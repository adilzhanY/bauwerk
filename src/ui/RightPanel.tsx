import { useState } from "react";
import { Trash2 } from "lucide-react";
import { validateOpening } from "@/geometry/openings";
import type { OpeningError } from "@/geometry/openings";
import { distance, edges } from "@/geometry/polygon";
import type { Opening, Room, Storey, Zone } from "@/geometry/types";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n";
import { formatArea, formatMetres, formatNumber } from "@/lib/format";
import { useEditorStore } from "@/store/building";
import type { Selection } from "@/store/building";
import { CustomButton } from "@/components/CustomButton";
import { CustomCheckbox } from "@/components/CustomCheckbox";
import { CustomReadOnly, CustomSection } from "@/components/CustomField";
import { CustomNumberInput } from "@/components/CustomNumberInput";
import { CustomSegmented } from "@/components/CustomSegmented";
import { CustomSelect } from "@/components/CustomSelect";
import { CustomSwatches } from "@/components/CustomSwatches";
import { CustomTabPanel, CustomTabs } from "@/components/CustomTabs";
import { CustomTextInput } from "@/components/CustomTextInput";
import { ConstructionSelect, EnergyPanel } from "./EnergyPanel";

const openingErrorKey: Record<OpeningError, MessageKey> = {
  outsideWallStart: "opening.error.outsideWallStart",
  outsideWallEnd: "opening.error.outsideWallEnd",
  tooSmall: "opening.error.tooSmall",
  overlaps: "opening.error.overlaps",
  tooTall: "opening.error.tooTall",
  doorNotOnFloor: "opening.error.doorNotOnFloor",
  negativeSill: "opening.error.negativeSill",
};

type Tab = "properties" | "energy";

export function RightPanel() {
  const t = useT();
  const selection = useEditorStore((s) => s.selection);
  const [tab, setTab] = useState<Tab>("properties");
  const [lastSelection, setLastSelection] = useState(selection);
  if (selection !== lastSelection) {
    // A fresh selection brings the properties tab forward.
    setLastSelection(selection);
    if (selection) setTab("properties");
  }
  return (
    <aside className="pointer-events-auto flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-line bg-panel shadow-float">
      <CustomTabs
        label={t("panel.properties")}
        value={tab}
        tabs={[
          { value: "properties", label: t("tabs.properties") },
          { value: "energy", label: t("tabs.energy") },
        ]}
        onChange={setTab}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "properties" ? (
          <CustomTabPanel value="properties">
            <CustomSection title={t("panel.properties")} first>
              {selection ? (
                <Properties selection={selection} />
              ) : (
                <p className="text-sm text-muted">{t("properties.empty")}</p>
              )}
            </CustomSection>
          </CustomTabPanel>
        ) : (
          <CustomTabPanel value="energy">
            <CustomSection title={t("energy.title")} first>
              <EnergyPanel />
            </CustomSection>
          </CustomTabPanel>
        )}
      </div>
    </aside>
  );
}

function Properties({ selection }: { selection: Selection }) {
  switch (selection.kind) {
    case "vertex":
      return <VertexProperties index={selection.index} />;
    case "wall":
      return <WallProperties storeyId={selection.storeyId} wallIndex={selection.wallIndex} />;
    case "opening":
      return <OpeningProperties storeyId={selection.storeyId} openingId={selection.id} />;
    case "interiorWall":
      return <InteriorWallProperties storeyId={selection.storeyId} index={selection.index} />;
    case "room":
      return <RoomProperties storeyId={selection.storeyId} roomId={selection.id} />;
    case "storey":
      return <StoreyProperties storeyId={selection.id} />;
    case "zone":
      return <ZoneProperties zoneId={selection.id} />;
  }
}

function useStorey(storeyId: string): Storey | undefined {
  return useEditorStore((s) => s.building.storeys.find((st) => st.id === storeyId));
}

