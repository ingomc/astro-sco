import assert from "node:assert/strict";
import test from "node:test";
import {
  FoodOrderError,
  ensureCapacity,
  ensureOrderingOpen,
  hashToken,
  validateReservationPayload,
} from "../directus/extensions/directus-extension-food-preorders/dist/logic.js";

test("aggregiert doppelt ausgewählte Gerichte und normalisiert Kontaktdaten", () => {
  const reservation = validateReservationPayload({
    name: "  Erika Muster  ",
    email: "ERIKA@EXAMPLE.DE ",
    privacyAccepted: true,
    website: "",
    items: [
      { dishId: 3, quantity: 1 },
      { dishId: 3, quantity: 2 },
      { dishId: 8, quantity: 1 },
    ],
  });

  assert.deepEqual(reservation, {
    name: "Erika Muster",
    email: "erika@example.de",
    items: [
      { dishId: 3, quantity: 3 },
      { dishId: 8, quantity: 1 },
    ],
  });
});

test("lehnt fehlende Datenschutzzustimmung und Honeypot-Einträge ab", () => {
  assert.throws(
    () =>
      validateReservationPayload({
        name: "Erika Muster",
        email: "e@example.de",
        items: [{ dishId: 1, quantity: 1 }],
      }),
    (error) =>
      error instanceof FoodOrderError && error.code === "PRIVACY_REQUIRED",
  );
  assert.throws(
    () =>
      validateReservationPayload({
        name: "Erika Muster",
        email: "e@example.de",
        privacyAccepted: true,
        website: "https://spam.example",
        items: [{ dishId: 1, quantity: 1 }],
      }),
    (error) =>
      error instanceof FoodOrderError && error.code === "INVALID_REQUEST",
  );
});

test("berücksichtigt bestätigte Mengen beim Kontingent", () => {
  const dish = { id: 1, name: "Kerwabraten", active: true, capacity: 10 };
  ensureCapacity([{ dish, quantity: 3 }], new Map([[1, 7]]));
  assert.throws(
    () => ensureCapacity([{ dish, quantity: 4 }], new Map([[1, 7]])),
    (error) =>
      error instanceof FoodOrderError && error.code === "DISH_SOLD_OUT",
  );
});

test("schließt Bestellungen nach dem Stichtag und speichert keine Klartext-Tokens", () => {
  assert.throws(
    () =>
      ensureOrderingOpen(
        { active: true, order_deadline: "2026-01-01T00:00:00.000Z" },
        new Date("2026-01-02T00:00:00.000Z"),
      ),
    (error) =>
      error instanceof FoodOrderError && error.code === "ORDERING_CLOSED",
  );
  assert.equal(
    hashToken("geheimer-link"),
    "578ffb401c8662faea767a51170acfd90f5f5e8bf5079a616b0858e87291dcad",
  );
});
