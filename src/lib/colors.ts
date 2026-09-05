/** Palette from INFO.md. Mirrors the CSS variables in index.css for use in the 3D scene. */
export const colors = {
  bg: "#0f1115",
  panel: "#171a21",
  border: "#262a33",
  fg: "#e6e8ee",
  muted: "#8b93a5",
  accent: "#4f8cff",
  warning: "#ffb454",
  wall: "#d9d4c7",
  wallHover: "#ebe7dc",
  floor: "#b8b2a4",
  window: "#8ecae6",
  door: "#a67c52",
  interiorWall: "#cfc9bb",
} as const;

/** The fixed set of six zone colours the user can pick from. */
export const ZONE_COLORS = [
  "#e76f51",
  "#f4a261",
  "#e9c46a",
  "#2a9d8f",
  "#6c8ef5",
  "#b084cc",
] as const;

export const INACTIVE_OPACITY = 0.25;