function useBatch() {
  const beginBatch = useEditorStore((s) => s.beginBatch);
  const endBatch = useEditorStore((s) => s.endBatch);
  return { onGestureStart: beginBatch, onGestureEnd: endBatch };
}

function Title({ children }: { children: string }) {
  return <h3 className="font-display text-lg font-semibold text-ink">{children}</h3>;
}

function RemoveButton({
  label,
  onClick,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <CustomButton
      variant="danger"
      icon={<Trash2 size={14} />}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="mt-2 self-start"
    >
      {label}
    </CustomButton>
  );
}

function VertexProperties({ index }: { index: number }) {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const footprint = useEditorStore((s) => s.building.footprint);
  const setFootprintVertex = useEditorStore((s) => s.setFootprintVertex);
  const removeFootprintVertex = useEditorStore((s) => s.removeFootprintVertex);
  const batch = useBatch();
  const vertex = footprint[index];
  if (!vertex) return null;
  const m = t("common.metres");
  return (
    <>
      <Title>{t("vertex.title", { n: index + 1 })}</Title>
      <CustomNumberInput
        label={t("vertex.x")}
        value={vertex.x}
        min={-50}
        max={50}
        step={0.5}
        unit={m}
        language={language}
        onChange={(x) => {
          setFootprintVertex(index, { x, y: vertex.y });
        }}
        {...batch}
      />
      <CustomNumberInput
        label={t("vertex.y")}
        value={vertex.y}
        min={-50}
        max={50}
        step={0.5}
        unit={m}
        language={language}
        onChange={(y) => {
          setFootprintVertex(index, { x: vertex.x, y });
        }}
        {...batch}
      />
      <RemoveButton
        label={t("vertex.remove")}
        disabled={footprint.length <= 3}
        title={footprint.length <= 3 ? t("vertex.cannotRemove") : undefined}
        onClick={() => {
          removeFootprintVertex(index);
        }}
      />
    </>
  );
}

function WallProperties({ storeyId, wallIndex }: { storeyId: string; wallIndex: number }) {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const footprint = useEditorStore((s) => s.building.footprint);
  const thickness = useEditorStore((s) => s.building.wallThickness);
  const wallConstructionId = useEditorStore((s) => s.building.wallConstructionId);
  const storey = useStorey(storeyId);
  const edge = edges(footprint)[wallIndex];
  if (!edge || !storey) return null;
  const onWall = storey.openings.filter((o) => o.wallIndex === wallIndex);
  const netArea = edge.length * storey.height - onWall.reduce((a, o) => a + o.width * o.height, 0);
  return (
    <>
      <Title>{t("wall.title", { n: wallIndex + 1 })}</Title>
      <CustomReadOnly label={t("wall.length")} value={formatMetres(edge.length, language)} />
      <CustomReadOnly label={t("wall.thickness")} value={formatMetres(thickness, language)} />
      <CustomReadOnly label={t("wall.openings")} value={String(onWall.length)} />
      <ConstructionSelect
        category="wall"
        value={wallConstructionId}
        area={Math.max(0, netArea)}
        target={{ kind: "wall" }}
      />
      <p className="text-xs leading-relaxed text-muted">{t("wall.hint")}</p>
    </>
  );
}

