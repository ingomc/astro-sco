import { directusRequest } from "./client.mjs";

async function run() {
  console.log("Updating Directus CMS settings singleton...");

  const payload = {
    site_title: "SCO-OGV Oberfüllbach 1963 e.V.",
    site_description: "Der SCO-OGV Oberfüllbach 1963 e.V. ist ein offener und familiärer Verein, bei dem neben dem sportlichen Betätigung auch das gesellschaftliche Leben eine wichtige Rolle spielt.",
    posts_front_limit: 234,
    posts_author: "author",
    posts_thumb: "/assets/placeholder-about.jpg",
    phone: "09560 / 8609",
    email: "info@sc-oberfuellbach.de",
    address_street: "Lützelbucher Str. 7",
    address_city: "96237 Ebersdorf-Oberfüllbach",
    payment_methods: [
      { name: "Bargeld" },
      { name: "Kartenzahlung" }
    ],
    opening_hours: [
      { hour: "jeden Sonntag ab 18:30 Uhr" },
      { hour: "jeden 1. Freitag im Monat ab 19:30 Uhr (ohne Gewähr)" }
    ],
    regular_events: [
      { time: "So: ab 18:00 Uhr", label: "Steel-Darts" },
      { time: "So: ab 18:30 Uhr", label: "Stammtisch" }
    ],
    use_winter_mode: false,
    use_winter_stage: false
  };

  await directusRequest("/items/settings", {
    method: "PATCH",
    body: payload
  });

  console.log("Directus CMS settings updated successfully!");
}

run().catch(console.error);
