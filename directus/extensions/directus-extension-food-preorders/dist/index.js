import {
  FoodOrderError,
  createReservationNumber,
  createToken,
  ensureCapacity,
  ensureOrderingOpen,
  hashToken,
  validateDishSelection,
  validateReservationPayload,
} from "./logic.js";

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 5;
const rateBuckets = new Map();

function isoNow() {
  return new Date().toISOString();
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    throw new FoodOrderError(
      "RATE_LIMITED",
      "Zu viele Anfragen. Bitte versuche es in einigen Minuten erneut.",
      429,
    );
  }
  recent.push(now);
  rateBuckets.set(key, recent);
}

function allowedOrigins(env) {
  const configured = String(env.ORDER_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured.length > 0) return configured;
  if (!env.ORDER_SITE_URL) return [];
  return [new URL(env.ORDER_SITE_URL).origin];
}

function assertAllowedOrigin(request, env) {
  const origin = request.headers.origin;
  if (!origin) return;
  const origins = allowedOrigins(env);
  if (!origins.includes("*") && !origins.includes(origin)) {
    throw new FoodOrderError("ORIGIN_NOT_ALLOWED", "Diese Anfrage ist nicht erlaubt.", 403);
  }
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (!origin) return;
  response.set({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  });
}

function isTestMode(context) {
  return context.env?.ORDER_TEST_MODE === "true" || process.env.ORDER_TEST_MODE === "true";
}

function publicOrdering(order, dishes, confirmedQuantities) {
  const deadline = new Date(order.order_deadline);
  const closed = !order.active || Number.isNaN(deadline.getTime()) || deadline <= new Date();
  return {
    event: {
      slug: order.event_slug,
      title: order.event_title,
      eventDate: order.event_date,
    },
    orderDeadline: order.order_deadline,
    note: order.collection_note || undefined,
    closed,
    dishes: dishes.map((dish) => ({
      id: Number(dish.id),
      name: dish.name,
      description: dish.description || undefined,
      allergens: dish.allergens || undefined,
      priceCents: asNumber(dish.price_cents),
      remainingQuantity: Math.max(0, asNumber(dish.capacity) - asNumber(confirmedQuantities.get(Number(dish.id)))),
    })),
  };
}

async function findOrdering(database, slug) {
  return database("food_orderings as ordering")
    .join("veranstaltungen as event", "event.id", "ordering.event")
    .where("event.slug", slug)
    .select(
      "ordering.*",
      "event.slug as event_slug",
      "event.title as event_title",
      "event.event_date as event_date",
    )
    .first();
}

async function getDishes(database, orderingId, dishIds) {
  const query = database("food_dishes")
    .where({ ordering: orderingId, active: true })
    .orderBy("sort", "asc")
    .orderBy("id", "asc");
  if (dishIds) query.whereIn("id", dishIds);
  return query;
}

async function confirmedQuantities(database, orderingId, dishIds, excludeReservationId) {
  const query = database("food_reservation_lines")
    .select("dish")
    .sum({ quantity: "quantity" })
    .where({ ordering: orderingId, status: "confirmed" })
    .whereIn("dish", dishIds)
    .groupBy("dish");
  if (excludeReservationId) query.whereNot("reservation", excludeReservationId);
  const rows = await query;
  return new Map(rows.map((row) => [Number(row.dish), asNumber(row.quantity)]));
}

async function getOrderWithDishes(database, slug) {
  const ordering = await findOrdering(database, slug);
  if (!ordering || !ordering.active) {
    throw new FoodOrderError("NOT_AVAILABLE", "Für diese Veranstaltung ist keine Essensvorbestellung verfügbar.", 404);
  }
  const dishes = await getDishes(database, ordering.id);
  const quantities = await confirmedQuantities(
    database,
    ordering.id,
    dishes.map((dish) => dish.id),
  );
  return { ordering, dishes, quantities };
}

function confirmationLink(env, order, token) {
  const siteUrl = String(env.ORDER_SITE_URL || "").replace(/\/$/, "");
  if (!siteUrl) throw new Error("ORDER_SITE_URL is missing");
  const url = new URL(`${siteUrl}/veranstaltungen/${encodeURIComponent(order.event_slug)}`);
  url.searchParams.set("food-order-token", token);
  url.searchParams.set("food-order-confirm", "1");
  return url.toString();
}

function managementLink(env, order, token) {
  const siteUrl = String(env.ORDER_SITE_URL || "").replace(/\/$/, "");
  if (!siteUrl) throw new Error("ORDER_SITE_URL is missing");
  const url = new URL(`${siteUrl}/veranstaltungen/${encodeURIComponent(order.event_slug)}`);
  url.searchParams.set("food-order-token", token);
  return url.toString();
}