function OpeningProperties({ storeyId, openingId }: { storeyId: string; openingId: string }) {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const footprint = useEditorStore((s) => s.building.footprint);
  const storey = useStorey(storeyId);
  const updateOpening = useEditorStore((s) => s.updateOpening);
  const removeOpening = useEditorStore((s) => s.removeOpening);
  const windowConstructionId = useEditorStore((s) => s.building.windowConstructionId);
  const doorConstructionId = useEditorStore((s) => s.building.doorConstructionId);
  const batch = useBatch();
  const opening = storey?.openings.find((o) => o.id === openingId);
  const edge = opening ? edges(footprint)[opening.wallIndex] : undefined;
  if (!storey || !opening || !edge) return null;
  const errors = validateOpening(opening, {
    wallLength: edge.length,
    storeyHeight: storey.height,
    siblings: storey.openings,
  });
  const has = (...codes: OpeningError[]) => errors.some((e) => codes.includes(e));
  const patch = (p: Partial<Omit<Opening, "id">>) => {
    updateOpening(storeyId, openingId, p);
  };
  const m = t("common.metres");
  return (
    <>
      <Title>{t(opening.kind === "door" ? "opening.door" : "opening.window")}</Title>
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-inner border border-mark bg-mark-soft px-3 py-2 text-xs text-mark"
        >
          <p className="font-medium">{t("opening.invalid")}</p>
          <ul className="mt-1 list-disc pl-4">
            {errors.map((e) => (
              <li key={e}>{t(openingErrorKey[e])}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">{t("opening.kind")}</span>
        <CustomSegmented
          label={t("opening.kind")}
          value={opening.kind}
          options={[
            { value: "window", label: t("opening.window") },
            { value: "door", label: t("opening.door") },
          ]}
          onChange={(kind) => {
            const constructionId = kind === "door" ? doorConstructionId : windowConstructionId;
            patch(kind === "door" ? { kind, sill: 0, constructionId } : { kind, constructionId });
          }}
        />
      </div>
      <CustomNumberInput
        label={t("opening.offset")}
        value={opening.offset}
        min={0}
        max={Math.max(0, edge.length - opening.width)}
        step={0.1}
        unit={m}
        language={language}
        invalid={has("outsideWallStart", "outsideWallEnd", "overlaps")}
        onChange={(offset) => {
          patch({ offset });
        }}
        {...batch}
      />
      <CustomNumberInput
        label={t("opening.width")}
        value={opening.width}
        min={0.1}
        max={edge.length}
        step={0.1}
        unit={m}
        language={language}
        invalid={has("outsideWallEnd", "overlaps", "tooSmall")}
        onChange={(width) => {
          patch({ width });
        }}
        {...batch}
      />
      <CustomNumberInput
        label={t("opening.height")}
        value={opening.height}
        min={0.1}
        max={storey.height}
        step={0.1}
        unit={m}
        language={language}
        invalid={has("tooTall", "tooSmall")}
        onChange={(height) => {
          patch({ height });
        }}
        {...batch}
      />
      {opening.kind === "window" && (
        <CustomNumberInput
          label={t("opening.sill")}
          value={opening.sill}
          min={0}
          max={Math.max(0, storey.height - opening.height)}
          step={0.1}
          unit={m}
          language={language}
          invalid={has("tooTall", "negativeSill")}
          onChange={(sill) => {
            patch({ sill });
          }}
          {...batch}
        />
      )}
      <ConstructionSelect
        category={opening.kind}
        value={opening.constructionId}
        area={opening.width * opening.height}
        target={{ kind: "opening", storeyId, id: openingId }}
      />
      <RemoveButton
        label={t("opening.remove")}
        onClick={() => {
          removeOpening(storeyId, openingId);
        }}
      />
    </>
  );
}

function InteriorWallProperties({ storeyId, index }: { storeyId: string; index: number }) {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const storey = useStorey(storeyId);
  const removeInteriorWall = useEditorStore((s) => s.removeInteriorWall);
  const segment = storey?.interiorWalls[index];
  if (!segment) return null;
  return (
    <>
      <Title>{t("interiorWall.title")}</Title>
      <CustomReadOnly
        label={t("interiorWall.length")}
        value={formatMetres(distance(segment.a, segment.b), language)}
      />
      <RemoveButton
        label={t("interiorWall.remove")}
        onClick={() => {
          removeInteriorWall(storeyId, index);
        }}
      />
    </>
  );
}

function RoomProperties({ storeyId, roomId }: { storeyId: string; roomId: string }) {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const zones = useEditorStore((s) => s.building.zones);
  const storey = useStorey(storeyId);
  const renameRoom = useEditorStore((s) => s.renameRoom);
  const assignRoomToZone = useEditorStore((s) => s.assignRoomToZone);
  const room: Room | undefined = storey?.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  return (
    <>
      <Title>{t("room.title")}</Title>
      <CustomTextInput
        label={t("room.name")}
        value={room.name}
        onCommit={(name) => {
          renameRoom(storeyId, roomId, name);
        }}
      />
      <CustomReadOnly label={t("room.area")} value={formatArea(room.area, language)} />
      <CustomSelect
        label={t("room.zone")}
        value={room.zoneId ?? ""}
        options={[
          { value: "", label: t("zone.none") },
          ...zones.map((z: Zone) => ({ value: z.id, label: z.name, color: z.color })),
        ]}
        onChange={(id) => {
          assignRoomToZone(storeyId, roomId, id === "" ? undefined : id);
        }}
      />
    </>
  );
}

function StoreyProperties({ storeyId }: { storeyId: string }) {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const storey = useStorey(storeyId);
  const renameStorey = useEditorStore((s) => s.renameStorey);
  const setStoreyHeight = useEditorStore((s) => s.setStoreyHeight);
  const removeStorey = useEditorStore((s) => s.removeStorey);
  const batch = useBatch();
  if (!storey) return null;
  const area = storey.rooms.reduce((s, r) => s + r.area, 0);
  return (
    <>
      <Title>{t("storey.title")}</Title>
      <CustomTextInput
        label={t("storey.name")}
        value={storey.name}
        onCommit={(name) => {
          renameStorey(storeyId, name);
        }}
      />
      <CustomNumberInput
        label={t("storey.height")}
        value={storey.height}
        min={2}
        max={6}
        step={0.1}
        unit={t("common.metres")}
        language={language}
        onChange={(h) => {
          setStoreyHeight(storeyId, h);
        }}
        {...batch}
      />
      <CustomReadOnly label={t("storey.openings")} value={String(storey.openings.length)} />
      <CustomReadOnly label={t("storey.rooms")} value={String(storey.rooms.length)} />
      <CustomReadOnly label={t("room.area")} value={formatArea(area, language)} />
      <RemoveButton
        label={t("storey.remove")}
        onClick={() => {
          removeStorey(storeyId);
        }}
      />
    </>
  );
}

function ZoneProperties({ zoneId }: { zoneId: string }) {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const zone = useEditorStore((s) => s.building.zones.find((z) => z.id === zoneId));
  const roomCount = useEditorStore((s) =>
    s.building.storeys.reduce((n, st) => n + st.rooms.filter((r) => r.zoneId === zoneId).length, 0),
  );
  const updateZone = useEditorStore((s) => s.updateZone);
  const removeZone = useEditorStore((s) => s.removeZone);
  const setZoneHeated = useEditorStore((s) => s.setZoneHeated);
  if (!zone) return null;
  return (
    <>
      <Title>{t("zone.title")}</Title>
      <CustomTextInput
        label={t("zone.name")}
        value={zone.name}
        onCommit={(name) => {
          updateZone(zoneId, { name });
        }}
      />
      <CustomSwatches
        label={t("zone.color")}
        value={zone.color}
        onChange={(color) => {
          updateZone(zoneId, { color });
        }}
      />
      <CustomCheckbox
        variant="switch"
        label={t(zone.heated ? "zone.heated" : "zone.unheated")}
        checked={zone.heated}
        onChange={(heated) => {
          setZoneHeated(zoneId, heated);
        }}
      />
      <CustomReadOnly
        label={t("zone.temperature")}
        value={`${formatNumber(zone.temperature, language, 0)} °C`}
      />
      <CustomReadOnly label={t("zone.rooms")} value={String(roomCount)} />
      <RemoveButton
        label={t("zone.remove")}
        onClick={() => {
          removeZone(zoneId);
        }}
      />
    </>
  );
}
