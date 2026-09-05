import { useMemo } from "react";
import { validateOpening } from "@/geometry/openings";
import { buildWalls } from "@/geometry/walls";
import { effectiveWallThickness } from "@/geometry/layers";
import type { Building, Storey as StoreyData } from "@/geometry/types";
import { colors, INACTIVE_OPACITY } from "@/lib/colors";
import { Opening } from "./Opening";
import { Room } from "./Room";
import { Wall } from "./Wall";
import { InteriorWall } from "./InteriorWall";
import { prismGeometry } from "./three";
import { StoreyHvac } from "./Hvac";

interface Props {
  building: Building;
  storey: StoreyData;
  elevation: number;
  active: boolean;
}

const SLAB = 0.2;

export function Storey({ building, storey, elevation, active }: Props) {
  const thickness = effectiveWallThickness(building);
  const walls = useMemo(
    () => buildWalls(building.footprint, thickness, storey.height),
    [building.footprint, thickness, storey.height],
  );
  const slab = useMemo(
    () => prismGeometry(building.footprint, elevation - SLAB, elevation),
    [building.footprint, elevation],
  );
  const zones = useMemo(() => new Map(building.zones.map((z) => [z.id, z])), [building.zones]);

  return (
    <group>
      <mesh geometry={slab} receiveShadow raycast={() => null}>
        <meshStandardMaterial
          color={colors.floor}
          roughness={1}
          transparent={!active}
          opacity={active ? 1 : INACTIVE_OPACITY}
          depthWrite={active}
        />
      </mesh>
      {walls.map((wall) => {
        const onWall = storey.openings.filter((o) => o.wallIndex === wall.index);
        return (
          <group key={wall.index}>
            <Wall
              storeyId={storey.id}
              wall={wall}
              openings={onWall}
              elevation={elevation}
              active={active}
            />
            {onWall.map((opening) => (
              <Opening
                key={opening.id}
                storeyId={storey.id}
                wall={wall}
                opening={opening}
                thickness={thickness}
                elevation={elevation}
                active={active}
                valid={
                  validateOpening(opening, {
                    wallLength: wall.length,
                    storeyHeight: storey.height,
                    siblings: onWall,
                  }).length === 0
                }
              />
            ))}
          </group>
        );
      })}
      {storey.interiorWalls.map((segment, index) => (
        <InteriorWall
          key={`${segment.a.x},${segment.a.y},${segment.b.x},${segment.b.y}`}
          storeyId={storey.id}
          index={index}
          segment={segment}
          height={storey.height}
          elevation={elevation}
          active={active}
        />
      ))}
      <StoreyHvac building={building} storey={storey} elevation={elevation} active={active} />
      {storey.rooms.map((room) => (
        <Room
          key={room.id}
          storeyId={storey.id}
          room={room}
          zone={room.zoneId === undefined ? undefined : zones.get(room.zoneId)}
          elevation={elevation}
          active={active}
        />
      ))}
    </group>
  );
}
