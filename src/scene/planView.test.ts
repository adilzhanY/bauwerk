import { describe, expect, it } from "vitest";
import { rect } from "@/geometry/fixtures";
import { bounds } from "@/geometry/polygon";
import { planCamera, planPointFromScreen } from "./planView";

describe("plan camera", () => {
  it("centres over the footprint and fits it with a margin", () => {
    const cam = planCamera(bounds(rect), { width: 1400, height: 800 }, 3);
    expect(cam.position).toEqual([5, 53, 4]);
    expect(cam.target).toEqual([5, 3, 4]);
    // 14 m by 12 m with margin; height is the limiting side: 800 / 12
    expect(cam.zoom).toBeCloseTo(800 / 12);
  });

  it("maps the viewport centre to the footprint centre and scales by zoom", () => {
    const viewport = { width: 1400, height: 800 };
    const cam = planCamera(bounds(rect), viewport, 0);
    expect(planPointFromScreen(cam, viewport, 700, 400)).toEqual({ x: 5, y: 4 });
    const right = planPointFromScreen(cam, viewport, 700 + cam.zoom, 400);
    expect(right.x).toBeCloseTo(6);
    const down = planPointFromScreen(cam, viewport, 700, 400 + cam.zoom * 2);
    expect(down.y).toBeCloseTo(6);
  });
});
