import { useEffect, useState } from "react";
import { useEditorStore } from "@/store/building";
import { SyncClient, randomActor, syncConfigFromEnv } from "./client";
import type { SyncStatus } from "./client";

export interface ProjectSummary {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
}

const ACTOR_KEY = "bauwerk.actor";

function actorIdentity(): { actor: string; color: string } {
  try {
    const saved = localStorage.getItem(ACTOR_KEY);
    if (saved) return JSON.parse(saved) as { actor: string; color: string };
    const fresh = randomActor();
    localStorage.setItem(ACTOR_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return randomActor();
  }
}

export function projectIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("project");
}

export function setProjectInUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("project", id);
  else url.searchParams.delete("project");
  window.history.replaceState(null, "", url);
}

export const syncEnabled = syncConfigFromEnv() !== null;

export async function listProjects(): Promise<ProjectSummary[]> {
  const cfg = syncConfigFromEnv();
  if (!cfg) return [];
  const res = await fetch(`${cfg.apiUrl}/projects`);
  return res.ok ? ((await res.json()) as ProjectSummary[]) : [];
}

export async function createProject(): Promise<string | null> {
  const cfg = syncConfigFromEnv();
  if (!cfg) return null;
  const { actor } = actorIdentity();
  const res = await fetch(`${cfg.apiUrl}/projects`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-actor": actor },
    body: JSON.stringify({ building: useEditorStore.getState().building }),
  });
  if (!res.ok) return null;
  const project = (await res.json()) as { id: string };
  return project.id;
}

/**
 * Connects the store to the project named in the URL. Without VITE_API_URL this
 * hook does nothing and the app stays a local, localStorage-backed editor.
 */
export function useSync(): { status: SyncStatus | "local"; actor: string; color: string } {
  const [status, setStatus] = useState<SyncStatus | "local">(syncEnabled ? "connecting" : "local");
  const [identity] = useState(actorIdentity);
  const [urlProject, setUrlProject] = useState(projectIdFromUrl);

  useEffect(() => {
    const onPop = () => {
      setUrlProject(projectIdFromUrl());
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("bauwerk:project", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("bauwerk:project", onPop);
    };
  }, []);

  useEffect(() => {
    const cfg = syncConfigFromEnv();
    if (!cfg || !urlProject) return;
    const client = new SyncClient(useEditorStore, { ...cfg, projectId: urlProject, ...identity });
    const off = client.onStatus(setStatus);
    client.start().catch(() => {
      setStatus("error");
    });
    return () => {
      off();
      client.stop();
    };
  }, [urlProject, identity]);

  return { status, ...identity };
}

/** Switches the URL and lets useSync reconnect. */
export function openProject(id: string | null) {
  setProjectInUrl(id);
  window.dispatchEvent(new Event("bauwerk:project"));
}
