import { test, expect } from "@playwright/test";

test("lokaler 3K-Mock überträgt echte STOMP-Updates und bildet Live-Zustände ab", async ({
  page,
  request,
}) => {
  const control = (action) =>
    request.post("/__dart-demo/control", { form: { action } });
  await control("live");
  await control("auto");
  await page.goto("/darts");
  const card = page.getByTestId("next-dart-match");
  await expect(
    page.getByText("Dart-Demo · simulierte Spiele und Namen ·"),
  ).toBeVisible();
  await expect(card).toContainText("Ligaspiel läuft");
  await expect(
    page.locator('[data-fixture-id="101"]').getByRole("link"),
  ).toHaveCount(0);
  await card
    .getByRole("link", { name: "Live-Spiel ansehen", exact: true })
    .click();
  await expect(page.locator('[data-live-field="connection"]')).toHaveText(
    "Live-Verbindung aktiv.",
  );
  await expect(page.locator("[data-live-pairings] > li")).toHaveCount(3);
  const points = page.locator('[data-pairing="points-home"]').first();
  await expect(points).toHaveText("121");
  await expect(
    page.locator('[data-pairing="average-home"]').first(),
  ).toHaveText("55,3");
  await expect(
    page.locator('[data-pairing="turn-home"]').first(),
  ).toContainText("Am Wurf");
  await control("step");
  await expect(points).toHaveText("61");
  await expect(page.locator('[data-pairing="darts-home"]').first()).toHaveText(
    "18",
  );
  await expect(
    page.locator('[data-pairing="turn-guest"]').first(),
  ).toContainText("Am Wurf");
  await control("offline");
  await expect(page.locator('[data-live-field="connection"]')).toContainText(
    "Verbindung unterbrochen",
  );
  await expect(points).toHaveText("61");
  await control("reconnect");
  await expect(page.locator('[data-live-field="connection"]')).toHaveText(
    "Live-Verbindung aktiv.",
    { timeout: 15000 },
  );
  await control("pause");
  await expect(page.locator('[data-live-field="badge"]')).toHaveText("LIVE");
  await expect(page.locator('[data-pairing="status"]').first()).toHaveText(
    "Beendet",
  );
  await control("finish");
  await expect(page.locator('[data-live-field="score"]')).toHaveText("12:8");
  await page.goto("/darts");
  await expect(page.locator('[data-dart-list="results"]')).toContainText(
    "12:8",
  );
  await expect(
    page.locator('[data-dart-list="results"]').getByRole("link"),
  ).toHaveCount(0);
  await control("none");
  await expect(card).toContainText("Nächstes Ligaspiel");
  await expect(card.getByRole("link")).toHaveCount(0);
  await expect(
    page.locator('[data-dart-list="upcoming"]').getByRole("link"),
  ).toHaveCount(0);
  await control("live");
  await expect(card).toContainText("Ligaspiel läuft");
  await expect(
    card.getByRole("link", { name: "Live-Spiel ansehen", exact: true }),
  ).toBeVisible();
});
