import { directusRequest, getDirectusBaseUrl } from "../scripts/directus/client.mjs";
import { TARGET_RELATIONS, TARGET_SCHEMA } from "../scripts/directus/schema.mjs";

const syncExisting = true;

function fieldPayload(field) {
  return {
    field: field.name,
    type: field.type,
    meta: field.meta,
    schema: field.schema,
  };
}

async function ensureCollection(definition, counters) {
  const existing = await directusRequest(`/collections/${definition.name}`, { allow404: true });

  if (!existing) {
    await directusRequest("/collections", {
      method: "POST",
      body: {
        collection: definition.name,
        meta: {
          ...definition.meta,
        },
        schema: {
          name: definition.name,
        },
      },
    });
    counters.collectionsCreated += 1;
    return;
  }

  counters.collectionsExisting += 1;

  if (!syncExisting) {
    return;
  }

  await directusRequest(`/collections/${definition.name}`, {
    method: "PATCH",
    body: {
      meta: {
        ...existing.meta,
        ...definition.meta,
      },
    },
  });
  counters.collectionsUpdated += 1;
}

async function ensureField(collectionName, field, counters) {
  const existing = await directusRequest(`/fields/${collectionName}/${field.name}`, {
    allow404: true,
  });

  if (!existing) {
    await directusRequest(`/fields/${collectionName}`, {
      method: "POST",
      body: fieldPayload(field),
    });
    counters.fieldsCreated += 1;
    return;
  }

  counters.fieldsExisting += 1;

  if (!syncExisting) {
    return;
  }

  await directusRequest(`/fields/${collectionName}/${field.name}`, {
    method: "PATCH",
    body: {
      type: field.type,
      meta: {
        ...existing.meta,
        ...field.meta,
      },
      schema: {
        ...existing.schema,
        ...field.schema,
      },
    },
  });
  counters.fieldsUpdated += 1;
}

function relationPayload(relation) {
  return {
    collection: relation.collection,
    field: relation.field,
    related_collection: relation.related_collection,
    meta: relation.meta,
    schema: relation.schema,
  };
}

async function ensureRelation(relation, counters) {
  const existing = await directusRequest(`/relations/${relation.collection}/${relation.field}`, {
    allow404: true,
  });

  if (!existing) {
    await directusRequest("/relations", {
      method: "POST",
      body: relationPayload(relation),
    });
    counters.relationsCreated += 1;
    return;
  }

  counters.relationsExisting += 1;

  if (!syncExisting) {
    return;
  }

  await directusRequest(`/relations/${relation.collection}/${relation.field}`, {
    method: "PATCH",
    body: {
      related_collection: relation.related_collection,
      meta: {
        ...existing.meta,
        ...relation.meta,
      },
      schema: {
        ...existing.schema,
        ...relation.schema,
      },
    },
  });
  counters.relationsUpdated += 1;
}

async function main() {
  const counters = {
    collectionsCreated: 0,
    collectionsExisting: 0,
    collectionsUpdated: 0,
    fieldsCreated: 0,
    fieldsExisting: 0,
    fieldsUpdated: 0,
    relationsCreated: 0,
    relationsExisting: 0,
    relationsUpdated: 0,
  };

  const selectedCollections = TARGET_SCHEMA.filter(
    (c) => c.name === "drink_categories" || c.name === "drinks"
  );
  const selectedRelations = TARGET_RELATIONS.filter(
    (r) => r.collection === "drink_categories" || r.collection === "drinks"
  );

  console.log(`Provisioning selected Directus schema at ${getDirectusBaseUrl()}`);

  for (const collection of selectedCollections) {
    console.log(`\nCollection: ${collection.name}`);
    await ensureCollection(collection, counters);

    for (const field of collection.fields) {
      await ensureField(collection.name, field, counters);
    }
  }

  if (selectedRelations.length > 0) {
    console.log("\nRelations:");
    for (const relation of selectedRelations) {
      await ensureRelation(relation, counters);
    }
  }

  console.log("\nDone.");
  console.log(JSON.stringify(counters, null, 2));
}

main().catch(console.error);
