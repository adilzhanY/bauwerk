import { describe, expect, it } from "vitest";
import { DEFAULT_ASSIGNMENT, PRESET_IDS, defaultConstructions } from "@/geometry/constructions";
import { rect } from "@/geometry/fixtures";
import type { Building, Storey } from "@/geometry/types";
import { BODY_RADIUS, constrainWalk } from "./walk";

const storey: Storey = {
  id: "s",
  name: "G",
  height: 3,
  openings: [
    {
      id: "d",
      wallIndex: 0,
      kind: "door",
      offset: 4.5,
      width: 1,
      height: 2.1,
      sill: 0,
      constructionId: PRESET_IDS.doorOld,
    },
  ],
  interiorWalls: [{ a: { x: 4, y: 0 }, b: { x: 4, y: 8 } }],
  rooms: [],
};
const building: Building = {
  id: "b",
  name: "b",
  footprint: rect,
  wallThickness: 0.3,
  storeys: [storey],
  zones: [],
  constructions: defaultConstructions("en"),
  ...DEFAULT_ASSIGNMENT,
};

describe("constrainWalk", () => {
  it("keeps the walker inside the inner wall face and slides along it", () => {
    const p = constrainWalk(building, storey, { x: 2, y: 2 }, { x: 2, y: -1 }, 0.3);
    expect(p.y).toBeGreaterThanOrEqual(0.3 - 1e-9);
    const slide = constrainWalk(building, storey, { x: 2, y: 2 }, { x: 2.5, y: -1 }, 0.3);
    expect(slide.x).toBeCloseTo(2.5);
    expect(slide.y).toBeCloseTo(2);
  });

  it("lets the walker through the door span but not through the wall next to it", () => {
    const through = constrainWalk(building, storey, { x: 5, y: 0.5 }, { x: 5, y: -0.5 }, 0.3);
    expect(through.y).toBeCloseTo(-0.5);
    const blocked = constrainWalk(building, storey, { x: 7, y: 0.5 }, { x: 7, y: -0.5 }, 0.3);
    expect(blocked.y).toBeGreaterThan(0);
  });

  it("keeps a body radius away from interior walls", () => {
    const p = constrainWalk(building, storey, { x: 3, y: 4 }, { x: 3.9, y: 4 }, 0.3);
    expect(Math.abs(p.x - 4)).toBeGreaterThanOrEqual(BODY_RADIUS - 1e-9);
  });
});
