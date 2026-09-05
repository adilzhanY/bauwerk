-- Projects hold the whole building as JSON. The version column is the optimistic
-- concurrency token: a write must name the version it was based on and only
-- succeeds when that is still the current one.
CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  building    jsonb NOT NULL,
  version     integer NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per accepted write, so the history of a project can be replayed.
CREATE TABLE IF NOT EXISTS project_events (
  id          bigserial PRIMARY KEY,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version     integer NOT NULL,
  actor       text NOT NULL,
  patch       jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

CREATE INDEX IF NOT EXISTS project_events_project_idx ON project_events (project_id, version);
