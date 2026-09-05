import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Building, Id, Opening, Segment, Storey, Vec2, Zone } from "@/geometry/types";
import { DEFAULT_STOREY_HEIGHT, DEFAULT_WALL_THICKNESS } from "@/geometry/types";
import { computeRooms } from "@/geometry/rooms";
import { defaultRoomName, defaultStoreyName } from "@/i18n";
import type { Language } from "@/i18n";
import { createId } from "@/lib/ids";
import { history } from "./history";
import type { HistorySlice } from "./history";

export type Tool = "select" | "footprint" | "opening" | "interiorWall" | "zone";

export type Selection =
  | { kind: "vertex"; index: number }
  | { kind: "wall"; storeyId: Id; wallIndex: number }
  | { kind: "opening"; storeyId: Id; id: Id }
  | { kind: "interiorWall"; storeyId: Id; index: number }
  | { kind: "room"; storeyId: Id; id: Id }
  | { kind: "storey"; id: Id }
  | { kind: "zone"; id: Id };

export interface EditorState {
  building: Building;
  activeStoreyId: Id | null;
  selection: Selection | null;
  tool: Tool;
  language: Language;
}

export interface EditorActions {
  setFootprintVertex: (index: number, position: Vec2) => void;
  addStorey: () => void;
  removeStorey: (storeyId: Id) => void;
  setStoreyHeight: (storeyId: Id, height: number) => void;
  renameStorey: (storeyId: Id, name: string) => void;
  setWallThickness: (thickness: number) => void;
  addOpening: (storeyId: Id, opening: Omit<Opening, "id">) => Id;
  updateOpening: (storeyId: Id, openingId: Id, patch: Partial<Omit<Opening, "id">>) => void;
  removeOpening: (storeyId: Id, openingId: Id) => void;
  addInteriorWall: (storeyId: Id, segment: Segment) => void;
  removeInteriorWall: (storeyId: Id, index: number) => void;
  renameRoom: (storeyId: Id, roomId: Id, name: string) => void;
  assignRoomToZone: (storeyId: Id, roomId: Id, zoneId: Id | undefined) => void;
  addZone: (name: string, color: string) => Id;
  updateZone: (zoneId: Id, patch: Partial<Omit<Zone, "id">>) => void;
  removeZone: (zoneId: Id) => void;
  loadBuilding: (building: Building) => void;
  setActiveStorey: (storeyId: Id) => void;
  select: (selection: Selection) => void;
  clearSelection: () => void;
  setTool: (tool: Tool) => void;
  setLanguage: (language: Language) => void;
}

export type EditorStore = EditorState & EditorActions & HistorySlice;

export function createStorey(index: number, language: Language): Storey {
  return {
    id: createId("storey"),
    name: defaultStoreyName(index, language),
    height: DEFAULT_STOREY_HEIGHT,
    openings: [],
    interiorWalls: [],
    rooms: [],
  };
}

/** A 10 m by 8 m rectangle, one storey, no openings. Counter-clockwise on the XZ plane. */
export function createDefaultBuilding(language: Language = "en"): Building {
  const building: Building = {
    id: createId("building"),
    name: "Bauwerk",
    footprint: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
      { x: 0, y: 8 },
    ],
    wallThickness: DEFAULT_WALL_THICKNESS,
    storeys: [createStorey(0, language)],
    zones: [],
  };
  refreshAllRooms(building, language);
  return building;
}

function findStorey(building: Building, storeyId: Id): Storey | undefined {
  return building.storeys.find((s) => s.id === storeyId);
}

/** Rooms are derived. Recompute them whenever the footprint or the interior walls change. */
function refreshRooms(storey: Storey, footprint: readonly Vec2[], language: Language): void {
  storey.rooms = computeRooms(footprint, storey.interiorWalls, storey.rooms, {
    createId: () => createId("room"),
    defaultName: (i) => defaultRoomName(i, language),
  });
}

function refreshAllRooms(building: Building, language: Language): void {
  for (const storey of building.storeys) refreshRooms(storey, building.footprint, language);
}

