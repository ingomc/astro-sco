export const DART_TEAM_ID = 633505;
export const DART_EVENT_ID = 24970;
export const DART_API_URL =
  "https://backend4.2k-dart-software.com/2k-backend4/api/v1/frontend/participant/633505";
export const DART_TABLE_API_URL =
  "https://backend4.2k-dart-software.com/2k-backend4/api/v1/frontend/event/24970/phase/0/round/0/table";
export const DART_SOURCE_URL =
  "https://www.2k-dart-software.com/frontend/events/5/event/24970/participants/633505";
export const DART_TABLE_SOURCE_URL =
  "https://www.2k-dart-software.com/frontend/events/5/event/24970/table";

const DART_CACHE_KEY = "sco_dart_team_2026_27_v1";
const DART_STANDINGS_CACHE_KEY = "sco_dart_standings_2026_27_v1";
const DART_CACHE_DURATION = 1000 * 60 * 15;
const DART_TIME_ZONE = "Europe/Berlin";

type RawSeason = {
  name?: string;
  start?: string;
  end?: string;
};

type RawParticipant = {
  id?: number;
  displayName?: string;
  teamSeason?: {
    name?: string;
    season?: RawSeason;
    playingVenue?: {
      name?: string;
      locationStreet?: string;
      locationPostalCode?: string;
      locationCity?: string;
      numberOfBoards?: number;
    };
    teamMembers?: RawTeamMember[];
  };
};

type RawTeamMember = {
  id?: number;
  displayName?: string;
  memberPlayerName?: string;
  tc1?: boolean;
  tc2?: boolean;
};

type RawMatch = {
  id?: number;
  eventId?: number;
  active?: boolean;
  statusCd?: string;
  datePlanned?: string;
  gameNr?: number;
  setsHome?: number;
  setsAway?: number;
  event?: {
    name?: string;
  };
  round?: {
    name?: string;
    index?: number;
  };
  participantHome?: {
    id?: number;
    displayName?: string;
  };
  participantGuest?: {
    id?: number;
    displayName?: string;
  };
};

type RawDartTeamResponse = {
  participant?: RawParticipant;
  matches?: RawMatch[];
};

type RawStandingEntry = {
  index?: number;
  placement?: string;
  participantId?: number;
  participantName?: string;
  participant?: {
    id?: number;
    displayName?: string;
  };
  matchCount?: number;
  win?: number;
  tie?: number;
  lost?: number;
  points1?: number;
  sets1?: number;
  sets2?: number;
};

type RawDartStandingsResponse = {
  tableEntries?: Array<{
    tableEntries?: RawStandingEntry[];
  }>;
};

export type DartTeamMember = {
  id: number;
  name: string;
  sortName: string;
  teamCaptain: 1 | 2 | null;
};

export type DartVenue = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  boards: number | null;
};

export type DartMatch = {
  id: number;
  gameNumber: number | null;
  roundName: string;
  roundIndex: number;
  datePlanned: string;
  status: string;
  isFinished: boolean;
  isHome: boolean;
  homeTeam: string;
  guestTeam: string;
  opponent: string;
  scoreHome: number | null;
  scoreGuest: number | null;
};

export type DartTeamData = {
  teamId: number;
  teamName: string;
  leagueName: string;
  seasonName: string;
  venue: DartVenue | null;
  members: DartTeamMember[];
  matches: DartMatch[];
  upcomingMatches: DartMatch[];
  results: DartMatch[];
  nextMatch: DartMatch | null;
};

export type DartStanding = {
  position: string;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  setsFor: number;
  setsAgainst: number;
};

declare global {
  interface Window {
    __scoDartTeamPromise?: Promise<DartTeamData>;
    __scoDartStandingsPromise?: Promise<DartStanding[]>;
  }
}

function isFinishedStatus(status?: string) {
  return status === "FINISH" || status === "FINISHED";
}

