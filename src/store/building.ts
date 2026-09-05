import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Building,
  GeoOrigin,
  Construction,
  Id,
  Opening,
  Segment,
  Storey,
  Vec2,
  Zone,
} from "@/geometry/types";
import {
  DEFAULT_STOREY_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  GRID_SIZE,
  HEATED_TEMPERATURE,
  UNHEATED_TEMPERATURE,
} from "@/geometry/types";
import { DEFAULT_ASSIGNMENT, defaultConstructions } from "@/geometry/constructions";
import {
  ensureCounterClockwise,
  isCounterClockwise,
  isSimplePolygon,
  snapPoint,
} from "@/geometry/polygon";
import { computeRooms } from "@/geometry/rooms";
import { defaultRoomName, defaultStoreyName, detectLanguage } from "@/i18n";
import { loadBuilding, loadLanguage, loadTheme } from "@/lib/storage";
import type { Language } from "@/i18n";
import { createId } from "@/lib/ids";
import { history } from "./history";
import type { HistorySlice } from "./history";

export type Theme = "light" | "dark" | "system";

export type Tool = "select" | "footprint" | "opening" | "interiorWall" | "zone" | "measure";

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
  /** Throttled hover target from the viewport. UI state, never in history. */
  hovered: Selection | null;
  tool: Tool;
  language: Language;
  showGrid: boolean;
  /** Zone the zone tool paints with. UI state. */
  activeZoneId: Id | null;
  /** Energy panel shows the renovated scenario. UI state. */
  renovatedView: boolean;
  /** Other people editing the same project, from the sync layer. UI state. */
  presence: Presence[];
  /** Project id on the server when sync is active. UI state. */
  projectId: string | null;
  /** Orthographic top-down view of the active storey. UI state. */
  planView: boolean;
  /** Colour band on wall tops keyed to the construction U-value. UI state. */
  showUValueBands: boolean;
  /** Floor plan image on the ground. Local to this browser, never exported. UI state. */
  underlay: Underlay | null;
  /** Result of the measure tool. UI state. */
  measurement: { a: Vec2; b: Vec2 } | null;
  theme: Theme;
}

export interface Underlay {
  url: string;
  /** Image width in metres on the ground. */
  widthMetres: number;
  /** Image aspect ratio height / width. */
  aspect: number;
  /** Plan position of the image centre. */
  x: number;
  y: number;
  opacity: number;
}

export interface Presence {
  actor: string;
  color: string;
  selection: Selection | null;
}

export interface EditorActions {
  setFootprintVertex: (index: number, position: Vec2) => void;
  /** Inserts a vertex at the midpoint of edge `edgeIndex`. */
  insertFootprintVertex: (edgeIndex: number) => void;
  /** Removes a vertex if the footprint stays a valid polygon. */
  removeFootprintVertex: (index: number) => void;
  moveStorey: (storeyId: Id, direction: -1 | 1) => void;
  /** Removes whatever is selected, if it is removable. */
  deleteSelection: () => void;
  addStorey: () => void;
  removeStorey: (storeyId: Id) => void;
  setStoreyHeight: (storeyId: Id, height: number) => void;
  renameStorey: (storeyId: Id, name: string) => void;
  setWallThickness: (thickness: number) => void;
  renameBuilding: (name: string) => void;
  setOrigin: (origin: GeoOrigin | undefined) => void;
  /** Replaces the footprint, for a GeoJSON import. Rooms are recomputed. */
  setFootprint: (footprint: Vec2[], origin?: GeoOrigin) => void;
  addOpening: (storeyId: Id, opening: NewOpening) => Id;
  updateOpening: (storeyId: Id, openingId: Id, patch: Partial<Omit<Opening, "id">>) => void;
  removeOpening: (storeyId: Id, openingId: Id) => void;
  addInteriorWall: (storeyId: Id, segment: Segment) => void;
  removeInteriorWall: (storeyId: Id, index: number) => void;
  renameRoom: (storeyId: Id, roomId: Id, name: string) => void;
  assignRoomToZone: (storeyId: Id, roomId: Id, zoneId: Id | undefined) => void;
  addZone: (name: string, color: string, heated?: boolean) => Id;
  setZoneHeated: (zoneId: Id, heated: boolean) => void;
  updateConstruction: (constructionId: Id, patch: Partial<Omit<Construction, "id">>) => void;
  assignConstruction: (target: ConstructionTarget, constructionId: Id) => void;
  updateZone: (zoneId: Id, patch: Partial<Omit<Zone, "id">>) => void;
  removeZone: (zoneId: Id) => void;
  loadBuilding: (building: Building) => void;
  setActiveStorey: (storeyId: Id) => void;
  select: (selection: Selection) => void;
  clearSelection: () => void;
  setHovered: (hovered: Selection | null) => void;
  setActiveZone: (zoneId: Id | null) => void;
  setRenovatedView: (on: boolean) => void;
  setPresence: (presence: Presence[]) => void;
  setProjectId: (projectId: string | null) => void;
  duplicateStorey: (storeyId: Id) => void;
  setPlanView: (on: boolean) => void;
  setShowUValueBands: (on: boolean) => void;
  setUnderlay: (underlay: Underlay | null) => void;
  setMeasurement: (measurement: { a: Vec2; b: Vec2 } | null) => void;
  setTheme: (theme: Theme) => void;
  /** Replaces the building with server state. Not recorded in history and clears the redo stack. */
  applyRemoteBuilding: (building: Building) => void;
  setShowGrid: (show: boolean) => void;
  setTool: (tool: Tool) => void;
  setLanguage: (language: Language) => void;
}

