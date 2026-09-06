import { useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { bounds, centroid, snapPoint } from "@/geometry/polygon";
import { GRID_SIZE } from "@/geometry/types";
import type { Vec2 } from "@/geometry/types";
import { useEditorStore } from "@/store/building";
import { pointOnLevel } from "./plane";
import { useDragLock } from "./useDragLock";

const ROTATE_STEP = 5;

interface Drag {
  pointerId: number;
  start: Vec2;
  rotate: boolean;
  /** What has been applied so far, so each move sends only the difference. */
  appliedDelta: Vec2;
  appliedDegrees: number;
  centre: Vec2;
}

/**
 * Slides the whole building over the grid. A transparent plane under and around
 * the footprint catches the press, walls and roof let pointer events through to
 * it, so grabbing any part of the building works. The gesture is one undo step.
 */
export function MoveTool() {
  const footprint = useEditorStore((s) => s.building.footprint);
  const translate = useEditorStore((s) => s.translateBuilding);
  const rotate = useEditorStore((s) => s.rotateBuilding);
  const beginBatch = useEditorStore((s) => s.beginBatch);
  const endBatch = useEditorStore((s) => s.endBatch);
  const lock = useDragLock();
  const drag = useRef<Drag | null>(null);

  const plane = useMemo(() => {
    const { min, max } = bounds(footprint);
    const margin = 3;
    return {
      centre: [(min.x + max.x) / 2, (min.y + max.y) / 2] as [number, number],
      size: [max.x - min.x + 2 * margin, max.y - min.y + 2 * margin] as [number, number],
    };
  }, [footprint]);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    const hit = pointOnLevel(e, 0);
    if (!hit) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    lock(true);
    beginBatch();
    drag.current = {
      pointerId: e.pointerId,
      start: hit,
      rotate: e.nativeEvent.shiftKey,
      appliedDelta: { x: 0, y: 0 },
      appliedDegrees: 0,
      centre: centroid(footprint),
    };
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (d?.pointerId !== e.pointerId) return;
    const hit = pointOnLevel(e, 0);
    if (!hit) return;
    if (d.rotate) {
      const a0 = Math.atan2(d.start.y - d.centre.y, d.start.x - d.centre.x);
      const a1 = Math.atan2(hit.y - d.centre.y, hit.x - d.centre.x);
      const degrees = Math.round(((a1 - a0) * 180) / Math.PI / ROTATE_STEP) * ROTATE_STEP;
      const step = degrees - d.appliedDegrees;
      if (step !== 0) {
        rotate(step);
        d.appliedDegrees = degrees;
      }
      return;
    }
    const target = snapPoint({ x: hit.x - d.start.x, y: hit.y - d.start.y }, GRID_SIZE);
    const step = { x: target.x - d.appliedDelta.x, y: target.y - d.appliedDelta.y };
    if (step.x !== 0 || step.y !== 0) {
      translate(step);
      d.appliedDelta = target;
    }
  };

  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (d?.pointerId !== e.pointerId) return;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be gone */
    }
    drag.current = null;
    lock(false);
    endBatch();
  };

  return (
    <mesh
      position={[plane.centre[0], 0.01, plane.centre[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <planeGeometry args={plane.size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