function valueOrFallback(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function deriveSeasonName(season?: RawSeason) {
  const startYear = season?.start?.slice(0, 4);
  const endYear = season?.end?.slice(2, 4);

  if (startYear && endYear) return `${startYear}/${endYear}`;
  return valueOrFallback(season?.name, "2026/27");
}

function matchTimestamp(match: DartMatch) {
  const timestamp = Date.parse(match.datePlanned);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function dateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: DART_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

export function normalizeDartTeamData(
  response: RawDartTeamResponse,
  now = new Date(),
): DartTeamData {
  const participant = response.participant ?? {};
  const teamSeason = participant.teamSeason;
  const teamId = participant.id ?? DART_TEAM_ID;
  const teamName = valueOrFallback(
    participant.displayName ?? teamSeason?.name,
    "SCO-Darts Team Fülltreffer",
  );

  const members = (teamSeason?.teamMembers ?? [])
    .map(
      (member): DartTeamMember => ({
        id: member.id ?? 0,
        name: valueOrFallback(member.displayName, "Unbekannter Spieler"),
        sortName: valueOrFallback(
          member.memberPlayerName,
          member.displayName ?? "",
        ),
        teamCaptain: member.tc1 ? 1 : member.tc2 ? 2 : null,
      }),
    )
    .sort((a, b) => {
      const captainOrder =
        Number(Boolean(b.teamCaptain)) - Number(Boolean(a.teamCaptain));
      if (captainOrder !== 0) return captainOrder;

      if (a.teamCaptain && b.teamCaptain && a.teamCaptain !== b.teamCaptain) {
        return a.teamCaptain - b.teamCaptain;
      }

      return a.sortName.localeCompare(b.sortName, "de", {
        sensitivity: "base",
      });
    });

  const matches = (response.matches ?? [])
    .filter(
      (match) =>
        match.active !== false &&
        match.eventId === DART_EVENT_ID &&
        Boolean(match.datePlanned),
    )
    .map((match): DartMatch => {
      const isHome = match.participantHome?.id === teamId;
      const homeTeam = valueOrFallback(
        match.participantHome?.displayName,
        "Noch offen",
      );
      const guestTeam = valueOrFallback(
        match.participantGuest?.displayName,
        "Noch offen",
      );

      return {
        id: match.id ?? 0,
        gameNumber: match.gameNr ?? null,
        roundName: valueOrFallback(match.round?.name, "Spieltag"),
        roundIndex: match.round?.index ?? Number.MAX_SAFE_INTEGER,
        datePlanned: match.datePlanned ?? "",
        status: match.statusCd ?? "OPEN",
        isFinished: isFinishedStatus(match.statusCd),
        isHome,
        homeTeam,
        guestTeam,
        opponent: isHome ? guestTeam : homeTeam,
        scoreHome: match.setsHome ?? null,
        scoreGuest: match.setsAway ?? null,
      };
    })
    .sort(
      (a, b) =>
        matchTimestamp(a) - matchTimestamp(b) || a.roundIndex - b.roundIndex,
    );

  const upcomingMatches = matches.filter((match) => !match.isFinished);
  const results = matches
    .filter((match) => match.isFinished)
    .sort((a, b) => matchTimestamp(b) - matchTimestamp(a));
  const today = dateKey(now);
  const nextMatch =
    upcomingMatches.find((match) => dateKey(match.datePlanned) >= today) ??
    upcomingMatches[0] ??
    null;
  const venue = teamSeason?.playingVenue;

  return {
    teamId,
    teamName,
    leagueName: valueOrFallback(
      response.matches?.find((match) => match.eventId === DART_EVENT_ID)?.event
        ?.name,
      "Liga B2",
    ),
    seasonName: deriveSeasonName(teamSeason?.season),
    venue: venue
      ? {
          name: valueOrFallback(venue.name, "Sportheim Oberfüllbach"),
          street: venue.locationStreet?.trim() ?? "",
          postalCode: venue.locationPostalCode?.trim() ?? "",
          city: venue.locationCity?.trim() ?? "",
          boards: venue.numberOfBoards ?? null,
        }
      : null,
    members,
    matches,
    upcomingMatches,
    results,
    nextMatch,
  };
}

export function normalizeDartStandings(
  response: RawDartStandingsResponse,
): DartStanding[] {
  const entries =
    response.tableEntries?.find((table) => Array.isArray(table.tableEntries))
      ?.tableEntries ?? [];

  return entries
    .map((entry, index): DartStanding => {
      const position =
        entry.placement?.trim() || `${(entry.index ?? index) + 1}.`;

      return {
        position,
        teamId: entry.participantId ?? entry.participant?.id ?? 0,
        teamName: valueOrFallback(
          entry.participantName ?? entry.participant?.displayName,
          "Unbekannte Mannschaft",
        ),
        played: entry.matchCount ?? 0,
        won: entry.win ?? 0,
        drawn: entry.tie ?? 0,
        lost: entry.lost ?? 0,
        points: entry.points1 ?? 0,
        setsFor: entry.sets1 ?? 0,
        setsAgainst: entry.sets2 ?? 0,
      };
    })
    .sort((a, b) => {
      const positionA = Number.parseInt(a.position, 10);
      const positionB = Number.parseInt(b.position, 10);
      return positionA - positionB;
    });
}

function readCachedTeamData() {
  try {
    const cached = sessionStorage.getItem(DART_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as {
      timestamp?: number;
      data?: DartTeamData;
    };

    if (
      !parsed.timestamp ||
      !parsed.data ||
      Date.now() - parsed.timestamp >= DART_CACHE_DURATION
    ) {
      sessionStorage.removeItem(DART_CACHE_KEY);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function cacheTeamData(data: DartTeamData) {
  try {
    sessionStorage.setItem(
      DART_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data }),
    );
  } catch {
    // Die Anzeige funktioniert auch, wenn Session Storage nicht verfügbar ist.
  }
}

function readCachedStandings() {
  try {
    const cached = sessionStorage.getItem(DART_STANDINGS_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as {
      timestamp?: number;
      data?: DartStanding[];
    };

    if (
      !parsed.timestamp ||
      !parsed.data ||
      Date.now() - parsed.timestamp >= DART_CACHE_DURATION
    ) {
      sessionStorage.removeItem(DART_STANDINGS_CACHE_KEY);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function cacheStandings(data: DartStanding[]) {
  try {
    sessionStorage.setItem(
      DART_STANDINGS_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data }),
    );
  } catch {
    // Die Anzeige funktioniert auch, wenn Session Storage nicht verfügbar ist.
  }
}

export async function getDartTeamData(options: { force?: boolean } = {}) {
  if (options.force) {
    try {
      sessionStorage.removeItem(DART_CACHE_KEY);
    } catch {
      // Kein Cache vorhanden oder Session Storage ist nicht verfügbar.
    }
    window.__scoDartTeamPromise = undefined;
  }

  const cached = readCachedTeamData();
  if (cached) return cached;

  if (!window.__scoDartTeamPromise) {
    window.__scoDartTeamPromise = fetch(DART_API_URL, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Dart-API antwortet mit Status ${response.status}`);
        }

        const data = normalizeDartTeamData(
          (await response.json()) as RawDartTeamResponse,
        );
        cacheTeamData(data);
        return data;
      })
      .catch((error) => {
        window.__scoDartTeamPromise = undefined;
        throw error;
      });
  }

  return window.__scoDartTeamPromise;
}

export async function getDartStandings(options: { force?: boolean } = {}) {
  if (options.force) {
    try {
      sessionStorage.removeItem(DART_STANDINGS_CACHE_KEY);
    } catch {
      // Kein Cache vorhanden oder Session Storage ist nicht verfügbar.
    }
    window.__scoDartStandingsPromise = undefined;
  }

  const cached = readCachedStandings();
  if (cached) return cached;

  if (!window.__scoDartStandingsPromise) {
    window.__scoDartStandingsPromise = fetch(DART_TABLE_API_URL, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Dart-Tabellen-API antwortet mit Status ${response.status}`,
          );
        }

        const data = normalizeDartStandings(
          (await response.json()) as RawDartStandingsResponse,
        );
        cacheStandings(data);
        return data;
      })
      .catch((error) => {
        window.__scoDartStandingsPromise = undefined;
        throw error;
      });
  }

  return window.__scoDartStandingsPromise;
}

export function formatDartDate(
  value: string,
  style: "short" | "long" = "short",
) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: DART_TIME_ZONE,
    weekday: style === "long" ? "long" : "short",
    day: "2-digit",
    month: "2-digit",
    ...(style === "long" ? { year: "numeric" } : {}),
  }).format(new Date(value));
}

export function formatDartTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: DART_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
