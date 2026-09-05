import { TARGET_SCHEMA, TARGET_RELATIONS } from "/Users/ap4716/Documents/dev/astro-sco/scripts/directus/schema.mjs";

async function callMcpTool(toolName, args = {}) {
  const res = await fetch('https://cms.dart.ingomc.de/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer FdgpDcOQtW_oWEujaDErhgO4NaDXIGJ8'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    })
  });
  const json = await res.json();
  if (json.error) {
    throw new Error(`MCP tool ${toolName} failed: ${JSON.stringify(json.error)}`);
  }
  if (json.result && json.result.content && json.result.content[0]) {
    const rawText = json.result.content[0].text;
    try {
      const parsed = JSON.parse(rawText);
      return parsed.raw ?? parsed;
    } catch {
      return rawText;
    }
  }
  return json.result;
}

async function run() {
  console.log("Starting schema provisioning via Directus MCP...");

  // 1. Handle fields for 'settings' collection
  const settingsDef = TARGET_SCHEMA.find(c => c.name === "settings");
  if (!settingsDef) {
    throw new Error("Could not find 'settings' definition in schema.mjs");
  }

  console.log("\nFetching existing fields for 'settings' collection...");
  const existingFieldsRaw = await callMcpTool("fields", {
    action: "read",
    collection: "settings"
  });
  const existingFieldNames = new Set((existingFieldsRaw || []).map(f => f.field));
  console.log(`Existing fields: ${[...existingFieldNames].join(", ")}`);

  const fieldsToCreate = [];
  for (const field of settingsDef.fields) {
    if (!existingFieldNames.has(field.name)) {
      console.log(`Field '${field.name}' is missing. Preparing to create...`);
      fieldsToCreate.push({
        field: field.name,
        type: field.type,
        meta: field.meta,
        schema: field.schema
      });
    } else {
      console.log(`Field '${field.name}' already exists.`);
    }
  }

  if (fieldsToCreate.length > 0) {
    console.log(`Creating ${fieldsToCreate.length} fields on 'settings'...`);
    await callMcpTool("fields", {
      action: "create",
      collection: "settings",
      data: fieldsToCreate
    });
    console.log("Fields created successfully!");
  } else {
    console.log("No new fields to create.");
  }

  // 2. Handle relations
  console.log("\nFetching existing relations...");
  const existingRelations = await callMcpTool("relations", {
    action: "read"
  });

  const settingsRelations = TARGET_RELATIONS.filter(r => r.collection === "settings");
  for (const rel of settingsRelations) {
    const exists = (existingRelations || []).some(
      r => r.collection === rel.collection && r.field === rel.field
    );

    if (!exists) {
      console.log(`Relation for '${rel.collection}.${rel.field}' is missing. Creating...`);
      await callMcpTool("relations", {
        action: "create",
        collection: rel.collection,
        field: rel.field,
        data: {
          collection: rel.collection,
          field: rel.field,
          related_collection: rel.related_collection,
          schema: rel.schema,
          meta: rel.meta
        }
      });
      console.log(`Relation for '${rel.collection}.${rel.field}' created successfully!`);
    } else {
      console.log(`Relation for '${rel.collection}.${rel.field}' already exists.`);
    }
  }

  console.log("\nSchema provisioning via Directus MCP completed!");
}

run().catch(console.error);