/** The construction defaults to the building's window or door construction. */
export type NewOpening = Omit<Opening, "id" | "constructionId"> & { constructionId?: Id };

export type ConstructionTarget =
  | { kind: "wall" | "floor" | "roof" | "window" | "door" }
  | { kind: "opening"; storeyId: Id; id: Id };

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
    constructions: defaultConstructions(language),
    ...DEFAULT_ASSIGNMENT,
  };
  refreshAllRooms(building, language);
  return building;
}

export function sameSelection(a: Selection | null, b: Selection | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
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
      immer((set, get) => {
        const language = initial?.language ?? "en";
        const building = initial?.building ?? createDefaultBuilding(language);
        return {
          building,
          activeStoreyId: initial?.activeStoreyId ?? building.storeys[0]?.id ?? null,
          selection: initial?.selection ?? null,
          hovered: null,
          tool: initial?.tool ?? "select",
          language,
          showGrid: initial?.showGrid ?? true,
          activeZoneId: initial?.activeZoneId ?? null,
          renovatedView: false,
          presence: [],
          projectId: null,
          planView: false,
          showUValueBands: false,
          underlay: null,
          measurement: null,
          theme: initial?.theme ?? "system",

          setFootprintVertex: (index, position) => {
            set((state) => {
              if (index < 0 || index >= state.building.footprint.length) return;
              state.building.footprint[index] = { x: position.x, y: position.y };
              refreshAllRooms(state.building, state.language);
            });
          },

          insertFootprintVertex: (edgeIndex) => {
            set((state) => {
              const fp = state.building.footprint;
              const a = fp[edgeIndex];
              const b = fp[(edgeIndex + 1) % fp.length];
              if (!a || !b) return;
              const mid = snapPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, GRID_SIZE);
              const next = [...fp.slice(0, edgeIndex + 1), mid, ...fp.slice(edgeIndex + 1)];
              if (!isSimplePolygon(next)) return;
              state.building.footprint = next;
              state.selection = { kind: "vertex", index: edgeIndex + 1 };
              refreshAllRooms(state.building, state.language);
            });
          },

          removeFootprintVertex: (index) => {
            set((state) => {
              const fp = state.building.footprint;
              if (fp.length <= 3 || index < 0 || index >= fp.length) return;
              const next = fp.filter((_, i) => i !== index);
              if (!isSimplePolygon(next) || !isCounterClockwise(next)) return;
              state.building.footprint = next;
              // Openings index footprint edges, so edges after the removed vertex shift down
              // and the two edges that merged lose their openings.
              for (const storey of state.building.storeys) {
                storey.openings = storey.openings
                  .filter(
                    (o) =>
                      o.wallIndex !== index && o.wallIndex !== (index - 1 + fp.length) % fp.length,
                  )
                  .map((o) => (o.wallIndex > index ? { ...o, wallIndex: o.wallIndex - 1 } : o));
              }
              if (state.selection?.kind === "vertex") state.selection = null;
              refreshAllRooms(state.building, state.language);
            });
          },

          moveStorey: (storeyId, direction) => {
            set((state) => {
              const list = state.building.storeys;
              const from = list.findIndex((s) => s.id === storeyId);
              const to = from + direction;
              if (from === -1 || to < 0 || to >= list.length) return;
              const [item] = list.splice(from, 1);
              if (item) list.splice(to, 0, item);
            });
          },

          deleteSelection: () => {
            const { selection } = get();
            if (!selection) return;
            const actions = get();
            switch (selection.kind) {
              case "opening":
                actions.removeOpening(selection.storeyId, selection.id);
                break;
              case "interiorWall":
                actions.removeInteriorWall(selection.storeyId, selection.index);
                break;
              case "storey":
                actions.removeStorey(selection.id);
                break;
              case "zone":
                actions.removeZone(selection.id);
                break;
              case "vertex":
                actions.removeFootprintVertex(selection.index);
                break;
              case "wall":
              case "room":
                break;
            }
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

          setOrigin: (origin) => {
            set((state) => {
              if (origin === undefined) delete state.building.origin;
              else state.building.origin = { ...origin };
            });
          },

          setFootprint: (footprint, origin) => {
            set((state) => {
              if (!isSimplePolygon(footprint)) return;
              state.building.footprint = ensureCounterClockwise(footprint);
              if (origin) state.building.origin = { ...origin };
              for (const storey of state.building.storeys) storey.openings = [];
              state.selection = null;
              refreshAllRooms(state.building, state.language);
            });
          },

          renameBuilding: (name) => {
            set((state) => {
              state.building.name = name;
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
              if (!storey) return;
              const constructionId =
                opening.constructionId ??
                (opening.kind === "door"
                  ? state.building.doorConstructionId
                  : state.building.windowConstructionId);
              storey.openings.push({ ...opening, constructionId, id });
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

          addZone: (name, color, heated = true) => {
            const id = createId("zone");
            set((state) => {
              state.building.zones.push({
                id,
                name,
                color,
                heated,
                temperature: heated ? HEATED_TEMPERATURE : UNHEATED_TEMPERATURE,
              });
            });
            return id;
          },

          setZoneHeated: (zoneId, heated) => {
            set((state) => {
              const zone = state.building.zones.find((z) => z.id === zoneId);
              if (!zone || zone.heated === heated) return;
              zone.heated = heated;
              zone.temperature = heated ? HEATED_TEMPERATURE : UNHEATED_TEMPERATURE;
            });
          },

          updateConstruction: (constructionId, patch) => {
            set((state) => {
              const c = state.building.constructions.find((x) => x.id === constructionId);
              if (c) Object.assign(c, patch);
            });
          },

          assignConstruction: (target, constructionId) => {
            set((state) => {
              const b = state.building;
              if (!b.constructions.some((c) => c.id === constructionId)) return;
              switch (target.kind) {
                case "wall":
                  b.wallConstructionId = constructionId;
                  break;
                case "floor":
                  b.floorConstructionId = constructionId;
                  break;
                case "roof":
                  b.roofConstructionId = constructionId;
                  break;
                case "window":
                  b.windowConstructionId = constructionId;
                  break;
                case "door":
                  b.doorConstructionId = constructionId;
                  break;
                case "opening": {
                  const o = findStorey(b, target.storeyId)?.openings.find(
                    (x) => x.id === target.id,
                  );
                  if (o) o.constructionId = constructionId;
                  break;
                }
              }
            });
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
              if (state.activeZoneId === zoneId) state.activeZoneId = null;
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

          setHovered: (hovered) => {
            set((state) => {
              if (sameSelection(state.hovered, hovered)) return;
              state.hovered = hovered;
            });
          },

          duplicateStorey: (storeyId) => {
            set((state) => {
              const index = state.building.storeys.findIndex((s) => s.id === storeyId);
              const source = state.building.storeys[index];
              if (!source) return;
              const copy: Storey = {
                id: createId("storey"),
                name: defaultStoreyName(index + 1, state.language),
                height: source.height,
                openings: source.openings.map((o) => ({ ...o, id: createId("opening") })),
                interiorWalls: source.interiorWalls.map((w) => ({ a: { ...w.a }, b: { ...w.b } })),
                rooms: source.rooms.map((r) => ({
                  ...r,
                  id: createId("room"),
                  polygon: r.polygon.map((p) => ({ ...p })),
                })),
              };
              state.building.storeys.splice(index + 1, 0, copy);
              state.activeStoreyId = copy.id;
            });
          },

          setPlanView: (on) => {
            set((state) => {
              state.planView = on;
            });
          },

          setShowUValueBands: (on) => {
            set((state) => {
              state.showUValueBands = on;
            });
          },

          setUnderlay: (underlay) => {
            set((state) => {
              state.underlay = underlay;
            });
          },

          setTheme: (theme) => {
            set((state) => {
              state.theme = theme;
            });
          },

          setMeasurement: (measurement) => {
            set((state) => {
              state.measurement = measurement;
            });
          },

          setPresence: (presence) => {
            set((state) => {
              state.presence = presence;
            });
          },

          setProjectId: (projectId) => {
            set((state) => {
              state.projectId = projectId;
            });
          },

          applyRemoteBuilding: (building) => {
            // withoutHistory and future belong to the history slice wrapped around this initializer.
            (get() as unknown as EditorStore).withoutHistory(() => {
              set((state) => {
                state.building = building;
                if (!state.building.storeys.some((s) => s.id === state.activeStoreyId)) {
                  state.activeStoreyId = state.building.storeys[0]?.id ?? null;
                }
                (state as unknown as { future: Building[] }).future = [];
              });
            });
          },

          setRenovatedView: (on) => {
            set((state) => {
              state.renovatedView = on;
            });
          },

          setActiveZone: (zoneId) => {
            set((state) => {
              state.activeZoneId = zoneId;
            });
          },

          setShowGrid: (show) => {
            set((state) => {
              state.showGrid = show;
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

const startLanguage = loadLanguage() ?? detectLanguage();
export const useEditorStore = createEditorStore({
  language: startLanguage,
  building: loadBuilding() ?? undefined,
  theme: loadTheme() ?? "system",
});
