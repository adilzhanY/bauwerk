import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import { validateBuilding } from "@/geometry/export";
import type { ImportError } from "@/geometry/export";
import type { Building } from "@/geometry/types";
import { DB } from "../db";

export interface ProjectRecord {
  id: string;
  name: string;
  building: Building;
  version: number;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
}

export type WriteResult =
  | { ok: true; project: ProjectRecord }
  | { ok: false; reason: "conflict"; current: ProjectRecord }
  | { ok: false; reason: "invalid"; error: ImportError }
  | { ok: false; reason: "notFound" };

export interface ProjectUpdated {
  project: ProjectRecord;
  actor: string;
}

interface Row {
  id: string;
  name: string;
  building: Building;
  version: number;
  updated_at: Date;
}

const toRecord = (r: Row): ProjectRecord => ({
  id: r.id,
  name: r.name,
  building: r.building,
  version: r.version,
  updatedAt: r.updated_at.toISOString(),
});

@Injectable()
export class ProjectsService {
  /** Emits "updated" with a ProjectUpdated after every accepted write. */
  readonly events = new EventEmitter();

  constructor(@Inject(DB) private readonly pool: Pool) {}

  async list(): Promise<ProjectSummary[]> {
    const res = await this.pool.query<Row>(
      "SELECT id, name, version, updated_at FROM projects ORDER BY updated_at DESC",
    );
    return res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      version: r.version,
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async get(id: string): Promise<ProjectRecord | null> {
    const res = await this.pool.query<Row>("SELECT * FROM projects WHERE id = $1", [id]);
    const row = res.rows[0];
    return row ? toRecord(row) : null;
  }

  async create(building: Building, actor: string): Promise<WriteResult> {
    const error = validateBuilding(building);
    if (error) return { ok: false, reason: "invalid", error };
    const id = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query<Row>(
        "INSERT INTO projects (id, name, building, version) VALUES ($1, $2, $3, 1) RETURNING *",
        [id, building.name, JSON.stringify(building)],
      );
      await client.query(
        "INSERT INTO project_events (project_id, version, actor, patch) VALUES ($1, 1, $2, $3)",
        [id, actor, JSON.stringify({ type: "create" })],
      );
      await client.query("COMMIT");
      const row = res.rows[0];
      if (!row) throw new Error("insert returned no row");
      return { ok: true, project: toRecord(row) };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Optimistic concurrency: the update only applies when the stored version still
   * equals `baseVersion`. Everything happens in one transaction so the event row
   * and the new version can never disagree.
   */
  async update(
    id: string,
    building: Building,
    baseVersion: number,
    actor: string,
  ): Promise<WriteResult> {
    const error = validateBuilding(building);
    if (error) return { ok: false, reason: "invalid", error };
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query<Row>(
        `UPDATE projects
           SET building = $1, name = $2, version = version + 1, updated_at = now()
         WHERE id = $3 AND version = $4
         RETURNING *`,
        [JSON.stringify(building), building.name, id, baseVersion],
      );
      const row = res.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        // Read the current row on this same client. Going through the pool here
        // deadlocks once every pooled connection is held by a concurrent writer.
        const cur = await client.query<Row>("SELECT * FROM projects WHERE id = $1", [id]);
        const current = cur.rows[0];
        return current
          ? { ok: false, reason: "conflict", current: toRecord(current) }
          : { ok: false, reason: "notFound" };
      }
      await client.query(
        "INSERT INTO project_events (project_id, version, actor, patch) VALUES ($1, $2, $3, $4)",
        [id, row.version, actor, JSON.stringify({ type: "replace", baseVersion })],
      );
      await client.query("COMMIT");
      const project = toRecord(row);
      this.events.emit("updated", { project, actor } satisfies ProjectUpdated);
      return { ok: true, project };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async rename(id: string, name: string, actor: string): Promise<WriteResult> {
    const current = await this.get(id);
    if (!current) return { ok: false, reason: "notFound" };
    return this.update(id, { ...current.building, name }, current.version, actor);
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM projects WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async eventCount(id: string): Promise<number> {
    const res = await this.pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM project_events WHERE project_id = $1",
      [id],
    );
    return Number(res.rows[0]?.n ?? 0);
  }
}
