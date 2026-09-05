import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { bounds } from "@/geometry/polygon";
import { useEditorStore } from "@/store/building";
import { storeyElevation } from "@/store/selectors";

const STOREY_ANIMATION_MS = 300;

interface Tween {
  from: Vector3;
  to: Vector3;
  start: number;
}

/**
 * Fits the building on first load and glides the orbit target to the active
 * storey's mid height over 300 ms whenever the active storey changes.
 */
export function Camera() {
  // During a walkthrough the default controls are PointerLockControls, which have no
  // orbit target, so only orbit controls are used here.
  const controls = useThree((s) => {
    const c = s.controls as OrbitControlsImpl | null;
    return c !== null && "target" in c && c.target instanceof Vector3 ? c : null;
  });
  const camera = useThree((s) => s.camera);
  const building = useEditorStore((s) => s.building);
  const activeStoreyId = useEditorStore((s) => s.activeStoreyId);
  const planView = useEditorStore((s) => s.planView);
  const tween = useRef<Tween | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!controls || fitted.current) return;
    const { min, max } = bounds(building.footprint);
    const centre = new Vector3((min.x + max.x) / 2, 0, (min.y + max.y) / 2);
    const size = Math.max(max.x - min.x, max.y - min.y, 4);
    const height = building.storeys.reduce((s, st) => s + st.height, 0);
    const distance = size * 1.4 + height;
    camera.position.set(
      centre.x + distance * 0.8,
      height + distance * 0.7,
      centre.z + distance * 0.8,
    );
    controls.target.copy(centre);
    controls.update();
    fitted.current = true;
  }, [controls, camera, building]);

  useEffect(() => {
    if (!controls || activeStoreyId === null || planView) return;
    const storey = building.storeys.find((s) => s.id === activeStoreyId);
    if (!storey) return;
    const y = storeyElevation(building, activeStoreyId) + storey.height / 2;
    const to = controls.target.clone().setY(y);
    if (Math.abs(to.y - controls.target.y) < 1e-6) return;
    tween.current = { from: controls.target.clone(), to, start: performance.now() };
  }, [controls, building, activeStoreyId, planView]);

  useFrame(() => {
    const t = tween.current;
    if (!t || !controls) return;
    const k = Math.min(1, (performance.now() - t.start) / STOREY_ANIMATION_MS);
    const eased = 1 - Math.pow(1 - k, 3);
    const previous = controls.target.clone();
    controls.target.lerpVectors(t.from, t.to, eased);
    camera.position.add(controls.target.clone().sub(previous));
    controls.update();
    if (k >= 1) tween.current = null;
  });

  return null;
}
