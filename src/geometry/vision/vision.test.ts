import { describe, expect, it } from "vitest";
import { area, isCounterClockwise } from "../polygon";
import { adaptiveThreshold, close, estimateSkew, rotate, toGray } from "./image";
import type { Binary } from "./image";
import { detectLines, mergeCollinear } from "./lines";
import { analysePlan, pixelToPlan, proposeFootprint } from "./plan";

/** Draws a synthetic plan: white paper, black wall lines of `t` pixels. */
function drawPlan(
  width: number,
  height: number,
  t: number,
  extra: (set: (x: number, y: number) => void) => void,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  const set = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    rgba[i] = 20;
    rgba[i + 1] = 20;
    rgba[i + 2] = 20;
  };
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let d = 0; d < t; d++) set(x + (x0 === x1 ? d : 0), y + (y0 === y1 ? d : 0));
  };
  // Outer rectangle 300 x 200 px starting at (50, 50); interior walls at x = 170 and y = 150 (right half).
  line(50, 50, 350, 50);
  line(50, 250, 350, 250);
  line(50, 50, 50, 250);
  line(350, 50, 350, 250);
  line(170, 50, 170, 250);
  line(170, 150, 350, 150);
  extra(set);
  return rgba;
}

const W = 400;
const H = 300;
const placement = { x: 5, y: 4, widthMetres: 20 }; // 20 m over 400 px: 0.05 m per pixel

describe("image ops", () => {
  it("thresholds dark lines to ink and closing fills a one pixel gap", () => {
    const rgba = drawPlan(W, H, 4, (set) => {
      set(200, 10);
    });
    const bin = adaptiveThreshold(toGray(rgba, W, H));
    expect(bin.data[52 * W + 200]).toBe(1);
    expect(bin.data[100 * W + 100]).toBe(0);
    const gap: Binary = { width: 20, height: 5, data: new Uint8Array(100) };
    for (let x = 0; x < 20; x++) if (x !== 10) gap.data[2 * 20 + x] = 1;
    expect(close(gap).data[2 * 20 + 10]).toBe(1);
  });

  it("estimates and undoes a two degree skew", () => {
    const bin = adaptiveThreshold(
      toGray(
        drawPlan(W, H, 5, () => undefined),
        W,
        H,
      ),
    );
    const skewed = rotate(bin, 2);
    // The estimator returns the corrective rotation: minus two for an image skewed by plus two.
    const est = estimateSkew(skewed);
    expect(Math.abs(est + 2)).toBeLessThan(0.6);
    const fixed = rotate(skewed, est);
    const { lines } = analysePlan(fixed, { deskew: false });
    expect(lines.filter((l) => l.orientation === "h").length).toBeGreaterThanOrEqual(3);
  });
});

describe("line detection", () => {
  it("finds the six walls with their thickness and merges collinear pieces", () => {
    const bin = adaptiveThreshold(
      toGray(
        drawPlan(W, H, 5, () => undefined),
        W,
        H,
      ),
    );
    const lines = detectLines(bin, { minLength: 16, maxThickness: 12, mergeGap: 8 });
    expect(lines.length).toBeGreaterThanOrEqual(6);
    expect(lines.length).toBeLessThanOrEqual(8);
    const top = lines.find((l) => l.orientation === "h" && Math.abs(l.segment.a.y - 52) < 3)!;
    expect(top).toBeDefined();
    expect(Math.abs(top.segment.a.x - 50)).toBeLessThanOrEqual(1);
    expect(Math.abs(top.segment.b.x - 354)).toBeLessThanOrEqual(2);
    expect(top.thickness).toBeGreaterThanOrEqual(4);
    expect(top.confidence).toBeGreaterThan(0.95);
    const merged = mergeCollinear(
      [
        {
          segment: { a: { x: 0, y: 10 }, b: { x: 40, y: 10 } },
          thickness: 3,
          confidence: 1,
          orientation: "h",
        },
        {
          segment: { a: { x: 44, y: 10 }, b: { x: 90, y: 10 } },
          thickness: 3,
          confidence: 1,
          orientation: "h",
        },
      ],
      8,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.segment.b.x).toBe(90);
  });

  it("ignores speckle noise", () => {
    const bin = adaptiveThreshold(
      toGray(
        drawPlan(W, H, 5, (set) => {
          for (let i = 0; i < 300; i++) set((i * 37) % W, (i * 53) % H);
        }),
        W,
        H,
      ),
    );
    const { lines } = analysePlan(bin, { deskew: false });
    expect(lines.length).toBeLessThanOrEqual(8);
  });
});

describe("proposeFootprint", () => {
  it("recovers the rectangle and the two interior walls within one pixel, snapped to the grid", () => {
    const bin = adaptiveThreshold(
      toGray(
        drawPlan(W, H, 5, () => undefined),
        W,
        H,
      ),
    );
    const { lines } = analysePlan(bin, { deskew: false });
    const p = proposeFootprint(lines, W, H, placement)!;
    expect(p).not.toBeNull();
    expect(p.footprint).toHaveLength(4);
    expect(isCounterClockwise(p.footprint)).toBe(true);
    // 300 px x 200 px at 0.05 m/px = 15 m x 10 m
    expect(area(p.footprint)).toBeCloseTo(150, 5);
    expect(p.interiorWalls.length).toBeGreaterThanOrEqual(2);
    const vertical = p.interiorWalls.find((w) => Math.abs(w.segment.a.x - w.segment.b.x) < 1e-9)!;
    expect(vertical).toBeDefined();
    // x = 170 px + 2.5 px half thickness -> from image left edge 172.5 px x 0.05 = 8.625 m, image left at 5 - 10 = -5 -> 3.625, snapped 3.5
    expect(Math.abs(vertical.segment.a.x - 3.5)).toBeLessThanOrEqual(0.5);
    for (const c of p.footprintPixels) {
      expect(Math.abs(c.x - 52) <= 3 || Math.abs(c.x - 352) <= 3).toBe(true);
    }
  });

  it("maps pixels to plan metres with y flipped", () => {
    const tl = pixelToPlan({ x: 0, y: 0 }, W, H, placement);
    expect(tl.x).toBeCloseTo(-5);
    expect(tl.y).toBeCloseTo(4 + 7.5);
    const br = pixelToPlan({ x: W, y: H }, W, H, placement);
    expect(br.x).toBeCloseTo(15);
    expect(br.y).toBeCloseTo(4 - 7.5);
  });

  it("returns null when nothing closes", () => {
    const rgba = drawPlan(W, H, 5, () => undefined);
    const bin = adaptiveThreshold(toGray(rgba, W, H));
    const { lines } = analysePlan(bin, { deskew: false });
    expect(
      proposeFootprint(
        lines.filter((l) => l.orientation === "h"),
        W,
        H,
        placement,
      ),
    ).toBeNull();
  });
});
