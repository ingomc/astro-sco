import type { APIRoute } from "astro";
import {
  createIpFingerprint,
  enforceSignupRateLimit,
  getClientIp,
  mapSecurityErrorToResponse,
  securityLog,
  verifyHCaptcha,
} from "../../lib/abuse-protection";
import { getEventSignupConfig } from "../../lib/event-signup-config";
import {
  countEventReservedSeats,
  saveEventSignup,
} from "../../lib/event-signup-db";
import {
  EventSignupValidationError,
  createRegistrationId,
  isSignupOpen,
  parseEventSignupInput,
  type EventRegistration,
  type EventSignupInput,
} from "../../lib/event-signups";

export const prerender = false;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function isRegistrationIdCollision(error: unknown): boolean {
  if (error && typeof error === "object") {
    const errorWithCode = error as { code?: string; message?: string };
    return (
      errorWithCode.code === "23505" ||
      errorWithCode.message?.toLowerCase().includes("duplicate key") === true
    );
  }

  return false;
}

function getServerErrorMessage(): string {
  const metaDatabaseUrl = (import.meta.env as Record<string, unknown>)[
    "DATABASE_URL"
  ];
  const hasDatabaseUrl =
    Boolean(process.env.DATABASE_URL) || typeof metaDatabaseUrl === "string";

  if (import.meta.env.DEV && !hasDatabaseUrl) {
    return "Die Anmeldung konnte lokal nicht gespeichert werden, weil DATABASE_URL fehlt.";
  }

  return import.meta.env.DEV
    ? "Die Anmeldung konnte lokal nicht gespeichert werden. Bitte prüfen Sie den Serverlog."
    : "Die Anmeldung konnte gerade nicht gespeichert werden. Bitte versuchen Sie es nochmal.";
}

export const POST: APIRoute = async ({ request }) => {
  let payload: EventSignupInput;
  const clientIp = getClientIp(request);
  const ipFingerprint = await createIpFingerprint(clientIp);

  try {
    payload = (await request.json()) as EventSignupInput;
  } catch {
    return jsonResponse(
      { ok: false, message: "Die Anmeldung konnte nicht gelesen werden." },
      400,
    );
  }

  const eventId = typeof payload.eventId === "string" ? payload.eventId : "";
  const signupConfig = eventId
    ? await getEventSignupConfig(eventId)
    : undefined;

  if (!signupConfig) {
    return jsonResponse(
      { ok: false, message: "Diese Veranstaltung nimmt keine Anmeldungen an." },
      404,
    );
  }

  if (!isSignupOpen(signupConfig)) {
    return jsonResponse(
      { ok: false, message: "Die Anmeldung ist bereits geschlossen." },
      400,
    );
  }

  try {
    try {
      await enforceSignupRateLimit(clientIp, signupConfig.eventId);
      await verifyHCaptcha(payload.hcaptchaToken, clientIp);
    } catch (securityError) {
      const mapped = mapSecurityErrorToResponse(securityError);
      if (mapped) {
        if (mapped.type) {
          securityLog(mapped.type, {
            eventId: signupConfig.eventId,
            clientIp,
          });
        }
        return jsonResponse({ ok: false, message: mapped.message }, mapped.status);
      }
      throw securityError;
    }

    const parsed = parseEventSignupInput(payload, signupConfig);

    if (parsed.isSpam) {
      securityLog("honeypot_hit", {
        eventId: signupConfig.eventId,
        clientIp,
      });
      return jsonResponse({ ok: true });
    }

    if (signupConfig.capacity) {
      const reservedSeats = await countEventReservedSeats(signupConfig.eventId);

      if (reservedSeats + parsed.partySize > signupConfig.capacity) {
        return jsonResponse(
          {
            ok: false,
            message:
              "Für diese Veranstaltung sind leider keine Plätze mehr frei.",
          },
          400,
        );
      }
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = createRegistrationId();
      const registration: EventRegistration = {
        id,
        eventId: signupConfig.eventId,
        createdAt: new Date().toISOString(),
        name: parsed.name,
        email: parsed.email,
        ipFingerprint,
        privacyAcceptedAt: new Date().toISOString(),
        slotAt: parsed.slotAt,
        slotLabel: parsed.slotLabel,
        notes: parsed.notes,
        notesDone: false,
        kind: signupConfig.mode,
        partySize: parsed.partySize,
        totalItems: parsed.totalItems,
      };

      try {
        await saveEventSignup(registration, parsed.items);
        return jsonResponse({ ok: true, id });
      } catch (error) {
        if (isRegistrationIdCollision(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new Error("Could not create a unique event signup id.");
  } catch (error) {
    if (error instanceof EventSignupValidationError) {
      return jsonResponse({ ok: false, message: error.message }, 400);
    }

    console.error("Event signup failed", error);
    return jsonResponse(
      {
        ok: false,
        message: getServerErrorMessage(),
      },
      500,
    );
  }
};

export const GET: APIRoute = () =>
  jsonResponse({ ok: false, message: "Method not allowed" }, 405);
