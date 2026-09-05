import { DEFAULT_RADIATOR, roomHeatLoads, suggestRadiatorPower } from "@/geometry/hvac";
import { dot, edges, pointInPolygon, sub } from "@/geometry/polygon";
import type { Vec2 } from "@/geometry/types";
import { useEditorStore } from "@/store/building";

/** Radiator placement from a wall click: centred under the click, sized to the room behind it. */
export function placeRadiatorFromWallClick(point: Vec2, wallIndex: number) {
  const s = useEditorStore.getState();
  const storeyId = s.activeStoreyId;
  if (!storeyId) return;
  const e = edges(s.building.footprint)[wallIndex];
  const storey = s.building.storeys.find((st) => st.id === storeyId);
  if (!e || !storey) return;
  const u = dot(sub(point, e.a), e.direction);
  const width = DEFAULT_RADIATOR.width;
  const offset =
    Math.round(Math.min(Math.max(u - width / 2, 0), Math.max(0, e.length - width)) * 10) / 10;
  const behind = {
    x: e.a.x + e.direction.x * (offset + width / 2) - e.normal.x * 0.3,
    y: e.a.y + e.direction.y * (offset + width / 2) - e.normal.y * 0.3,
  };
  const room = storey.rooms.find((r) => pointInPolygon(behind, r.polygon));
  const load = room ? roomHeatLoads(s.building).find((l) => l.roomId === room.id)?.load : undefined;
  const power = load !== undefined ? suggestRadiatorPower(load) : DEFAULT_RADIATOR.power;
  const id = s.addRadiator(storeyId, {
    wallIndex,
    offset,
    width,
    height: DEFAULT_RADIATOR.height,
    power,
  });
  s.select({ kind: "radiator", storeyId, id });
}
