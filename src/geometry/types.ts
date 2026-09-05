export type Id = string;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Segment {
  a: Vec2;
  b: Vec2;
}

export type OpeningKind = "window" | "door";

export type ConstructionCategory = "wall" | "window" | "door" | "floor" | "roof";

/** One material layer of a construction, from outside to inside. */
export interface Layer {
  id: Id;
  name: string;
  /** Metres. */
  thickness: number;
  /** Thermal conductivity λ in W/(m·K). */
  conductivity: number;
}

/** A building component type with its thermal transmittance. */
export interface Construction {
  id: Id;
  name: string;
  category: ConstructionCategory;
  /** U-value in W/(m²K). Computed from the layers when they exist. */
  uValue: number;
  /** Layer stack from outside to inside. Walls, roofs and floors; windows and doors have none. */
  layers?: Layer[];
}

export interface Opening {
  id: Id;
  /** Index into the footprint edges. Edge i runs from vertex i to vertex i + 1. */
  wallIndex: number;
  kind: OpeningKind;
  /** Metres from the wall start to the opening's left edge. */
  offset: number;
  width: number;
  height: number;
  /** Metres above the floor. Always 0 for doors. */
  sill: number;
  constructionId: Id;
}

export interface Room {
  id: Id;
  name: string;
  /** Derived from the interior walls. */
  polygon: Vec2[];
  /** Derived, square metres. */
  area: number;
  zoneId?: Id;
}

export interface Zone {
  id: Id;
  name: string;
  color: string;
  heated: boolean;
  /** Indoor design temperature in °C. */
  temperature: number;
}

export interface Storey {
  id: Id;
  name: string;
  /** Metres. */
  height: number;
  openings: Opening[];
  /** On the grid. Define the rooms. */
  interiorWalls: Segment[];
  rooms: Room[];
}

export interface Building {
  id: Id;
  name: string;
  /** Closed simple polygon, counter-clockwise, metres. The closing edge is implicit. */
  footprint: Vec2[];
  /** Metres. */
  wallThickness: number;
  /** Index 0 is the ground floor. */
  storeys: Storey[];
  zones: Zone[];
  constructions: Construction[];
  wallConstructionId: Id;
  floorConstructionId: Id;
  roofConstructionId: Id;
  /** Used for newly placed openings. */
  windowConstructionId: Id;
  doorConstructionId: Id;
  /** Where the plan origin sits on the earth. Optional. */
  origin?: GeoOrigin;
  /** Thermal bridge detailing level. Missing means "poor", the uninsulated stock. */
  bridgeDetail?: "good" | "poor";
}

export interface GeoOrigin {
  lat: number;
  lon: number;
  /** Compass bearing of the plan's +y axis, degrees clockwise from north. */
  rotation: number;
}

export const GRID_SIZE = 0.5;
export const DEFAULT_WALL_THICKNESS = 0.3;
export const DEFAULT_STOREY_HEIGHT = 3;
export const HEATED_TEMPERATURE = 20;
export const UNHEATED_TEMPERATURE = 10;
