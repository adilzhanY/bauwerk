import { beforeEach, describe, expect, it } from "vitest";
import { createEditorStore, createDefaultBuilding } from "./building";
import type { EditorStore } from "./building";
import { HISTORY_LIMIT } from "./history";
import { resetIds } from "@/lib/ids";
import type { Building } from "@/geometry/types";

type Store = ReturnType<typeof createEditorStore>;

let store: Store;

beforeEach(() => {
  resetIds();
  store = createEditorStore();
});

const storeyId = () => store.getState().building.storeys[0]?.id ?? "";

function withRoom(): string {
  // The default building already derives one room covering the whole footprint.
  return store.getState().building.storeys[0]?.rooms[0]?.id ?? "";
}

interface ActionCase {
  name: string;
  arrange?: () => void;
  act: (s: EditorStore) => void;
}

const cases: ActionCase[] = [
  {
    name: "setFootprintVertex",
    act: (s) => {
      s.setFootprintVertex(1, { x: 12, y: 0 });
    },
  },
  {
    name: "addStorey",
    act: (s) => {
      s.addStorey();
    },
  },
  {
    name: "removeStorey",
    act: (s) => {
      s.removeStorey(storeyId());
    },
  },
  {
    name: "setStoreyHeight",
    act: (s) => {
      s.setStoreyHeight(storeyId(), 2.7);
    },
  },
  {
    name: "renameStorey",
    act: (s) => {
      s.renameStorey(storeyId(), "Keller");
    },
  },
  {
    name: "setWallThickness",
    act: (s) => {
      s.setWallThickness(0.4);
    },
  },
  {
    name: "addOpening",
    act: (s) =>
      s.addOpening(storeyId(), {
        wallIndex: 0,
        kind: "window",
        offset: 1,
        width: 1.2,
        height: 1.4,
        sill: 0.9,
      }),
  },
  {
    name: "updateOpening",
    arrange: () => {
      store.getState().addOpening(storeyId(), {
        wallIndex: 0,
        kind: "window",
        offset: 1,
        width: 1.2,
        height: 1.4,
        sill: 0.9,
      });
    },
    act: (s) => {
      const id = s.building.storeys[0]?.openings[0]?.id ?? "";
      s.updateOpening(storeyId(), id, { width: 2, offset: 3 });
    },
  },
  {
    name: "removeOpening",
    arrange: () => {
      store.getState().addOpening(storeyId(), {
        wallIndex: 1,
        kind: "door",
        offset: 0.5,
        width: 1,
        height: 2.1,
        sill: 0,
      });
    },
    act: (s) => {
      const id = s.building.storeys[0]?.openings[0]?.id ?? "";
      s.removeOpening(storeyId(), id);
    },
  },
  {
    name: "addInteriorWall",
    act: (s) => {
      s.addInteriorWall(storeyId(), { a: { x: 5, y: 0 }, b: { x: 5, y: 8 } });
    },
  },
  {
    name: "removeInteriorWall",
    arrange: () => {
      store.getState().addInteriorWall(storeyId(), { a: { x: 5, y: 0 }, b: { x: 5, y: 8 } });
    },
    act: (s) => {
      s.removeInteriorWall(storeyId(), 0);
    },
  },
  {
    name: "renameRoom",
    arrange: () => {
      withRoom();
    },
    act: (s) => {
      s.renameRoom(storeyId(), withRoom(), "Bad");
    },
  },
  {
    name: "assignRoomToZone",
    arrange: () => {
      withRoom();
      store.getState().addZone("Heated", "#ff0000");
    },
    act: (s) => {
      s.assignRoomToZone(storeyId(), withRoom(), s.building.zones[0]?.id);
    },
  },
  { name: "addZone", act: (s) => s.addZone("Heated", "#ff0000") },
  {
    name: "updateZone",
    arrange: () => {
      store.getState().addZone("Heated", "#ff0000");
    },
    act: (s) => {
      s.updateZone(s.building.zones[0]?.id ?? "", { name: "Beheizt", color: "#00ff00" });
    },
  },
  {
    name: "removeZone",
    arrange: () => {
      withRoom();
      const zoneId = store.getState().addZone("Heated", "#ff0000");
      store.getState().assignRoomToZone(storeyId(), withRoom(), zoneId);
    },
    act: (s) => {
      s.removeZone(s.building.zones[0]?.id ?? "");
    },
  },
  {
    name: "loadBuilding",
    act: (s) => {
      const b: Building = { ...createDefaultBuilding(), name: "Imported", wallThickness: 0.5 };
      s.loadBuilding(b);
    },
  },
];

