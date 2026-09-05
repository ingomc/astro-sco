import { TARGET_SCHEMA, TARGET_RELATIONS } from "../scripts/directus/schema.mjs";

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

  // Get selected collections from schema.mjs
  const selectedCollections = TARGET_SCHEMA.filter(
    (c) => c.name === "drink_categories" || c.name === "drinks"
  );

  // 1. Fetch existing collections list to see if they exist
  const existingCollectionsRaw = await callMcpTool("collections", { action: "read" });
  const existingCollections = new Set((existingCollectionsRaw || []).map(c => c.collection));
  console.log(`Existing collections: ${[...existingCollections].join(", ")}`);

  // 2. Create missing collections
  for (const colDef of selectedCollections) {
    if (!existingCollections.has(colDef.name)) {
      console.log(`Collection '${colDef.name}' is missing. Creating...`);
      await callMcpTool("collections", {
        action: "create",
        data: [
          {
            collection: colDef.name,
            meta: colDef.meta,
            schema: {}
          }
        ]
      });
      console.log(`Collection '${colDef.name}' created successfully!`);
    } else {
      console.log(`Collection '${colDef.name}' already exists.`);
    }
  }

  // 3. Ensure fields exist for each collection
  for (const colDef of selectedCollections) {
    console.log(`\nChecking fields for '${colDef.name}'...`);
    const existingFieldsRaw = await callMcpTool("fields", {
      action: "read",
      collection: colDef.name
    });
    const existingFieldNames = new Set((existingFieldsRaw || []).map(f => f.field));
    console.log(`Existing fields on '${colDef.name}': ${[...existingFieldNames].join(", ")}`);

    const fieldsToCreate = [];
    const fieldsToUpdate = [];
    for (const field of colDef.fields) {
      if (!existingFieldNames.has(field.name)) {
        console.log(`Field '${field.name}' is missing on '${colDef.name}'. Preparing to create...`);
        fieldsToCreate.push({
          field: field.name,
          type: field.type,
          meta: field.meta,
          schema: field.schema
        });
      } else {
        console.log(`Field '${field.name}' already exists. Preparing to update...`);
        fieldsToUpdate.push({
          field: field.name,
          type: field.type,
          meta: field.meta,
          schema: field.schema
        });
      }
    }

    if (fieldsToCreate.length > 0) {
      console.log(`Creating ${fieldsToCreate.length} fields on '${colDef.name}'...`);
      await callMcpTool("fields", {
        action: "create",
        collection: colDef.name,
        data: fieldsToCreate
      });
      console.log(`Fields on '${colDef.name}' created successfully!`);
    }

    if (fieldsToUpdate.length > 0) {
      console.log(`Updating ${fieldsToUpdate.length} fields on '${colDef.name}'...`);
      await callMcpTool("fields", {
        action: "update",
        collection: colDef.name,
        data: fieldsToUpdate
      });
      console.log(`Fields on '${colDef.name}' updated successfully!`);
    }
  }

  // 4. Ensure relations exist
  console.log("\nChecking relations...");
  const existingRelations = await callMcpTool("relations", { action: "read" });

  const selectedRelations = TARGET_RELATIONS.filter(
    (r) => r.collection === "drink_categories" || r.collection === "drinks"
  );

  for (const rel of selectedRelations) {
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

  console.log("\nSchema provisioning via Directus MCP completed successfully!");
}

run().catch(console.error);