function lineList(lines) {
  return lines
    .map((line) => `<li>${htmlEscape(line.quantity)} × ${htmlEscape(line.dish_name)}</li>`)
    .join("");
}

async function sendEmail(context, message) {
  const { MailService } = context.services;
  if (!MailService) throw new Error("Directus MailService is unavailable");
  const mailService = new MailService({ schema: await context.getSchema() });
  await mailService.send(message);
}

async function sendConfirmationEmail(context, order, reservation, lines, token) {
  const link = confirmationLink(context.env, order, token);
  await sendEmail(context, {
    to: reservation.customer_email,
    subject: `Bitte bestätige deine Essensreservierung: ${order.event_title}`,
    html: `
      <p>Hallo ${htmlEscape(reservation.customer_name)},</p>
      <p>bitte bestätige deine Essensreservierung für <strong>${htmlEscape(order.event_title)}</strong>.</p>
      <ul>${lineList(lines)}</ul>
      <p><a href="${htmlEscape(link)}">Reservierung bestätigen</a></p>
      <p>Erst nach diesem Klick ist die Reservierung verbindlich. Die Bezahlung erfolgt bei der Abholung vor Ort.</p>
    `,
  });
}

async function sendManagementEmail(context, order, reservation, lines, token) {
  const link = managementLink(context.env, order, token);
  await sendEmail(context, {
    to: reservation.customer_email,
    subject: `Essensreservierung bestätigt: ${order.event_title}`,
    html: `
      <p>Hallo ${htmlEscape(reservation.customer_name)},</p>
      <p>deine Essensreservierung für <strong>${htmlEscape(order.event_title)}</strong> ist bestätigt.</p>
      <p>Reservierungsnummer: <strong>${htmlEscape(reservation.reservation_number)}</strong></p>
      <ul>${lineList(lines)}</ul>
      <p>Bezahlung bei Abholung vor Ort.</p>
      <p>Bis zum Bestellschluss kannst du die Reservierung hier <a href="${htmlEscape(link)}">ändern oder stornieren</a>.</p>
    `,
  });
}

async function sendCancellationEmail(context, order, reservation) {
  await sendEmail(context, {
    to: reservation.customer_email,
    subject: `Essensreservierung storniert: ${order.event_title}`,
    html: `<p>Hallo ${htmlEscape(reservation.customer_name)},</p><p>deine Essensreservierung ${htmlEscape(reservation.reservation_number)} für ${htmlEscape(order.event_title)} wurde storniert.</p>`,
  });
}

async function createLines(database, reservation, selectedItems, status) {
  const createdAt = isoNow();
  const rows = selectedItems.map(({ dish, quantity }) => ({
    reservation: reservation.id,
    ordering: reservation.ordering,
    dish: dish.id,
    reservation_number: reservation.reservation_number,
    status,
    customer_name: reservation.customer_name,
    customer_email: reservation.customer_email,
    dish_name: dish.name,
    unit_price_cents: asNumber(dish.price_cents),
    quantity,
    date_created: createdAt,
  }));
  await database("food_reservation_lines").insert(rows);
  return rows;
}

async function reservationLines(database, reservationId) {
  return database("food_reservation_lines")
    .where({ reservation: reservationId })
    .orderBy("id", "asc");
}

async function lockedDishes(database, orderingId, itemIds) {
  return database("food_dishes")
    .where({ ordering: orderingId, active: true })
    .whereIn("id", itemIds)
    .orderBy("id", "asc")
    .forUpdate();
}

async function reservationForManagement(database, token, lock = false) {
  const query = database("food_reservations")
    .where({ management_token_hash: hashToken(token) })
  if (lock) query.forUpdate();
  return query.first();
}

function serializeReservation(reservation, lines, ordering) {
  return {
    reservationNumber: reservation.reservation_number,
    status: reservation.status,
    name: reservation.customer_name,
    email: reservation.customer_email,
    orderDeadline: ordering.order_deadline,
    lines: lines.map((line) => ({
      dishId: Number(line.dish),
      dishName: line.dish_name,
      quantity: asNumber(line.quantity),
      unitPriceCents: asNumber(line.unit_price_cents),
    })),
  };
}

function route(handler, context) {
  return async (request, response) => {
    try {
      assertAllowedOrigin(request, context.env);
      setCorsHeaders(request, response);
      await handler(request, response);
    } catch (error) {
      const known = error instanceof FoodOrderError;
      if (!known) context.logger.error({ err: error }, "Food preorder request failed");
      response.status(known ? error.status : 500).json({
        error: known ? error.code : "INTERNAL_ERROR",
        message: known ? error.message : "Die Reservierung konnte gerade nicht verarbeitet werden.",
      });
    }
  };
}

