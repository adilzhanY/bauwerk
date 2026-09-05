import { useState } from "react";
import type { DragEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  DoorOpen,
  Grid3x3,
  Layers,
  MousePointer2,
  PenTool,
  Plus,
  Trash2,
  Ruler,
  RulerDimensionLine,
  Copy,
  Printer,
} from "lucide-react";
import type { Id } from "@/geometry/types";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n";
import { LANGUAGES } from "@/i18n";
import { example } from "@/lib/examples";
import type { ExampleId } from "@/lib/examples";
import { formatArea, formatMetres } from "@/lib/format";
import { selectActiveStorey } from "@/store/selectors";
import { UnderlaySection } from "./UnderlaySection";
import { useEditorStore } from "@/store/building";
import type { Tool } from "@/store/building";
import { Button, IconButton } from "./controls/Button";
import { Section } from "./controls/Field";
import { NumberField } from "./controls/NumberField";
import { Select } from "./controls/Select";
import { TOOL_ORDER } from "./useKeyboardShortcuts";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { LocationSection } from "./LocationSection";
import { TextField } from "./controls/TextField";
import type { SyncStatus } from "@/sync/client";

const toolIcons: Record<Tool, React.ReactNode> = {
  select: <MousePointer2 size={16} />,
  footprint: <PenTool size={16} />,
  opening: <DoorOpen size={16} />,
  interiorWall: <Ruler size={16} />,
  zone: <Layers size={16} />,
  measure: <RulerDimensionLine size={16} />,
};

const toolLabel: Record<Tool, MessageKey> = {
  select: "tool.select",
  footprint: "tool.footprint",
  opening: "tool.opening",
  interiorWall: "tool.interiorWall",
  zone: "tool.zone",
  measure: "tool.measure",
};

const toolHint: Record<Tool, MessageKey> = {
  select: "hint.select",
  footprint: "hint.footprint",
  opening: "hint.opening",
  interiorWall: "hint.interiorWall",
  zone: "hint.zone",
  measure: "hint.measure",
};

export function LeftPanel({ syncStatus }: { syncStatus: SyncStatus | "local" }) {
  return (
    <aside className="flex h-full flex-col overflow-y-auto border-r border-border bg-panel">
      <ProjectSwitcher status={syncStatus} />
      <StoreyList />
      <RoomList />
      <ToolPalette />
      <ZoneList />
      <LocationSection />
      <UnderlaySection />
      <Settings />
    </aside>
  );
}

