import { useCallback } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/** Turns the orbit controls off while an element is being dragged. */
export function useDragLock() {
  const get = useThree((s) => s.get);
  return useCallback(
    (locked: boolean) => {
      const controls = get().controls as OrbitControlsImpl | null;
      if (controls) controls.enabled = !locked;
    },
    [get],
  );
}
