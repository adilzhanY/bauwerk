import { describe, expect, it } from "vitest";
import { fromJson, toJson, validateBuilding } from "./export";
import { rect } from "./fixtures";
import { computeRooms } from "./rooms";
import type { Building } from "./types";

function sample(): Building {
  let n = 0;
  const factory = { createId: () => `room_${++n}`, defaultName: (i: number) => `Room ${i}` };
  const walls = [{ a: { x: 4, y: 0 }, b: { x: 4, y: 8 } }];
  return {
    id: "b1",
    name: "Haus",
    footprint: rect,
    wallThickness: 0.3,
    zones: [{ id: "z1", name: "Heated", color: "#ff0000" }],
    storeys: [
      {
        id: "s1",
        name: "Ground floor",
        height: 3,
        openings: [
          { id: "o1", wallIndex: 0, kind: "door", offset: 1, width: 1, height: 2.1, sill: 0 },
          { id: "o2", wallIndex: 0, kind: "window", offset: 3, width: 1.2, height: 1.4, sill: 0.9 },
        ],
        interiorWalls: walls,
        rooms: computeRooms(rect, walls, [], factory).map((r, i) =>
          i === 0 ? { ...r, zoneId: "z1" } : r,
        ),
      },
      { id: "s2", name: "1st floor", height: 2.8, openings: [], interiorWalls: [], rooms: [] },
    ],
  };
}

describe("toJson and fromJson", () => {
  it("round trips to a deep equal building", () => {
    const b = sample();
    const text = toJson(b);
    const result = fromJson(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.building).toEqual(b);
  });

  it("uses a dot as the decimal separator regardless of locale", () => {
    const text = toJson({ ...sample(), wallThickness: 0.25 });
    expect(text).toContain('"wallThickness": 0.25');
    expect(text).not.toContain("0,25");
  });

  it("rejects text that is not JSON or not a Bauwerk file", () => {
    expect(fromJson("{not json")).toEqual({ ok: false, error: { code: "invalidJson" } });
    expect(fromJson('{"hello":1}')).toEqual({ ok: false, error: { code: "notBauwerkFile" } });
    expect(fromJson('{"format":"bauwerk","version":99,"building":{}}')).toEqual({
      ok: false,
      error: { code: "unsupportedVersion" },
    });
  });

  it("reports the path of a structural problem", () => {
    const b = sample();
    const raw: unknown = JSON.parse(toJson(b));
    (
      raw as { building: { storeys: { openings: { width: unknown }[] }[] } }
    ).building.storeys[0]!.openings[1]!.width = "wide";
    const result = fromJson(JSON.stringify(raw));
    expect(result).toEqual({
      ok: false,
      error: { code: "invalidStructure", path: "building.storeys[0].openings[1].width" },
    });
  });

  it("rejects a JSON with an overlapping opening with the right message", () => {
    const b = sample();
    const storey = b.storeys[0];
    if (!storey) throw new Error("missing storey");
    storey.openings[1] = { ...storey.openings[1]!, offset: 1.5 };
    const result = fromJson(toJson(b));
    expect(result).toEqual({
      ok: false,
      error: { code: "openingsOverlap", path: "building.storeys[0].openings[0]" },
    });
  });
});

describe("validateBuilding", () => {
  it("accepts the sample", () => {
    expect(validateBuilding(sample())).toBeNull();
  });

  it("rejects a bowtie footprint and a clockwise footprint", () => {
    const bowtie = { ...sample(), footprint: [rect[0]!, rect[2]!, rect[1]!, rect[3]!] };
    expect(validateBuilding(bowtie)?.code).toBe("footprintInvalid");
    const cw = { ...sample(), footprint: [...rect].reverse() };
    expect(validateBuilding(cw)?.code).toBe("footprintNotCounterClockwise");
  });

  it("rejects each opening invariant", () => {
    const make = (patch: object) => {
      const b = sample();
      const s = b.storeys[0]!;
      s.openings = [{ ...s.openings[1]!, ...patch }];
      return validateBuilding(b)?.code;
    };
    expect(make({ offset: 9.5 })).toBe("openingOutsideWall");
    expect(make({ offset: -1 })).toBe("openingOutsideWall");
    expect(make({ sill: 2, height: 1.4 })).toBe("openingTooTall");
    expect(make({ kind: "door", sill: 0.3 })).toBe("doorNotOnFloor");
    expect(make({ wallIndex: 7 })).toBe("wallIndexOutOfRange");
    expect(make({ width: 0.01 })).toBe("openingTooSmall");
  });

  it("rejects duplicate ids, unknown zones, bad rooms and bad sizes", () => {
    const dup = sample();
    dup.zones.push({ id: "s1", name: "Clash", color: "#000" });
    expect(validateBuilding(dup)?.code).toBe("duplicateId");

    const zone = sample();
    zone.storeys[0]!.rooms[0]!.zoneId = "nope";
    expect(validateBuilding(zone)?.code).toBe("unknownZone");

    const outside = sample();
    outside.storeys[0]!.rooms[0]!.polygon = [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(validateBuilding(outside)?.code).toBe("roomOutsideFootprint");

    const mismatch = sample();
    mismatch.storeys[0]!.rooms.pop();
    expect(validateBuilding(mismatch)?.code).toBe("roomAreaMismatch");

    expect(validateBuilding({ ...sample(), wallThickness: 0 })?.code).toBe("wallThicknessInvalid");
    const h = sample();
    h.storeys[1]!.height = -1;
    expect(validateBuilding(h)?.code).toBe("storeyHeightInvalid");
  });
});
