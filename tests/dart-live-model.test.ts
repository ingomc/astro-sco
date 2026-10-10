import { test, expect } from "@playwright/test";
import { normalizeDartTeamData } from "../src/lib/darts";
import {
  LiveFixtureStore,
  normalizeLiveRubber,
} from "../src/lib/dart-live-model";
import { rubber, teamResponse } from "./dart-live-fixtures.js";

const match = () =>
  normalizeDartTeamData(teamResponse).matches.find(
    (match) => match.id === 102,
  )!;

test("bindet ausschließlich passende Datenbank, Spiel-ID und Event-ID", () => {
  expect(normalizeLiveRubber(rubber(), 102)).not.toBeNull();
  for (const invalid of [
    { database: "10" },
    { groupKey: "101" },
    { originalEventId: 999 },
    { typ: "TURNIER" },
    { matchPlayers: [] },
    { status: 3 },
  ]) {
    expect(normalizeLiveRubber(rubber(invalid), 102)).toBeNull();
  }
  expect(
    normalizeLiveRubber(rubber({ originalEventId: undefined }), 102),
  ).not.toBeNull();
});

test("Uhrzeit und abgeschlossene Einzelpartien erzeugen keinen Live-Status", () => {
  const store = new LiveFixtureStore(match());
  store.apply([rubber({ status: 2 })]);
  expect(store.snapshot().isLive).toBe(false);
  store.apply([rubber({ lastUpdate: "2026-10-02T18:01:00Z" })]);
  store.apply([rubber({ status: 2, lastUpdate: "2026-10-02T18:02:00Z" })]);
  expect(store.snapshot().isLive).toBe(true);
  store.match = {
    ...store.match,
    isFinished: true,
    scoreHome: 12,
    scoreGuest: 8,
  };
  expect(store.snapshot()).toMatchObject({
    isLive: false,
    scoreHome: 12,
    scoreGuest: 8,
  });
});

test("verspätete Snapshots und doppelte Frames überschreiben keine neueren Scores", () => {
  const store = new LiveFixtureStore(match());
  const newer = rubber({ lastUpdate: "2026-10-02T18:02:00Z", setsHome: 4 });
  store.apply([newer], 100);
  expect(store.apply([rubber()], 200)).toBe(false);
  expect(store.apply([newer], 300)).toBe(false);
  expect(store.snapshot()).toMatchObject({ scoreHome: 4, lastUpdated: 100 });
  store.apply([
    rubber({
      matchKey: "2002",
      status: 2,
      board: "2",
      lastUpdate: "2026-10-02T18:03:00Z",
      setsHome: 5,
    }),
  ]);
  expect(store.snapshot().rubbers.map((item) => item.key)).toEqual([
    "2001",
    "2002",
  ]);
  expect(store.snapshot().scoreHome).toBe(5);
});

test("Löschungen bleiben gegen verspätete Daten geschützt, fehlende Scores sind keine Null", () => {
  const store = new LiveFixtureStore(match());
  store.apply([rubber({ setsHome: undefined, setsGuest: undefined })]);
  expect(store.snapshot().scoreHome).toBeNull();
  store.apply([
    rubber({ status: 4, matchPlayers: [], lastUpdate: "2026-10-02T18:01:00Z" }),
  ]);
  store.apply([rubber()]);
  expect(store.snapshot().rubbers).toHaveLength(0);
});

test("3K-Statistiken berücksichtigen laufende Einzelwürfe und fehlende Werte", () => {
  const data = rubber({ singleDarts: true });
  Object.assign(data.matchPlayers[0], {
    scoreAdditional: 40,
    dartsAdditional: 2,
    dart1: "T20",
    dart2: "D20",
    dart3: "-",
    activePlayerIndex: 1,
    playerName1: "Doppel A",
    playerName2: "Doppel B",
  });
  const result = normalizeLiveRubber(data, 102)!;
  expect(result.players[0]).toMatchObject({
    lastScore: 100,
    average: 55.4,
    darts: 17,
    highFinish: 80,
    counts: [5, 2, 3, 1, 0],
    singleDarts: ["T20", "D20", "-"],
    activeName: "Doppel B",
  });
  const missing = normalizeLiveRubber(
    rubber({
      currentplayerIndex: "",
      startplayerIndex: -1,
      matchPlayers: [
        {
          index: 0,
          playerName: "A",
          legs: 0,
          points: 0,
          lastScore: 0,
          darts: 0,
          scoreTotal: 0,
          dartsTotal: 0,
          count180: 0,
        },
        {
          index: 1,
          playerName: "B",
          legs: 0,
          lastScore: 999,
          darts: -1,
          scoreTotal: 10,
        },
      ],
    }),
    102,
  )!;
  expect(missing.currentPlayer).toBeNull();
  expect(missing.startPlayer).toBeNull();
  expect(missing.players[0]).toMatchObject({
    lastScore: 0,
    darts: 0,
    points: 0,
    average: null,
    counts: [null, null, null, null, 0],
  });
  expect(missing.players[1]).toMatchObject({
    lastScore: null,
    darts: null,
    points: null,
    average: null,
  });
});