describe("undo and redo", () => {
  for (const c of cases) {
    it(`${c.name}: undo restores the previous building, redo restores the next`, () => {
      c.arrange?.();
      const before = structuredClone(store.getState().building);
      c.act(store.getState());
      const after = structuredClone(store.getState().building);
      expect(after).not.toEqual(before);

      store.getState().undo();
      expect(store.getState().building).toEqual(before);

      store.getState().redo();
      expect(store.getState().building).toEqual(after);

      store.getState().undo();
      store.getState().redo();
      expect(store.getState().building).toEqual(after);
    });
  }

  it("every action actually changes the building", () => {
    expect(cases.length).toBeGreaterThanOrEqual(17);
  });

  it("undo and redo on an empty history are no-ops", () => {
    const before = store.getState().building;
    store.getState().undo();
    store.getState().redo();
    expect(store.getState().building).toBe(before);
  });

  it("a new action after undo drops the redo stack", () => {
    store.getState().setWallThickness(0.4);
    store.getState().setWallThickness(0.5);
    store.getState().undo();
    expect(store.getState().future).toHaveLength(1);
    store.getState().setWallThickness(0.6);
    expect(store.getState().future).toHaveLength(0);
    expect(store.getState().building.wallThickness).toBe(0.6);
  });

  it("a no-op action does not create a history entry", () => {
    store.getState().renameStorey("missing", "Nothing");
    expect(store.getState().past).toHaveLength(0);
  });

  it(`caps the history at ${HISTORY_LIMIT} entries`, () => {
    for (let i = 0; i < HISTORY_LIMIT + 50; i++) {
      store.getState().setWallThickness(0.1 + i * 0.001);
    }
    expect(store.getState().past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT; i++) store.getState().undo();
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().building.wallThickness).toBeCloseTo(0.1 + 49 * 0.001);
  });
});

describe("UI state and history", () => {
  it("selection, tool and language are not recorded and not touched by undo", () => {
    store.getState().setWallThickness(0.4);
    store.getState().select({ kind: "storey", id: storeyId() });
    store.getState().setTool("opening");
    store.getState().setLanguage("de");
    expect(store.getState().past).toHaveLength(1);

    store.getState().undo();
    const s = store.getState();
    expect(s.building.wallThickness).toBe(0.3);
    expect(s.selection).toEqual({ kind: "storey", id: storeyId() });
    expect(s.tool).toBe("opening");
    expect(s.language).toBe("de");
  });

  it("clearSelection and setActiveStorey do not create history", () => {
    store.getState().addStorey();
    const second = store.getState().activeStoreyId ?? "";
    store.getState().setActiveStorey(storeyId());
    store.getState().setActiveStorey(second);
    store.getState().clearSelection();
    expect(store.getState().past).toHaveLength(1);
  });
});