function StoreyList() {
  const t = useT();
  const storeys = useEditorStore((s) => s.building.storeys);
  const activeStoreyId = useEditorStore((s) => s.activeStoreyId);
  const language = useEditorStore((s) => s.language);
  const setActiveStorey = useEditorStore((s) => s.setActiveStorey);
  const select = useEditorStore((s) => s.select);
  const addStorey = useEditorStore((s) => s.addStorey);
  const removeStorey = useEditorStore((s) => s.removeStorey);
  const moveStorey = useEditorStore((s) => s.moveStorey);
  const duplicateStorey = useEditorStore((s) => s.duplicateStorey);
  const [dragging, setDragging] = useState<Id | null>(null);

  const onDrop = (targetId: Id) => (e: DragEvent) => {
    e.preventDefault();
    if (!dragging || dragging === targetId) return;
    const from = storeys.findIndex((s) => s.id === dragging);
    const to = storeys.findIndex((s) => s.id === targetId);
    if (from === -1 || to === -1) return;
    const direction = to > from ? 1 : -1;
    for (let i = from; i !== to; i += direction) moveStorey(dragging, direction);
    setDragging(null);
  };

  // Top of the list is the top storey, like a building.
  const ordered = [...storeys].reverse();

  return (
    <Section
      title={t("panel.storeys")}
      action={
        <IconButton label={t("storey.add")} onClick={addStorey}>
          <Plus size={16} />
        </IconButton>
      }
    >
      {storeys.length === 0 && <p className="text-sm text-muted">{t("empty.body")}</p>}
      <ul className="flex flex-col gap-1">
        {ordered.map((storey) => {
          const index = storeys.indexOf(storey);
          const active = storey.id === activeStoreyId;
          return (
            <li
              key={storey.id}
              draggable
              onDragStart={() => {
                setDragging(storey.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={onDrop(storey.id)}
              onDragEnd={() => {
                setDragging(null);
              }}
              className={`group flex items-center gap-1 rounded border pr-1 ${
                active ? "border-accent bg-accent/10" : "border-transparent hover:bg-border/40"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveStorey(storey.id);
                  select({ kind: "storey", id: storey.id });
                }}
                aria-current={active ? "true" : undefined}
                className="flex min-w-0 flex-1 flex-col items-start px-2 py-1.5 text-left"
              >
                <span className="truncate text-sm text-fg">{storey.name}</span>
                <span className="font-mono text-xs text-muted">
                  {formatMetres(storey.height, language)}
                </span>
              </button>
              <IconButton
                label={t("storey.moveUp")}
                disabled={index === storeys.length - 1}
                onClick={() => {
                  moveStorey(storey.id, 1);
                }}
              >
                <ArrowUp size={14} />
              </IconButton>
              <IconButton
                label={t("storey.moveDown")}
                disabled={index === 0}
                onClick={() => {
                  moveStorey(storey.id, -1);
                }}
              >
                <ArrowDown size={14} />
              </IconButton>
              <IconButton
                label={t("storey.duplicate")}
                onClick={() => {
                  duplicateStorey(storey.id);
                }}
              >
                <Copy size={14} />
              </IconButton>
              <IconButton
                label={t("storey.remove")}
                onClick={() => {
                  removeStorey(storey.id);
                }}
              >
                <Trash2 size={14} />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function RoomList() {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const storey = useEditorStore(selectActiveStorey);
  const zones = useEditorStore((s) => s.building.zones);
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  if (!storey || storey.rooms.length === 0) return null;
  return (
    <Section title={t("rooms.title")}>
      <ul className="flex flex-col gap-0.5">
        {storey.rooms.map((room) => {
          const zone = zones.find((z) => z.id === room.zoneId);
          const selected = selection?.kind === "room" && selection.id === room.id;
          return (
            <li key={room.id}>
              <button
                type="button"
                onClick={() => {
                  select({ kind: "room", storeyId: storey.id, id: room.id });
                }}
                className={`flex w-full items-center gap-2 rounded border px-2 py-1 text-left text-sm ${
                  selected ? "border-accent bg-accent/10" : "border-transparent hover:bg-border/40"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background: zone?.color ?? "transparent",
                    outline: zone ? "none" : "1px solid #8b93a5",
                  }}
                />
                <span className="flex-1 truncate text-fg">{room.name}</span>
                <span className="font-mono text-xs text-muted">
                  {formatArea(room.area, language)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function ToolPalette() {
  const t = useT();
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  return (
    <Section title={t("panel.tools")}>
      <div role="radiogroup" aria-label={t("panel.tools")} className="grid grid-cols-3 gap-1">
        {TOOL_ORDER.map((id, i) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={tool === id}
            title={`${t(toolLabel[id])} (${i + 1})`}
            onClick={() => {
              setTool(id);
            }}
            className={`flex h-14 flex-col items-center justify-center gap-1 rounded border text-xs ${
              tool === id
                ? "border-accent bg-accent/15 text-accent"
                : "border-border text-muted hover:bg-border/60 hover:text-fg"
            }`}
          >
            {toolIcons[id]}
            <span className="truncate px-0.5">{t(toolLabel[id])}</span>
          </button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted">{t(toolHint[tool])}</p>
    </Section>
  );
}

function ZoneList() {
  const t = useT();
  const zones = useEditorStore((s) => s.building.zones);
  const activeZoneId = useEditorStore((s) => s.activeZoneId);
  const selection = useEditorStore((s) => s.selection);
  const addZone = useEditorStore((s) => s.addZone);
  const setActiveZone = useEditorStore((s) => s.setActiveZone);
  const select = useEditorStore((s) => s.select);
  const setTool = useEditorStore((s) => s.setTool);

  const onAdd = () => {
    const usedColors = new Set(zones.map((z) => z.color));
    const color =
      ["#e76f51", "#f4a261", "#e9c46a", "#2a9d8f", "#6c8ef5", "#b084cc"].find(
        (c) => !usedColors.has(c),
      ) ?? "#e76f51";
    const id = addZone(t("zone.defaultName", { n: zones.length + 1 }), color);
    setActiveZone(id);
    select({ kind: "zone", id });
    setTool("zone");
  };

  return (
    <Section
      title={t("panel.zones")}
      action={
        <IconButton label={t("zone.add")} onClick={onAdd}>
          <Plus size={16} />
        </IconButton>
      }
    >
      <ul className="flex flex-col gap-1">
        {zones.map((zone) => {
          const active = zone.id === activeZoneId;
          const selected = selection?.kind === "zone" && selection.id === zone.id;
          return (
            <li key={zone.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveZone(zone.id);
                  select({ kind: "zone", id: zone.id });
                }}
                aria-pressed={active}
                className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-sm ${
                  selected ? "border-accent bg-accent/10" : "border-transparent hover:bg-border/40"
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: zone.color }}
                />
                <span className="flex-1 truncate text-fg">{zone.name}</span>
                <span className="text-xs text-muted">
                  {t(zone.heated ? "zone.heated" : "zone.unheated")}
                </span>
                {active && <span className="text-xs text-accent">{t("zone.active")}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function Settings() {
  const t = useT();
  const wallThickness = useEditorStore((s) => s.building.wallThickness);
  const setWallThickness = useEditorStore((s) => s.setWallThickness);
  const showGrid = useEditorStore((s) => s.showGrid);
  const setShowGrid = useEditorStore((s) => s.setShowGrid);
  const language = useEditorStore((s) => s.language);
  const setLanguage = useEditorStore((s) => s.setLanguage);
  const loadBuilding = useEditorStore((s) => s.loadBuilding);
  const buildingName = useEditorStore((s) => s.building.name);
  const renameBuilding = useEditorStore((s) => s.renameBuilding);
  const planView = useEditorStore((s) => s.planView);
  const setPlanView = useEditorStore((s) => s.setPlanView);
  const showUValueBands = useEditorStore((s) => s.showUValueBands);
  const setShowUValueBands = useEditorStore((s) => s.setShowUValueBands);

  return (
    <Section title={t("panel.settings")}>
      <TextField label={t("building.name")} value={buildingName} onCommit={renameBuilding} />
      <NumberField
        label={t("settings.wallThickness")}
        value={wallThickness}
        min={0.1}
        max={1}
        step={0.05}
        unit={t("common.metres")}
        onCommit={setWallThickness}
      />
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={showGrid}
          onChange={(e) => {
            setShowGrid(e.target.checked);
          }}
          className="accent-accent"
        />
        <Grid3x3 size={14} className="text-muted" />
        {t("settings.grid")}
      </label>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={planView}
          onChange={(e) => {
            setPlanView(e.target.checked);
          }}
          className="accent-accent"
        />
        {t("view.plan")}
      </label>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={showUValueBands}
          onChange={(e) => {
            setShowUValueBands(e.target.checked);
          }}
          className="accent-accent"
        />
        {t("view.uValueBands")}
      </label>
      <Button
        variant="ghost"
        className="justify-start"
        icon={<Printer size={14} />}
        onClick={() => {
          const url = new URL(window.location.href);
          url.searchParams.set("print", "1");
          window.open(url.toString(), "_blank");
        }}
      >
        {t("print.open")}
      </Button>
      <Select
        label={t("settings.language")}
        value={language}
        options={LANGUAGES.map((l) => ({ value: l, label: l === "de" ? "Deutsch" : "English" }))}
        onChange={setLanguage}
      />
      <Select<ExampleId | "">
        label={t("settings.example")}
        value=""
        options={[
          { value: "", label: t("settings.examplePlaceholder") },
          { value: "house", label: t("example.house") },
          { value: "block", label: t("example.block") },
        ]}
        onChange={(id) => {
          if (id !== "") loadBuilding(example(id, language));
        }}
      />
      <Button
        variant="ghost"
        className="justify-start"
        onClick={() => {
          loadBuilding(example("house", language));
        }}
      >
        {t("settings.reset")}
      </Button>
    </Section>
  );
}
