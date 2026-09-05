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
import { Button } from "./controls/Button";
import { ColorSwatches } from "./controls/ColorSwatches";
import { ReadOnly, Section } from "./controls/Field";
import { NumberField } from "./controls/NumberField";
import { Select } from "./controls/Select";
import { TextField } from "./controls/TextField";
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

export function RightPanel() {
  const t = useT();
  const selection = useEditorStore((s) => s.selection);
  return (
    <aside className="flex h-full flex-col overflow-y-auto border-l border-border bg-panel">
      {selection ? (
        <Section title={t("panel.properties")}>
          <Properties selection={selection} />
        </Section>
      ) : (
        <>
          <Section title={t("panel.properties")}>
            <p className="text-sm text-muted">{t("properties.empty")}</p>
          </Section>
          <Section title={t("energy.title")}>
            <EnergyPanel />
          </Section>
        </>
      )}
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

function Title({ children }: { children: string }) {
  return <h3 className="text-base font-semibold text-fg">{children}</h3>;
}

function VertexProperties({ index }: { index: number }) {
  const t = useT();
  const footprint = useEditorStore((s) => s.building.footprint);
  const setFootprintVertex = useEditorStore((s) => s.setFootprintVertex);
  const removeFootprintVertex = useEditorStore((s) => s.removeFootprintVertex);
  const vertex = footprint[index];
  if (!vertex) return null;
  return (
    <>
      <Title>{t("vertex.title", { n: index + 1 })}</Title>
      <NumberField
        label={t("vertex.x")}
        value={vertex.x}
        min={-50}
        max={50}
        step={0.5}
        unit={t("common.metres")}
        onCommit={(x) => {
          setFootprintVertex(index, { x, y: vertex.y });
        }}
      />
      <NumberField
        label={t("vertex.y")}
        value={vertex.y}
        min={-50}
        max={50}
        step={0.5}
        unit={t("common.metres")}
        onCommit={(y) => {
          setFootprintVertex(index, { x: vertex.x, y });
        }}
      />
      <Button
        variant="danger"
        icon={<Trash2 size={14} />}
        disabled={footprint.length <= 3}
        title={footprint.length <= 3 ? t("vertex.cannotRemove") : undefined}
        onClick={() => {
          removeFootprintVertex(index);
        }}
      >
        {t("vertex.remove")}
      </Button>
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
  const count = onWall.length;
  const netArea = edge.length * storey.height - onWall.reduce((a, o) => a + o.width * o.height, 0);
  return (
    <>
      <Title>{t("wall.title", { n: wallIndex + 1 })}</Title>
      <ReadOnly label={t("wall.length")} value={formatMetres(edge.length, language)} />
      <ReadOnly label={t("wall.thickness")} value={formatMetres(thickness, language)} />
      <ReadOnly label={t("wall.openings")} value={String(count)} />
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
  const footprint = useEditorStore((s) => s.building.footprint);
  const storey = useStorey(storeyId);
  const updateOpening = useEditorStore((s) => s.updateOpening);
  const removeOpening = useEditorStore((s) => s.removeOpening);
  const windowConstructionId = useEditorStore((s) => s.building.windowConstructionId);
  const doorConstructionId = useEditorStore((s) => s.building.doorConstructionId);
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
          className="rounded border border-warning/60 bg-warning/10 p-2 text-xs text-warning"
        >
          <p className="font-medium">{t("opening.invalid")}</p>
          <ul className="mt-1 list-disc pl-4">
            {errors.map((e) => (
              <li key={e}>{t(openingErrorKey[e])}</li>
            ))}
          </ul>
        </div>
      )}
      <Select
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
      <NumberField
        label={t("opening.offset")}
        value={opening.offset}
        min={0}
        max={Math.max(0, edge.length - opening.width)}
        step={0.1}
        unit={m}
        invalid={has("outsideWallStart", "outsideWallEnd", "overlaps")}
        onCommit={(offset) => {
          patch({ offset });
        }}
      />
      <NumberField
        label={t("opening.width")}
        value={opening.width}
        min={0.1}
        max={edge.length}
        step={0.1}
        unit={m}
        invalid={has("outsideWallEnd", "overlaps", "tooSmall")}
        onCommit={(width) => {
          patch({ width });
        }}
      />
      <NumberField
        label={t("opening.height")}
        value={opening.height}
        min={0.1}
        max={storey.height}
        step={0.1}
        unit={m}
        invalid={has("tooTall", "tooSmall")}
        onCommit={(height) => {
          patch({ height });
        }}
      />
      {opening.kind === "window" && (
        <NumberField
          label={t("opening.sill")}
          value={opening.sill}
          min={0}
          max={Math.max(0, storey.height - opening.height)}
          step={0.1}
          unit={m}
          invalid={has("tooTall", "negativeSill")}
          onCommit={(sill) => {
            patch({ sill });
          }}
        />
      )}
      <Button
        variant="danger"
        icon={<Trash2 size={14} />}
        onClick={() => {
          removeOpening(storeyId, openingId);
        }}
      >
        {t("opening.remove")}
      </Button>
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
      <ReadOnly
        label={t("interiorWall.length")}
        value={formatMetres(distance(segment.a, segment.b), language)}
      />
      <Button
        variant="danger"
        icon={<Trash2 size={14} />}
        onClick={() => {
          removeInteriorWall(storeyId, index);
        }}
      >
        {t("interiorWall.remove")}
      </Button>
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
      <TextField
        label={t("room.name")}
        value={room.name}
        onCommit={(name) => {
          renameRoom(storeyId, roomId, name);
        }}
      />
      <ReadOnly label={t("room.area")} value={formatArea(room.area, language)} />
      <Select
        label={t("room.zone")}
        value={room.zoneId ?? ""}
        options={[
          { value: "", label: t("zone.none") },
          ...zones.map((z: Zone) => ({ value: z.id, label: z.name })),
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
  if (!storey) return null;
  const area = storey.rooms.reduce((s, r) => s + r.area, 0);
  return (
    <>
      <Title>{t("storey.title")}</Title>
      <TextField
        label={t("storey.name")}
        value={storey.name}
        onCommit={(name) => {
          renameStorey(storeyId, name);
        }}
      />
      <NumberField
        label={t("storey.height")}
        value={storey.height}
        min={2}
        max={6}
        step={0.1}
        unit={t("common.metres")}
        onCommit={(h) => {
          setStoreyHeight(storeyId, h);
        }}
      />
      <ReadOnly label={t("storey.openings")} value={String(storey.openings.length)} />
      <ReadOnly label={t("storey.rooms")} value={String(storey.rooms.length)} />
      <ReadOnly label={t("room.area")} value={formatArea(area, language)} />
      <Button
        variant="danger"
        icon={<Trash2 size={14} />}
        onClick={() => {
          removeStorey(storeyId);
        }}
      >
        {t("storey.remove")}
      </Button>
    </>
  );
}

function ZoneProperties({ zoneId }: { zoneId: string }) {
  const t = useT();
  const zone = useEditorStore((s) => s.building.zones.find((z) => z.id === zoneId));
  const roomCount = useEditorStore((s) =>
    s.building.storeys.reduce((n, st) => n + st.rooms.filter((r) => r.zoneId === zoneId).length, 0),
  );
  const updateZone = useEditorStore((s) => s.updateZone);
  const removeZone = useEditorStore((s) => s.removeZone);
  const setZoneHeated = useEditorStore((s) => s.setZoneHeated);
  const language = useEditorStore((s) => s.language);
  if (!zone) return null;
  return (
    <>
      <Title>{t("zone.title")}</Title>
      <TextField
        label={t("zone.name")}
        value={zone.name}
        onCommit={(name) => {
          updateZone(zoneId, { name });
        }}
      />
      <ColorSwatches
        label={t("zone.color")}
        value={zone.color}
        onChange={(color) => {
          updateZone(zoneId, { color });
        }}
      />
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={zone.heated}
          onChange={(e) => {
            setZoneHeated(zoneId, e.target.checked);
          }}
          className="accent-accent"
        />
        {t(zone.heated ? "zone.heated" : "zone.unheated")}
      </label>
      <ReadOnly
        label={t("zone.temperature")}
        value={`${formatNumber(zone.temperature, language, 0)} °C`}
      />
      <ReadOnly label={t("zone.rooms")} value={String(roomCount)} />
      <Button
        variant="danger"
        icon={<Trash2 size={14} />}
        onClick={() => {
          removeZone(zoneId);
        }}
      >
        {t("zone.remove")}
      </Button>
    </>
  );
}
