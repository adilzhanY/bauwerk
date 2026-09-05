/**
 * Colours the 3D scene needs as JavaScript values. Chrome colours come from the
 * CSS tokens in index.css and are read at runtime so the scene follows the theme;
 * the model's own materials (plaster, timber, glass) do not change with the theme.
 */
export const colors = {
  wall: "#d9d4c7",
  wallHover: "#ebe7dc",
  floor: "#b8b2a4",
  window: "#8ecae6",
  door: "#a67c52",
  interiorWall: "#cfc9bb",
  /** Selection blue. Read live from the theme where possible; this is the light default. */
  accent: "#234d8f",
  /** Mark red for warnings and invalid elements. */
  warning: "#c2431f",
  fg: "#1b1d20",
  muted: "#5b6068",
  bg: "#e9e9e3",
} as const;

/** Reads a CSS token from the root element. Falls back to the light default. */
export function themeColor(token: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return v === "" ? fallback : v;
}

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
