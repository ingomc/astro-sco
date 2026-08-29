import { expect, test } from "@playwright/test";

const apiOrigin = "http://food-order-test.local";
const corsHeaders = { "access-control-allow-origin": "http://localhost:4329" };

test("Gast kann ein Gericht in den Warenkorb legen und eine Reservierung anfragen", async ({
  page,
}) => {
  let submittedBody;
  await page.route(`${apiOrigin}/food-preorders/**`, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          ...corsHeaders,
          "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
      return;
    }
    if (
      route.request().method() === "GET" &&
      url.pathname.endsWith("/events/test-essensvorbestellung")
    ) {
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          orderDeadline: "2026-12-31T18:00:00.000Z",
          closed: false,
          dishes: [
            {
              id: 1,
              name: "Kerwabraten",
              description: "mit Kloß und Blaukraut",
              allergens: "Sellerie",
              priceCents: 1250,
              remainingQuantity: 8,
            },
          ],
        }),
      });
      return;
    }
    if (
      route.request().method() === "POST" &&
      url.pathname.endsWith("/reservations")
    ) {
      submittedBody = route.request().postDataJSON();
      if (!submittedBody.privacyAccepted) {
        await route.fulfill({
          status: 400,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            error: "PRIVACY_REQUIRED",
            message: "Bitte bestätige den Datenschutzhinweis.",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          message:
            "Bitte bestätige deine Reservierung über den Link in der E-Mail.",
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, headers: corsHeaders, body: "{}" });
  });

  await page.goto("/veranstaltungen/test-essensvorbestellung", {
    waitUntil: "networkidle",
  });
  await expect(
    page.getByRole("heading", { name: "Essen vorbestellen" }),
  ).toBeVisible();
  await expect(page.locator(".food-preorder-dish")).toContainText(
    "Allergene: Sellerie",
  );

  await page.locator("#food-quantity-1").fill("2");
  await page.locator("#food-name").fill("Erika Muster");
  await page.locator("#food-email").fill("erika@example.de");
  await page.getByRole("button", { name: "Reservierung anfragen" }).click();

  await expect(
    page.getByText("Bitte bestätige den Datenschutzhinweis."),
  ).toBeVisible();
  await page.getByLabel(/Datenschutzhinweise zur Essensvorbestellung/).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByLabel(/Datenschutzhinweise zur Essensvorbestellung/),
  ).toBeChecked();
  await page.getByRole("button", { name: "Reservierung anfragen" }).click();

  await expect(
    page.getByText(
      "Bitte bestätige deine Reservierung über den Link in der E-Mail.",
    ),
  ).toBeVisible();
  expect(submittedBody).toMatchObject({
    name: "Erika Muster",
    email: "erika@example.de",
    privacyAccepted: true,
    items: [{ dishId: 1, quantity: 2 }],
  });
});
