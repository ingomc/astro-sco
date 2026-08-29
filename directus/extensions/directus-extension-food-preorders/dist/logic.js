import { createHash, randomBytes } from "node:crypto";

export class FoodOrderError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createToken() {
  return randomBytes(32).toString("base64url");
}

export function createReservationNumber() {
  return `E${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function validateReservationPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new FoodOrderError("INVALID_REQUEST", "Ungültige Bestelldaten.");
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const website = typeof payload.website === "string" ? payload.website.trim() : "";

  if (website) {
    throw new FoodOrderError("INVALID_REQUEST", "Die Reservierung konnte nicht verarbeitet werden.");
  }
  if (name.length < 2 || name.length > 120) {
    throw new FoodOrderError("INVALID_NAME", "Bitte gib einen Namen mit 2 bis 120 Zeichen an.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new FoodOrderError("INVALID_EMAIL", "Bitte gib eine gültige E-Mail-Adresse an.");
  }
  if (payload.privacyAccepted !== true) {
    throw new FoodOrderError("PRIVACY_REQUIRED", "Bitte bestätige den Datenschutzhinweis.");
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 20) {
    throw new FoodOrderError("INVALID_ITEMS", "Bitte wähle mindestens ein Gericht aus.");
  }

  const quantities = new Map();
  for (const item of payload.items) {
    const dishId = Number(item?.dishId);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(dishId) || dishId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      throw new FoodOrderError("INVALID_ITEMS", "Die ausgewählten Mengen sind ungültig.");
    }
    quantities.set(dishId, (quantities.get(dishId) || 0) + quantity);
  }

  if ([...quantities.values()].some((quantity) => quantity > 50)) {
    throw new FoodOrderError("INVALID_ITEMS", "Pro Gericht sind höchstens 50 Portionen möglich.");
  }

  return {
    name,
    email,
    items: [...quantities.entries()]
      .map(([dishId, quantity]) => ({ dishId, quantity }))
      .sort((a, b) => a.dishId - b.dishId),
  };
}

export function ensureOrderingOpen(ordering, now = new Date()) {
  if (!ordering || !ordering.active) {
    throw new FoodOrderError("NOT_AVAILABLE", "Für diese Veranstaltung ist keine Essensvorbestellung verfügbar.", 404);
  }
  const deadline = new Date(ordering.order_deadline);
  if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= now.getTime()) {
    throw new FoodOrderError("ORDERING_CLOSED", "Der Bestellschluss für diese Veranstaltung ist bereits erreicht.", 410);
  }
}

export function validateDishSelection(dishes, items) {
  const dishesById = new Map(dishes.map((dish) => [Number(dish.id), dish]));
  const selected = items.map((item) => ({ ...item, dish: dishesById.get(item.dishId) }));
  if (selected.some((item) => !item.dish || !item.dish.active)) {
    throw new FoodOrderError("DISH_UNAVAILABLE", "Ein ausgewähltes Gericht ist nicht mehr verfügbar.", 409);
  }
  return selected;
}

export function ensureCapacity(selectedItems, confirmedQuantities) {
  for (const { dish, quantity } of selectedItems) {
    const confirmed = Number(confirmedQuantities.get(Number(dish.id)) || 0);
    const capacity = Number(dish.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || confirmed + quantity > capacity) {
      throw new FoodOrderError(
        "DISH_SOLD_OUT",
        `Für „${dish.name}“ ist die gewünschte Menge leider nicht mehr verfügbar.`,
        409,
      );
    }
  }
}
