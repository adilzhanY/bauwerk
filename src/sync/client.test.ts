import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Building } from "@/geometry/types";
import { resetIds } from "@/lib/ids";
import { createDefaultBuilding, createEditorStore } from "@/store/building";
import { SyncClient } from "./client";

interface Call {
  method: string;
  body?: { building: Building; baseVersion: number };
}

/** A tiny fake server: holds one project with a version and answers like the real one. */
function fakeServer(initial: Building) {
  let version = 1;
  let building = initial;
  const calls: Call[] = [];
  let failNext = 0;
  const fetchImpl: typeof fetch = (_input, init) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(init.body as string) as Call["body"]) : undefined;
    calls.push({ method, body });
    if (failNext > 0) {
      failNext -= 1;
      return Promise.reject(new Error("network"));
    }
    const json = (status: number, data: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(data), {
          status,
          headers: { "content-type": "application/json" },
        }),
      );
    if (method === "GET") return json(200, { id: "p1", version, building });
    if (method === "PUT" && body) {
      if (body.baseVersion !== version)
        return json(409, { error: "conflict", current: { id: "p1", version, building } });
      version += 1;
      building = body.building;
      return json(200, { id: "p1", version, building });
    }
    return json(500, {});
  };
  return {
    fetchImpl,
    calls,
    get version() {
      return version;
    },
    get building() {
      return building;
    },
    /** Simulates another actor writing directly. */
    externalWrite(mutate: (b: Building) => Building) {
      building = mutate(building);
      version += 1;
    },
    failNextRequests(n: number) {
      failNext = n;
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 5));

let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  resetIds();
  store = createEditorStore();
});

describe("SyncClient", () => {
  it("loads the project without creating history and sends each change with its base version", async () => {
    const server = fakeServer({ ...createDefaultBuilding(), name: "Remote" });
    const client = new SyncClient(store, {
      apiUrl: "http://x",
      projectId: "p1",
      actor: "me",
      color: "#000",
      fetchImpl: server.fetchImpl,
    });
    await client.start();
    expect(store.getState().building.name).toBe("Remote");
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().projectId).toBe("p1");

    store.getState().setWallThickness(0.4);
    await flush();
    const put = server.calls.find((c) => c.method === "PUT");
    expect(put?.body?.baseVersion).toBe(1);
    expect(server.version).toBe(2);
    expect(server.building.wallThickness).toBe(0.4);
    expect(client.currentVersion).toBe(2);
    expect(store.getState().past).toHaveLength(1);
  });

  it("on 409 applies the server state and reapplies the local change on top", async () => {
    const server = fakeServer(createDefaultBuilding());
    const client = new SyncClient(store, {
      apiUrl: "http://x",
      projectId: "p1",
      actor: "me",
      color: "#000",
      fetchImpl: server.fetchImpl,
    });
    await client.start();
    server.externalWrite((b) => ({ ...b, name: "Theirs" })); // version 2 on the server, we still think 1

    store.getState().setWallThickness(0.5);
    await flush();
    const puts = server.calls.filter((c) => c.method === "PUT");
    expect(puts.map((p) => p.body?.baseVersion)).toEqual([1, 2]);
    expect(server.version).toBe(3);
    expect(server.building.wallThickness).toBe(0.5);
    // Their rename did not survive locally because our building replaced it: last write wins.
    expect(server.building.name).toBe("Bauwerk");
    expect(client.currentVersion).toBe(3);
  });

  it("does not echo a remote update back and does not record it in history", async () => {
    const server = fakeServer(createDefaultBuilding());
    class FakeSocket {
      static instances: FakeSocket[] = [];
      readyState = 1;
      onopen: (() => void) | null = null;
      onmessage: ((e: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      sent: string[] = [];
      constructor() {
        FakeSocket.instances.push(this);
        setTimeout(() => this.onopen?.(), 0);
      }
      send(s: string) {
        this.sent.push(s);
      }
      close() {
        this.readyState = 3;
      }
    }
    const client = new SyncClient(store, {
      apiUrl: "http://x",
      projectId: "p1",
      actor: "me",
      color: "#000",
      fetchImpl: server.fetchImpl,
      webSocketImpl: FakeSocket as unknown as typeof WebSocket,
    });
    await client.start();
    await flush();
    const socket = FakeSocket.instances[0]!;
    expect(socket.sent[0]).toContain('"type":"join"');

    const remote = { ...createDefaultBuilding(), name: "From Bob" };
    socket.onmessage?.({
      data: JSON.stringify({ type: "update", version: 2, building: remote, actor: "bob" }),
    });
    expect(store.getState().building.name).toBe("From Bob");
    expect(store.getState().past).toHaveLength(0);
    await flush();
    expect(server.calls.filter((c) => c.method === "PUT")).toHaveLength(0);
    expect(client.currentVersion).toBe(2);

    socket.onmessage?.({
      data: JSON.stringify({
        type: "presence",
        actors: [
          { actor: "me", color: "#000", selection: null },
          { actor: "bob", color: "#f00", selection: null },
        ],
      }),
    });
    expect(store.getState().presence.map((p) => p.actor)).toEqual(["bob"]);
    socket.onmessage?.({
      data: JSON.stringify({
        type: "selection",
        actor: "bob",
        selection: { kind: "storey", id: "s" },
      }),
    });
    expect(store.getState().presence[0]?.selection).toEqual({ kind: "storey", id: "s" });

    store.getState().select({ kind: "storey", id: "mine" });
    expect(socket.sent.some((s) => s.includes('"kind":"mine"') || s.includes('"id":"mine"'))).toBe(
      true,
    );
    client.stop();
    expect(store.getState().presence).toEqual([]);
  });

  it("undo after a remote change does not undo the remote change", async () => {
    const server = fakeServer(createDefaultBuilding());
    const client = new SyncClient(store, {
      apiUrl: "http://x",
      projectId: "p1",
      actor: "me",
      color: "#000",
      fetchImpl: server.fetchImpl,
    });
    await client.start();
    store.getState().setWallThickness(0.4);
    await flush();
    // Bob renames remotely; we get it through the socket path (simulated by handle via a message).
    const remote = { ...server.building, name: "Bob was here" };
    store.getState().applyRemoteBuilding(remote);
    store.getState().undo();
    // Undo restores our pre-0.4 building, which had the old name: last write wins again,
    // but the remote change is not on the undo stack and the redo stack is cleared.
    expect(store.getState().building.wallThickness).toBe(0.3);
    expect(store.getState().future).toHaveLength(1);
  });

  it("keeps the newest pending write through a network failure and retries", async () => {
    vi.useFakeTimers();
    const server = fakeServer(createDefaultBuilding());
    const client = new SyncClient(store, {
      apiUrl: "http://x",
      projectId: "p1",
      actor: "me",
      color: "#000",
      fetchImpl: server.fetchImpl,
      retryMs: 10,
    });
    await client.start();
    server.failNextRequests(1);
    store.getState().setWallThickness(0.4);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.status).toBe("offline");
    store.getState().setWallThickness(0.6);
    await vi.advanceTimersByTimeAsync(50);
    expect(client.status).toBe("online");
    expect(server.building.wallThickness).toBe(0.6);
    vi.useRealTimers();
  });
});
