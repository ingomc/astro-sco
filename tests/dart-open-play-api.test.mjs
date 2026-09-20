import assert from "node:assert/strict";
import test from "node:test";
import {
  DartOpenPlayError,
  getNextDartOpenPlaySlot,
  normalizeOpenPlayTime,
  validateRegistrationPayload,
} from "../directus/extensions/directus-extension-dart-open-play/dist/logic.js";

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
      notes: "  Bitte kurz Bescheid geben. ",
      privacyAccepted: true,
      website: "",
    }),
    {
      name: "Erika Muster",
      email: "erika@example.de",
      notes: "Bitte kurz Bescheid geben.",
    },
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
