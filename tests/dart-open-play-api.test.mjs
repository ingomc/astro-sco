import assert from "node:assert/strict";
import test from "node:test";
import {
  DartOpenPlayError,
  formatRegistrationNotification,
  getNextDartOpenPlaySlot,
  normalizeOpenPlayTime,
  publishRegistrationNotification,
  validateRegistrationPayload,
} from "../directus/extensions/directus-extension-dart-open-play/dist/logic.js";
import dartEndpoint, {
  createRegistration,
} from "../directus/extensions/directus-extension-dart-open-play/dist/index.js";

test("ermittelt den nächsten Sonntag in Berliner Zeit und überspringt ein bereits begonnenes Training", () => {
  const saturday = getNextDartOpenPlaySlot(
    new Date("2026-09-19T12:00:00.000Z"),
    "18:00",
  );
  assert.deepEqual(saturday, {
    at: "2026-09-20T16:00:00.000Z",
    label: "Sonntag, 20.09.2026, 18:00 Uhr",
    time: "18:00",
  });

  const afterStart = getNextDartOpenPlaySlot(
    new Date("2026-09-20T16:01:00.000Z"),
    "18:00",
  );
  assert.equal(afterStart.at, "2026-09-27T16:00:00.000Z");
  assert.equal(afterStart.label, "Sonntag, 27.09.2026, 18:00 Uhr");
});

test("berücksichtigt die Zeitumstellung im Herbst", () => {
  const slot = getNextDartOpenPlaySlot(
    new Date("2026-10-25T17:01:00.000Z"),
    "18:00",
  );
  assert.equal(slot.at, "2026-11-01T17:00:00.000Z");
  assert.equal(slot.label, "Sonntag, 01.11.2026, 18:00 Uhr");
});

test("normalisiert Kontaktdaten und lässt optionale Hinweise zu", () => {
  assert.deepEqual(
    validateRegistrationPayload({
      name: "  Erika Muster  ",
      email: "ERIKA@EXAMPLE.DE ",
      phone: " +49 (171) 123-4567 ",
      notes: "  Bitte kurz Bescheid geben. ",
      privacyAccepted: true,
      website: "",
    }),
    {
      name: "Erika Muster",
      email: "erika@example.de",
      phone: "+491711234567",
      notes: "Bitte kurz Bescheid geben.",
    },
  );
});

test("erlaubt Handy oder E-Mail allein und verlangt mindestens einen Kontaktweg", () => {
  assert.deepEqual(
    validateRegistrationPayload({
      name: "Erika Muster",
      phone: "0171 1234567",
      privacyAccepted: true,
    }),
    { name: "Erika Muster", phone: "01711234567", email: null, notes: "" },
  );
  assert.deepEqual(
    validateRegistrationPayload({
      name: "Erika Muster",
      email: "erika@example.de",
      privacyAccepted: true,
    }),
    { name: "Erika Muster", phone: null, email: "erika@example.de", notes: "" },
  );
  assert.throws(
    () =>
      validateRegistrationPayload({
        name: "Erika Muster",
        privacyAccepted: true,
      }),
    (error) =>
      error instanceof DartOpenPlayError && error.code === "CONTACT_REQUIRED",
  );
  assert.throws(
    () =>
      validateRegistrationPayload({
        name: "Erika Muster",
        phone: "abc",
        privacyAccepted: true,
      }),
    (error) =>
      error instanceof DartOpenPlayError && error.code === "INVALID_PHONE",
  );
});

test("speichert Handy-only ohne E-Mail und verhindert eine doppelte Handy-Anmeldung", async () => {
  const rows = [];
  const database = (collection) => {
    assert.equal(collection, "event_dart_registrations");
    return {
      where(criteria) {
        return {
          first: async () =>
            rows.find((row) =>
              Object.entries(criteria).every(
                ([key, value]) => row[key] === value,
              ),
            ),
        };
      },
      async insert(row) {
        rows.push(row);
      },
    };
  };
  const input = validateRegistrationPayload({
    name: "Erika Muster",
    phone: "0171 1234567",
    privacyAccepted: true,
  });
  const configuration = {
    slot: {
      at: "2026-09-27T16:00:00.000Z",
      label: "Sonntag, 27.09.2026, 18:00 Uhr",
    },
  };
  const id = await createRegistration(database, input, configuration);
  assert.match(id, /^D[A-F0-9]{8}$/);
  assert.equal(rows[0].email, null);
  assert.equal(rows[0].phone, "01711234567");
  assert.equal(rows[0].status, "new");
  await assert.rejects(
    createRegistration(database, input, configuration),
    (error) =>
      error instanceof DartOpenPlayError && error.code === "ALREADY_REGISTERED",
  );
});

