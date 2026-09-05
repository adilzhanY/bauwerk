import { describe, expect, it } from "vitest";
import { area, equals } from "./polygon";
import { lShape, rect } from "./fixtures";
import { buildWalls, wallThicknessAt } from "./walls";

describe("buildWalls", () => {
  it("produces one wall per vertex with the storey height", () => {
    const walls = buildWalls(rect, 0.3, 3);
    expect(walls).toHaveLength(4);
    expect(walls.every((w) => w.height === 3)).toBe(true);
    expect(walls.map((w) => w.length)).toEqual([10, 8, 10, 8]);
  });

  it("offsets the inner face inward by the thickness on a rectangle", () => {
    const walls = buildWalls(rect, 0.3, 3);
    expect(walls[0]?.innerA.x).toBeCloseTo(0.3);
    expect(walls[0]?.innerA.y).toBeCloseTo(0.3);
    expect(walls[0]?.innerB.x).toBeCloseTo(9.7);
    expect(walls[0]?.innerB.y).toBeCloseTo(0.3);
    expect(walls[2]?.innerA.x).toBeCloseTo(9.7);
    expect(walls[2]?.innerA.y).toBeCloseTo(7.7);
    for (const w of walls) {
      expect(wallThicknessAt(w, 0)).toBeCloseTo(0.3);
      expect(wallThicknessAt(w, 0.5)).toBeCloseTo(0.3);
      expect(wallThicknessAt(w, 1)).toBeCloseTo(0.3);
    }
  });

  it("mitres the corners so neighbouring walls share the inner corner", () => {
    for (const footprint of [rect, lShape]) {
      const walls = buildWalls(footprint, 0.3, 3);
      const n = walls.length;
      for (let i = 0; i < n; i++) {
        const a = walls[i];
        const b = walls[(i + 1) % n];
        if (!a || !b) throw new Error("missing wall");
        expect(equals(a.innerB, b.innerA)).toBe(true);
        expect(equals(a.outerB, b.outerA)).toBe(true);
      }
    }
  });

  it("honours the thickness on the concave L shape, including the inner corner", () => {
    const walls = buildWalls(lShape, 0.3, 3);
    expect(walls).toHaveLength(6);
    for (const w of walls) {
      expect(wallThicknessAt(w, 0.5)).toBeCloseTo(0.3);
    }
    // The re-entrant corner at (6,5) moves to (5.7, 4.7): the wall material sits
    // inside the polygon, so the inner corner is pulled into the lower left block.
    expect(walls[3]?.innerA.x).toBeCloseTo(5.7);
    expect(walls[3]?.innerA.y).toBeCloseTo(4.7);
  });

  it("the wall quads cover exactly the ring between outer and inner polygon", () => {
    const thickness = 0.3;
    const walls = buildWalls(rect, thickness, 3);
    const quadArea = walls.reduce((sum, w) => sum + area(w.quad), 0);
    const ring = 80 - (10 - 0.6) * (8 - 0.6);
    expect(quadArea).toBeCloseTo(ring);
  });
});
