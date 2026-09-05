import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Building,
  GeoOrigin,
  Construction,
  HeatPump,
  Id,
  Layer,
  Opening,
  Radiator,
  Roof,
  Scenario,
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
import { uValueFromLayers } from "@/geometry/layers";
import { roofOf } from "@/geometry/roof";
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

export type Tool =
  "select" | "footprint" | "opening" | "interiorWall" | "zone" | "measure" | "hvac";

export type Selection =
  | { kind: "vertex"; index: number }
  | { kind: "wall"; storeyId: Id; wallIndex: number }
  | { kind: "opening"; storeyId: Id; id: Id }
  | { kind: "interiorWall"; storeyId: Id; index: number }
  | { kind: "room"; storeyId: Id; id: Id }
  | { kind: "storey"; id: Id }
  | { kind: "zone"; id: Id }
  | { kind: "roof" }
  | { kind: "radiator"; storeyId: Id; id: Id }
  | { kind: "heatPump"; id: Id }
  | { kind: "pipe"; storeyId: Id; id: Id };

/** Display of storeys that are not being edited. */
export interface OtherStoreys {
  above: "hidden" | "outline" | "ghost";
  below: "outline" | "ghost" | "solid";
  ghostOpacity: number;
}

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
  /** Scenario shown in the Energy tab: null is the current state, "full-envelope" the built-in variant, else a saved id. UI state. */
  viewScenarioId: string | null;
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
  /** Footprint proposal from the vision pipeline, shown over the underlay until accepted. UI state. */
  proposal: FootprintProposal | null;
  theme: Theme;
  /** Red lines for thermal bridges. UI state. */
  showBridges: boolean;
  /** How storeys other than the active one are drawn. UI state. */
  otherStoreys: OtherStoreys;
  /** Section cut through the model. UI state. */
  sectionCut: { enabled: boolean; axis: "horizontal" | "x" | "y"; value: number };
  /** First person walkthrough. UI state. */
  walkthrough: boolean;
  /** Sun simulation: a real sun over the model for a day of the year and a local time. UI state. */
  sun: { enabled: boolean; dayOfYear: number; minutes: number };
  /** OpenStreetMap tiles on the ground when a location is set. UI state. */
  showMap: boolean;
  mapOpacity: number;
}

export interface FootprintProposal {
  footprint: Vec2[];
  interiorWalls: { segment: Segment; confidence: number; enabled: boolean }[];
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
  setBridgeDetail: (detail: "good" | "poor") => void;
  setRoof: (patch: Partial<Roof>) => void;
  addRadiator: (storeyId: Id, radiator: Omit<Radiator, "id">) => Id;
  updateRadiator: (storeyId: Id, id: Id, patch: Partial<Omit<Radiator, "id">>) => void;
  removeRadiator: (storeyId: Id, id: Id) => void;
  addHeatPump: (pump: Omit<HeatPump, "id">) => Id;
  updateHeatPump: (id: Id, patch: Partial<Omit<HeatPump, "id">>) => void;
  removeHeatPump: (id: Id) => void;
  addPipe: (storeyId: Id, points: Vec2[]) => Id;
  removePipe: (storeyId: Id, id: Id) => void;
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
  addLayer: (constructionId: Id, layer?: Omit<Layer, "id">) => void;
  updateLayer: (constructionId: Id, layerId: Id, patch: Partial<Omit<Layer, "id">>) => void;
  removeLayer: (constructionId: Id, layerId: Id) => void;
  moveLayer: (constructionId: Id, layerId: Id, direction: -1 | 1) => void;
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
  setViewScenario: (id: string | null) => void;
  addScenario: (name: string, from?: Partial<Scenario>) => Id;
  updateScenario: (id: Id, patch: Partial<Omit<Scenario, "id">>) => void;
  removeScenario: (id: Id) => void;
  setPresence: (presence: Presence[]) => void;
  setProjectId: (projectId: string | null) => void;
  duplicateStorey: (storeyId: Id) => void;
  setPlanView: (on: boolean) => void;
  setShowUValueBands: (on: boolean) => void;
  setUnderlay: (underlay: Underlay | null) => void;
  setMeasurement: (measurement: { a: Vec2; b: Vec2 } | null) => void;
  setProposal: (proposal: FootprintProposal | null) => void;
  toggleProposalWall: (index: number) => void;
  /** Replaces the footprint and interior walls with the proposal in one undo step. */
  acceptProposal: () => void;
  setTheme: (theme: Theme) => void;
  setShowMap: (on: boolean) => void;
  setShowBridges: (on: boolean) => void;
  setSun: (patch: Partial<{ enabled: boolean; dayOfYear: number; minutes: number }>) => void;
  setOtherStoreys: (patch: Partial<OtherStoreys>) => void;
  setSectionCut: (
    patch: Partial<{ enabled: boolean; axis: "horizontal" | "x" | "y"; value: number }>,
  ) => void;
  setWalkthrough: (on: boolean) => void;
  setMapOpacity: (opacity: number) => void;
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
          viewScenarioId: null,
          presence: [],
          projectId: null,
          planView: false,
          showUValueBands: false,
          underlay: null,
          measurement: null,
          proposal: null,
          theme: initial?.theme ?? "system",
          showMap: true,
          showBridges: false,
          sun: { enabled: false, dayOfYear: 172, minutes: 14 * 60 },
          sectionCut: { enabled: false, axis: "horizontal", value: 1.5 },
          otherStoreys: { above: "outline", below: "ghost", ghostOpacity: 0.15 },
          walkthrough: false,
          mapOpacity: 0.85,

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
              case "radiator":
                actions.removeRadiator(selection.storeyId, selection.id);
                break;
              case "heatPump":
                actions.removeHeatPump(selection.id);
                break;
              case "pipe":
                actions.removePipe(selection.storeyId, selection.id);
                break;
              case "wall":
              case "room":
              case "roof":
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

