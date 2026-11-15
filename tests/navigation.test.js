import { test, expect } from "@playwright/test";

test("desktop navigation opens sections and reaches reports", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const navigation = page.getByRole("navigation", {
    name: "Hauptnavigation",
    exact: true,
  });
  const eventsButton = navigation.getByRole("button", {
    name: "Veranstaltungen",
  });
  await expect(eventsButton).toHaveAttribute("aria-expanded", "false");
  await eventsButton.click();
  await expect(eventsButton).toHaveAttribute("aria-expanded", "true");
  await expect(navigation.getByRole("link", { name: "Termine" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(eventsButton).toBeFocused();
  await expect(eventsButton).toHaveAttribute("aria-expanded", "false");

  await eventsButton.click();
  await navigation.getByRole("link", { name: "Berichte" }).click();
  await expect(page).toHaveURL(/\/berichte\/?$/);
  await expect(
    page.getByRole("heading", { name: "Berichte", exact: true }),
  ).toBeVisible();
});

test("mobile navigation opens a section and reaches room inquiries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Hauptmenü öffnen" }).click();

  const navigation = page.getByRole("navigation", {
    name: "Mobile Hauptnavigation",
  });
  const sportheimButton = navigation.getByRole("button", { name: "Sportheim" });
  await sportheimButton.click();
  await expect(sportheimButton).toHaveAttribute("aria-expanded", "true");
  await navigation.getByRole("link", { name: "Feiern & Räume" }).click();
  await expect(page).toHaveURL(/\/sportheim\/feiern\/?$/);
  await expect(
    page.getByRole("heading", { name: "Feiern & Räume" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hauptmenü öffnen" }).click();
  await expect(sportheimButton).toHaveAttribute("aria-expanded", "true");
  await expect(
    navigation.getByRole("link", { name: "Feiern & Räume" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    navigation.getByRole("link", { name: "Besuch & Öffnungszeiten" }),
  ).not.toHaveAttribute("aria-current", "page");
});

test("tablet width uses the side drawer", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Hauptmenü öffnen" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Hauptnavigation", exact: true }),
  ).toBeHidden();
});

