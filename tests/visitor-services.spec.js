import { expect, test } from "@playwright/test";

const dartApi = "http://dart-open-play-test.local/dart-open-play";
const dartRoute =
  /^http:\/\/dart-open-play-test\.local\/dart-open-play(?:\/.*)?$/;
const foodApi = "http://food-order-test.local/food-preorders";
const headers = { "access-control-allow-origin": "*" };
const openSlot = {
  open: true,
  contactMethods: ["phone", "email"],
  slot: { label: "Sonntag, 04.10.2026, 18:00 Uhr", time: "18:00" },
};
const ordering = {
  closed: false,
  orderDeadline: "2026-12-31T18:00:00Z",
  dishes: [
    {
      id: 1,
      name: "Spint mit Sauerkraut",
      priceCents: 0,
      remainingQuantity: null,
    },
  ],
};
const fulfill = (route, data, status = 200) =>
  route.fulfill({
    status,
    headers,
    contentType: "application/json",
    body: JSON.stringify(data),
  });

test("fehlgeschlagener Termin bleibt verborgen und lässt sich erneut laden", async ({
  page,
}) => {
  let loads = 0;
  let submissions = 0;
  await page.route(dartRoute, async (route) => {
    if (route.request().method() !== "GET") {
      submissions++;
      return fulfill(route, {}, 500);
    }
    if (++loads === 1) return route.abort("failed");
    return fulfill(route, openSlot);
  });
  await page.goto("/darts/training");
  const root = page.locator("[data-dart-open-play-signup]");
  await expect(
    root.getByRole("heading", {
      name: "Die Online-Anmeldung ist gerade nicht erreichbar",
    }),
  ).toBeVisible();
  await expect(root.locator("form")).toBeHidden();
  await expect(
    root.getByRole("link", { name: "E-Mail schreiben" }),
  ).toHaveAttribute("href", /^mailto:/);
  // Even a programmatically dispatched submit cannot navigate or send data before a slot exists.
  expect(
    await root
      .locator("form")
      .evaluate((form) =>
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
      ),
  ).toBe(false);
  expect(submissions).toBe(0);
  await root.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(root.locator("form")).toBeVisible();
  await expect(
    root.getByText(`Nächster Termin: ${openSlot.slot.label}`),
  ).toBeVisible();
  await expect(root.locator("[data-online-service-help]")).toBeHidden();
  expect(loads).toBe(2);
});

test("geschlossener Termin zeigt weder Formular noch irreführende Anmeldung", async ({
  page,
}) => {
  await page.route(dartRoute, (route) =>
    fulfill(route, { open: false, message: "Die Anmeldung ist geschlossen." }),
  );
  await page.goto("/darts/training");
  await expect(page.locator("[data-dart-open-play-form]")).toBeHidden();
  await expect(page.getByText("Die Anmeldung ist geschlossen.")).toBeVisible();
  await page.goto("/darts");
  await expect(page.locator("[data-dart-training-link]")).toHaveText(
    "Infos & Anmeldung",
  );
});

test("Netzwerkfehler beim Speichern lässt Angaben erhalten und behauptet keinen Erfolg", async ({
  page,
}) => {
  await page.route(dartRoute, (route) =>
    route.request().method() === "GET"
      ? fulfill(route, openSlot)
      : route.request().method() === "OPTIONS"
        ? route.fulfill({
            status: 204,
            headers: {
              ...headers,
              "access-control-allow-methods": "POST, OPTIONS",
              "access-control-allow-headers": "content-type",
            },
          })
        : route.abort("failed"),
  );
  await page.goto("/darts/training");
  await page.getByLabel("Name", { exact: true }).fill("Erika Muster");
  await page.getByLabel("Handynummer (bevorzugt)").fill("0171 1234567");
  await page.getByLabel(/Datenschutzerklärung/).check();
  await page.getByRole("button", { name: "Verbindlich anmelden" }).click();
  await expect(page.locator("[data-dart-open-play-message]")).toContainText(
    "Die Anmeldung konnte nicht gespeichert werden",
  );
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Erika Muster",
  );
  await expect(
    page.getByRole("button", { name: "Verbindlich anmelden" }),
  ).toBeEnabled();
  await expect(page.locator("[data-dart-open-play-success]")).toBeHidden();
  await expect(page).toHaveURL(/\/darts\/training\/?$/);
});

