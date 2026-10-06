import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockLive, rubber } from "./dart-live-fixtures.js";

const snapshot = (overrides = {}) =>
  rubber({ lastUpdate: "2026-10-02T18:01:00Z", ...overrides });
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-02T18:00:00Z") });
});

test("Liga priorisiert laufendes Spiel und führt zur eigenen Live-Spielseite", async ({
  page,
}) => {
  const api = await mockLive(page);
  await page.goto("/darts", { waitUntil: "domcontentloaded" });
  const card = page.getByTestId("next-dart-match");
  await expect(card).toContainText("Ligaspiel läuft");
  await expect(card).toContainText("Spieltag 3");
  await expect(card).toContainText("LIVE");
  await expect(card).toContainText("3:2");
  const rows = page.locator('[data-dart-list="upcoming"] > li');
  await expect(rows.first()).toHaveAttribute("data-fixture-id", "102");
  await expect(rows.first()).toHaveAttribute("data-match-state", "live");
  await expect.poll(api.subscribed).toBe(true);
  const rowLink = rows.first().getByRole("link");
  await rowLink.focus();
  api.push(snapshot({ setsHome: 4 }));
  await expect(card).toContainText("4:2");
  await expect(rowLink).toBeFocused();
  await card
    .getByRole("link", { name: "Live-Spiel ansehen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/darts\/spiel\?match=102$/);
  await expect(page.locator('[data-live-field="score"]')).toHaveText("3:2");
});

test("neues Ligaspiel wird automatisch erkannt, Datum allein erzeugt kein LIVE", async ({
  page,
}) => {
  const api = await mockLive(page, []);
  await page.goto("/darts", { waitUntil: "domcontentloaded" });
  const card = page.getByTestId("next-dart-match");
  await expect(card).toContainText("Spieltag 4");
  await expect(card.locator('[data-dart-next="live"]')).toBeHidden();
  await expect(card.getByRole("link")).toHaveCount(0);
  await expect(
    page.locator('[data-dart-list="upcoming"]').getByRole("link"),
  ).toHaveCount(0);
  api.setRecords([rubber()]);
  await page.clock.fastForward(31_000);
  await expect(card).toContainText("Ligaspiel läuft");
  await expect(card).toContainText("Spieltag 3");
});

test("Spielseite zeigt mehrere Boards und aktualisiert Punkte ohne Neuladen", async ({
  page,
}) => {
  const api = await mockLive(page, [
    rubber({ matchKey: "2002", board: "2", status: 2 }),
    rubber(),
  ]);
  await page.goto("/darts/spiel?match=102", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-live-field="score"]')).toHaveText("3:2");
  const rows = page.locator("[data-live-pairings] > li");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Board 1");
  await expect(rows.first()).toContainText("André Bellmann");
  await expect(rows.first().locator('[data-pairing="legs"]')).toHaveText("1:2");
  await expect(rows.first().locator('[data-pairing="points-home"]')).toHaveText(
    "121",
  );
  await expect(rows.nth(1).locator('[data-pairing="points"]')).toBeHidden();
  await expect.poll(api.subscribed).toBe(true);
  const back = page.getByRole("link", {
    name: "← Zurück zur Liga",
    exact: true,
  });
  await back.focus();
  const announcement = await page
    .locator("[data-live-announcement]")
    .textContent();
  const update = snapshot({
    setsHome: 4,
    matchPlayers: [
      { index: 0, playerName: "André Bellmann", legs: 2, points: 40 },
      { index: 1, playerName: "Beispiel Gegner", legs: 2, points: 80 },
    ],
  });
  api.push(update);
  await expect(page.locator('[data-live-field="score"]')).toHaveText("4:2");
  await expect(rows.first().locator('[data-pairing="points-home"]')).toHaveText(
    "40",
  );
  await expect(rows.first().locator('[data-pairing="legs"]')).toHaveText("2:2");
  await expect(back).toBeFocused();
  await expect(page.locator("[data-live-announcement]")).toHaveText(
    announcement,
  );
  api.push(rubber());
  await expect(page.locator('[data-live-field="score"]')).toHaveText("4:2");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});

test("Statistiken und Wurfwechsel aktualisieren sich ohne Fokusverlust", async ({
  page,
}) => {
  const api = await mockLive(page);
  await page.goto("/darts/spiel?match=102", { waitUntil: "domcontentloaded" });
  const row = page.locator("[data-live-pairings] > li").first();
  await expect(row.locator('[data-pairing="last-home"]')).toHaveText("60");
  await expect(row.locator('[data-pairing="average-home"]')).toHaveText("55,3");
  await expect(row.locator('[data-pairing="darts-home"]')).toHaveText("15");
  await expect(row.locator('[data-pairing="turn-home"]')).toContainText(
    "Am Wurf",
  );
  await expect(row.locator('[data-stat-row="sets"]')).toBeHidden();
  await expect(row.locator('[data-stat-row="single"]')).toBeHidden();
  const summary = row.locator("summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(row.locator('[data-pairing="high-home"]')).toHaveText("80");
  await expect(row.locator('[data-pairing="count-4-home"]')).toHaveText("0");
  await expect.poll(api.subscribed).toBe(true);
  const next = snapshot({ currentplayerIndex: 1, singleDarts: true });
  Object.assign(next.matchPlayers[0], {
    scoreAdditional: 40,
    dartsAdditional: 2,
    dart1: "T20",
    dart2: "D20",
    dart3: "-",
  });
  api.push(next);
  await expect(row.locator('[data-pairing="last-home"]')).toHaveText("100");
  await expect(row.locator('[data-pairing="average-home"]')).toHaveText("55,4");
  await expect(row.locator('[data-pairing="darts-home"]')).toHaveText("17");
  await expect(row.locator('[data-pairing="single-home"]')).toHaveText(
    "T20 · D20 · -",
  );
  await expect(row.locator('[data-pairing="turn-guest"]')).toHaveText(
    "Am Wurf",
  );
  await expect(summary).toBeFocused();
  await expect(row.locator("details")).toHaveAttribute("open", "");
  api.push(
    snapshot({
      lastUpdate: "2026-10-02T18:02:00Z",
      matchPlayers: [
        { index: 0, playerName: "A", legs: 0, points: 301 },
        { index: 1, playerName: "B", legs: 0, points: 221 },
      ],
    }),
  );
  await expect(row.locator('[data-stat-row="average"]')).toBeHidden();
  await expect(row.locator('[data-stat-row="last"]')).toBeHidden();
  await expect(row.locator('[data-pairing="stats"]')).toBeHidden();
  await expect(summary).toBeFocused();
  await expect(row.locator('[data-pairing="details"]')).toBeVisible();
  await expect(row.locator('[data-pairing="extra-stats"]')).toBeHidden();
  await page
    .getByRole("link", { name: "← Zurück zur Liga", exact: true })
    .focus();
  await expect(row.locator('[data-pairing="details"]')).toBeHidden();
  const partial = snapshot({
    lastUpdate: "2026-10-02T18:03:00Z",
    matchPlayers: [
      {
        index: 0,
        playerName: "A",
        legs: 0,
        points: 301,
        lastScore: 0,
        count180: 0,
      },
      { index: 1, playerName: "B", legs: 0, points: 221 },
    ],
  });
  api.push(partial);
  await expect(row.locator('[data-pairing="last-home"]')).toHaveText("0");
  await expect(row.locator('[data-pairing="last-guest"]')).toBeEmpty();
  await expect(row.locator('[data-stat-row="last"]')).toBeVisible();
  await expect(row.locator('[data-stat-row="average"]')).toBeHidden();
  await expect(row.locator('[data-stat-row="high"]')).toBeHidden();
  await expect(row.locator('[data-stat-row="count-4"]')).toBeVisible();
  await expect(row.locator('[data-pairing="count-4-home"]')).toHaveText("0");
  await expect(row.locator('[data-pairing="count-4-guest"]')).toBeEmpty();
  await expect(row).not.toContainText("nicht übertragen");
});

test("Einzelpartie beendet lässt LIVE bestehen, Liga-Abschluss zeigt Endstand", async ({
  page,
}) => {
  const api = await mockLive(page);
  await page.goto("/darts/spiel?match=102", { waitUntil: "domcontentloaded" });
  await expect.poll(api.subscribed).toBe(true);
  api.push(snapshot({ status: 2, setsHome: 4 }));
  await expect(page.locator('[data-live-field="badge"]')).toHaveText("LIVE");
  await expect(page.locator('[data-pairing="status"]')).toHaveText("Beendet");
  api.finish();
  await page.clock.fastForward(61_000);
  await expect(page.locator('[data-live-field="badge"]')).toHaveText("Beendet");
  await expect(page.locator('[data-live-field="score"]')).toHaveText("12:8");
  await expect(page.locator('[data-live-field="score-label"]')).toHaveText(
    "Endstand",
  );
});

test("Liga wechselt nach Abschluss zum nächsten Spiel und Ergebnis", async ({
  page,
}) => {
  const api = await mockLive(page);
  await page.goto("/darts", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("next-dart-match")).toContainText(
    "Ligaspiel läuft",
  );
  api.finish();
  await page.clock.fastForward(61_000);
  await expect(page.getByTestId("next-dart-match")).toContainText("Spieltag 4");
  await expect(page.getByTestId("next-dart-match")).toContainText(
    "Nächstes Ligaspiel",
  );
  await expect(page.locator('[data-dart-list="results"]')).toContainText(
    "12:8",
  );
  await expect(
    page.locator('[data-dart-list="results"]').getByRole("link"),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("next-dart-match").getByRole("link"),
  ).toHaveCount(0);
});

test("Ausfall erhält Stand, REST-Rückfall und Wiederverbindung holen neue Daten", async ({
  page,
}) => {
  const api = await mockLive(page);
  await page.goto("/darts/spiel?match=102", { waitUntil: "domcontentloaded" });
  await expect.poll(api.subscribed).toBe(true);
  api.blockSocket(true);
  api.failLive(true);
  api.disconnect();
  await expect(page.locator('[data-live-field="connection"]')).toContainText(
    "Verbindung unterbrochen",
  );
  await expect(page.locator('[data-live-field="score"]')).toHaveText("3:2");
  api.setRecords([snapshot({ setsHome: 4 })]);
  api.failLive(false);
  await page.clock.fastForward(11_000);
  await expect(page.locator('[data-live-field="score"]')).toHaveText("4:2");
  await expect(page.locator('[data-live-field="connection"]')).toContainText(
    "regelmäßig aktualisiert",
  );
  api.setRecords([
    snapshot({ lastUpdate: "2026-10-02T18:02:00Z", setsHome: 5 }),
  ]);
  api.blockSocket(false);
  // A blocked handshake may finish asynchronously after virtual time advances.
  // Drive subsequent five-second retries until the broker has accepted a subscription.
  await expect
    .poll(async () => {
      await page.clock.fastForward(5_000);
      return api.subscribed();
    })
    .toBe(true);
  await expect(page.locator('[data-live-field="connection"]')).toHaveText(
    "Live-Verbindung aktiv.",
  );
  await expect(page.locator('[data-live-field="score"]')).toHaveText("5:2");
});

test("fehlende oder fremde Übertragung zeigt Spielinfos ohne falsche Scores", async ({
  page,
}) => {
  await mockLive(page, [
    rubber({ originalEventId: 999, setsHome: 99 }),
    rubber({ database: "10" }),
    rubber({ groupKey: "101" }),
  ]);
  await page.goto("/darts/spiel?match=102", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText(
      "Für dieses Spiel ist derzeit keine Live-Übertragung verfügbar.",
    ),
  ).toBeVisible();
  await expect(page.locator('[data-live-field="score"]')).toHaveText("—:—");
  await expect(page.locator('[data-live-field="badge"]')).toBeHidden();
  await expect(page.locator("[data-live-pairings] > li")).toHaveCount(0);
});

test("ungültige und unbekannte Spiel-IDs bieten verständlichen Rückweg", async ({
  page,
}) => {
  await mockLive(page, []);
  for (const id of ["", "abc", "-1", "102&match=101", "9007199254740993"]) {
    await page.goto(`/darts/spiel?match=${id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-live-state="error"]')).toContainText(
      "Spiellink ist ungültig",
    );
    await expect(
      page.getByRole("link", { name: "← Zurück zur Liga", exact: true }),
    ).toHaveAttribute("href", "/darts");
  }
  await page.goto("/darts/spiel?match=999", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-live-state="error"]')).toContainText(
    "nicht gefunden",
  );
});

test("Portal-Ausfall ist wiederholbar und löscht bestehende Live-Daten nicht", async ({
  page,
}) => {
  const api = await mockLive(page);
  api.failTeam(true);
  await page.goto("/darts/spiel?match=102", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-live-state="error"]')).toBeVisible();
  api.failTeam(false);
  await page.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(page.locator('[data-live-field="score"]')).toHaveText("3:2");
  api.failTeam(true);
  await page.clock.fastForward(61_000);
  await expect(page.locator('[data-live-state="content"]')).toBeVisible();
  await expect(page.locator('[data-live-field="score"]')).toHaveText("3:2");
});

test("pagehide räumt Verbindungen auf, pageshow gleicht sofort ab", async ({
  page,
}) => {
  const api = await mockLive(page);
  await page.goto("/darts/spiel?match=102", { waitUntil: "domcontentloaded" });
  await expect.poll(api.subscribed).toBe(true);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  const counts = api.reads();
  await page.clock.fastForward(65_000);
  expect(api.reads()).toEqual(counts);
  api.setRecords([snapshot({ setsHome: 6 })]);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect(page.locator('[data-live-field="score"]')).toHaveText("6:2");
});
