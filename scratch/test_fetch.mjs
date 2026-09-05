import { getSiteSettings } from "../src/lib/content-source.ts";

async function run() {
  process.env.DIRECTUS_URL = "https://cms.dart.ingomc.de";
  process.env.DIRECTUS_ACCESS_TOKEN = "XAYyBfQzhTYd79m8lw69gM97qLZtUWvh";
  process.env.MCP = "FdgpDcOQtW_oWEujaDErhgO4NaDXIGJ8";
  process.env.CONTENT_SOURCE = "directus";

  console.log("Fetching settings from content-source helper...");
  const settings = await getSiteSettings();
  console.log("Resolved Settings:", JSON.stringify(settings, null, 2));
}

run().catch(console.error);