test("Vorbestellung kann nach Ladefehler erneut laden und behält Angaben bei Speicherfehler", async ({
  page,
}) => {
  let loads = 0;
  await page.route(`${foodApi}/**`, async (route) => {
    if (route.request().method() === "GET") {
      if (++loads === 1)
        return fulfill(
          route,
          { error: "ORIGIN_NOT_ALLOWED", message: "Origin not allowed" },
          403,
        );
      return fulfill(route, ordering);
    }
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          ...headers,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
    return route.abort("failed");
  });
  await page.goto("/veranstaltungen/test-essensvorbestellung", {
    waitUntil: "domcontentloaded",
  });
  const root = page.locator("[data-food-preorder]");
  await expect(
    root.getByRole("heading", {
      name: "Die Online-Vorbestellung ist gerade nicht erreichbar",
    }),
  ).toBeVisible();
  await expect(root).not.toContainText("Origin not allowed");
  await expect(root.locator("form")).toHaveCount(0);
  await root.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(root.locator("form")).toBeVisible();
  await root.getByLabel("Menge").fill("2");
  await root.getByLabel("Name", { exact: true }).fill("Erika Muster");
  await root
    .getByLabel("E-Mail-Adresse", { exact: true })
    .fill("erika@example.de");
  await root.getByLabel(/Datenschutzhinweise/).check();
  await root.getByRole("button", { name: "Reservierung anfragen" }).click();
  await expect(root.locator(".food-preorder-message")).toContainText(
    "Die Online-Vorbestellung ist gerade nicht erreichbar",
  );
  await expect(root.getByLabel("Menge")).toHaveValue("2");
  await expect(root.getByLabel("Name", { exact: true })).toHaveValue(
    "Erika Muster",
  );
  await expect(
    root.getByRole("button", { name: "Reservierung anfragen" }),
  ).toBeEnabled();
  expect(loads).toBe(2);
});

test("Veranstaltungen ohne Essensangebot zeigen keine Bestellaktion", async ({
  page,
}) => {
  await page.route(`${foodApi}/**`, (route) =>
    fulfill(route, { error: "NOT_AVAILABLE" }, 404),
  );
  await page.goto("/veranstaltungen/test-essensvorbestellung");
  await expect(page.locator("[data-food-preorder]")).toBeHidden();
});

test("Besuchsinfos stehen nur auf Sportheim vor den Angebotstexten", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#besuch-planen")).toHaveCount(0);
  for (const path of ["/sportheim"]) {
    await page.goto(path);
    const visit = page.locator("#besuch-planen");
    await expect(
      visit.getByRole("link", { name: "Öffnungszeiten & Anfahrt" }),
    ).toHaveCount(0);
    await expect(page.locator('main a[href^="tel:"]')).toHaveCount(0);
    await expect(page.locator('footer a[href^="tel:"]')).toHaveCount(1);
    await expect(
      visit.getByRole("heading", { name: "Öffnungszeiten", exact: true }),
    ).toBeVisible();
    await expect(
      visit.getByRole("heading", { name: "Anschrift & Anfahrt" }),
    ).toBeVisible();
    await expect(visit).toContainText("regulären Sportheimbetrieb");
    const href = await visit
      .getByRole("link", { name: "Route planen" })
      .getAttribute("href");
    const url = new URL(href);
    expect(url.searchParams.get("destination")).toContain("Lützelbucher");
    expect(
      await visit.evaluate((el) =>
        Boolean(
          el.compareDocumentPosition(
            document.querySelector("[data-dart-training-callout]") ||
              document.querySelector("section.prose"),
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("Feieranfrage hat eine ausgefüllte E-Mail-Vorlage und steht mobil vor dem Fließtext", async ({
  page,
}) => {
  await page.goto("/sportheim/feiern");
  const link = page.getByRole("link", { name: "Feier per E-Mail anfragen" });
  const href = await link.getAttribute("href");
  const url = new URL(href);
  expect(url.protocol).toBe("mailto:");
  expect(url.searchParams.get("subject")).toContain("Private Feier");
  expect(url.searchParams.get("body")).toContain("Wunschtermin:");
  expect(url.searchParams.get("body")).toContain("Personenzahl:");
  await expect(
    page.locator(
      'main a[href^="tel:"], main a[href^="sms:"], main a[href^="https://wa.me/"]',
    ),
  ).toHaveCount(0);
  await expect(page.getByText(/Die Mobilkontakte/)).toHaveCount(0);
  if (page.viewportSize().width < 1024) {
    expect((await link.boundingBox()).y).toBeLessThan(
      (
        await page
          .getByRole("heading", { name: "Private Feiern im Sportheim" })
          .boundingBox()
      ).y,
    );
  }
});

test("Fehleraktionen verwenden einheitliche Buttons mit lesbarem Hover", async ({
  page,
}) => {
  await page.route(dartRoute, (route) => route.abort("failed"));
  await page.goto("/darts/training");
  const help = page.locator("[data-online-service-help]");
  await expect(help).toBeVisible();
  const primary = help.getByRole("button", { name: "Erneut versuchen" });
  await primary.hover();
  await expect(primary).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(primary).toHaveCSS("background-color", "rgb(153, 27, 27)");
  await expect(page.locator('main a[href^="tel:"]')).toHaveCount(0);
  await expect(page.locator('footer a[href^="tel:"]')).toHaveCount(1);
  for (const label of ["E-Mail schreiben"]) {
    const link = help.getByRole("link", { name: label });
    await link.hover();
    await expect(link).toHaveCSS("color", "rgb(15, 23, 42)");
    await expect(link).toHaveCSS("background-color", "rgb(203, 213, 225)");
    await expect(link).toHaveClass(/site-button--secondary/);
  }
});
