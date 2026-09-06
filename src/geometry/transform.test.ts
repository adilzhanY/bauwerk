import { describe, expect, it } from "vitest";
import { area, isCounterClockwise } from "./polygon";
import { exampleHouse } from "@/lib/examples";
import { buildingCentre, rotateBuilding, translateBuilding } from "./transform";

describe("translateBuilding and rotateBuilding", () => {
  it("moves every plan coordinate and nothing else", () => {
    const b = exampleHouse("en");
    b.heatPumps = [{ id: "hp", position: { x: -2, y: 1 }, power: 8, kind: "air" }];
    const moved = translateBuilding(b, { x: 3, y: -1.5 });
    expect(buildingCentre(moved)).toEqual({ x: 8, y: 2.5 });
    expect(area(moved.footprint)).toBeCloseTo(area(b.footprint));
    expect(moved.storeys[0]?.interiorWalls[0]?.a).toEqual({ x: 7, y: -1.5 });
    expect(moved.storeys[0]?.rooms.map((r) => r.id)).toEqual(b.storeys[0]?.rooms.map((r) => r.id));
    expect(moved.storeys[0]?.rooms[0]?.area).toBeCloseTo(b.storeys[0]?.rooms[0]?.area ?? 0);
    expect(moved.heatPumps?.[0]?.position).toEqual({ x: 1, y: -0.5 });
    // Openings and radiators are offsets, so they are the same objects' values.
    expect(moved.storeys[0]?.openings).toEqual(b.storeys[0]?.openings);
    expect(moved.origin).toBe(b.origin);
    expect(translateBuilding(b, { x: 0, y: 0 })).toBe(b);
  });

  it("rotates about the centre and keeps the footprint counter-clockwise", () => {
    const b = exampleHouse("en");
    const turned = rotateBuilding(b, 90);
    expect(buildingCentre(turned).x).toBeCloseTo(buildingCentre(b).x);
    expect(buildingCentre(turned).y).toBeCloseTo(buildingCentre(b).y);
    expect(isCounterClockwise(turned.footprint)).toBe(true);
    expect(area(turned.footprint)).toBeCloseTo(80);
    // A 10 by 8 box turned by 90 degrees spans 8 by 10.
    const xs = turned.footprint.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(8);
    const back = rotateBuilding(turned, -90);
    back.footprint.forEach((p, i) => {
      expect(p.x).toBeCloseTo(b.footprint[i]?.x ?? NaN, 5);
      expect(p.y).toBeCloseTo(b.footprint[i]?.y ?? NaN, 5);
    });
  });
});
