import { directusRequest, getDirectusBaseUrl } from "./client.mjs";
import { TARGET_SCHEMA } from "./schema.mjs";

const args = new Set(process.argv.slice(2));
const syncExisting = args.has("--sync");

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

async function main() {
  const counters = {
    collectionsCreated: 0,
    collectionsExisting: 0,
    collectionsUpdated: 0,
    fieldsCreated: 0,
    fieldsExisting: 0,
    fieldsUpdated: 0,
  };

  console.log(`Provisioning Directus schema at ${getDirectusBaseUrl()}`);
  console.log(`Mode: ${syncExisting ? "sync existing" : "create missing only"}`);

  for (const collection of TARGET_SCHEMA) {
    console.log(`\nCollection: ${collection.name}`);
    await ensureCollection(collection, counters);

    for (const field of collection.fields) {
      await ensureField(collection.name, field, counters);
    }
  }

  console.log("\nDone.");
  console.log(JSON.stringify(counters, null, 2));
}

try {
  await main();
} catch (error) {
  console.error("Schema provisioning failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
