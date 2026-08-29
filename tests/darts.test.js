import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DART_API_PATTERN = "**/frontend/participant/633505";
const DART_TABLE_API_PATTERN = "**/frontend/event/24970/phase/0/round/0/table";

const dartApiResponse = {
  participant: {
    id: 633505,
    displayName: "SCO-Darts Team Fülltreffer",
    teamSeason: {
      season: {
        name: "2026-1",
        start: "2026-09-07",
        end: "2027-08-31",
      },
      playingVenue: {
        name: "Sportheim Oberfüllbach",
        locationStreet: "Lützelbucherstrasse 7",
        locationPostalCode: "96237",
        locationCity: "Ebersdorf bei Coburg",
        numberOfBoards: 3,
      },
      teamMembers: [
        {
          id: 2,
          displayName: "Dominik Hohnhaus",
          memberPlayerName: "Hohnhaus, Dominik",
          tc1: true,
        },
        {
          id: 1,
          displayName: "André Bellmann",
          memberPlayerName: "Bellmann, André",
          tc2: true,
        },
        {
          id: 3,
          displayName: "Marion Bauer",
          memberPlayerName: "Bauer, Marion",
        },
      ],
    },
  },
  matches: [
    {
      id: 102,
      eventId: 24970,
      active: true,
      statusCd: "OPEN",
      datePlanned: "2026-09-25T16:00:00.000+0000",
      gameNr: 8,
      event: { name: "Liga B2" },
      round: { name: "Spieltag 2", index: 1 },
      participantHome: {
        id: 633505,
        displayName: "SCO-Darts Team Fülltreffer",
      },
      participantGuest: {
        id: 632080,
        displayName: "Drächer Bull´s Eichen",
      },
    },
    {
      id: 100,
      eventId: 24970,
      active: true,
      statusCd: "FINISH",
      datePlanned: "2026-08-14T16:00:00.000+0000",
      gameNr: 1,
      setsHome: 8,
      setsAway: 12,
      event: { name: "Liga B2" },
      round: { name: "Testspiel", index: -1 },
      participantHome: {
        id: 633505,
        displayName: "SCO-Darts Team Fülltreffer",
      },
      participantGuest: { id: 1, displayName: "DC Test" },
    },
    {
      id: 101,
      eventId: 24970,
      active: true,
      statusCd: "OPEN",
      datePlanned: "2026-09-11T16:00:00.000+0000",
      gameNr: 2,
      event: { name: "Liga B2" },
      round: { name: "Spieltag 1", index: 0 },
      participantHome: { id: 632076, displayName: "SDC Cafe Q" },
      participantGuest: {
        id: 633505,
        displayName: "SCO-Darts Team Fülltreffer",
      },
    },
  ],
};

const dartTableResponse = {
  tableEntries: [
    {
      index: 0,
      name: "TABLE",
      tableEntries: [
        {
          index: 0,
          placement: "1.",
          participantId: 632076,
          participantName: "SDC Cafe Q",
          matchCount: 4,
          win: 3,
          tie: 0,
          lost: 1,
          points1: 6,
          sets1: 48,
          sets2: 32,
        },
        {
          index: 1,
          placement: "2.",
          participantId: 633505,
          participantName: "SCO-Darts Team Fülltreffer",
          matchCount: 4,
          win: 2,
          tie: 1,
          lost: 1,
          points1: 5,
          sets1: 44,
          sets2: 36,
        },
      ],
    },
  ],
};

