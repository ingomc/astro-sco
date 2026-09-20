import assert from "node:assert/strict";
import test from "node:test";
import {
  DartOpenPlayError,
  getNextDartOpenPlaySlot,
  normalizeOpenPlayTime,
  validateRegistrationPayload,
} from "../directus/extensions/directus-extension-dart-open-play/dist/logic.js";
import { createRegistration } from "../directus/extensions/directus-extension-dart-open-play/dist/index.js";

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
