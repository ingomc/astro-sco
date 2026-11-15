import { DART_EVENT_ID, type DartMatch } from "./darts";

export const DART_LIVE_API =
  import.meta.env?.DEV && import.meta.env.PUBLIC_DART_LIVE_DEMO === "1"
    ? "/__dart-demo/api/live/"
    : "https://live.3k-darts.com/dartsscorer-liveticker/api/v1/";
export const DART_LIVE_DATABASE = "5";
export const dartMatchUrl = (id: number) => `/darts/spiel?match=${id}`;
export const dartLiveSourceUrl = (id: number) =>
  `https://live.3k-darts.com/event/5/${id}`;

export type LivePlayer = {
  index: number;
  name: string;
  legs: number | null;
  points: number | null;
  sets: number | null;
  lastScore: number | null;
  darts: number | null;
  average: number | null;
  highFinish: number | null;
  counts: (number | null)[];
  singleDarts: string[];
  activeName: string | null;
};
export type LiveRubber = {
  key: string;
  revision: number;
  status: 0 | 1 | 2 | 4;
  board: string;
  mode: string;
  currentPlayer: number | null;
  startPlayer: number | null;
  players: LivePlayer[];
  scoreHome: number | null;
  scoreGuest: number | null;
  totalLegsHome: number | null;
  totalLegsGuest: number | null;
};
export type LiveConnection =
  | "connecting"
  | "connected"
  | "polling"
  | "unavailable";
export type LiveFixture = {
  match: DartMatch;
  rubbers: LiveRubber[];
  isLive: boolean;
  scoreHome: number | null;
  scoreGuest: number | null;
  totalLegsHome: number | null;
  totalLegsGuest: number | null;
  lastUpdated: number | null;
  connection: LiveConnection;
};

type ObjectData = Record<string, unknown>;
export function objectData(value: unknown): ObjectData | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ObjectData)
    : null;
}
const counter = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
const identifier = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

export function normalizeLiveRubber(
  value: unknown,
  fixtureId: number,
): LiveRubber | null {
  const raw = objectData(value);
  if (
    !raw ||
    identifier(raw.database) !== DART_LIVE_DATABASE ||
    identifier(raw.groupKey) !== String(fixtureId) ||
    raw.typ !== "LIGA" ||
    (raw.originalEventId != null &&
      identifier(raw.originalEventId) !== String(DART_EVENT_ID)) ||
    ![0, 1, 2, 4].includes(Number(raw.status))
  )
    return null;
  const key = identifier(raw.matchKey);
  if (!key) return null;
  const players = (Array.isArray(raw.matchPlayers) ? raw.matchPlayers : [])
    .map(objectData)
    .filter((player): player is ObjectData => Boolean(player))
    .map((player): LivePlayer => {
      const additionalDarts = counter(player.dartsAdditional) ?? 0;
      const additionalScore = counter(player.scoreAdditional);
      const darts = counter(player.darts);
      const dartsTotal = counter(player.dartsTotal);
      const scoreTotal = counter(player.scoreTotal);
      const includeAdditional = additionalDarts > 0 && additionalScore !== null;
      const last = counter(player.lastScore);
      const lastScore = last !== null && last <= 180 ? last : null;
      const combinedScore = (lastScore ?? 0) + (additionalScore ?? 0);
      const activeIndex = counter(player.activePlayerIndex);
      const activeName =
        activeIndex !== null && activeIndex < 4
          ? player[`playerName${activeIndex + 1}`]
          : null;
      return {
        index: counter(player.index) ?? -1,
        name:
          typeof player.playerName === "string" ? player.playerName.trim() : "",
        legs: counter(player.legs),
        sets: counter(player.sets),
        points: counter(player.points),
        lastScore:
          (lastScore !== null ||
            (additionalScore !== null && additionalScore > 0)) &&
          combinedScore <= 180
            ? combinedScore
            : null,
        darts: darts === null ? null : darts + additionalDarts,
        // Match average, weighted by darts, including an in-progress single-dart visit (3K semantics).
        average:
          dartsTotal !== null && dartsTotal > 0 && scoreTotal !== null
            ? Math.round(
                ((scoreTotal + (includeAdditional ? additionalScore! : 0)) /
                  (dartsTotal + (includeAdditional ? additionalDarts : 0))) *
                  30,
              ) / 10
            : null,
        highFinish: counter(player.highfinish),
        counts: [60, 80, 100, 140, 180].map((score) =>
          counter(player[`count${score}`]),
        ),
        singleDarts:
          raw.singleDarts === true
            ? [player.dart1, player.dart2, player.dart3].map((dart) =>
                typeof dart === "string" &&
                /^(?:-|0|[SDT]?(?:[1-9]|1[0-9]|20)|(?:[SD]?BULL))$/i.test(dart)
                  ? dart
                  : "—",
              )
            : [],
        activeName:
          typeof activeName === "string" && activeName.trim()
            ? activeName.trim()
            : null,
      };
    })
    .sort((a, b) => a.index - b.index);
  if (
    Number(raw.status) !== 4 &&
    (players.length !== 2 ||
      players[0].index !== 0 ||
      players[1].index !== 1 ||
      players.some((player) => !player.name))
  )
    return null;
  const revision =
    typeof raw.lastUpdate === "string" ? Date.parse(raw.lastUpdate) : NaN;
  return {
    key,
    revision: Number.isFinite(revision) ? revision : 0,
    status: Number(raw.status) as LiveRubber["status"],
    board: identifier(raw.board),
    mode: typeof raw.mode === "string" ? raw.mode.trim() : "",
    currentPlayer:
      counter(raw.currentplayerIndex) !== null &&
      Number(raw.currentplayerIndex) <= 1
        ? Number(raw.currentplayerIndex)
        : null,
    startPlayer:
      counter(raw.startplayerIndex) !== null &&
      Number(raw.startplayerIndex) <= 1
        ? Number(raw.startplayerIndex)
        : null,
    players,
    scoreHome: counter(raw.setsHome),
    scoreGuest: counter(raw.setsGuest),
    totalLegsHome: counter(raw.legsHome),
    totalLegsGuest: counter(raw.legsGuest),
  };
}

