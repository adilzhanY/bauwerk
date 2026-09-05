import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export interface RenderSample {
  frameTimesMs: number[];
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

/** Collects frame times and renderer counters inside the Canvas and reports them twice a second. */
export function FrameProbe({
  onSample,
  windowMs = 10000,
}: {
  onSample: (s: RenderSample) => void;
  windowMs?: number;
}) {
  const get = useThree((s) => s.get);
  const frames = useRef<{ t: number; dt: number }[]>([]);
  const last = useRef(0);
  useFrame((_, dt) => {
    const now = performance.now();
    frames.current.push({ t: now, dt: dt * 1000 });
    while (frames.current.length > 0 && now - (frames.current[0]?.t ?? now) > windowMs)
      frames.current.shift();
    if (now - last.current > 500) {
      last.current = now;
      const info = get().gl.info;
      onSample({
        frameTimesMs: frames.current.map((f) => f.dt),
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      });
    }
  });
  useEffect(() => {
    const list = frames.current;
    return () => {
      list.length = 0;
    };
  }, []);
  return null;
}
