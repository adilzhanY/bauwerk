import type { Vec2 } from "./types";

/** 10 by 8 rectangle, counter-clockwise. The default building footprint. */
export const rect: Vec2[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 8 },
  { x: 0, y: 8 },
];

/** Concave L shape: the rectangle with the top right 4 by 3 corner removed. */
export const lShape: Vec2[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 5 },
  { x: 6, y: 5 },
  { x: 6, y: 8 },
  { x: 0, y: 8 },
];
