import { useMemo } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { centroid } from "@/geometry/polygon";
import type { Id, Room as RoomData, Zone } from "@/geometry/types";
import { colors, INACTIVE_OPACITY } from "@/lib/colors";
import { formatArea } from "@/lib/format";
import { sameSelection, useEditorStore } from "@/store/building";
import type { Selection } from "@/store/building";
import { useHover } from "./hover";
import { flatGeometry } from "./three";

interface Props {
  storeyId: Id;
  room: RoomData;
  zone: Zone | undefined;
  elevation: number;
  active: boolean;
}

const noRaycast = () => null;

/** Flat fill on the floor, coloured by zone, with a label facing the camera. */
export function Room({ storeyId, room, zone, elevation, active }: Props) {
  const target: Selection = useMemo(
    () => ({ kind: "room", storeyId, id: room.id }),
    [storeyId, room.id],
  );
  const selected = useEditorStore((s) => sameSelection(s.selection, target));
  const hovered = useEditorStore((s) => sameSelection(s.hovered, target));
  const language = useEditorStore((s) => s.language);
  const select = useEditorStore((s) => s.select);
  const tool = useEditorStore((s) => s.tool);
  const activeZoneId = useEditorStore((s) => s.activeZoneId);
  const assignRoomToZone = useEditorStore((s) => s.assignRoomToZone);
  const hover = useHover(target, active);

  const hash = JSON.stringify(room.polygon);
  const geometry = useMemo(
    () => flatGeometry(room.polygon, elevation + 0.012),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hash, elevation],
  );
  const centre = useMemo(() => centroid(room.polygon), [hash]); // eslint-disable-line react-hooks/exhaustive-deps

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    if (tool !== "select" && tool !== "zone") return;
    e.stopPropagation();
    select(target);
    if (tool === "zone" && activeZoneId !== null) {
      assignRoomToZone(storeyId, room.id, room.zoneId === activeZoneId ? undefined : activeZoneId);
    }
  };

  const fill = zone?.color ?? colors.floor;
  const baseOpacity = zone ? 0.55 : 0.001;
  const opacity = active
    ? hovered || selected
      ? Math.max(baseOpacity, 0.35)
      : baseOpacity
    : INACTIVE_OPACITY * (zone ? 1 : 0);

  return (
    <group>
      <mesh
        geometry={geometry}
        onClick={onClick}
        raycast={active ? undefined : noRaycast}
        {...hover}
      >
        <meshStandardMaterial
          color={selected ? colors.accent : fill}
          transparent
          opacity={opacity}
          depthWrite={false}
          roughness={1}
        />
      </mesh>
      {active && (
        <Html
          position={[centre.x, elevation + 0.05, centre.y]}
          center
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="rounded-pill border border-line bg-paper/90 px-2 py-0.5 text-center whitespace-nowrap select-none">
            <div className="text-xs font-medium text-ink">{room.name}</div>
            <div className="font-num text-xs text-muted">{formatArea(room.area, language)}</div>
          </div>
        </Html>
      )}
    </group>
  );
}
