import { computeRooms } from "@/geometry/rooms";
import type { Building, Segment, Storey, Vec2 } from "@/geometry/types";
import { DEFAULT_WALL_THICKNESS, HEATED_TEMPERATURE, UNHEATED_TEMPERATURE } from "@/geometry/types";
import { DEFAULT_ASSIGNMENT, PRESET_IDS, defaultConstructions } from "@/geometry/constructions";
import { defaultRoomName, defaultStoreyName } from "@/i18n";
import type { Language } from "@/i18n";
import { createId } from "./ids";

export type ExampleId = "house" | "block";

function storey(
  index: number,
  language: Language,
  footprint: Vec2[],
  height: number,
  openings: Omit<Storey["openings"][number], "id" | "constructionId">[],
  interiorWalls: Segment[],
  roomNames: Record<number, string> = {},
  roomZones: Record<number, string> = {},
): Storey {
  const rooms = computeRooms(footprint, interiorWalls, [], {
    createId: () => createId("room"),
    defaultName: (i) => defaultRoomName(i, language),
  });
  rooms.forEach((r, i) => {
    const name = roomNames[i];
    if (name !== undefined) r.name = name;
    const zone = roomZones[i];
    if (zone !== undefined) r.zoneId = zone;
  });
  return {
    id: createId("storey"),
    name: defaultStoreyName(index, language),
    height,
    openings: openings.map((o) => ({
      ...o,
      id: createId("opening"),
      constructionId: o.kind === "door" ? PRESET_IDS.doorOld : PRESET_IDS.glazingDouble,
    })),
    interiorWalls,
    rooms,
  };
}

/** A simple two-storey house, 10 by 8 m, with a door, windows and three rooms downstairs. */
export function exampleHouse(language: Language): Building {
  const footprint: Vec2[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 8 },
    { x: 0, y: 8 },
  ];
  const heated = createId("zone");
  const unheated = createId("zone");
  const de = language === "de";
  return {
    id: createId("building"),
    name: de ? "Einfamilienhaus" : "Family house",
    footprint,
    wallThickness: DEFAULT_WALL_THICKNESS,
    zones: [
      {
        id: heated,
        name: de ? "Beheizt" : "Heated",
        color: "#e76f51",
        heated: true,
        temperature: HEATED_TEMPERATURE,
      },
      {
        id: unheated,
        name: de ? "Unbeheizt" : "Unheated",
        color: "#6c8ef5",
        heated: false,
        temperature: UNHEATED_TEMPERATURE,
      },
    ],
    constructions: defaultConstructions(language),
    ...DEFAULT_ASSIGNMENT,
    storeys: [
      storey(
        0,
        language,
        footprint,
        3,
        [
          { wallIndex: 0, kind: "door", offset: 4.5, width: 1, height: 2.1, sill: 0 },
          { wallIndex: 0, kind: "window", offset: 1, width: 1.2, height: 1.4, sill: 0.9 },
          { wallIndex: 0, kind: "window", offset: 7.5, width: 1.2, height: 1.4, sill: 0.9 },
          { wallIndex: 2, kind: "window", offset: 2, width: 1.8, height: 1.4, sill: 0.9 },
          { wallIndex: 2, kind: "window", offset: 6, width: 1.8, height: 1.4, sill: 0.9 },
        ],
        [
          { a: { x: 4, y: 0 }, b: { x: 4, y: 8 } },
          { a: { x: 4, y: 4.5 }, b: { x: 10, y: 4.5 } },
        ],
        {
          0: de ? "Küche" : "Kitchen",
          1: de ? "Wohnzimmer" : "Living room",
          2: de ? "Flur" : "Hall",
        },
        { 0: heated, 1: heated, 2: unheated },
      ),
      storey(
        1,
        language,
        footprint,
        2.8,
        [
          { wallIndex: 0, kind: "window", offset: 1, width: 1.2, height: 1.4, sill: 0.9 },
          { wallIndex: 0, kind: "window", offset: 4.4, width: 1.2, height: 1.4, sill: 0.9 },
          { wallIndex: 0, kind: "window", offset: 7.5, width: 1.2, height: 1.4, sill: 0.9 },
          { wallIndex: 2, kind: "window", offset: 4, width: 1.8, height: 1.4, sill: 0.9 },
        ],
        [{ a: { x: 5, y: 0 }, b: { x: 5, y: 8 } }],
        { 0: de ? "Schlafzimmer" : "Bedroom", 1: de ? "Büro" : "Office" },
        { 0: heated, 1: heated },
      ),
    ],
  };
}

/** An L-shaped three-storey block. */
export function exampleBlock(language: Language): Building {
  const footprint: Vec2[] = [
    { x: 0, y: 0 },
    { x: 16, y: 0 },
    { x: 16, y: 6 },
    { x: 8, y: 6 },
    { x: 8, y: 12 },
    { x: 0, y: 12 },
  ];
  const heated = createId("zone");
  const de = language === "de";
  const windows = (wallIndex: number, count: number, length: number) =>
    Array.from({ length: count }, (_, i) => ({
      wallIndex,
      kind: "window" as const,
      offset: Math.round(((i + 0.5) * (length / count) - 0.75) * 10) / 10,
      width: 1.5,
      height: 1.5,
      sill: 0.9,
    }));
  const walls: Segment[] = [
    { a: { x: 4, y: 0 }, b: { x: 4, y: 12 } },
    { a: { x: 12, y: 0 }, b: { x: 12, y: 6 } },
    { a: { x: 0, y: 6 }, b: { x: 8, y: 6 } },
  ];
  const level = (i: number, withDoor: boolean) =>
    storey(
      i,
      language,
      footprint,
      3.2,
      [
        ...(withDoor
          ? [{ wallIndex: 0, kind: "door" as const, offset: 7.5, width: 1.2, height: 2.2, sill: 0 }]
          : []),
        ...windows(0, 4, 16).filter((w) => !withDoor || Math.abs(w.offset - 7.5) > 2),
        ...windows(1, 2, 6),
        ...windows(2, 3, 8),
        ...windows(4, 3, 8),
        ...windows(5, 4, 12),
      ],
      walls,
      {},
      { 0: heated, 1: heated, 2: heated, 3: heated, 4: heated },
    );
  return {
    id: createId("building"),
    name: de ? "Bürogebäude" : "Office block",
    footprint,
    wallThickness: 0.4,
    zones: [
      {
        id: heated,
        name: de ? "Beheizt" : "Heated",
        color: "#2a9d8f",
        heated: true,
        temperature: HEATED_TEMPERATURE,
      },
    ],
    constructions: defaultConstructions(language),
    ...DEFAULT_ASSIGNMENT,
    wallConstructionId: PRESET_IDS.wall1970,
    storeys: [level(0, true), level(1, false), level(2, false)],
  };
}

export function example(id: ExampleId, language: Language): Building {
  return id === "house" ? exampleHouse(language) : exampleBlock(language);
}