          addRadiator: (storeyId, radiator) => {
            const id = createId("radiator");
            set((state) => {
              const storey = findStorey(state.building, storeyId);
              if (!storey) return;
              storey.radiators ??= [];
              storey.radiators.push({ ...radiator, id });
            });
            return id;
          },

          updateRadiator: (storeyId, id, patch) => {
            set((state) => {
              const r = findStorey(state.building, storeyId)?.radiators?.find((x) => x.id === id);
              if (r) Object.assign(r, patch);
            });
          },

          removeRadiator: (storeyId, id) => {
            set((state) => {
              const storey = findStorey(state.building, storeyId);
              if (!storey?.radiators) return;
              storey.radiators = storey.radiators.filter((x) => x.id !== id);
              if (state.selection?.kind === "radiator" && state.selection.id === id)
                state.selection = null;
            });
          },

          addHeatPump: (pump) => {
            const id = createId("pump");
            set((state) => {
              state.building.heatPumps ??= [];
              state.building.heatPumps.push({ ...pump, id, position: { ...pump.position } });
            });
            return id;
          },

          updateHeatPump: (id, patch) => {
            set((state) => {
              const p = state.building.heatPumps?.find((x) => x.id === id);
              if (p) Object.assign(p, patch);
            });
          },

          removeHeatPump: (id) => {
            set((state) => {
              if (!state.building.heatPumps) return;
              state.building.heatPumps = state.building.heatPumps.filter((x) => x.id !== id);
              if (state.selection?.kind === "heatPump" && state.selection.id === id)
                state.selection = null;
            });
          },

          addPipe: (storeyId, points) => {
            const id = createId("pipe");
            set((state) => {
              const storey = findStorey(state.building, storeyId);
              if (!storey || points.length < 2) return;
              storey.pipes ??= [];
              storey.pipes.push({ id, points: points.map((p) => ({ ...p })) });
            });
            return id;
          },

          removePipe: (storeyId, id) => {
            set((state) => {
              const storey = findStorey(state.building, storeyId);
              if (!storey?.pipes) return;
              storey.pipes = storey.pipes.filter((x) => x.id !== id);
              if (state.selection?.kind === "pipe" && state.selection.id === id)
                state.selection = null;
            });
          },

          setRoof: (patch) => {
            set((state) => {
              state.building.roof = { ...roofOf(state.building), ...patch };
            });
          },

          setBridgeDetail: (detail) => {
            set((state) => {
              state.building.bridgeDetail = detail;
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
              if (!c) return;
              Object.assign(c, patch);
              if (c.layers && c.layers.length > 0)
                c.uValue = uValueFromLayers(c.layers, c.category);
            });
          },

          addLayer: (constructionId, layer) => {
            set((state) => {
              const c = state.building.constructions.find((x) => x.id === constructionId);
              if (!c) return;
              c.layers ??= [];
              c.layers.push({
                id: createId("layer"),
                name: "",
                thickness: 0.1,
                conductivity: 0.5,
                ...layer,
              });
              c.uValue = uValueFromLayers(c.layers, c.category);
            });
          },