describe("store behaviour", () => {
  it("derives rooms when interior walls change and keeps names", () => {
    const sid = storeyId();
    expect(store.getState().building.storeys[0]?.rooms).toHaveLength(1);
    store.getState().renameRoom(sid, withRoom(), "Kitchen");
    store.getState().addInteriorWall(sid, { a: { x: 4, y: 0 }, b: { x: 4, y: 8 } });
    const rooms = store.getState().building.storeys[0]?.rooms ?? [];
    expect(rooms).toHaveLength(2);
    expect(rooms.map((r) => r.name).sort()).toEqual(["Kitchen", "Room 1"]);
    expect(rooms.reduce((s, r) => s + r.area, 0)).toBeCloseTo(80, 6);
    store.getState().undo();
    expect(store.getState().building.storeys[0]?.rooms).toHaveLength(1);
  });

  it("starts with a 10 by 8 rectangle, one storey, no openings", () => {
    const b = store.getState().building;
    expect(b.footprint).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
      { x: 0, y: 8 },
    ]);
    expect(b.storeys).toHaveLength(1);
    expect(b.storeys[0]?.openings).toEqual([]);
    expect(b.storeys[0]?.name).toBe("Ground floor");
    expect(b.wallThickness).toBe(0.3);
    expect(store.getState().activeStoreyId).toBe(b.storeys[0]?.id);
  });

  it("names new storeys in the active language", () => {
    store.getState().setLanguage("de");
    store.getState().addStorey();
    store.getState().addStorey();
    const names = store.getState().building.storeys.map((s) => s.name);
    expect(names).toEqual(["Ground floor", "1. Obergeschoss", "2. Obergeschoss"]);
  });

  it("removing the active storey moves the active storey to a neighbour", () => {
    store.getState().addStorey();
    const second = store.getState().activeStoreyId ?? "";
    store.getState().removeStorey(second);
    expect(store.getState().activeStoreyId).toBe(storeyId());
    store.getState().removeStorey(storeyId());
    expect(store.getState().activeStoreyId).toBeNull();
    expect(store.getState().building.storeys).toHaveLength(0);
  });

  it("removing a zone unassigns its rooms", () => {
    withRoom();
    const zoneId = store.getState().addZone("Heated", "#ff0000");
    store.getState().assignRoomToZone(storeyId(), withRoom(), zoneId);
    expect(store.getState().building.storeys[0]?.rooms[0]?.zoneId).toBe(zoneId);
    store.getState().removeZone(zoneId);
    expect(store.getState().building.storeys[0]?.rooms[0]?.zoneId).toBeUndefined();
  });

  it("removing a selected element clears the selection", () => {
    const id = store.getState().addOpening(storeyId(), {
      wallIndex: 0,
      kind: "window",
      offset: 1,
      width: 1,
      height: 1,
      sill: 1,
    });
    store.getState().select({ kind: "opening", storeyId: storeyId(), id });
    store.getState().removeOpening(storeyId(), id);
    expect(store.getState().selection).toBeNull();
  });
});

describe("footprint editing and deleteSelection", () => {
  it("inserts a vertex at an edge midpoint and can remove it again", () => {
    store.getState().insertFootprintVertex(0);
    expect(store.getState().building.footprint).toHaveLength(5);
    expect(store.getState().building.footprint[1]).toEqual({ x: 5, y: 0 });
    expect(store.getState().selection).toEqual({ kind: "vertex", index: 1 });
    store.getState().deleteSelection();
    expect(store.getState().building.footprint).toHaveLength(4);
    store.getState().undo();
    expect(store.getState().building.footprint).toHaveLength(5);
  });

  it("refuses to remove a vertex from a triangle", () => {
    store.getState().loadBuilding({
      ...store.getState().building,
      footprint: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 0, y: 6 },
      ],
    });
    store.getState().removeFootprintVertex(0);
    expect(store.getState().building.footprint).toHaveLength(3);
  });

  it("removing a vertex shifts opening wall indices and drops the merged edges' openings", () => {
    const sid = storeyId();
    store.getState().insertFootprintVertex(0); // edges: 0 (0,0)-(5,0), 1 (5,0)-(10,0), 2, 3, 4
    store.getState().setFootprintVertex(1, { x: 5, y: -2 });
    const onEdge1 = store.getState().addOpening(sid, {
      wallIndex: 1,
      kind: "window",
      offset: 1,
      width: 1,
      height: 1,
      sill: 1,
    });
    const onEdge3 = store.getState().addOpening(sid, {
      wallIndex: 3,
      kind: "window",
      offset: 1,
      width: 1,
      height: 1,
      sill: 1,
    });
    store.getState().removeFootprintVertex(1);
    const openings = store.getState().building.storeys[0]?.openings ?? [];
    expect(openings.find((o) => o.id === onEdge1)).toBeUndefined();
    expect(openings.find((o) => o.id === onEdge3)?.wallIndex).toBe(2);
  });

  it("deleteSelection removes openings, walls, storeys and zones but not rooms", () => {
    const sid = storeyId();
    const id = store.getState().addOpening(sid, {
      wallIndex: 0,
      kind: "door",
      offset: 1,
      width: 1,
      height: 2,
      sill: 0,
    });
    store.getState().select({ kind: "opening", storeyId: sid, id });
    store.getState().deleteSelection();
    expect(store.getState().building.storeys[0]?.openings).toHaveLength(0);

    store.getState().addInteriorWall(sid, { a: { x: 4, y: 0 }, b: { x: 4, y: 8 } });
    store.getState().select({ kind: "interiorWall", storeyId: sid, index: 0 });
    store.getState().deleteSelection();
    expect(store.getState().building.storeys[0]?.interiorWalls).toHaveLength(0);

    const roomId = withRoom();
    store.getState().select({ kind: "room", storeyId: sid, id: roomId });
    store.getState().deleteSelection();
    expect(store.getState().building.storeys[0]?.rooms).toHaveLength(1);

    const zoneId = store.getState().addZone("Heated", "#f00");
    store.getState().setActiveZone(zoneId);
    store.getState().select({ kind: "zone", id: zoneId });
    store.getState().deleteSelection();
    expect(store.getState().building.zones).toHaveLength(0);
    expect(store.getState().activeZoneId).toBeNull();

    store.getState().select({ kind: "storey", id: sid });
    store.getState().deleteSelection();
    expect(store.getState().building.storeys).toHaveLength(0);
  });

  it("moveStorey reorders and is undoable", () => {
    store.getState().addStorey();
    const [first, second] = store.getState().building.storeys.map((s) => s.id);
    store.getState().moveStorey(first ?? "", 1);
    expect(store.getState().building.storeys.map((s) => s.id)).toEqual([second, first]);
    store.getState().moveStorey(first ?? "", 1);
    expect(store.getState().building.storeys.map((s) => s.id)).toEqual([second, first]);
    store.getState().undo();
    expect(store.getState().building.storeys.map((s) => s.id)).toEqual([first, second]);
  });
});

