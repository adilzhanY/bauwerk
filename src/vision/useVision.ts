import { useCallback, useEffect, useRef, useState } from "react";
import type { Placement, Proposal } from "@/geometry/vision/plan";
import type { VisionRequest, VisionResponse } from "./worker";

export interface VisionState {
  status: "idle" | "loading" | "running" | "done" | "error";
  step: string;
  proposal: Proposal | null;
  error: string | null;
  imageSize: { width: number; height: number } | null;
}

/** Loads the underlay image into pixels and runs the plan pipeline in a worker. */
export function useVision() {
  const [state, setState] = useState<VisionState>({
    status: "idle",
    step: "",
    proposal: null,
    error: null,
    imageSize: null,
  });
  const worker = useRef<Worker | null>(null);

  useEffect(
    () => () => {
      worker.current?.terminate();
    },
    [],
  );

  const run = useCallback(async (url: string, placement: Placement, minConfidence: number) => {
    setState({ status: "loading", step: "image", proposal: null, error: null, imageSize: null });
    try {
      const img = await loadImage(url);
      const maxWidth = 1600;
      const scale = Math.min(1, maxWidth / img.width);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0, width, height);
      const rgba = ctx.getImageData(0, 0, width, height).data;
      worker.current?.terminate();
      const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      worker.current = w;
      setState((s) => ({ ...s, status: "running", imageSize: { width, height } }));
      w.onmessage = (e: MessageEvent<VisionResponse>) => {
        const m = e.data;
        if (m.type === "progress") setState((s) => ({ ...s, step: m.step }));
        else if (m.type === "result")
          setState((s) => ({ ...s, status: "done", proposal: m.proposal, step: "" }));
        else setState((s) => ({ ...s, status: "error", error: m.message }));
      };
      const request: VisionRequest = { rgba, width, height, placement, minConfidence };
      w.postMessage(request);
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle", step: "", proposal: null, error: null, imageSize: null });
  }, []);

  return { state, run, reset };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      reject(new Error("image failed to load"));
    };
    img.src = url;
  });
}
