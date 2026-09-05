import { useEffect, useState } from "react";
import { Cloud, CloudOff, Plus } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/building";
import {
  createProject,
  listProjects,
  openProject,
  projectIdFromUrl,
  syncEnabled,
} from "@/sync/useSync";
import type { ProjectSummary } from "@/sync/useSync";
import type { SyncStatus } from "@/sync/client";
import { IconButton } from "./controls/Button";
import { Section } from "./controls/Field";
import { Select } from "./controls/Select";

/** Only rendered when the client is built with a server URL. */
export function ProjectSwitcher({ status }: { status: SyncStatus | "local" }) {
  const t = useT();
  const projectId = useEditorStore((s) => s.projectId);
  const buildingName = useEditorStore((s) => s.building.name);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    if (!syncEnabled) return;
    void listProjects().then(setProjects);
  }, [projectId, buildingName]);

  if (!syncEnabled) return null;
  const current = projectId ?? projectIdFromUrl() ?? "";
  const options = [
    { value: "", label: t("project.local") },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];
  if (current && !projects.some((p) => p.id === current))
    options.push({ value: current, label: current.slice(0, 8) });

  return (
    <Section
      title={t("project.title")}
      action={
        <IconButton
          label={t("project.new")}
          onClick={() => {
            void createProject().then((id) => {
              if (id) openProject(id);
            });
          }}
        >
          <Plus size={16} />
        </IconButton>
      }
    >
      <Select
        label={t("project.open")}
        value={current}
        options={options}
        onChange={(id) => {
          openProject(id === "" ? null : id);
        }}
      />
      <div className="flex items-center gap-2 text-xs text-muted">
        {status === "online" ? (
          <Cloud size={14} className="text-accent" />
        ) : (
          <CloudOff size={14} className="text-warning" />
        )}
        {t(`project.status.${status}`)}
      </div>
    </Section>
  );
}