          updateLayer: (constructionId, layerId, patch) => {
            set((state) => {
              const c = state.building.constructions.find((x) => x.id === constructionId);
              const l = c?.layers?.find((x) => x.id === layerId);
              if (!c?.layers || !l) return;
              Object.assign(l, patch);
              c.uValue = uValueFromLayers(c.layers, c.category);
            });
          },

          removeLayer: (constructionId, layerId) => {
            set((state) => {
              const c = state.building.constructions.find((x) => x.id === constructionId);
              if (!c?.layers) return;
              c.layers = c.layers.filter((x) => x.id !== layerId);
              if (c.layers.length === 0) delete c.layers;
              else c.uValue = uValueFromLayers(c.layers, c.category);
            });
          },

          moveLayer: (constructionId, layerId, direction) => {
            set((state) => {
              const c = state.building.constructions.find((x) => x.id === constructionId);
              if (!c?.layers) return;
              const from = c.layers.findIndex((x) => x.id === layerId);
              const to = from + direction;
              if (from === -1 || to < 0 || to >= c.layers.length) return;
              const [item] = c.layers.splice(from, 1);
              if (item) c.layers.splice(to, 0, item);
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

          setOtherStoreys: (patch) => {
            set((state) => {
              state.otherStoreys = { ...state.otherStoreys, ...patch };
            });
          },

          setSectionCut: (patch) => {
            set((state) => {
              state.sectionCut = { ...state.sectionCut, ...patch };
            });
          },

          setWalkthrough: (on) => {
            set((state) => {
              state.walkthrough = on;
              if (on) state.planView = false;
            });
          },

          setSun: (patch) => {
            set((state) => {
              state.sun = { ...state.sun, ...patch };
            });
          },

          setShowBridges: (on) => {
            set((state) => {
              state.showBridges = on;
            });
          },

          setShowMap: (on) => {
            set((state) => {
              state.showMap = on;
            });
          },

          setMapOpacity: (opacity) => {
            set((state) => {
              state.mapOpacity = Math.min(1, Math.max(0.1, opacity));
            });
          },

          setTheme: (theme) => {
            set((state) => {
              state.theme = theme;
            });
          },

          setProposal: (proposal) => {
            set((state) => {
              state.proposal = proposal;
            });
          },

          toggleProposalWall: (index) => {
            set((state) => {
              const w = state.proposal?.interiorWalls[index];
              if (w) w.enabled = !w.enabled;
            });
          },

          acceptProposal: () => {
            const proposal = get().proposal;
            if (!proposal) return;
            const api = get() as unknown as EditorStore;
            api.beginBatch();
            try {
              api.setFootprint(proposal.footprint);
              const storeyId = get().activeStoreyId;
              if (storeyId) {
                const existing =
                  get().building.storeys.find((st) => st.id === storeyId)?.interiorWalls.length ??
                  0;
                for (let i = existing - 1; i >= 0; i--) api.removeInteriorWall(storeyId, i);
                for (const w of proposal.interiorWalls)
                  if (w.enabled) api.addInteriorWall(storeyId, w.segment);
              }
            } finally {
              api.endBatch();
            }
            set((state) => {
              state.proposal = null;
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
              state.viewScenarioId = on ? "full-envelope" : null;
            });
          },

          setViewScenario: (id) => {
            set((state) => {
              state.viewScenarioId = id;
              state.renovatedView = id === "full-envelope";
            });
          },

          addScenario: (name, from) => {
            const id = createId("scenario");
            set((state) => {
              state.building.scenarios ??= [];
              state.building.scenarios.push({
                id,
                name,
                overrides: { ...from?.overrides },
                bridgeDetail: from?.bridgeDetail,
                roof: from?.roof,
              });
            });
            return id;
          },

          updateScenario: (id, patch) => {
            set((state) => {
              const s = state.building.scenarios?.find((x) => x.id === id);
              if (!s) return;
              if (patch.name !== undefined) s.name = patch.name;
              if (patch.overrides !== undefined) s.overrides = { ...patch.overrides };
              if ("bridgeDetail" in patch) s.bridgeDetail = patch.bridgeDetail;
              if ("roof" in patch) s.roof = patch.roof;
            });
          },

          removeScenario: (id) => {
            set((state) => {
              if (!state.building.scenarios) return;
              state.building.scenarios = state.building.scenarios.filter((x) => x.id !== id);
              if (state.viewScenarioId === id) state.viewScenarioId = null;
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
