import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { useEditorStore } from "@/store/building";
import { cutPlane } from "./clipping";

/**
 * Applies the section cut as a global clipping plane. Materials are drawn
 * double sided by the wall meshes, so the cut faces read as solid; a coloured
 * cap plane would need stencil work and is left out.
 */
export function SectionCut() {
  const get = useThree((s) => s.get);
  const cut = useEditorStore((s) => s.sectionCut);
  const plane = useMemo(() => cutPlane(cut.axis, cut.value), [cut.axis, cut.value]);
  useEffect(() => {
    const renderer = get().gl;
    renderer.localClippingEnabled = true;
    renderer.clippingPlanes = cut.enabled ? [plane] : [];
    return () => {
      renderer.clippingPlanes = [];
    };
  }, [get, plane, cut.enabled]);
  return null;
}
