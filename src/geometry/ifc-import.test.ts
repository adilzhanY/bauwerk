import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exampleBlock, exampleHouse } from "@/lib/examples";
import { resetIds } from "@/lib/ids";
import { toIfc } from "./ifc";
import { importIfc } from "./ifc-import";
import { area } from "./polygon";
import { effectiveWallThickness } from "./layers";
import { asNumber, asRef, asRefs, asString, decodeControl, parseStep } from "./step-parse";
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

const appendData = (text: string, entities: string): string =>
  text.replace("ENDSEC;\nEND-ISO-10303-21;", `${entities}ENDSEC;\nEND-ISO-10303-21;`);

const scaledReal = (token: string, factor: number): string => {
  const value = Number(token) * factor;
  return Number.isInteger(value) ? `${value}.` : String(value);
};

function asMillimetres(text: string): string {
  return text
    .replace("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)", "IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)")
    .replace(
      /(IFCCARTESIANPOINT\(\()([^)]*)(\)\);)/g,
      (_line, start: string, values: string, end: string) =>
        `${start}${values
          .split(",")
          .map((value) => scaledReal(value, 1000))
          .join(",")}${end}`,
    )
    .replace(
      /(IFCEXTRUDEDAREASOLID\([^,\n]+,[^,\n]+,[^,\n]+,)([-+0-9.E]+)(\);)/g,
      (_line, start: string, value: string, end: string) =>
        `${start}${scaledReal(value, 1000)}${end}`,
    )
    .replace(
      /(IFCBUILDINGSTOREY\([^\n]+,\.ELEMENT\.,)([-+0-9.E]+)(\);)/g,
      (_line, start: string, value: string, end: string) =>
        `${start}${scaledReal(value, 1000)}${end}`,
    );
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

  it("round trips an opening in an interior wall", () => {
    resetIds();
    const original = exampleHouse("en");
    original.storeys[0]!.openings.push({
      id: "interior-door",
      wallIndex: 0,
      interior: true,
      kind: "door",
      offset: 1,
      width: 1,
      height: 2.1,
      sill: 0,
      constructionId: original.doorConstructionId,
    });
    const result = importIfc(toIfc(original), "en");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.building.storeys[0]?.openings).toContainEqual(
      expect.objectContaining({
        interior: true,
        wallIndex: 0,
        kind: "door",
        offset: 1,
        width: 1,
        height: 2.1,
      }),
    );
  });

  it("uses the storey placement when the optional Elevation attribute is absent", () => {
    resetIds();
    const text = toIfc(exampleHouse("en")).replace(
      /(IFCBUILDINGSTOREY\([^\n]+,\.ELEMENT\.),3\.\);/,
      "$1,$);",
    );
    const result = importIfc(text, "en");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.building.storeys.map((storey) => storey.height)).toEqual([3, 2.8]);
  });

  it("selects the Body representation when an Axis representation comes first", () => {
    resetIds();
    const original = exampleHouse("en");
    const text = toIfc(original);
    const file = parseStep(text);
    const wall = [...file.entities.values()].find((entity) => entity.type === "IFCWALL")!;
    const shapeId = asRef(wall.args[6])!;
    const shape = file.entities.get(shapeId)!;
    const bodyId = asRefs(shape.args[2])[0]!;
    const body = file.entities.get(bodyId)!;
    const contextId = asRef(body.args[0])!;
    const withAxis = appendData(
      text.replace(
        `#${shapeId}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${bodyId}));`,
        `#${shapeId}=IFCPRODUCTDEFINITIONSHAPE($,$,(#9003,#${bodyId}));`,
      ),
      `#9000=IFCCARTESIANPOINT((0.,0.));\n#9001=IFCCARTESIANPOINT((1.,0.));\n#9002=IFCPOLYLINE((#9000,#9001));\n#9003=IFCSHAPEREPRESENTATION(#${contextId},'Axis','Curve2D',(#9002));\n`,
    );
    const result = importIfc(withAxis, "en");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.building.footprint).toEqual(original.footprint);
  });

  it("converts millimetre project units to metres", () => {
    resetIds();
    const original = exampleHouse("en");
    const result = importIfc(asMillimetres(toIfc(original)), "en");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.building.footprint).toEqual(original.footprint);
    expect(result.building.wallThickness).toBeCloseTo(effectiveWallThickness(original), 3);
    expect(result.building.storeys.map((storey) => storey.height)).toEqual([3, 2.8]);
  });

  it("imports a vertical opening profile extruded horizontally through its wall", () => {
    resetIds();
    const text = toIfc(exampleHouse("en"));
    const file = parseStep(text);
    const voidRel = [...file.entities.values()].find(
      (entity) => entity.type === "IFCRELVOIDSELEMENT",
    )!;
    const opening = file.entities.get(asRef(voidRel.args[5])!)!;
    const shape = file.entities.get(asRef(opening.args[6])!)!;
    const representation = file.entities.get(asRefs(shape.args[2])[0]!)!;
    const solidId = asRefs(representation.args[3])[0]!;
    const horizontal = appendData(
      text.replace(
        new RegExp(`^#${solidId}=IFCEXTRUDEDAREASOLID\\([^\\n]+;$`, "m"),
        `#${solidId}=IFCEXTRUDEDAREASOLID(#9010,#9014,#9015,0.435);`,
      ),
      "#9004=IFCCARTESIANPOINT((0.,0.));\n#9005=IFCCARTESIANPOINT((1.,0.));\n#9006=IFCCARTESIANPOINT((1.,2.1));\n#9007=IFCCARTESIANPOINT((0.,2.1));\n#9008=IFCPOLYLINE((#9004,#9005,#9006,#9007,#9004));\n#9010=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#9008);\n#9011=IFCCARTESIANPOINT((4.5,0.425,0.));\n#9012=IFCDIRECTION((0.,-1.,0.));\n#9013=IFCDIRECTION((1.,0.,0.));\n#9014=IFCAXIS2PLACEMENT3D(#9011,#9012,#9013);\n#9015=IFCDIRECTION((0.,0.,1.));\n",
    );
    const result = importIfc(horizontal, "en");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.building.storeys[0]?.openings).toContainEqual(
      expect.objectContaining({ kind: "door", wallIndex: 0, offset: 4.5, width: 1, height: 2.1 }),
    );
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