export default {
  id: "food-preorders",
  handler: (router, context) => {
    const { database } = context;

    router.options("/*", (request, response) => {
      try {
        assertAllowedOrigin(request, context.env);
        setCorsHeaders(request, response);
        response.sendStatus(204);
      } catch (error) {
        const known = error instanceof FoodOrderError;
        response.status(known ? error.status : 500).json({
          error: known ? error.code : "INTERNAL_ERROR",
          message: known ? error.message : "Die Anfrage konnte nicht verarbeitet werden.",
        });
      }
    });

    router.get("/events/:slug", route(async (request, response) => {
      const { ordering, dishes, quantities } = await getOrderWithDishes(database, request.params.slug);
      response.set("Cache-Control", "no-store");
      response.json(publicOrdering(ordering, dishes, quantities));
    }, context));

    router.post("/events/:slug/reservations", route(async (request, response) => {
      rateLimit(request);
      const input = validateReservationPayload(request.body);
      const result = await database.transaction(async (transaction) => {
        const ordering = await findOrdering(transaction, request.params.slug);
        ensureOrderingOpen(ordering);
        const dishes = await lockedDishes(transaction, ordering.id, input.items.map((item) => item.dishId));
        const selectedItems = validateDishSelection(dishes, input.items);
        const confirmationToken = createToken();
        const createdAt = isoNow();
        const [reservation] = await transaction("food_reservations")
          .insert({
            ordering: ordering.id,
            reservation_number: createReservationNumber(),
            status: "pending_confirmation",
            customer_name: input.name,
            customer_email: input.email,
            confirmation_token_hash: hashToken(confirmationToken),
            date_created: createdAt,
            date_updated: createdAt,
          })
          .returning("*");
        const lines = await createLines(transaction, reservation, selectedItems, "pending_confirmation");
        return { ordering, reservation, lines, confirmationToken };
      });

      if (isTestMode(context)) {
        response.status(201).json({
          message: "Testmodus: Deine Reservierung wird jetzt bestätigt.",
          testConfirmationToken: result.confirmationToken,
        });
        return;
      }

      await sendConfirmationEmail(context, result.ordering, result.reservation, result.lines, result.confirmationToken);
      response.status(201).json({ message: "Bitte bestätige deine Reservierung über den Link in der E-Mail." });
    }, context));

    router.post("/reservations/confirm/:token", route(async (request, response) => {
      rateLimit(request);
      const result = await database.transaction(async (transaction) => {
        const reservation = await transaction("food_reservations")
          .where({ confirmation_token_hash: hashToken(request.params.token) })
          .forUpdate()
          .first();
        if (!reservation || reservation.status !== "pending_confirmation") {
          throw new FoodOrderError("INVALID_TOKEN", "Dieser Bestätigungslink ist nicht mehr gültig.", 404);
        }
        const ordering = await transaction("food_orderings as ordering")
          .join("veranstaltungen as event", "event.id", "ordering.event")
          .where("ordering.id", reservation.ordering)
          .select("ordering.*", "event.slug as event_slug", "event.title as event_title", "event.event_date as event_date")
          .first();
        ensureOrderingOpen(ordering);
        const lines = await reservationLines(transaction, reservation.id);
        const dishes = await lockedDishes(transaction, ordering.id, lines.map((line) => line.dish));
        const selectedItems = validateDishSelection(
          dishes,
          lines.map((line) => ({ dishId: Number(line.dish), quantity: asNumber(line.quantity) })),
        );
        const quantities = await confirmedQuantities(
          transaction,
          ordering.id,
          selectedItems.map(({ dish }) => dish.id),
          reservation.id,
        );
        ensureCapacity(selectedItems, quantities);
        const managementToken = createToken();
        const now = isoNow();
        const [confirmedReservation] = await transaction("food_reservations")
          .where({ id: reservation.id })
          .update({
            status: "confirmed",
            confirmation_token_hash: null,
            management_token_hash: hashToken(managementToken),
            confirmed_at: now,
            date_updated: now,
          })
          .returning("*");
        await transaction("food_reservation_lines")
          .where({ reservation: reservation.id })
          .update({ status: "confirmed" });
        return { ordering, reservation: confirmedReservation, lines, managementToken };
      });

      if (!isTestMode(context)) {
        await sendManagementEmail(context, result.ordering, result.reservation, result.lines, result.managementToken);
      }
      response.json({
        message: "Deine Reservierung ist bestätigt.",
        managementToken: result.managementToken,
      });
    }, context));

    router.get("/reservations/:token", route(async (request, response) => {
      const reservation = await reservationForManagement(database, request.params.token);
      if (!reservation || reservation.status !== "confirmed") {
        throw new FoodOrderError("INVALID_TOKEN", "Dieser Verwaltungslink ist nicht mehr gültig.", 404);
      }
      const ordering = await database("food_orderings as ordering")
        .join("veranstaltungen as event", "event.id", "ordering.event")
        .where("ordering.id", reservation.ordering)
        .select("ordering.*", "event.slug as event_slug", "event.title as event_title", "event.event_date as event_date")
        .first();
      const lines = await reservationLines(database, reservation.id);
      const dishes = await getDishes(database, ordering.id);
      const quantities = await confirmedQuantities(database, ordering.id, dishes.map((dish) => dish.id));
      response.set("Cache-Control", "no-store");
      response.json({
        ordering: publicOrdering(ordering, dishes, quantities),
        reservation: serializeReservation(reservation, lines, ordering),
      });
    }, context));

    router.patch("/reservations/:token", route(async (request, response) => {
      rateLimit(request);
      const input = validateReservationPayload(request.body);
      const result = await database.transaction(async (transaction) => {
        const reservation = await reservationForManagement(transaction, request.params.token, true);
        if (!reservation || reservation.status !== "confirmed") {
          throw new FoodOrderError("INVALID_TOKEN", "Dieser Verwaltungslink ist nicht mehr gültig.", 404);
        }
        const ordering = await transaction("food_orderings as ordering")
          .join("veranstaltungen as event", "event.id", "ordering.event")
          .where("ordering.id", reservation.ordering)
          .select("ordering.*", "event.slug as event_slug", "event.title as event_title", "event.event_date as event_date")
          .forUpdate()
          .first();
        ensureOrderingOpen(ordering);
        const dishes = await lockedDishes(transaction, ordering.id, input.items.map((item) => item.dishId));
        const selectedItems = validateDishSelection(dishes, input.items);
        const quantities = await confirmedQuantities(
          transaction,
          ordering.id,
          selectedItems.map(({ dish }) => dish.id),
          reservation.id,
        );
        ensureCapacity(selectedItems, quantities);

        const emailChanged = reservation.customer_email !== input.email;
        const now = isoNow();
        const confirmationToken = emailChanged ? createToken() : null;
        const status = emailChanged ? "pending_confirmation" : "confirmed";
        const [updatedReservation] = await transaction("food_reservations")
          .where({ id: reservation.id })
          .update({
            customer_name: input.name,
            customer_email: input.email,
            status,
            confirmation_token_hash: confirmationToken ? hashToken(confirmationToken) : null,
            management_token_hash: emailChanged ? null : reservation.management_token_hash,
            confirmed_at: emailChanged ? null : reservation.confirmed_at,
            date_updated: now,
          })
          .returning("*");
        await transaction("food_reservation_lines").where({ reservation: reservation.id }).del();
        const lines = await createLines(transaction, updatedReservation, selectedItems, status);
        return { ordering, reservation: updatedReservation, lines, confirmationToken, emailChanged };
      });

      if (result.emailChanged && !isTestMode(context)) {
        await sendConfirmationEmail(context, result.ordering, result.reservation, result.lines, result.confirmationToken);
      }
      response.json({
        message: result.emailChanged
          ? "Bitte bestätige die neue E-Mail-Adresse über den zugesandten Link."
          : "Deine Reservierung wurde aktualisiert.",
        requiresConfirmation: result.emailChanged,
        ...(result.emailChanged && isTestMode(context)
          ? { testConfirmationToken: result.confirmationToken }
          : {}),
      });
    }, context));

    router.delete("/reservations/:token", route(async (request, response) => {
      rateLimit(request);
      const result = await database.transaction(async (transaction) => {
        const reservation = await reservationForManagement(transaction, request.params.token, true);
        if (!reservation || reservation.status !== "confirmed") {
          throw new FoodOrderError("INVALID_TOKEN", "Dieser Verwaltungslink ist nicht mehr gültig.", 404);
        }
        const ordering = await transaction("food_orderings as ordering")
          .join("veranstaltungen as event", "event.id", "ordering.event")
          .where("ordering.id", reservation.ordering)
          .select("ordering.*", "event.slug as event_slug", "event.title as event_title", "event.event_date as event_date")
          .first();
        ensureOrderingOpen(ordering);
        const now = isoNow();
        const [cancelledReservation] = await transaction("food_reservations")
          .where({ id: reservation.id })
          .update({
            status: "cancelled",
            management_token_hash: null,
            cancelled_at: now,
            date_updated: now,
          })
          .returning("*");
        await transaction("food_reservation_lines")
          .where({ reservation: reservation.id })
          .update({ status: "cancelled" });
        return { ordering, reservation: cancelledReservation };
      });
      if (!isTestMode(context)) {
        await sendCancellationEmail(context, result.ordering, result.reservation);
      }
      response.json({ message: "Deine Reservierung wurde storniert." });
    }, context));
  },
};