test("sendet nach Anmeldung eine ntfy-Nachricht mit Termin und Kontaktdaten", async () => {
  const calls = [];
  const send = async (...args) => {
    calls.push(args);
    return { ok: true, status: 200 };
  };
  const slot = { label: "Sonntag, 27.09.2026, 18:00 Uhr" };
  const input = {
    name: "Erika Muster",
    phone: "01711234567",
    email: "erika@example.de",
    notes: "Bitte kurz anrufen.",
  };

  const sent = await publishRegistrationNotification(
    send,
    {
      DART_OPEN_PLAY_NTFY_URL: "https://ntfy.example.test/dart-anmeldungen",
      DART_OPEN_PLAY_NTFY_TOKEN: "test-token",
    },
    input,
    slot,
    "DTEST2026",
  );

  assert.equal(sent, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://ntfy.example.test/dart-anmeldungen");
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].headers.Authorization, "Bearer test-token");
  assert.equal(calls[0][1].headers.Title, "Neue Dart-Anmeldung");
  assert.match(calls[0][1].body, /Handy: 01711234567/);
  assert.match(calls[0][1].body, /E-Mail: erika@example\.de/);
  assert.match(calls[0][1].body, /Hinweis: Bitte kurz anrufen\./);
  assert.match(calls[0][1].body, /Anmeldenummer: DTEST2026/);
  assert.match(calls[0][1].body, /Sonntag, 27\.09\.2026, 18:00 Uhr/);
});

test("ntfy ist optional und meldet Zustellfehler ohne Anmeldedaten im Fehler", async () => {
  const input = {
    name: "Erika Muster",
    phone: "01711234567",
    email: null,
    notes: "",
  };
  const slot = { label: "Sonntag, 27.09.2026, 18:00 Uhr" };
  assert.equal(
    await publishRegistrationNotification(
      () => {
        throw new Error("should not be called");
      },
      {},
      input,
      slot,
      "DTEST2026",
    ),
    false,
  );
  await assert.rejects(
    publishRegistrationNotification(
      async () => ({ ok: false, status: 503 }),
      { DART_OPEN_PLAY_NTFY_URL: "https://ntfy.example.test/private-topic" },
      input,
      slot,
      "DTEST2026",
    ),
    (error) => error.message === "ntfy HTTP 503",
  );
  await assert.rejects(
    publishRegistrationNotification(
      async () => ({ ok: true }),
      { DART_OPEN_PLAY_NTFY_URL: "http://ntfy.example.test/private-topic" },
      input,
      slot,
      "DTEST2026",
    ),
    (error) => error.message === "Invalid ntfy URL configuration",
  );
  const message = formatRegistrationNotification(
    { ...input, notes: "😀".repeat(501) },
    slot,
    "DTEST2026",
  );
  assert.equal((message.match(/😀/gu) || []).length, 500);
  assert.match(message, /vollständig in Directus/);
});

test("ntfy-Ausfall lässt eine gespeicherte Anmeldung erfolgreich und protokolliert keine Kontaktdaten", async (t) => {
  const routes = {};
  const rows = [];
  const warnings = [];
  const router = {
    get(path, handler) {
      routes[`GET ${path}`] = handler;
    },
    post(path, handler) {
      routes[`POST ${path}`] = handler;
    },
    options(path, handler) {
      routes[`OPTIONS ${path}`] = handler;
    },
  };
  const database = (collection) => {
    if (collection === "settings") {
      return {
        first: async () => ({
          dart_open_play_enabled: true,
          dart_open_play_time: "18:00",
        }),
      };
    }
    assert.equal(collection, "event_dart_registrations");
    return {
      where(criteria) {
        return {
          first: async () =>
            rows.find((row) =>
              Object.entries(criteria).every(
                ([key, value]) => row[key] === value,
              ),
            ),
        };
      },
      async insert(row) {
        rows.push(row);
      },
    };
  };
  dartEndpoint.handler(router, {
    database,
    env: {
      DART_OPEN_PLAY_ALLOWED_ORIGINS: "https://preview.example.test",
      DART_OPEN_PLAY_NTFY_URL: "https://ntfy.example.test/private-topic",
    },
    logger: {
      warn(...args) {
        warnings.push(args);
      },
      error() {
        throw new Error("Unexpected endpoint error");
      },
    },
  });
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 503 }));
  const response = {
    code: 200,
    set() {
      return this;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const configurationResponse = {
    set() {
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await routes["GET /"]({ headers: {} }, configurationResponse);
  assert.equal(configurationResponse.body.notificationsEnabled, true);
  await routes["POST /registrations"](
    {
      headers: { origin: "https://preview.example.test" },
      ip: "test-ntfy-outage",
      body: {
        name: "Erika Muster",
        phone: "0171 1234567",
        privacyAccepted: true,
      },
    },
    response,
  );
  assert.equal(response.code, 201);
  assert.match(response.body.registrationId, /^D[A-F0-9]{8}$/);
  assert.equal(rows.length, 1);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0].registrationId, response.body.registrationId);
  assert.doesNotMatch(
    JSON.stringify(warnings),
    /Erika|01711234567|private-topic/,
  );
});

test("blockiert Honeypot, fehlenden Datenschutz und ungültige Uhrzeiten", () => {
  assert.throws(
    () =>
      validateRegistrationPayload({
        name: "Erika Muster",
        email: "e@example.de",
        privacyAccepted: true,
        website: "https://spam.example",
      }),
    (error) =>
      error instanceof DartOpenPlayError && error.code === "INVALID_REQUEST",
  );
  assert.throws(
    () =>
      validateRegistrationPayload({
        name: "Erika Muster",
        email: "e@example.de",
        website: "",
      }),
    (error) =>
      error instanceof DartOpenPlayError && error.code === "PRIVACY_REQUIRED",
  );
  assert.equal(normalizeOpenPlayTime("17:30"), "17:30");
  assert.equal(normalizeOpenPlayTime("morgen"), "18:00");
});
