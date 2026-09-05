import { analysePlan, binarize, proposeFootprint } from "@/geometry/vision/plan";
import type { Placement, Proposal } from "@/geometry/vision/plan";

export interface VisionRequest {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  placement: Placement;
  minConfidence: number;
}

export type VisionResponse =
  | { type: "progress"; step: string }
  | { type: "result"; proposal: Proposal | null; skewDegrees: number }
  | { type: "error"; message: string };

const post = (m: VisionResponse) => {
  (self as unknown as Worker).postMessage(m);
};

self.onmessage = (e: MessageEvent<VisionRequest>) => {
  try {
    const { rgba, width, height, placement, minConfidence } = e.data;
    post({ type: "progress", step: "threshold" });
    const binary = binarize(rgba, width, height);
    post({ type: "progress", step: "lines" });
    const { lines, skewDegrees } = analysePlan(binary);
    post({ type: "progress", step: "footprint" });
    const proposal = proposeFootprint(lines, width, height, placement, minConfidence);
    post({ type: "result", proposal: proposal ? { ...proposal, skewDegrees } : null, skewDegrees });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