export function createEditorStore(initial?: Partial<EditorState>) {
  return create<EditorStore>()(
    history(
      immer((set) => {
        const language = initial?.language ?? "en";
        const building = initial?.building ?? createDefaultBuilding(language);
        return {
          building,
          activeStoreyId: initial?.activeStoreyId ?? building.storeys[0]?.id ?? null,
          selection: initial?.selection ?? null,
          tool: initial?.tool ?? "select",
          language,

          setFootprintVertex: (index, position) => {
            set((state) => {
              if (index < 0 || index >= state.building.footprint.length) return;
              state.building.footprint[index] = { x: position.x, y: position.y };
              refreshAllRooms(state.building, state.language);
            });
          },

          addStorey: () => {
            set((state) => {
              const storey = createStorey(state.building.storeys.length, state.language);
              refreshRooms(storey, state.building.footprint, state.language);
              state.building.storeys.push(storey);
              state.activeStoreyId = storey.id;
            });
          },

          removeStorey: (storeyId) => {
            set((state) => {
              const index = state.building.storeys.findIndex((s) => s.id === storeyId);
              if (index === -1) return;
              state.building.storeys.splice(index, 1);
              if (state.activeStoreyId === storeyId) {
                const neighbour =
                  state.building.storeys[index] ?? state.building.storeys[index - 1];
                state.activeStoreyId = neighbour?.id ?? null;
              }
              if (state.selection && "storeyId" in state.selection) {
                if (state.selection.storeyId === storeyId) state.selection = null;
              } else if (state.selection?.kind === "storey" && state.selection.id === storeyId) {
                state.selection = null;
              }
            });
          },

          setStoreyHeight: (storeyId, height) => {
            set((state) => {
              const storey = findStorey(state.building, storeyId);
              if (storey) storey.height = height;
            });
          },

          renameStorey: (storeyId, name) => {
            set((state) => {
              const storey = findStorey(state.building, storeyId);
              if (storey) storey.name = name;
            });
          },

          setWallThickness: (thickness) => {
            set((state) => {
              state.building.wallThickness = thickness;
            });
          },

          addOpening: (storeyId, opening) => {
            const id = createId("opening");
            set((state) => {
              const storey = findStorey(state.building, storeyId);
              if (storey) storey.openings.push({ ...opening, id });
            });
            return id;
          },

          updateOpening: (storeyId, openingId, patch) => {
            set((state) => {
              const opening = findStorey(state.building, storeyId)?.openings.find(
                (o) => o.id === openingId,
              );
              if (opening) Object.assign(opening, patch);
            });
          },

          removeOpening: (storeyId, openingId) => {
            set((state) => {
              const storey = findStorey(state.building, storeyId);
              if (!storey) return;
              storey.openings = storey.openings.filter((o) => o.id !== openingId);
              if (state.selection?.kind === "opening" && state.selection.id === openingId) {
                state.selection = null;
              }
            });
          },

          addInteriorWall: (storeyId, segment) => {
            set((state) => {
              const storey = findStorey(state.building, storeyId);
              if (!storey) return;
              storey.interiorWalls.push({ a: { ...segment.a }, b: { ...segment.b } });
              refreshRooms(storey, state.building.footprint, state.language);
            });
          },

          removeInteriorWall: (storeyId, index) => {
            set((state) => {
              const storey = findStorey(state.building, storeyId);
              if (!storey || index < 0 || index >= storey.interiorWalls.length) return;
              storey.interiorWalls.splice(index, 1);
              refreshRooms(storey, state.building.footprint, state.language);
              if (state.selection?.kind === "interiorWall" && state.selection.index === index) {
                state.selection = null;
              }
            });
          },

          renameRoom: (storeyId, roomId, name) => {
            set((state) => {
              const room = findStorey(state.building, storeyId)?.rooms.find((r) => r.id === roomId);
              if (room) room.name = name;
            });
          },

          assignRoomToZone: (storeyId, roomId, zoneId) => {
            set((state) => {
              const room = findStorey(state.building, storeyId)?.rooms.find((r) => r.id === roomId);
              if (!room) return;
              if (zoneId === undefined) delete room.zoneId;
              else room.zoneId = zoneId;
            });
          },

          addZone: (name, color) => {
            const id = createId("zone");
            set((state) => {
              state.building.zones.push({ id, name, color });
            });
            return id;
          },

          updateZone: (zoneId, patch) => {
            set((state) => {
              const zone = state.building.zones.find((z) => z.id === zoneId);
              if (zone) Object.assign(zone, patch);
            });
          },

          removeZone: (zoneId) => {
            set((state) => {
              state.building.zones = state.building.zones.filter((z) => z.id !== zoneId);
              for (const storey of state.building.storeys) {
                for (const room of storey.rooms) {
                  if (room.zoneId === zoneId) delete room.zoneId;
                }
              }
              if (state.selection?.kind === "zone" && state.selection.id === zoneId) {
                state.selection = null;
              }
            });
          },

          loadBuilding: (next) => {
            set((state) => {
              state.building = next;
              state.activeStoreyId = next.storeys[0]?.id ?? null;
              state.selection = null;
            });
          },

          setActiveStorey: (storeyId) => {
            set((state) => {
              if (findStorey(state.building, storeyId)) state.activeStoreyId = storeyId;
            });
          },

          select: (selection) => {
            set((state) => {
              state.selection = selection;
            });
          },

          clearSelection: () => {
            set((state) => {
              state.selection = null;
            });
          },

          setTool: (tool) => {
            set((state) => {
              state.tool = tool;
            });
          },

          setLanguage: (language) => {
            set((state) => {
              state.language = language;
            });
          },
        };
      }),
    ),
  );
}

export const useEditorStore = createEditorStore();