test("mobile items fill the drawer and collapsed links leave the tab order", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Hauptmenü öffnen" }).click();
  const navigation = page.getByRole("navigation", {
    name: "Mobile Hauptnavigation",
  });
  const home = navigation.getByRole("link", {
    name: "Startseite",
    exact: true,
  });
  const darts = navigation.getByRole("button", { name: "Darts", exact: true });
  // Measure both items together while the drawer is sliding into view.
  const bounds = await page.locator("#mobile-menu").evaluate((drawer) => {
    const home = drawer.querySelector('a[href="/"]').getBoundingClientRect();
    const darts = drawer
      .querySelector('[aria-controls="mobile-submenu-3"]')
      .getBoundingClientRect();
    return {
      homeWidth: home.width,
      dartsWidth: darts.width,
      homeX: home.x,
      dartsX: darts.x,
    };
  });
  expect(bounds.homeWidth).toBeCloseTo(bounds.dartsWidth, 0);
  expect(bounds.homeX).toBeCloseTo(bounds.dartsX, 0);

  await darts.click();
  await expect(
    navigation.getByRole("link", { name: "Offenes Training" }),
  ).toBeVisible();
  await darts.press("Tab");
  await expect(
    navigation.getByRole("link", { name: "Offenes Training" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(darts).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Tab");
  await expect(
    navigation.getByRole("button", { name: "Hauptmenü schließen" }),
  ).toBeFocused();
  await expect(page.locator("#mobile-submenu-3")).toBeHidden();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await darts.click();
  await navigation.getByRole("button", { name: "Sportheim" }).click();
  await expect(page.locator("#mobile-submenu-3")).toBeHidden();
  await expect(
    navigation.getByRole("link", { name: "Feiern & Räume" }),
  ).toBeVisible();
});

test("dropdowns stay inside narrow desktop viewports without horizontal scrolling", async ({
  page,
}) => {
  await page.goto("/darts", { waitUntil: "domcontentloaded" });
  const navigation = page.getByRole("navigation", {
    name: "Hauptnavigation",
    exact: true,
  });

  for (const width of [1024, 1100, 1279, 1280, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const name of ["Veranstaltungen", "Sportheim", "Darts"]) {
      const button = navigation.getByRole("button", { name, exact: true });
      await button.click();
      const panel = page.locator(
        `#${await button.getAttribute("aria-controls")}`,
      );
      await expect(panel).toBeVisible();
      const bounds = await panel.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
      await expect(button).toBeFocused();
    }
  }

  for (const width of [375, 800]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(
      page.getByRole("button", { name: "Hauptmenü öffnen" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("touch opens and closes the mobile submenu", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, "Touch device required");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Hauptmenü öffnen" }).tap();
  const navigation = page.getByRole("navigation", {
    name: "Mobile Hauptnavigation",
  });
  const dartsButton = navigation.getByRole("button", { name: "Darts" });
  await dartsButton.tap();
  await expect(
    navigation.getByRole("link", { name: "Offenes Training" }),
  ).toBeVisible();
  await dartsButton.tap();
  await expect(dartsButton).toHaveAttribute("aria-expanded", "false");
});

test("training contains signup and old URL redirects", async ({ page }) => {
  const response = await page.request.get("/dart/anmelden", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe("/darts/training");
  await page.goto("/dart/anmelden", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/darts\/training\/?$/);
  await expect(
    page.getByRole("heading", { name: "Offenes Training für alle" }),
  ).toBeVisible();
  await expect(page.locator("[data-dart-open-play-signup]")).toBeVisible();

  await page.goto("/darts");
  await expect(
    page.getByRole("heading", { name: "SCO-Darts Team Fülltreffer" }),
  ).toBeVisible();
});

test("room inquiry never shows incomplete personal contacts", async ({
  page,
}) => {
  await page.goto("/sportheim/feiern");
  const whatsAppLinks = page.locator('a[href^="https://wa.me/"]');
  const smsLinks = page.locator('a[href^="sms:"]');
  const count = await whatsAppLinks.count();
  expect([0, 2]).toContain(count);
  await expect(smsLinks).toHaveCount(count);
  if (count === 0) {
    await expect(
      page.getByRole("link", { name: "09560 / 8609", exact: true }),
    ).toBeVisible();
  } else {
    expect(await whatsAppLinks.first().getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/\d+\?text=.+/,
    );
    expect(await smsLinks.first().getAttribute("href")).toMatch(
      /^sms:\+\d+\?body=.+/,
    );
  }
});

for (const [path, section, label] of [
  ["/veranstaltungen", "Veranstaltungen", "Termine"],
  ["/berichte", "Veranstaltungen", "Berichte"],
  ["/sportheim", "Sportheim", "Besuch & Öffnungszeiten"],
  ["/sportheim/feiern", "Sportheim", "Feiern & Räume"],
  ["/darts/training", "Darts", "Offenes Training"],
  ["/darts", "Darts", "Liga & Mannschaft"],
]) {
  test(`mobile menu reveals the current section on ${path}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const openButton = page.getByRole("button", { name: "Hauptmenü öffnen" });
    const navigation = page.getByRole("navigation", {
      name: "Mobile Hauptnavigation",
    });
    const sectionButton = navigation.getByRole("button", {
      name: section,
      exact: true,
    });
    const currentLink = navigation.getByRole("link", {
      name: label,
      exact: true,
    });

    await openButton.click();
    await expect(sectionButton).toHaveAttribute("aria-expanded", "true");
    await expect(currentLink).toBeVisible();
    await expect(currentLink).toHaveAttribute("aria-current", "page");
    await expect(
      navigation.locator('[data-nav-toggle][aria-expanded="true"]'),
    ).toHaveCount(1);

    await sectionButton.click();
    await expect(sectionButton).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Hauptmenü schließen" }).click();
    await openButton.click();
    await expect(sectionButton).toHaveAttribute("aria-expanded", "true");
    await expect(currentLink).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(openButton).toBeFocused();
    await expect(openButton).toHaveAttribute("aria-expanded", "false");
  });
}
