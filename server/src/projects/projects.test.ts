import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { RawData } from "ws";
import { Pool } from "pg";
import type { INestApplication } from "@nestjs/common";
import { WebSocket } from "ws";
import { exampleHouse } from "@/lib/examples";
import { resetIds } from "@/lib/ids";
import type { Building } from "@/geometry/types";
import { createApp } from "../app";
import { ProjectsGateway } from "./projects.gateway";
import { ProjectsService } from "./projects.service";

function rawToString(raw: RawData): string {
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  if (Array.isArray(raw)) return Buffer.concat(raw).toString("utf8");
  return Buffer.from(raw).toString("utf8");
}

const url = process.env.DATABASE_URL ?? "postgres://bauwerk@127.0.0.1:5499/bauwerk_test";

let pool: Pool;
let app: INestApplication;
let service: ProjectsService;
let base: string;

beforeAll(async () => {
  pool = new Pool({ connectionString: url });
  app = await createApp(pool, { logger: false });
  await app.listen(0);
  const address = (app.getHttpServer() as Server).address() as { port: number };
  base = `http://127.0.0.1:${address.port}`;
  service = app.get(ProjectsService);
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

beforeEach(async () => {
  resetIds();
  await pool.query("TRUNCATE project_events, projects");
});

const house = (): Building => exampleHouse("en");

const json = (method: string, path: string, body?: unknown, actor = "tester") =>
  fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-actor": actor },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("REST", () => {
  it("creates, reads, lists and deletes a project", async () => {
    const created = await json("POST", "/projects", { building: house() });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string; version: number; name: string };
    expect(project.version).toBe(1);
    expect(project.name).toBe("Family house");

    const got = await json("GET", `/projects/${project.id}`);
    expect(got.status).toBe(200);
    expect(((await got.json()) as { building: Building }).building.storeys).toHaveLength(2);

    const list = (await (await json("GET", "/projects")).json()) as { id: string }[];
    expect(list.map((p) => p.id)).toEqual([project.id]);

    expect((await json("DELETE", `/projects/${project.id}`)).status).toBe(204);
    expect((await json("GET", `/projects/${project.id}`)).status).toBe(404);
  });

  it("rejects an invalid building with 422 and the geometry error", async () => {
    const b = house();
    b.storeys[0]!.openings[1]!.offset = 4; // 4 to 5.2 overlaps the door at 4.5 to 5.5
    const res = await json("POST", "/projects", { building: b });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { detail: { code: string } };
    expect(body.detail.code).toBe("openingsOverlap");
  });

  it("accepts a write with the right base version and returns 409 with the current state otherwise", async () => {
    const project = (await (await json("POST", "/projects", { building: house() })).json()) as {
      id: string;
    };
    const b = house();
    b.wallThickness = 0.4;
    const ok = await json("PUT", `/projects/${project.id}`, { building: b, baseVersion: 1 });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { version: number }).version).toBe(2);

    const stale = await json("PUT", `/projects/${project.id}`, {
      building: house(),
      baseVersion: 1,
    });
    expect(stale.status).toBe(409);
    const conflict = (await stale.json()) as {
      error: string;
      current: { version: number; building: Building };
    };
    expect(conflict.error).toBe("conflict");
    expect(conflict.current.version).toBe(2);
    expect(conflict.current.building.wallThickness).toBe(0.4);

    const missing = await json("PUT", `/projects/${project.id}`, { building: house() });
    expect(missing.status).toBe(400);
  });
});

describe("concurrency", () => {
  it("of many simultaneous writes on the same base version exactly one wins", async () => {
    const created = await service.create(house(), "setup");
    if (!created.ok) throw new Error("create failed");
    const id = created.project.id;
    const writers = Array.from({ length: 12 }, (_, i) => {
      const b = house();
      b.wallThickness = 0.2 + i * 0.01;
      return service.update(id, b, 1, `writer-${i}`);
    });
    const results = await Promise.all(writers);
    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok && r.reason === "conflict");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(11);
    const after = await service.get(id);
    expect(after?.version).toBe(2);
    expect(await service.eventCount(id)).toBe(2);
  });

  it("increments the version by exactly one per accepted write and records one event each", async () => {
    const created = await service.create(house(), "setup");
    if (!created.ok) throw new Error("create failed");
    const id = created.project.id;
    let version = 1;
    for (let i = 0; i < 5; i++) {
      const b = house();
      b.name = `Step ${i}`;
      const r = await service.update(id, b, version, "seq");
      expect(r.ok).toBe(true);
      if (r.ok) version = r.project.version;
    }
    expect(version).toBe(6);
    expect(await service.eventCount(id)).toBe(6);
    const events = await pool.query<{ version: number; actor: string }>(
      "SELECT version, actor FROM project_events WHERE project_id = $1 ORDER BY version",
      [id],
    );
    expect(events.rows.map((e) => e.version)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("WebSocket", () => {
  const connect = (projectId: string, actor: string) =>
    new Promise<{ socket: WebSocket; messages: unknown[]; next: () => Promise<unknown> }>(
      (resolve, reject) => {
        const socket = new WebSocket(`${base.replace("http", "ws")}/ws`);
        const messages: unknown[] = [];
        const waiters: ((m: unknown) => void)[] = [];
        socket.on("message", (raw) => {
          const m: unknown = JSON.parse(rawToString(raw));
          const w = waiters.shift();
          if (w) w(m);
          else messages.push(m);
        });
        const next = () =>
          new Promise<unknown>((res) => {
            const m = messages.shift();
            if (m !== undefined) res(m);
            else waiters.push(res);
          });
        socket.on("open", () => {
          socket.send(JSON.stringify({ type: "join", projectId, actor, color: "#f00" }));
          resolve({ socket, messages, next });
        });
        socket.on("error", reject);
      },
    );

  it("broadcasts presence on join and updates on accepted writes", async () => {
    const created = await service.create(house(), "setup");
    if (!created.ok) throw new Error("create failed");
    const id = created.project.id;
    const a = await connect(id, "alice");
    const p1 = (await a.next()) as { type: string; actors: { actor: string }[] };
    expect(p1.type).toBe("presence");
    expect(p1.actors.map((x) => x.actor)).toEqual(["alice"]);

    const b = await connect(id, "bob");
    const p2 = (await a.next()) as { actors: { actor: string }[] };
    expect(p2.actors.map((x) => x.actor).sort()).toEqual(["alice", "bob"]);
    await b.next(); // bob's own presence
    expect(app.get(ProjectsGateway).roomSize(id)).toBe(2);

    const changed = house();
    changed.wallThickness = 0.5;
    const res = await json("PUT", `/projects/${id}`, { building: changed, baseVersion: 1 }, "bob");
    expect(res.status).toBe(200);
    const update = (await a.next()) as {
      type: string;
      version: number;
      actor: string;
      building: Building;
    };
    expect(update.type).toBe("update");
    expect(update.version).toBe(2);
    expect(update.actor).toBe("bob");
    expect(update.building.wallThickness).toBe(0.5);

    b.socket.send(JSON.stringify({ type: "selection", selection: { kind: "storey", id: "x" } }));
    const sel = (await a.next()) as { type: string; actor: string };
    expect(sel.type).toBe("selection");
    expect(sel.actor).toBe("bob");

    b.socket.close();
    const p3 = (await a.next()) as { actors: { actor: string }[] };
    expect(p3.actors.map((x) => x.actor)).toEqual(["alice"]);
    a.socket.close();
  });
});