describe("energy actions", () => {
  it("assigns constructions, edits U-values and toggles zone heating, all undoable", () => {
    const sid = storeyId();
    store.getState().assignConstruction({ kind: "wall" }, "c_wall_insulated");
    expect(store.getState().building.wallConstructionId).toBe("c_wall_insulated");
    store.getState().assignConstruction({ kind: "wall" }, "missing");
    expect(store.getState().building.wallConstructionId).toBe("c_wall_insulated");

    const id = store.getState().addOpening(sid, {
      wallIndex: 0,
      kind: "window",
      offset: 1,
      width: 1,
      height: 1,
      sill: 1,
    });
    expect(store.getState().building.storeys[0]?.openings[0]?.constructionId).toBe(
      "c_glazing_double",
    );
    store.getState().assignConstruction({ kind: "opening", storeyId: sid, id }, "c_glazing_triple");
    expect(store.getState().building.storeys[0]?.openings[0]?.constructionId).toBe(
      "c_glazing_triple",
    );

    store.getState().updateConstruction("c_wall_insulated", { uValue: 0.2 });
    expect(
      store.getState().building.constructions.find((c) => c.id === "c_wall_insulated")?.uValue,
    ).toBe(0.2);

    const zoneId = store.getState().addZone("Cellar", "#000", false);
    expect(store.getState().building.zones[0]?.temperature).toBe(10);
    store.getState().setZoneHeated(zoneId, true);
    expect(store.getState().building.zones[0]?.temperature).toBe(20);

    const entries = store.getState().past.length;
    store.getState().undo();
    expect(store.getState().building.zones[0]?.heated).toBe(false);
    expect(store.getState().past.length).toBe(entries - 1);
  });
});

describe("geo placement", () => {
  it("sets and clears the origin, undoable", () => {
    store.getState().setOrigin({ lat: 52.5, lon: 13.4, rotation: 15 });
    expect(store.getState().building.origin).toEqual({ lat: 52.5, lon: 13.4, rotation: 15 });
    store.getState().setOrigin(undefined);
    expect(store.getState().building.origin).toBeUndefined();
    store.getState().undo();
    expect(store.getState().building.origin?.rotation).toBe(15);
  });

  it("setFootprint replaces the footprint, drops openings and recomputes rooms", () => {
    const sid = storeyId();
    store
      .getState()
      .addOpening(sid, { wallIndex: 0, kind: "window", offset: 1, width: 1, height: 1, sill: 1 });
    store.getState().setFootprint(
      [
        { x: 0, y: 0 },
        { x: 0, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 0 },
      ],
      { lat: 52.5, lon: 13.4, rotation: 0 },
    );
    const b = store.getState().building;
    expect(b.footprint[1]).toEqual({ x: 6, y: 0 }); // reoriented counter-clockwise
    expect(b.storeys[0]?.openings).toHaveLength(0);
    expect(b.storeys[0]?.rooms[0]?.area).toBe(36);
    expect(b.origin?.lat).toBe(52.5);
  });
});
