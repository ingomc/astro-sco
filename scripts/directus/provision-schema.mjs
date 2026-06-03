import { directusRequest, getDirectusBaseUrl } from "./client.mjs";
import { TARGET_RELATIONS, TARGET_SCHEMA } from "./schema.mjs";

const args = new Set(process.argv.slice(2));
const syncExisting = args.has("--sync");

function fieldPayload(field) {
  const payload = {
    field: field.name,
    type: field.type,
    meta: field.meta,
  };
  if (field.schema !== null && field.schema !== undefined) {
    payload.schema = field.schema;
  }
  return payload;
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

  const patchBody = {
    type: field.type,
    meta: {
      ...existing.meta,
      ...field.meta,
    },
  };

  if (field.schema !== null && field.schema !== undefined && existing.schema !== null && existing.schema !== undefined) {
    patchBody.schema = {
      ...existing.schema,
      ...field.schema,
    };
  }

  await directusRequest(`/fields/${collectionName}/${field.name}`, {
    method: "PATCH",
    body: patchBody,
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

  console.log(`Provisioning Directus schema at ${getDirectusBaseUrl()}`);
  console.log(`Mode: ${syncExisting ? "sync existing" : "create missing only"}`);

  const limitCols = process.env.LIMIT_COLLECTIONS 
    ? process.env.LIMIT_COLLECTIONS.split(",").map(c => c.trim()) 
    : null;

  const collectionsToProvision = limitCols 
    ? TARGET_SCHEMA.filter(c => limitCols.includes(c.name)) 
    : TARGET_SCHEMA;

  const relationsToProvision = limitCols 
    ? TARGET_RELATIONS.filter(r => limitCols.includes(r.collection)) 
    : TARGET_RELATIONS;

  for (const collection of collectionsToProvision) {
    console.log(`\nCollection: ${collection.name}`);
    await ensureCollection(collection, counters);

    for (const field of collection.fields) {
      await ensureField(collection.name, field, counters);
    }
  }

  if (relationsToProvision.length > 0) {
    console.log("\nRelations:");
    for (const relation of relationsToProvision) {
      await ensureRelation(relation, counters);
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
