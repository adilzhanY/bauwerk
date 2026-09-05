import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exampleBlock, exampleHouse } from "@/lib/examples";
import { resetIds } from "@/lib/ids";
import { toIfc } from "./ifc";
import { importIfc } from "./ifc-import";
import { area } from "./polygon";
import { effectiveWallThickness } from "./layers";
import { asNumber, asString, decodeControl, parseStep } from "./step-parse";
import type { Building } from "./types";

describe("STEP parser", () => {
  it("parses entities with nested lists, typed values, enums, refs and escaped strings", () => {
    const f = parseStep(`ISO-10303-21;HEADER;FILE_SCHEMA(('IFC4'));ENDSEC;DATA;
#1=IFCCARTESIANPOINT((1.,2.5,-3.E-1));
#2=IFCPROPERTYSINGLEVALUE('Name''s',$,IFCLABEL('K\\X2\\00FC\\X0\\che'),*);
#3=IFCWALL('g',#1,$,$,$,$,$,$,.SOLIDWALL.);
ENDSEC;END-ISO-10303-21;`);
    expect(f.schema).toBe("IFC4");
    expect(f.entities.size).toBe(3);
    const p = f.entities.get(1)!;
    expect(p.type).toBe("IFCCARTESIANPOINT");
    expect(p.args[0]?.kind).toBe("list");
    expect(p.args[0]?.kind === "list" ? p.args[0].items.map(asNumber) : []).toEqual([1, 2.5, -0.3]);
    const prop = f.entities.get(2)!;
    expect(asString(prop.args[0])).toBe("Name's");
    expect(asString(prop.args[2])).toBe("Küche");
    expect(prop.args[3]?.kind).toBe("derived");
    expect(f.entities.get(3)!.args[8]).toEqual({ kind: "enum", value: "SOLIDWALL" });
  });

  it("decodes control directives and reports malformed input", () => {
    expect(decodeControl("a\\X\\41b")).toBe("aAb");
    expect(decodeControl("\\X4\\0001F600\\X0\\")).toBe("😀");
    expect(() => parseStep("ISO-10303-21;DATA;#1=IFCWALL(;ENDSEC;")).toThrow();
    expect(() => parseStep("nothing here")).toThrow(/DATA/);
  });

  it("reads the files the exporter writes", () => {
    resetIds();
    const text = toIfc(exampleHouse("de"));
    const f = parseStep(text);
    expect([...f.entities.values()].filter((e) => e.type === "IFCWALL").length).toBeGreaterThan(8);
  });
});

function stripIds(b: Building) {
  return {
    name: b.name,
    footprint: b.footprint,
    wallThickness: b.wallThickness,
    origin: b.origin,
    storeys: b.storeys.map((s) => ({
      name: s.name,
      height: s.height,
      openings: s.openings
        .map(({ id: _id, constructionId: _c, ...o }) => o)
        .sort((a, c) => a.wallIndex - c.wallIndex || a.offset - c.offset),
      interiorWalls: s.interiorWalls,
      rooms: s.rooms
        .map((r) => ({
          name: r.name,
          area: Math.round(r.area * 100) / 100,
          zone: b.zones.find((z) => z.id === r.zoneId)?.name,
        }))
        .sort((a, c) => a.name.localeCompare(c.name)),
    })),
    zones: b.zones.map((z) => z.name).sort(),
  };
}

describe("importIfc round trip", () => {
  it("export then import of the example house gives an equal building up to ids", () => {
    resetIds();
    const original = exampleHouse("de");
    original.origin = { lat: 52.516275, lon: 13.377704, rotation: 30 };
    const result = importIfc(toIfc(original), "de");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.filter((r) => r.code !== "spaceUnmatched")).toEqual([]);
    const a = stripIds(original);
    const b = stripIds(result.building);
    expect(b.footprint).toEqual(a.footprint);
    // The exporter draws walls at the layer stack thickness, so that is what comes back.
    expect(b.wallThickness).toBeCloseTo(effectiveWallThickness(original), 3);
    expect(b.storeys.map((s) => [s.name, s.height])).toEqual(
      a.storeys.map((s) => [s.name, s.height]),
    );
    expect(b.storeys.map((s) => s.openings)).toEqual(a.storeys.map((s) => s.openings));
    expect(b.storeys.map((s) => s.interiorWalls)).toEqual(a.storeys.map((s) => s.interiorWalls));
    expect(b.storeys.map((s) => s.rooms)).toEqual(a.storeys.map((s) => s.rooms));
    expect(b.zones).toEqual(a.zones);
    expect(b.origin?.lat).toBeCloseTo(52.516275, 5);
    expect(b.origin?.lon).toBeCloseTo(13.377704, 5);
    expect(b.origin?.rotation).toBeCloseTo(30, 0);
    expect(
      result.building.constructions.find((c) => c.id === result.building.wallConstructionId)
        ?.uValue,
    ).toBeCloseTo(
      original.constructions.find((c) => c.id === original.wallConstructionId)!.uValue,
      2,
    );
  });

  it("the L-shaped block round trips its footprint, storeys and openings", () => {
    resetIds();
    const original = exampleBlock("en");
    const result = importIfc(toIfc(original), "en");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.building.footprint).toEqual(original.footprint);
    expect(result.building.storeys).toHaveLength(3);
    expect(result.stats.openings).toBe(
      original.storeys.reduce((s, st) => s + st.openings.length, 0),
    );
    expect(area(result.building.footprint)).toBeCloseTo(area(original.footprint));
  });
});

describe("importIfc on a foreign file", () => {
  const text = readFileSync("docs/foreign-sample.ifc", "utf8");

  it("reads rectangle profiles with placements, reports the curved wall, keeps the rest", () => {
    const result = importIfc(text, "en");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.building.name).toBe("Foreign house");
    expect(result.building.storeys.map((s) => s.name)).toEqual(["EG", "OG"]);
    expect(result.building.storeys[0]?.height).toBeCloseTo(2.8);
    expect(area(result.building.footprint)).toBeCloseTo(8.6 * 6.6, 1); // outer faces: 8 + 2 x 0.3 by 6 + 2 x 0.3
    expect(result.building.wallThickness).toBeCloseTo(0.3, 2);
    const eg = result.building.storeys[0]!;
    expect(eg.interiorWalls).toHaveLength(1);
    expect(eg.rooms).toHaveLength(2);
    expect(eg.openings).toHaveLength(1);
    expect(eg.openings[0]).toMatchObject({ kind: "window", width: 1.2, height: 1.4, sill: 0.9 });
    expect(result.report.some((r) => r.code === "curvedWall" && r.entity.includes("#118"))).toBe(
      true,
    );
    expect(
      result.building.constructions.find((c) => c.id === result.building.wallConstructionId)
        ?.uValue,
    ).toBe(0.9);
  });

  it("fails clearly without storeys or a closed ring", () => {
    const noStoreys = importIfc(
      "ISO-10303-21;DATA;#1=IFCPROJECT('a',$,'x',$,$,$,$,$,$);ENDSEC;",
      "en",
    );
    expect(noStoreys.ok).toBe(false);
    if (!noStoreys.ok) expect(noStoreys.error).toBe("noStoreys");
    const parse = importIfc("garbage", "en");
    expect(parse.ok).toBe(false);
    if (!parse.ok) expect(parse.error).toBe("parse");
  });
});
