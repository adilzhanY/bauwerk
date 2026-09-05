import { useState } from "react";
import type { DragEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Copy,
  Image as ImageIcon,
  MapPin,
  Palette,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { MessageKey } from "@/i18n";
import { CustomSegmented } from "@/components/CustomSegmented";
import type { Id } from "@/geometry/types";
import { useT } from "@/i18n/useT";
import { formatArea, formatMetres } from "@/lib/format";
import { useEditorStore } from "@/store/building";
import { selectActiveStorey } from "@/store/selectors";
import type { SyncStatus } from "@/sync/client";
import { CustomIconButton } from "@/components/CustomIconButton";
import { CustomSection } from "@/components/CustomField";
import { ZONE_COLORS } from "@/lib/colors";
import { cx } from "@/components/cx";
import { LocationSection } from "./LocationSection";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { SettingsSection } from "./SettingsSection";
import { toolHint } from "./tools";
import { UnderlaySection } from "./UnderlaySection";

type SectionId = "storeys" | "zones" | "location" | "underlay" | "settings";

const sectionIcons: Record<SectionId, ReactNode> = {
  storeys: <Building2 size={20} />,
  zones: <Palette size={20} />,
  location: <MapPin size={20} />,
  underlay: <ImageIcon size={20} />,
  settings: <Settings2 size={20} />,
};

const sectionLabel: Record<SectionId, MessageKey> = {
  storeys: "panel.storeys",
  zones: "panel.zones",
  location: "location.title",
  underlay: "underlay.title",
  settings: "panel.settings",
};

/** Floating panel with an icon strip that shows one section at a time. */
export function LeftPanel({ syncStatus }: { syncStatus: SyncStatus | "local" }) {
  const t = useT();
  const tool = useEditorStore((s) => s.tool);
  const [section, setSection] = useState<SectionId>("storeys");
  const ids: SectionId[] = ["storeys", "zones", "location", "underlay", "settings"];
  return (
    <aside className="pointer-events-auto flex h-full min-h-0 rounded-card border border-line bg-panel shadow-float">
      <div className="flex flex-col items-center border-r border-line p-2">
        <CustomSegmented
          label={t("panel.view")}
          value={section}
          vertical
          iconsOnly
          options={ids.map((id) => ({
            value: id,
            label: t(sectionLabel[id]),
            icon: sectionIcons[id],
          }))}
          onChange={setSection}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="border-b border-line px-4 py-3 text-sm leading-relaxed text-muted">
          {t(toolHint[tool])}
        </div>
        {section === "storeys" && (
          <>
            <ProjectSwitcher status={syncStatus} />
            <StoreyList />
            <RoomList />
          </>
        )}
        {section === "zones" && <ZoneList />}
        {section === "location" && <LocationSection />}
        {section === "underlay" && <UnderlaySection />}
        {section === "settings" && <SettingsSection />}
      </div>
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

  // Drawn as a section: top storey first, like the building.
  const ordered = [...storeys].reverse();
  const totalHeight = storeys.reduce((s, x) => s + x.height, 0) || 1;

  return (
    <CustomSection
      title={t("panel.storeys")}
      action={
        <CustomIconButton label={t("storey.add")} size="sm" onClick={addStorey}>
          <Plus size={16} />
        </CustomIconButton>
      }
    >
      {storeys.length === 0 && <p className="text-sm text-muted">{t("empty.body")}</p>}
      <ul className="flex flex-col">
        {ordered.map((storey) => {
          const index = storeys.indexOf(storey);
          const active = storey.id === activeStoreyId;
          const share = Math.max(36, (storey.height / totalHeight) * 160);
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
              style={{ minHeight: share }}
              className={cx(
                "group flex items-stretch border-x border-t border-line last:border-b",
                active ? "bg-paper" : "bg-panel-2/60 hover:bg-panel-2",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveStorey(storey.id);
                  select({ kind: "storey", id: storey.id });
                }}
                aria-current={active ? "true" : undefined}
                className={cx(
                  "flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 text-left",
                  active && "border-l-2 border-select",
                )}
              >
                <span
                  className={cx("truncate text-sm", active ? "font-medium text-ink" : "text-muted")}
                >
                  {storey.name}
                </span>
                <span className="font-num text-xs text-muted">
                  {formatMetres(storey.height, language)} · {storey.rooms.length}{" "}
                  {t("storey.rooms").toLowerCase()}
                </span>
              </button>
              <div className="flex flex-col justify-center gap-0 pr-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <div className="flex">
                  <CustomIconButton
                    label={t("storey.moveUp")}
                    size="sm"
                    disabled={index === storeys.length - 1}
                    onClick={() => {
                      moveStorey(storey.id, 1);
                    }}
                  >
                    <ArrowUp size={13} />
                  </CustomIconButton>
                  <CustomIconButton
                    label={t("storey.moveDown")}
                    size="sm"
                    disabled={index === 0}
                    onClick={() => {
                      moveStorey(storey.id, -1);
                    }}
                  >
                    <ArrowDown size={13} />
                  </CustomIconButton>
                </div>
                <div className="flex">
                  <CustomIconButton
                    label={t("storey.duplicate")}
                    size="sm"
                    onClick={() => {
                      duplicateStorey(storey.id);
                    }}
                  >
                    <Copy size={13} />
                  </CustomIconButton>
                  <CustomIconButton
                    label={t("storey.remove")}
                    size="sm"
                    onClick={() => {
                      removeStorey(storey.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </CustomIconButton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </CustomSection>
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
    <CustomSection title={t("rooms.title")}>
      <ul className="flex flex-col">
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
                className={cx(
                  "flex w-full items-center gap-2 border-l-2 px-2 py-1 text-left text-sm",
                  selected ? "border-select bg-paper" : "border-transparent hover:bg-panel-2",
                )}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-line-strong"
                  style={{ background: zone?.color ?? "transparent" }}
                />
                <span className="flex-1 truncate text-ink">{room.name}</span>
                <span className="font-num text-xs text-muted">
                  {formatArea(room.area, language)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </CustomSection>
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
    const used = new Set(zones.map((z) => z.color));
    const color = ZONE_COLORS.find((c) => !used.has(c)) ?? ZONE_COLORS[0];
    const id = addZone(t("zone.defaultName", { n: zones.length + 1 }), color);
    setActiveZone(id);
    select({ kind: "zone", id });
    setTool("zone");
  };

  return (
    <CustomSection
      title={t("panel.zones")}
      action={
        <CustomIconButton label={t("zone.add")} size="sm" onClick={onAdd}>
          <Plus size={16} />
        </CustomIconButton>
      }
    >
      {zones.length === 0 && <p className="text-xs text-muted">{t("hint.zone")}</p>}
      <ul className="flex flex-col">
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
                className={cx(
                  "flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-left text-sm",
                  selected ? "border-select bg-paper" : "border-transparent hover:bg-panel-2",
                )}
              >
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: zone.color }}
                />
                <span className="flex-1 truncate text-ink">{zone.name}</span>
                <span className="font-num text-xs text-muted">
                  {t(zone.heated ? "zone.heated" : "zone.unheated")}
                </span>
                {active && (
                  <span className="rounded-soft bg-select-soft px-1.5 font-num text-xs text-select">
                    {t("zone.active")}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </CustomSection>
  );
}
