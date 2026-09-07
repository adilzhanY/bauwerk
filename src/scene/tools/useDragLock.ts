import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/** Turns the orbit controls off while an element is being dragged. */
export function useDragLock() {
  const get = useThree((s) => s.get);
  const lockedControls = useRef<OrbitControlsImpl | null>(null);

  useEffect(
    () => () => {
      if (lockedControls.current) lockedControls.current.enabled = true;
      lockedControls.current = null;
    },
    [],
  );

  return useCallback(
    (locked: boolean) => {
      const controls = get().controls as OrbitControlsImpl | null;
      if (locked) {
        if (controls) {
          controls.enabled = false;
          lockedControls.current = controls;
        }
        return;
      }
      if (lockedControls.current) lockedControls.current.enabled = true;
      if (controls) controls.enabled = true;
      lockedControls.current = null;
    },
    [get],
  );
}
