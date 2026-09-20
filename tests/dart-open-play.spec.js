import { expect, test } from "@playwright/test";

const apiOrigin = "http://dart-open-play-test.local";
const corsHeaders = { "access-control-allow-origin": "http://localhost:4330" };
const dartOpenPlayRoute = new RegExp(
  "^http://dart-open-play-test\\.local/dart-open-play(?:/.*)?$",
);

test("Gast sieht den nächsten Termin und kann sich zum Sonntagstraining anmelden", async ({
  page,
}) => {
  let submittedBody;
  await page.route(dartOpenPlayRoute, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          ...corsHeaders,
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
      return;
    }
    if (
      route.request().method() === "GET" &&
      url.pathname === "/dart-open-play"
    ) {
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          open: true,
          slot: {
            at: "2026-09-27T16:00:00.000Z",
            label: "Sonntag, 27.09.2026, 18:00 Uhr",
            time: "18:00",
          },
        }),
      });
      return;
    }
    if (
      route.request().method() === "POST" &&
      url.pathname === "/dart-open-play/registrations"
    ) {
      submittedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          registrationId: "DTEST2026",
          message:
            "Danke, deine Anmeldung für das nächste Sonntagstraining ist eingegangen.",
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, headers: corsHeaders, body: "{}" });
  });

  await page.goto("/darts/anmelden/", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", {
      name: "Zum offenen Sonntagstraining anmelden",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Nächster Termin: Sonntag, 27.09.2026, 18:00 Uhr"),
  ).toBeVisible();

  await page.locator("#dart-open-play-name").fill("Erika Muster");
  await page.locator("#dart-open-play-email").fill("erika@example.de");
  await page.getByLabel(/Datenschutzerklärung/).check();
  await page.getByRole("button", { name: "Verbindlich anmelden" }).click();

  await expect(
    page.getByRole("heading", { name: "Anmeldung gespeichert" }),
  ).toBeVisible();
  await expect(page.getByText("DTEST2026")).toBeVisible();
  expect(submittedBody).toMatchObject({
    name: "Erika Muster",
    email: "erika@example.de",
    privacyAccepted: true,
  });
});

test("Darts-Seite führt Gäste sichtbar zur Anmeldung", async ({ page }) => {
  await page.route(dartOpenPlayRoute, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          open: true,
          slot: {
            label: "Sonntag, 27.09.2026, 18:00 Uhr",
            time: "18:00",
          },
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, headers: corsHeaders, body: "{}" });
  });

  await page.goto("/darts/", { waitUntil: "networkidle" });
  const callout = page.getByRole("heading", {
    name: "Offenes Sonntagstraining",
  });
  await expect(callout).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Für nächsten Sonntag anmelden" }),
  ).toHaveAttribute("href", "/darts/anmelden/");

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Offenes Sonntagstraining" }),
  ).toBeVisible();
});
