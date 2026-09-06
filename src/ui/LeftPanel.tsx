import { useState } from "react";
import type { KeyboardEvent } from "react";
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
  const active = storeys.find((s) => s.id === activeStoreyId);
  const activeIndex = active ? storeys.indexOf(active) : -1;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (activeIndex === -1) return;
    // Up raises the storey index, matching the top storey being drawn first.
    const step = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = storeys[(activeIndex + step + storeys.length) % storeys.length];
    if (next) {
      setActiveStorey(next.id);
      select({ kind: "storey", id: next.id });
    }
  };

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
      {storeys.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* A vertical switch, top storey first like the building. */}
          <div
            role="radiogroup"
            aria-label={t("panel.storeys")}
            className="flex flex-col gap-1 rounded-card border border-line bg-panel p-1"
          >
            {[...storeys].reverse().map((storey) => {
              const selected = storey.id === activeStoreyId;
              return (
                <button
                  key={storey.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-current={selected ? "true" : undefined}
                  tabIndex={selected ? 0 : -1}
                  title={storey.name}
                  onClick={() => {
                    setActiveStorey(storey.id);
                    select({ kind: "storey", id: storey.id });
                  }}
                  onKeyDown={onKeyDown}
                  className={cx(
                    "h-10 min-w-0 truncate rounded-pill px-4 text-left text-sm transition-colors",
                    selected ? "bg-ink text-paper" : "text-muted hover:bg-panel-2 hover:text-ink",
                  )}
                >
                  {storey.name}
                </button>
              );
            })}
          </div>
          {active && (
            <div className="flex items-center gap-1 px-1">
              <span className="font-num min-w-0 flex-1 truncate text-xs text-muted">
                {formatMetres(active.height, language)} · {active.rooms.length}{" "}
                {t("storey.rooms").toLowerCase()}
              </span>
              <CustomIconButton
                label={t("storey.moveDown")}
                size="sm"
                disabled={activeIndex === 0}
                onClick={() => {
                  moveStorey(active.id, -1);
                }}
              >
                <ArrowDown size={13} />
              </CustomIconButton>
              <CustomIconButton
                label={t("storey.moveUp")}
                size="sm"
                disabled={activeIndex === storeys.length - 1}
                onClick={() => {
                  moveStorey(active.id, 1);
                }}
              >
                <ArrowUp size={13} />
              </CustomIconButton>
              <CustomIconButton
                label={t("storey.duplicate")}
                size="sm"
                onClick={() => {
                  duplicateStorey(active.id);
                }}
              >
                <Copy size={13} />
              </CustomIconButton>
              <CustomIconButton
                label={t("storey.remove")}
                size="sm"
                onClick={() => {
                  removeStorey(active.id);
                }}
              >
                <Trash2 size={13} />
              </CustomIconButton>
            </div>
          )}
        </div>
      )}
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
