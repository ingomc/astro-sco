import { directusRequest } from "../scripts/directus/client.mjs";

async function run() {
  const fields = await directusRequest("/fields");
  const listFields = fields.filter(f => f.meta?.interface === "list" || f.meta?.interface === "tags");
  console.log(JSON.stringify(listFields.map(f => ({
    collection: f.collection,
    field: f.field,
    type: f.type,
    interface: f.meta?.interface,
    options: f.meta?.options
  })), null, 2));
}

run().catch(console.error);
