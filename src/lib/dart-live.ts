import type { DartMatch } from "./darts";
import {
  DART_LIVE_API,
  DART_LIVE_DATABASE,
  LiveFixtureStore,
  objectData,
  type LiveConnection,
  type LiveFixture,
} from "./dart-live-model";
import { Client, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client/dist/sockjs.js";

type TrackerOptions = {
  selectedMatchId?: number;
  onChange: (fixtures: LiveFixture[]) => void;
  refreshTeam: () => Promise<DartMatch[]>;
};

/** One tracker/connection per page, with REST catch-up after every subscription. */
export class DartLiveTracker {
  private stores = new Map<number, LiveFixtureStore>();
  private watched = new Set<number>();
  private subscriptions = new Map<number, StompSubscription>();
  private client: Client | null = null;
  private abort: AbortController | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private refreshPending: Promise<void> | null = null;
  private teamPending: Promise<void> | null = null;
  private connection: LiveConnection = "connecting";
  private running = false;
  private disposed = false;
  private lastTeamRefresh = 0;

  constructor(private options: TrackerOptions) {
    document.addEventListener("visibilitychange", this.visibility);
    window.addEventListener("focus", this.focus);
    window.addEventListener("pagehide", this.pause);
    window.addEventListener("pageshow", this.resume);
    document.addEventListener("astro:before-swap", this.dispose);
  }

  setMatches(matches: DartMatch[]) {
    this.lastTeamRefresh = Date.now();
    const ids = new Set(matches.map((match) => match.id));
    for (const [id] of this.stores) {
      if (!ids.has(id)) {
        this.stores.delete(id);
        this.watched.delete(id);
      }
    }
    for (const match of matches) {
      const store = this.stores.get(match.id);
      if (store) store.match = match;
      else {
        const next = new LiveFixtureStore(match);
        next.connection = this.connection;
        this.stores.set(match.id, next);
      }
    }
    // The portal's overall completion is authoritative, not the last rubber's status.
    for (const id of this.watched) {
      if (this.stores.get(id)?.match.isFinished) this.watched.delete(id);
    }
    this.syncSubscriptions();
    this.emit();
    if (this.running) void this.refresh();
  }

  start() {
    if (this.running || this.disposed || document.hidden) return;
    this.running = true;
    this.abort = new AbortController();
    this.setConnection("connecting");
    void this.refresh();
    this.timers = [
      setInterval(() => void this.refresh(), 30_000),
      setInterval(() => void this.refreshTeam(), 60_000),
      setInterval(() => {
        if (this.connection !== "connected") void this.refresh();
      }, 10_000),
    ];
  }

  private async read(path: string, signal: AbortSignal): Promise<unknown[]> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    const timeout = setTimeout(abort, 8_000);
    try {
      const response = await fetch(`${DART_LIVE_API}${path}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Live-Daten nicht verfügbar");
      const result = objectData(await response.json());
      if (!result || result.error || !Array.isArray(result.data)) {
        throw new Error("Ungültige Live-Daten");
      }
      return result.data;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
  }

  private refresh() {
    if (!this.running || !this.abort) return Promise.resolve();
    if (this.refreshPending) return this.refreshPending;
    const signal = this.abort.signal;
    const pending = this.discoverAndRead(signal).finally(() => {
      if (this.refreshPending === pending) this.refreshPending = null;
    });
    this.refreshPending = pending;
    return pending;
  }

  private async discoverAndRead(signal: AbortSignal) {
    try {
      let ids: number[];
      if (this.options.selectedMatchId) {
        ids = this.stores.has(this.options.selectedMatchId)
          ? [this.options.selectedMatchId]
          : [];
      } else {
        const groups = await this.read("group?eventType=LIGA", signal);
        ids = groups.flatMap((value) => {
          const group = objectData(value);
          if (
            !group ||
            String(group.database) !== DART_LIVE_DATABASE ||
            group.typ !== "LIGA"
          )
            return [];
          const id = Number(group.groupKey);
          const match = this.stores.get(id)?.match;
          return match && !match.isFinished ? [id] : [];
        });
      }
      if (signal.aborted) return;
      // Keep observed matches subscribed through pauses between rubbers.
      for (const id of ids) {
        if (!this.stores.get(id)?.match.isFinished) this.watched.add(id);
      }
      this.syncSubscriptions();
      const requests = [...new Set([...ids, ...this.watched])];
      const results = await Promise.allSettled(
        requests.map((id) => this.readFixture(id, signal)),
      );
      if (signal.aborted) return;
      if (results.some((result) => result.status === "rejected")) {
        this.setConnection("unavailable");
      } else {
        this.setConnection(this.client?.connected ? "connected" : "polling");
        if (this.watched.size > 0 && !this.client) this.connect(signal);
      }
    } catch {
      if (!signal.aborted) this.setConnection("unavailable");
    }
  }

  private async readFixture(id: number, signal: AbortSignal) {
    const values = await this.read(`match/5/0/${id}`, signal);
    if (signal.aborted) return;
    this.stores.get(id)?.apply(values);
    this.emit();
  }

  private connect(signal: AbortSignal) {
    try {
      if (signal.aborted) return;
      const client = new Client({
        webSocketFactory: () =>
          new SockJS(`${DART_LIVE_API}websocket`, null, {
            transports: ["websocket"],
          }),
        reconnectDelay: 5_000,
        connectionTimeout: 8_000,
        heartbeatIncoming: 10_000,
        heartbeatOutgoing: 10_000,
        onConnect: () => {
          if (signal.aborted) return;
          this.subscriptions.clear();
          this.setConnection("connected");
          this.syncSubscriptions();
        },
        onWebSocketClose: () => {
          if (signal.aborted) return;
          this.subscriptions.clear();
          this.setConnection("unavailable");
          void this.refresh();
        },
        onStompError: () => {
          if (!signal.aborted) this.setConnection("unavailable");
        },
      });
      this.client = client;
      client.activate();
    } catch {
      if (!signal.aborted) this.setConnection("unavailable");
    }
  }

  private syncSubscriptions() {
    if (!this.client?.connected || !this.abort) return;
    const signal = this.abort.signal;
    for (const [id, subscription] of this.subscriptions) {
      if (!this.watched.has(id)) {
        subscription.unsubscribe();
        this.subscriptions.delete(id);
      }
    }
    for (const id of this.watched) {
      if (this.subscriptions.has(id)) continue;
      const subscription = this.client.subscribe(
        `/topic/5-${id}`,
        (message) => {
          if (signal.aborted) return;
          try {
            const event = objectData(JSON.parse(message.body));
            if (event?.match && this.stores.get(id)?.apply([event.match])) {
              this.setConnection("connected");
            }
          } catch {
            // Ignore malformed frames; the periodic REST snapshot repairs missing updates.
          }
        },
      );
      this.subscriptions.set(id, subscription);
      // Fetch after subscribing to cover events between bootstrap and connection.
      void this.readFixture(id, signal).catch(() => {
        if (!signal.aborted) this.setConnection("unavailable");
      });
    }
  }

  private refreshTeam() {
    if (
      !this.running ||
      this.teamPending ||
      !this.abort ||
      Date.now() - this.lastTeamRefresh < 1_000
    )
      return Promise.resolve();
    const signal = this.abort.signal;
    const pending = this.options
      .refreshTeam()
      .then((matches) => {
        if (!signal.aborted) this.setMatches(matches);
      })
      .catch(() => {
        if (!signal.aborted) this.setConnection("unavailable");
      })
      .finally(() => {
        if (this.teamPending === pending) this.teamPending = null;
      });
    this.teamPending = pending;
    return pending;
  }

  private setConnection(connection: LiveConnection) {
    this.connection = connection;
    for (const store of this.stores.values()) store.connection = connection;
    this.emit();
  }

  private emit() {
    if (!this.disposed)
      this.options.onChange(
        [...this.stores.values()].map((store) => store.snapshot()),
      );
  }

  private visibility = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };
  private focus = () => {
    if (!document.hidden) {
      this.start();
      void this.refreshTeam();
      void this.refresh();
    }
  };
  private resume = () => {
    if (!document.hidden) {
      this.start();
      void this.refreshTeam();
      void this.refresh();
    }
  };
  private pause = () => {
    this.running = false;
    this.abort?.abort();
    this.abort = null;
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    this.subscriptions.clear();
    void this.client?.deactivate({ force: true });
    this.client = null;
    this.refreshPending = null;
    this.teamPending = null;
  };
  dispose = () => {
    this.disposed = true;
    this.pause();
    document.removeEventListener("visibilitychange", this.visibility);
    window.removeEventListener("focus", this.focus);
    window.removeEventListener("pagehide", this.pause);
    window.removeEventListener("pageshow", this.resume);
    document.removeEventListener("astro:before-swap", this.dispose);
  };
}

export function liveConnectionText(fixture: LiveFixture) {
  if (fixture.connection === "unavailable")
    return "Verbindung unterbrochen – letzter bekannter Stand.";
  if (fixture.connection === "connecting")
    return "Live-Verbindung wird hergestellt …";
  if (fixture.connection === "polling")
    return "Spielstand wird regelmäßig aktualisiert.";
  return "Live-Verbindung aktiv.";
}
export function liveUpdatedText(timestamp: number | null) {
  return timestamp === null
    ? ""
    : `Zuletzt aktualisiert: ${new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(timestamp)} Uhr`;
}
