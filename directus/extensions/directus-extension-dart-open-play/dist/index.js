import {
  createRegistrationId,
  DART_OPEN_PLAY_EVENT_ID,
  DART_OPEN_PLAY_EVENT_TITLE,
  DART_OPEN_PLAY_LOCATION,
  DartOpenPlayError,
  getNextDartOpenPlaySlot,
  normalizeOpenPlayTime,
  validateRegistrationPayload,
} from "./logic.js";

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 5;
const rateBuckets = new Map();

function isoNow() {
  return new Date().toISOString();
}

function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.ip || request.socket?.remoteAddress || "unknown";
}

function rateLimit(request) {
  const now = Date.now();
  const key = getClientIp(request);
  const recent = (rateBuckets.get(key) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) {
    throw new DartOpenPlayError(
      "RATE_LIMITED",
      "Zu viele Anfragen. Bitte versuche es in einigen Minuten erneut.",
      429,
    );
  }
  recent.push(now);
  rateBuckets.set(key, recent);
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function allowedOrigins(env) {
  const direct = parseOrigins(env.DART_OPEN_PLAY_ALLOWED_ORIGINS);
  if (direct.length > 0) return direct;

  const shared = parseOrigins(env.ORDER_ALLOWED_ORIGINS);
  if (shared.length > 0) return shared;

  const siteUrl = env.DART_OPEN_PLAY_SITE_URL || env.ORDER_SITE_URL;
  if (!siteUrl) return [];
  return [new URL(siteUrl).origin];
}

function assertAllowedOrigin(request, env, requireOrigin = false) {
  const origin = request.headers.origin;
  if (!origin) {
    if (requireOrigin) {
      throw new DartOpenPlayError("ORIGIN_NOT_ALLOWED", "Diese Anfrage ist nicht erlaubt.", 403);
    }
    return;
  }

  const origins = allowedOrigins(env);
  if (!origins.includes("*") && !origins.includes(origin)) {
    throw new DartOpenPlayError("ORIGIN_NOT_ALLOWED", "Diese Anfrage ist nicht erlaubt.", 403);
  }
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (!origin) return;
  response.set({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });
}

function asEnabled(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

async function openPlayConfiguration(database) {
  // Select all fields so deploying this endpoint before the schema addition
  // remains a safe, closed state instead of a database error.
  const settings = await database("settings").first();
  const enabled = asEnabled(settings?.dart_open_play_enabled);
  const time = normalizeOpenPlayTime(settings?.dart_open_play_time);
  return {
    enabled,
    slot: getNextDartOpenPlaySlot(new Date(), time),
  };
}

function publicConfiguration(configuration) {
  const message = configuration.enabled
    ? "Die Online-Anmeldung ist geöffnet."
    : "Die Online-Anmeldung ist für den nächsten Termin aktuell nicht geöffnet.";
  return {
    open: configuration.enabled,
    message,
    event: {
      id: DART_OPEN_PLAY_EVENT_ID,
      title: DART_OPEN_PLAY_EVENT_TITLE,
      location: DART_OPEN_PLAY_LOCATION,
    },
    slot: configuration.slot,
  };
}

function isRegistrationIdCollision(error) {
  const code = error && typeof error === "object" ? error.code : undefined;
  return code === "23505" || String(error?.message || "").toLowerCase().includes("duplicate");
}

async function createRegistration(database, input, configuration) {
  const slot = configuration.slot;
  const existing = await database("event_dart_registrations")
    .where({ event_id: DART_OPEN_PLAY_EVENT_ID, email: input.email, slot_at: slot.at })
    .first();
  if (existing) {
    throw new DartOpenPlayError(
      "ALREADY_REGISTERED",
      "Für diesen Sonntag liegt mit dieser E-Mail-Adresse bereits eine Anmeldung vor.",
      409,
    );
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const registrationId = createRegistrationId();
    const now = isoNow();
    try {
      await database("event_dart_registrations").insert({
        registration_id: registrationId,
        event_id: DART_OPEN_PLAY_EVENT_ID,
        event_title: DART_OPEN_PLAY_EVENT_TITLE,
        created_at: now,
        name: input.name,
        email: input.email,
        notes: input.notes || null,
        party_size: 1,
        slot_at: slot.at,
        slot_label: slot.label,
        privacy_accepted_at: now,
        status: "Neu",
        notes_done: false,
      });
      return registrationId;
    } catch (error) {
      if (isRegistrationIdCollision(error) && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not create a unique Dart registration id.");
}

function route(handler, context, requireOrigin = false) {
  return async (request, response) => {
    try {
      assertAllowedOrigin(request, context.env, requireOrigin);
      setCorsHeaders(request, response);
      await handler(request, response);
    } catch (error) {
      const known = error instanceof DartOpenPlayError;
      if (!known) context.logger.error({ err: error }, "Dart open play request failed");
      response.status(known ? error.status : 500).json({
        error: known ? error.code : "INTERNAL_ERROR",
        message: known
          ? error.message
          : "Die Anmeldung konnte gerade nicht verarbeitet werden.",
      });
    }
  };
}

export default {
  id: "dart-open-play",
  handler: (router, context) => {
    const { database } = context;

    router.options("/*", (request, response) => {
      try {
        assertAllowedOrigin(request, context.env);
        setCorsHeaders(request, response);
        response.sendStatus(204);
      } catch (error) {
        const known = error instanceof DartOpenPlayError;
        response.status(known ? error.status : 500).json({
          error: known ? error.code : "INTERNAL_ERROR",
          message: known ? error.message : "Die Anfrage konnte nicht verarbeitet werden.",
        });
      }
    });

    router.get("/", route(async (_request, response) => {
      const configuration = await openPlayConfiguration(database);
      response.set("Cache-Control", "no-store");
      response.json(publicConfiguration(configuration));
    }, context));

    router.post("/registrations", route(async (request, response) => {
      rateLimit(request);
      const configuration = await openPlayConfiguration(database);
      if (!configuration.enabled) {
        throw new DartOpenPlayError(
          "REGISTRATION_CLOSED",
          "Die Online-Anmeldung ist für den nächsten Termin aktuell nicht geöffnet.",
          410,
        );
      }

      const input = validateRegistrationPayload(request.body);
      const registrationId = await createRegistration(database, input, configuration);
      response.status(201).json({
        registrationId,
        message: "Danke, deine Anmeldung für das nächste Sonntagstraining ist eingegangen.",
      });
    }, context, true));
  },
};
