import { directusRequest, getDirectusBaseUrl } from "./client.mjs";

const applyChanges = process.argv.includes("--apply");
const EVENT_SLUG = "2026-10-17-spintessen";

const orderingPayload = {
  title: "Spintessen 2026 – Essensvorbestellung",
  active: true,
  // The flyer says "bis zum 10.10.2026" without a time. We keep ordering
  // open through the end of that day in Berlin (CEST = UTC+2).
  order_deadline: "2026-10-10T21:59:00.000Z",
  collection_note:
    "Vorbestellung bis einschließlich Samstag, 10. Oktober 2026. Bezahlt wird bei der Abholung im Sportheim.",
};

const dishes = [
  {
    sort: 1,
    active: true,
    name: "Spint mit Sauerkraut",
    // No prices or quotas appear on the flyer. Zero has the documented
    // semantics of price on pickup / no online quota.
    price_cents: 0,
    capacity: 0,
  },
  {
    sort: 2,
    active: true,
    name: "Kopfspint mit Sauerkraut",
    price_cents: 0,
    capacity: 0,
  },
];

async function findEvent() {
  const events = await directusRequest("/items/veranstaltungen", {
    query: {
      fields: ["id", "slug", "title"],
      filter: { slug: { _eq: EVENT_SLUG } },
      limit: 1,
    },
  });

  if (!Array.isArray(events) || events.length !== 1) {
    throw new Error(`Event '${EVENT_SLUG}' was not found in Directus.`);
  }

  return events[0];
}

async function findOrdering(eventId) {
  const orderings = await directusRequest("/items/food_orderings", {
    query: {
      fields: ["id", "title", "active", "order_deadline"],
      filter: { event: { _eq: eventId } },
      limit: 1,
    },
  });

  return Array.isArray(orderings) ? orderings[0] : undefined;
}

async function findDishes(orderingId) {
  const existing = await directusRequest("/items/food_dishes", {
    query: {
      fields: ["id", "name"],
      filter: { ordering: { _eq: orderingId } },
      limit: 100,
    },
  });

  return new Map(
    (Array.isArray(existing) ? existing : []).map((dish) => [dish.name, dish]),
  );
}

async function main() {
  console.log(`Preparing Spintessen ordering at ${getDirectusBaseUrl()}`);
  console.log(`Mode: ${applyChanges ? "apply" : "dry-run"}`);

  const event = await findEvent();
  let ordering = await findOrdering(event.id);

  if (!ordering) {
    console.log(`- create ordering for ${event.title}`);
    if (applyChanges) {
      ordering = await directusRequest("/items/food_orderings", {
        method: "POST",
        body: { ...orderingPayload, event: event.id },
      });
    }
  } else {
    console.log(`- keep existing ordering: ${ordering.title}`);
  }

  if (!ordering) {
    for (const dish of dishes) {
      console.log(`- create dish: ${dish.name}`);
    }
    return;
  }

  const existingDishes = await findDishes(ordering.id);
  for (const dish of dishes) {
    if (existingDishes.has(dish.name)) {
      console.log(`- keep existing dish: ${dish.name}`);
      continue;
    }

    console.log(`- create dish: ${dish.name}`);
    if (applyChanges) {
      await directusRequest("/items/food_dishes", {
        method: "POST",
        body: { ...dish, ordering: ordering.id },
      });
    }
  }
}

main().catch((error) => {
  console.error("Spintessen ordering setup failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
