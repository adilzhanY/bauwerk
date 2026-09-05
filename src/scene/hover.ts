import { useCallback, useEffect, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useEditorStore } from "@/store/building";
import type { Selection } from "@/store/building";

/**
 * Pointer hover handlers that write to the store at most once per animation
 * frame, so the viewport does not re-render on every mouse move.
 */
export function useHover(target: Selection | null, enabled = true) {
  const setHovered = useEditorStore((s) => s.setHovered);
  const pending = useRef<Selection | null | undefined>(undefined);
  const frame = useRef<number | null>(null);

  const flush = useCallback(() => {
    frame.current = null;
    if (pending.current !== undefined) setHovered(pending.current);
    pending.current = undefined;
  }, [setHovered]);

  const schedule = useCallback(
    (value: Selection | null) => {
      pending.current = value;
      frame.current ??= requestAnimationFrame(flush);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const onPointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!enabled) return;
      e.stopPropagation();
      schedule(target);
    },
    [enabled, schedule, target],
  );
  const onPointerOut = useCallback(() => {
    if (!enabled) return;
    schedule(null);
  }, [enabled, schedule]);

  return { onPointerOver, onPointerOut };
}