async function mockDartApi(page, response = dartApiResponse) {
  let requestCount = 0;

  await page.route(DART_API_PATTERN, async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  return () => requestCount;
}

async function mockDartTableApi(page, response = dartTableResponse) {
  let requestCount = 0;

  await page.route(DART_TABLE_API_PATTERN, async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  return () => requestCount;
}

test.describe("Darts-Mannschaftsseite", () => {
  test("zeigt Mannschaft, Spielplan, Ergebnisse und Kader", async ({
    page,
  }) => {
    const getRequestCount = await mockDartApi(page);
    const getTableRequestCount = await mockDartTableApi(page);

    await page.goto("/darts");
    await expect(page.locator('[data-dart-state="content"]')).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "SCO-Darts Team Fülltreffer" }),
    ).toBeVisible();
    await expect(
      page.getByText("Liga B2", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Saison 2026/27", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Sportheim Oberfüllbach")).toBeVisible();
    await expect(page.getByText("3 Boards")).toBeVisible();

    const upcomingMatches = page.locator('[data-dart-list="upcoming"] > li');
    await expect(upcomingMatches).toHaveCount(2);
    await expect(upcomingMatches.nth(0)).toContainText("Spieltag 1");
    await expect(upcomingMatches.nth(0)).toContainText("SDC Cafe Q");
    await expect(upcomingMatches.nth(0)).toContainText("18:00 Uhr");
    await expect(upcomingMatches.nth(0)).toContainText("Auswärts");
    await expect(upcomingMatches.nth(1)).toContainText("Spieltag 2");
    await expect(upcomingMatches.nth(0)).toHaveAttribute(
      "data-highlighted",
      "true",
    );
    await expect(page.getByText(/Spiel Nr\./)).toHaveCount(0);

    const results = page.locator('[data-dart-list="results"] > li');
    await expect(results).toHaveCount(1);
    await expect(results.first()).toContainText("8:12");
    await expect(results.first()).toHaveAttribute(
      "data-match-state",
      "finished",
    );

    const standings = page.locator('[data-dart-list="standings"] > tr');
    await expect(standings).toHaveCount(2);
    await expect(standings.nth(0)).toContainText("SDC Cafe Q");
    await expect(standings.nth(0)).toContainText("48:32");
    await expect(standings.nth(0)).toContainText("6");
    await expect(standings.nth(1)).toHaveAttribute("data-own-team", "true");

    const members = page.locator('[data-dart-list="members"] > li');
    await expect(members).toHaveCount(3);
    await expect(members.nth(0)).toContainText("Dominik Hohnhaus👑");
    await expect(members.nth(0)).toContainText("TC 1");
    await expect(members.nth(1)).toContainText("André Bellmann👑");
    await expect(members.nth(1)).toContainText("TC 2");
    await expect(members.nth(2)).toContainText("Marion Bauer");
    await expect(members.nth(2)).not.toContainText("👑");

    await expect(
      page.getByRole("link", { name: "Darts", exact: true }).first(),
    ).toHaveAttribute("aria-current", "page");
    expect(getRequestCount()).toBe(1);
    expect(getTableRequestCount()).toBe(1);
  });

  test("zeigt verständliche Leerzustände", async ({ page }) => {
    await mockDartApi(page, {
      ...dartApiResponse,
      participant: {
        ...dartApiResponse.participant,
        teamSeason: {
          ...dartApiResponse.participant.teamSeason,
          teamMembers: [],
        },
      },
      matches: [],
    });
    await mockDartTableApi(page, {
      tableEntries: [{ index: 0, name: "TABLE" }],
    });

    await page.goto("/darts");
    await expect(page.locator('[data-dart-state="content"]')).toBeVisible();
    await expect(
      page.getByText("Aktuell sind keine offenen Ligaspiele vorhanden."),
    ).toBeVisible();
    await expect(
      page.getByText("Zum Saisonstart liegen noch keine Ergebnisse vor."),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Der Mannschaftskader ist derzeit noch nicht veröffentlicht.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Die Rangliste wird nach den ersten Ergebnissen angezeigt.",
      ),
    ).toBeVisible();
  });

  test("zeigt bei einem API-Fehler eine Alternative", async ({ page }) => {
    await mockDartTableApi(page);
    await page.route(DART_API_PATTERN, (route) =>
      route.fulfill({ status: 503, body: "Nicht verfügbar" }),
    );

    await page.goto("/darts");
    await expect(page.locator('[data-dart-state="error"]')).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Spielplan bei 2K Darts" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Erneut versuchen" }),
    ).toBeVisible();
  });

  test("schaltet mobil barrierefrei zwischen Spielplan und Rangliste", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDartApi(page);
    await mockDartTableApi(page);

    await page.goto("/darts");
    await expect(page.locator('[data-dart-state="content"]')).toBeVisible();

    const scheduleTab = page.getByRole("tab", { name: "Kommende Spiele" });
    const standingsTab = page.getByRole("tab", { name: "Rangliste" });
    const schedulePanel = page.getByRole("tabpanel", {
      name: "Kommende Spiele",
    });
    const standingsPanel = page.getByRole("tabpanel", { name: "Rangliste" });

    await expect(scheduleTab).toHaveAttribute("aria-selected", "true");
    await expect(schedulePanel).toBeVisible();
    await expect(standingsPanel).toBeHidden();

    await standingsTab.click();
    await expect(standingsTab).toHaveAttribute("aria-selected", "true");
    await expect(standingsPanel).toBeVisible();
    await expect(schedulePanel).toBeHidden();
    await expect(
      standingsPanel.getByText("SCO-Darts Team Fülltreffer"),
    ).toBeVisible();

    await standingsTab.press("ArrowLeft");
    await expect(scheduleTab).toBeFocused();
    await expect(schedulePanel).toBeVisible();

    const squadBox = await page.locator(".dart-squad-area").boundingBox();
    const venueBox = await page.locator(".dart-venue-area").boundingBox();
    expect(squadBox).not.toBeNull();
    expect(venueBox).not.toBeNull();
    expect(venueBox.y).toBeGreaterThan(squadBox.y);
  });

  test("behandelt einen Tabellenfehler unabhängig von den Mannschaftsdaten", async ({
    page,
  }) => {
    await mockDartApi(page);
    await page.route(DART_TABLE_API_PATTERN, (route) =>
      route.fulfill({ status: 503, body: "Nicht verfügbar" }),
    );

    await page.goto("/darts");
    await expect(page.locator('[data-dart-state="content"]')).toBeVisible();
    await expect(
      page.getByText("Die Rangliste ist gerade nicht verfügbar."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Gemeldeter Kader" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Tabelle bei 2K Darts" }),
    ).toBeVisible();
  });

  test("bleibt mit geladenen Daten barrierefrei", async ({ page }) => {
    await mockDartApi(page);
    await mockDartTableApi(page);
    await page.goto("/darts");
    await expect(page.locator('[data-dart-state="content"]')).toBeVisible();

    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(scan.violations).toEqual([]);
  });

  test("versorgt alle Nächstes-Spiel-Widgets mit nur einem Request", async ({
    page,
  }) => {
    const getRequestCount = await mockDartApi(page);
    const getTableRequestCount = await mockDartTableApi(page);

    await page.goto("/");
    const fullWidget = page.locator(
      '.next-match-container[data-small="false"]',
    );
    await expect(fullWidget).toContainText("Auswärts");
    await expect(fullWidget).toContainText("SDC Cafe Q");
    await expect(fullWidget).toContainText("Spieltag 1");
    const compactWidgetLink = page.getByRole("link", {
      name: "Nächstes Dartspiel und Spielplan ansehen",
    });
    await expect(compactWidgetLink).toHaveAttribute("href", "/darts");
    await expect(fullWidget.getByRole("link")).toHaveCount(0);
    expect(getRequestCount()).toBe(1);
    expect(getTableRequestCount()).toBe(0);
  });
});
