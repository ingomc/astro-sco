import { WebSocketServer } from "ws";
import { rubber, teamResponse } from "../../tests/dart-live-fixtures.js";

/** Development-only 3K REST + SockJS/STOMP simulator, bound to the local Astro server. */
export function dartLiveDemo() {
  return {
    name: "dart-live-demo",
    apply: "serve",
    configureServer(server) {
      const sockets = new Map();
      const wss = new WebSocketServer({ noServer: true });
      let revision = Date.now();
      let records = [];
      let totalLegsHome = 9;
      let totalLegsGuest = 11;
      let team;
      let offline = false;
      let automatic = true;
      let phase = "LIVE · Zwei Boards";
      const stamp = () =>
        new Date((revision = Math.max(Date.now(), revision + 1))).toISOString();
      const reply = (res, data, status = 200) => {
        res.writeHead(status, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(data));
      };
      const send = (socket, frame) => {
        if (socket.readyState === 1) socket.send(`a${JSON.stringify([frame])}`);
      };
      const push = (record) => {
        for (const [socket, subscriptions] of sockets) {
          for (const [id, topic] of subscriptions) {
            if (topic === "/topic/5-102")
              send(
                socket,
                `MESSAGE\nsubscription:${id}\ndestination:${topic}\nmessage-id:${revision}\n\n${JSON.stringify({ match: record })}\u0000`,
              );
          }
        }
      };
      const reset = (live) => {
        offline = false;
        totalLegsHome = 9;
        totalLegsGuest = 11;
        automatic = live;
        team = structuredClone(teamResponse);
        team.matches[0].datePlanned = new Date(
          Date.now() + 3 * 86400000,
        ).toISOString();
        team.matches[1].datePlanned = new Date(
          Date.now() - 3600000,
        ).toISOString();
        records = live
          ? [
              rubber({
                lastUpdate: stamp(),
                matchPlayers: [
                  {
                    index: 0,
                    playerName: "Max Beispiel",
                    legs: 1,
                    points: 121,
                  },
                  { index: 1, playerName: "Alex Muster", legs: 1, points: 80 },
                ],
              }),
              rubber({
                matchKey: "2002",
                board: "2",
                lastUpdate: stamp(),
                matchPlayers: [
                  {
                    index: 0,
                    playerName: "Lena Beispiel",
                    legs: 0,
                    points: 301,
                  },
                  {
                    index: 1,
                    playerName: "Robin Muster",
                    legs: 1,
                    points: 221,
                  },
                ],
              }),
              rubber({
                matchKey: "1999",
                board: "1",
                status: 2,
                lastUpdate: stamp(),
                matchPlayers: [
                  {
                    index: 0,
                    playerName: "Chris Beispiel",
                    legs: 3,
                    points: 0,
                  },
                  { index: 1, playerName: "Sam Muster", legs: 1, points: 40 },
                ],
              }),
            ]
          : [];
        records.forEach((record) => {
          record.matchPlayers = record.matchPlayers.map((player, i) => ({
            ...rubber().matchPlayers[i],
            ...player,
            ...(record.status === 2 && i === 0
              ? { scoreTotal: 1712, dartsTotal: 90, lastScore: 80, darts: 21 }
              : {}),
          }));
        });
        phase = live ? "LIVE · Zwei Boards" : "Keine Übertragung";
      };
      const tick = () => {
        if (offline || team.matches[1].statusCd === "FINISH") return;
        records = records.map((record) => {
          if (record.status !== 1) return record;
          const next = structuredClone(record);
          next.lastUpdate = stamp();
          const player = next.matchPlayers[next.currentplayerIndex];
          const checkout = player.points >= 2 && player.points <= 80;
          const score = checkout ? player.points : player.points > 61 ? 60 : 0;
          player.lastScore = score;
          player.points -= score;
          player.darts += 3;
          player.dartsTotal += 3;
          player.scoreTotal += score;
          const bucket = [180, 140, 100, 80, 60].find(
            (value) => score >= value,
          );
          if (bucket) player[`count${bucket}`] += 1;
          next.currentplayerIndex = 1 - next.currentplayerIndex;
          if (checkout) {
            player.highfinish = Math.max(player.highfinish, score);
            player.legs += 1;
            if (player.index === 0) totalLegsHome += 1;
            else totalLegsGuest += 1;
            if (player.legs >= 3) next.status = 2;
            else {
              next.startplayerIndex = 1 - next.startplayerIndex;
              next.currentplayerIndex = next.startplayerIndex;
              next.matchPlayers.forEach((p) => {
                p.points = 501;
                p.darts = 0;
                p.lastScore = 0;
              });
            }
          }
          next.legsHome = totalLegsHome;
          next.legsGuest = totalLegsGuest;
          push(next);
          return next;
        });
      };
      reset(true);
      const timer = setInterval(() => {
        if (automatic) tick();
      }, 3000);
      const action = (name) => {
        if (name === "live" || name === "none") {
          reset(name === "live");
          server.ws.send({ type: "custom", event: "dart-demo:reset" });
        } else if (name === "pause") {
          automatic = false;
          phase = "Pause zwischen Einzelspielen";
          records = records.map((record) => ({
            ...record,
            status: 2,
            lastUpdate: stamp(),
          }));
          records.forEach(push);
        } else if (name === "finish") {
          automatic = false;
          phase = "Ligaspiel beendet";
          team.matches[1] = {
            ...team.matches[1],
            statusCd: "FINISH",
            setsHome: 12,
            setsAway: 8,
          };
          server.ws.send({ type: "custom", event: "dart-demo:reset" });
        } else if (name === "offline") {
          offline = true;
          phase = "Verbindung unterbrochen";
          for (const socket of sockets.keys()) socket.close();
        } else if (name === "reconnect") {
          offline = false;
          phase = "Wieder verbunden";
        } else if (name === "step") tick();
        else if (name === "auto") automatic = !automatic;
      };
      const panel = () =>
        `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dart-Live-Demo</title><style>body{font:16px system-ui;background:#f1f5f9;color:#0f172a;max-width:780px;margin:40px auto;padding:20px}a{color:#991b1b}form{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}button{border:0;border-radius:999px;background:#b91c1c;color:white;font:600 16px system-ui;padding:12px 18px;cursor:pointer}button:hover{background:#991b1b;color:white}button:focus-visible{outline:3px solid #b91c1c;outline-offset:3px}</style><h1>Dart-Live-Demo</h1><p>Simulierte Spiele und Namen. Es werden keine echten 3K-Daten verändert.</p><p><strong>${phase}</strong> · Automatische Punkte: ${automatic ? "an" : "aus"}</p><p><a href="/darts" target="dart-demo-site">Liga ansehen</a> · <a href="/darts/spiel?match=102" target="dart-demo-site">Live-Spiel mit Einzelpartien ansehen</a></p><form method="post" action="/__dart-demo/control">${[
          ["live", "LIVE · Zwei Boards"],
          ["none", "Keine Übertragung"],
          ["step", "Nächster Punktestand"],
          ["auto", "Automatische Punkte an/aus"],
          ["pause", "Pause zwischen Einzelspielen"],
          ["finish", "Ligaspiel beenden"],
          ["offline", "Verbindung unterbrechen"],
          ["reconnect", "Wieder verbinden"],
        ]
          .map(
            ([value, label]) =>
              `<button name="action" value="${value}">${label}</button>`,
          )
          .join(
            "",
          )}</form><p>Die Punkte ändern sich alle drei Sekunden. Bei einer Spielpause bleibt LIVE bestehen. Nach dem Liga-Abschluss verschwinden die Live-Links. Bei Wiederverbindung erscheint der neue Stand nach spätestens zehn Sekunden.</p><p>Diese Demo betrifft ausschließlich die Ligaspiele. Die echte Trainingsanmeldung bleibt unverändert.</p></html>`;
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        if (!url.pathname.startsWith("/__dart-demo")) return next();
        const host = (req.headers.host || "").split(":")[0];
        if (!["localhost", "127.0.0.1"].includes(host))
          return reply(res, { error: "Local demo only" }, 403);
        if (url.pathname === "/__dart-demo/control" && req.method === "POST") {
          if (
            req.headers.origin &&
            new URL(req.headers.origin).host !== req.headers.host
          )
            return reply(res, {}, 403);
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1000) req.destroy();
          });
          req.on("end", () => {
            action(new URLSearchParams(body).get("action"));
            res.writeHead(303, { Location: "/__dart-demo/" });
            res.end();
          });
          return;
        }
        if (req.method !== "GET") return reply(res, {}, 405);
        if (
          url.pathname === "/__dart-demo" ||
          url.pathname === "/__dart-demo/"
        ) {
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          });
          res.end(panel());
          return;
        }
        if (url.pathname === "/__dart-demo/api/team") return reply(res, team);
        if (url.pathname === "/__dart-demo/api/table")
          return reply(res, { tableEntries: [] });
        if (url.pathname.startsWith("/__dart-demo/api/live/")) {
          if (offline) return reply(res, { error: "Simulated outage" }, 503);
          if (url.pathname.endsWith("/websocket/info"))
            return reply(res, {
              websocket: true,
              cookie_needed: false,
              origins: ["*:*"],
              entropy: 1,
            });
          const data = url.pathname.endsWith("/group")
            ? records.length
              ? [{ database: "5", typ: "LIGA", groupKey: "102" }]
              : []
            : url.pathname.endsWith("/match/5/0/102")
              ? records
              : [];
          return reply(res, { status: true, error: null, data });
        }
        return reply(res, {}, 404);
      });
      server.httpServer.on("upgrade", (req, socket, head) => {
        if (!req.url?.startsWith("/__dart-demo/api/live/websocket/")) return;
        if (
          offline ||
          !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || "") ||
          (req.headers.origin &&
            new URL(req.headers.origin).host !== req.headers.host)
        ) {
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          const subscriptions = new Map();
          sockets.set(ws, subscriptions);
          ws.send("o");
          ws.on("close", () => sockets.delete(ws));
          ws.on("error", () => {});
          ws.on("message", (raw) => {
            try {
              for (const frame of JSON.parse(raw.toString())) {
                if (frame.startsWith("CONNECT") || frame.startsWith("STOMP"))
                  send(ws, "CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\u0000");
                else if (frame.startsWith("SUBSCRIBE")) {
                  const id = frame.match(/\nid:([^\n]+)/)?.[1];
                  const topic = frame.match(/\ndestination:([^\n]+)/)?.[1];
                  if (id && topic) subscriptions.set(id, topic);
                } else if (frame.startsWith("UNSUBSCRIBE"))
                  subscriptions.delete(frame.match(/\nid:([^\n]+)/)?.[1]);
                else if (frame.startsWith("DISCONNECT")) ws.close();
              }
            } catch {
              ws.close(1003);
            }
          });
        });
      });
      server.httpServer.once("close", () => {
        clearInterval(timer);
        for (const socket of sockets.keys()) socket.terminate();
        wss.close();
      });
    },
  };
}
