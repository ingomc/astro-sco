export const TEAM_API =
  "https://backend4.3k-darts.com/2k-backend4/api/v1/frontend/participant/633505";
export const TABLE_API =
  "https://backend4.3k-darts.com/2k-backend4/api/v1/frontend/event/24970/phase/0/round/0/table";
export const LIVE_API =
  "https://live.3k-darts.com/dartsscorer-liveticker/api/v1/";
export const teamResponse = {
  participant: { id: 633505, displayName: "SCO-Darts Team Fülltreffer" },
  matches: [
    {
      id: 101,
      eventId: 24970,
      active: true,
      statusCd: "OPEN",
      datePlanned: "2026-10-03T16:00:00Z",
      round: { name: "Spieltag 4", index: 3 },
      participantHome: {
        id: 633505,
        displayName: "SCO-Darts Team Fülltreffer",
      },
      participantGuest: { id: 7, displayName: "Nächster Gegner" },
    },
    {
      id: 102,
      eventId: 24970,
      active: true,
      statusCd: "OPEN",
      datePlanned: "2026-10-01T16:00:00Z",
      round: { name: "Spieltag 3", index: 2 },
      participantHome: {
        id: 633505,
        displayName: "SCO-Darts Team Fülltreffer",
      },
      participantGuest: { id: 8, displayName: "DC Beispiel" },
    },
  ],
};
export function rubber(overrides = {}) {
  return {
    database: "5",
    typ: "LIGA",
    originalEventId: 24970,
    groupKey: "102",
    id: 2001,
    matchKey: "2001",
    board: "1",
    status: 1,
    mode: "Best of 5 Legs",
    currentplayerIndex: 0,
    startplayerIndex: 0,
    singleDarts: false,
    lastUpdate: "2026-10-02T18:00:00Z",
    setsHome: 3,
    setsGuest: 2,
    legsHome: 9,
    legsGuest: 11,
    matchPlayers: [
      {
        index: 0,
        playerName: "André Bellmann",
        legs: 1,
        points: 121,
        lastScore: 60,
        darts: 15,
        scoreTotal: 1382,
        dartsTotal: 75,
        highfinish: 80,
        count60: 5,
        count80: 2,
        count100: 3,
        count140: 1,
        count180: 0,
      },
      {
        index: 1,
        playerName: "Beispiel Gegner",
        legs: 2,
        points: 80,
        lastScore: 100,
        darts: 18,
        scoreTotal: 1924,
        dartsTotal: 108,
        highfinish: 100,
        count60: 4,
        count80: 3,
        count100: 4,
        count140: 1,
        count180: 1,
      },
    ],
    ...overrides,
  };
}

/** A public SockJS/STOMP broker double exercising the actual production transport. */
export async function mockLive(page, initial = [rubber()]) {
  let records = initial;
  let team = structuredClone(teamResponse);
  let failLive = false;
  let failTeam = false;
  let blockSocket = false;
  let groupReads = 0;
  let teamReads = 0;
  let sockets = [];
  let socketClosed = 0;
  const subscriptions = new Map();
  await page.route(TEAM_API, (route) => {
    teamReads++;
    return route.fulfill({
      status: failTeam ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(team),
    });
  });
  await page.route(TABLE_API, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ tableEntries: [] }),
    }),
  );
  await page.route(`${LIVE_API}**`, (route) => {
    const path = route.request().url().slice(LIVE_API.length);
    if (path.startsWith("websocket/info"))
      return route.fulfill({
        status: blockSocket ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify({
          websocket: true,
          cookie_needed: false,
          origins: ["*:*"],
          entropy: 1,
        }),
      });
    let data = [];
    if (path.startsWith("group?")) {
      groupReads++;
      if (records.length)
        data = [
          { database: "5", typ: "LIGA", groupKey: "102" },
          { database: "10", typ: "LIGA", groupKey: "101" },
        ];
    } else if (path === "match/5/0/102") data = records;
    return route.fulfill({
      status: failLive ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true, error: null, data }),
    });
  });
  await page.routeWebSocket(
    /live\.3k-darts\.com\/dartsscorer-liveticker\/api\/v1\/websocket\/.*\/websocket/,
    (socket) => {
      sockets.push(socket);
      socket.send("o");
      socket.onClose(() => {
        for (const [topic, sub] of subscriptions)
          if (sub.socket === socket) subscriptions.delete(topic);
        socketClosed++;
      });
      socket.onMessage((raw) => {
        for (const frame of JSON.parse(String(raw))) {
          if (frame.startsWith("CONNECT") || frame.startsWith("STOMP")) {
            socket.send(
              `a${JSON.stringify(["CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\u0000"])}`,
            );
          } else if (frame.startsWith("SUBSCRIBE")) {
            const id = frame.match(/\nid:([^\n]+)/)?.[1];
            const topic = frame.match(/\ndestination:([^\n]+)/)?.[1];
            if (id && topic) subscriptions.set(topic, { id, socket });
          } else if (frame.startsWith("UNSUBSCRIBE")) {
            const id = frame.match(/\nid:([^\n]+)/)?.[1];
            for (const [topic, sub] of subscriptions)
              if (sub.id === id && sub.socket === socket)
                subscriptions.delete(topic);
          }
        }
      });
    },
  );
  return {
    setRecords: (next) => {
      records = next;
    },
    failLive: (value) => {
      failLive = value;
    },
    failTeam: (value) => {
      failTeam = value;
    },
    blockSocket: (value) => {
      blockSocket = value;
    },
    finish: () => {
      team.matches[1] = {
        ...team.matches[1],
        statusCd: "FINISH",
        setsHome: 12,
        setsAway: 8,
      };
    },
    push: (value) => {
      const sub = subscriptions.get("/topic/5-102");
      if (!sub) throw new Error("Live subscription missing");
      const body = JSON.stringify({ match: value });
      const frame = `MESSAGE\nsubscription:${sub.id}\ndestination:/topic/5-102\nmessage-id:1\n\n${body}\u0000`;
      sub.socket.send(`a${JSON.stringify([frame])}`);
    },
    disconnect: () => {
      sockets.forEach((socket) => socket.close());
      sockets = [];
      subscriptions.clear();
    },
    subscribed: () => subscriptions.has("/topic/5-102"),
    connections: () => sockets.length,
    closes: () => socketClosed,
    reads: () => ({ team: teamReads, groups: groupReads }),
  };
}
