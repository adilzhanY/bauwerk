import type { Building } from "@/geometry/types";
import type { createEditorStore, Presence, Selection } from "@/store/building";

/**
 * Keeps one store in step with one project on the server.
 *
 * Writes: every committed change to `building` is sent as a PUT with the version
 * it was based on. A 409 means someone else wrote first: the server's building is
 * applied locally (without touching undo history) and the local change is sent
 * once more on top of the new version. Last write wins; a CRDT merge was not
 * attempted, see DECISIONS.md. Only one write is in flight, the newest pending
 * building replaces any older pending one, and a failed request is retried with
 * backoff, so a short offline period loses nothing.
 *
 * Reads: a WebSocket room per project delivers other actors' accepted writes,
 * presence and selections.
 */

export interface SyncConfig {
  apiUrl: string;
  projectId: string;
  actor: string;
  color: string;
  fetchImpl?: typeof fetch;
  webSocketImpl?: typeof WebSocket;
  /** Backoff base in ms. Tests pass a small value. */
  retryMs?: number;
}

type Store = ReturnType<typeof createEditorStore>;

interface ProjectResponse {
  id: string;
  version: number;
  building: Building;
}

type ServerMessage =
  | { type: "update"; version: number; building: Building; actor: string }
  | { type: "presence"; actors: { actor: string; color: string; selection: Selection | null }[] }
  | { type: "selection"; actor: string; selection: Selection | null };

export type SyncStatus = "connecting" | "online" | "offline" | "error";

export class SyncClient {
  private version = 0;
  private pending: Building | null = null;
  private inFlight = false;
  private applying = false;
  private socket: WebSocket | null = null;
  private unsubscribe: (() => void) | null = null;
  private closed = false;
  private reconnectDelay: number;
  private readonly fetchImpl: typeof fetch;
  private readonly wsImpl: typeof WebSocket | undefined;
  private readonly listeners = new Set<(s: SyncStatus) => void>();
  private lastSelection: string | null = null;
  status: SyncStatus = "connecting";

  constructor(
    private readonly store: Store,
    private readonly config: SyncConfig,
  ) {
    this.fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init));
    this.wsImpl =
      config.webSocketImpl ?? (typeof WebSocket === "undefined" ? undefined : WebSocket);
    this.reconnectDelay = config.retryMs ?? 1000;
  }

  onStatus(listener: (s: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(s: SyncStatus) {
    this.status = s;
    for (const l of this.listeners) l(s);
  }

  /** Loads the project, applies it, then starts watching the store and the socket. */
  async start(): Promise<void> {
    const res = await this.fetchImpl(`${this.config.apiUrl}/projects/${this.config.projectId}`);
    if (!res.ok) {
      this.setStatus("error");
      throw new Error(`Project load failed: ${res.status}`);
    }
    const project = (await res.json()) as ProjectResponse;
    this.version = project.version;
    this.apply(project.building);
    this.store.getState().setProjectId(this.config.projectId);

    let lastBuilding = this.store.getState().building;
    this.unsubscribe = this.store.subscribe((state) => {
      if (state.building !== lastBuilding) {
        lastBuilding = state.building;
        if (!this.applying) this.queue(state.building);
      }
      const sel = JSON.stringify(state.selection);
      if (sel !== this.lastSelection) {
        this.lastSelection = sel;
        this.send({ type: "selection", selection: state.selection });
      }
    });
    this.connect();
    this.setStatus("online");
  }

  stop(): void {
    this.closed = true;
    this.unsubscribe?.();
    this.socket?.close();
    this.store.getState().setPresence([]);
    this.store.getState().setProjectId(null);
  }

  get currentVersion(): number {
    return this.version;
  }

  private apply(building: Building) {
    this.applying = true;
    try {
      this.store.getState().applyRemoteBuilding(building);
    } finally {
      this.applying = false;
    }
  }

  private queue(building: Building) {
    this.pending = building;
    void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.inFlight || !this.pending || this.closed) return;
    const building = this.pending;
    this.pending = null;
    this.inFlight = true;
    try {
      await this.write(building, 0);
      this.setStatus("online");
    } catch {
      // Network failure: keep the newest building pending and retry later.
      this.pending ??= building;
      this.setStatus("offline");
      setTimeout(() => void this.flush(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      return;
    } finally {
      this.inFlight = false;
    }
    this.reconnectDelay = this.config.retryMs ?? 1000;
    // A change may have been queued while the request was in flight.
    if (this.hasPending()) void this.flush();
  }

  private hasPending(): boolean {
    return this.pending !== null;
  }

  private async write(building: Building, attempt: number): Promise<void> {
    const res = await this.fetchImpl(`${this.config.apiUrl}/projects/${this.config.projectId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-actor": this.config.actor },
      body: JSON.stringify({ building, baseVersion: this.version }),
    });
    if (res.status === 200) {
      const project = (await res.json()) as ProjectResponse;
      this.version = project.version;
      return;
    }
    if (res.status === 409) {
      const body = (await res.json()) as { current: ProjectResponse };
      this.version = body.current.version;
      // Someone else's write landed first. Take it, then put our change on top,
      // unless a newer local change is already waiting, which supersedes ours.
      if (this.pending) {
        this.apply(body.current.building);
        return;
      }
      if (attempt >= 1) {
        this.apply(body.current.building);
        return;
      }
      await this.write(building, attempt + 1);
      return;
    }
    if (res.status === 422) {
      // The server refused the building as invalid; keep the local state, report it.
      this.setStatus("error");
      return;
    }
    throw new Error(`Write failed: ${res.status}`);
  }

  private connect() {
    if (!this.wsImpl || this.closed) return;
    const wsUrl = this.config.apiUrl.replace(/^http/, "ws") + "/ws";
    const socket = new this.wsImpl(wsUrl);
    this.socket = socket;
    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "join",
          projectId: this.config.projectId,
          actor: this.config.actor,
          color: this.config.color,
        }),
      );
      this.send({ type: "selection", selection: this.store.getState().selection });
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      this.handle(message);
    };
    socket.onclose = () => {
      if (this.closed) return;
      this.store.getState().setPresence([]);
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    };
  }

  private send(message: unknown) {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(message));
  }

  private handle(message: ServerMessage) {
    switch (message.type) {
      case "update":
        if (message.actor === this.config.actor) {
          this.version = Math.max(this.version, message.version);
          return;
        }
        if (message.version > this.version) {
          this.version = message.version;
          this.apply(message.building);
        }
        return;
      case "presence": {
        const others: Presence[] = message.actors.filter((a) => a.actor !== this.config.actor);
        this.store.getState().setPresence(others);
        return;
      }
      case "selection": {
        const presence = this.store
          .getState()
          .presence.map((p) =>
            p.actor === message.actor ? { ...p, selection: message.selection } : p,
          );
        this.store.getState().setPresence(presence);
        return;
      }
    }
  }
}

/** Sync is on when the client is built with VITE_API_URL. */
export function syncConfigFromEnv(): { apiUrl: string } | null {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  return url ? { apiUrl: url.replace(/\/$/, "") } : null;
}

export function randomActor(): { actor: string; color: string } {
  const names = ["Ada", "Grace", "Linus", "Margaret", "Alan", "Barbara", "Edsger", "Hedy"];
  const colors = ["#e76f51", "#f4a261", "#e9c46a", "#2a9d8f", "#6c8ef5", "#b084cc"];
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)] as T;
  return { actor: `${pick(names)} ${Math.floor(Math.random() * 90 + 10)}`, color: pick(colors) };
}