/** Keep revisions (including deletions) so delayed REST responses cannot undo push updates. */
export class LiveFixtureStore {
  private records = new Map<string, LiveRubber>();
  private started = false;
  private updated: number | null = null;
  private overall: LiveRubber | null = null;
  connection: LiveConnection = "connecting";

  constructor(public match: DartMatch) {}

  apply(values: unknown[], receivedAt = Date.now()) {
    let changed = false;
    for (const value of values) {
      const next = normalizeLiveRubber(value, this.match.id);
      if (!next) continue;
      const previous = this.records.get(next.key);
      if (previous && next.revision <= previous.revision) continue;
      // A response without a source revision may bootstrap a record, never overwrite one.
      this.records.set(next.key, next);
      changed = true;
      if (next.status === 1) this.started = true;
      if (
        next.status !== 4 &&
        next.scoreHome !== null &&
        next.scoreGuest !== null &&
        (!this.overall || next.revision > this.overall.revision)
      )
        this.overall = next;
    }
    if (changed) this.updated = receivedAt;
    return changed;
  }

  snapshot(): LiveFixture {
    const rubbers = [...this.records.values()]
      .filter((rubber) => rubber.status !== 4)
      .sort(
        (a, b) =>
          Number(b.status === 1) - Number(a.status === 1) ||
          a.board.localeCompare(b.board, "de", { numeric: true }) ||
          a.key.localeCompare(b.key, "de", { numeric: true }),
      );
    return {
      match: this.match,
      rubbers,
      isLive: !this.match.isFinished && this.started,
      scoreHome: this.match.isFinished
        ? this.match.scoreHome
        : (this.overall?.scoreHome ?? null),
      scoreGuest: this.match.isFinished
        ? this.match.scoreGuest
        : (this.overall?.scoreGuest ?? null),
      totalLegsHome: this.overall?.totalLegsHome ?? null,
      totalLegsGuest: this.overall?.totalLegsGuest ?? null,
      lastUpdated: this.updated,
      connection: this.connection,
    };
  }
}
