import type { Opening, Vec2 } from "./types";

export const OPENING_SNAP = 0.1;
export const MIN_OPENING_SIZE = 0.1;

export type OpeningError =
  | "outsideWallStart"
  | "outsideWallEnd"
  | "tooSmall"
  | "overlaps"
  | "tooTall"
  | "doorNotOnFloor"
  | "negativeSill";

export interface OpeningContext {
  wallLength: number;
  storeyHeight: number;
  /** Other openings on the same wall. The opening itself is filtered out by id. */
  siblings: readonly Opening[];
}

/** Every invariant from INFO.md, each with its own error code. Empty means valid. */
export function validateOpening(opening: Opening, ctx: OpeningContext): OpeningError[] {
  const errors: OpeningError[] = [];
  const eps = 1e-9;
  if (opening.width < MIN_OPENING_SIZE || opening.height < MIN_OPENING_SIZE)
    errors.push("tooSmall");
  if (opening.offset < -eps) errors.push("outsideWallStart");
  if (opening.offset + opening.width > ctx.wallLength + eps) errors.push("outsideWallEnd");
  if (opening.sill < -eps) errors.push("negativeSill");
  if (opening.sill + opening.height > ctx.storeyHeight + eps) errors.push("tooTall");
  if (opening.kind === "door" && Math.abs(opening.sill) > eps) errors.push("doorNotOnFloor");
  const overlapping = ctx.siblings.some(
    (other) =>
      other.id !== opening.id &&
      other.wallIndex === opening.wallIndex &&
      openingsOverlap(opening, other),
  );
  if (overlapping) errors.push("overlaps");
  return errors;
}

/** Touching edges are not an overlap. Anything past a micrometre is. */
export function openingsOverlap(a: Opening, b: Opening, eps = 1e-6): boolean {
  const aEnd = a.offset + a.width;
  const bEnd = b.offset + b.width;
  return a.offset < bEnd - eps && b.offset < aEnd - eps;
}

export const isOpeningValid = (opening: Opening, ctx: OpeningContext): boolean =>
  validateOpening(opening, ctx).length === 0;

const snap = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Clamp helper for the UI. Brings an opening back inside its wall and storey
 * and forces doors to the floor. It does not resolve overlaps, since which
 * neighbour should give way is the user's call; the validator reports those.
 */
export function clampOpening(opening: Opening, ctx: OpeningContext): Opening {
  const width = Math.min(Math.max(opening.width, MIN_OPENING_SIZE), ctx.wallLength);
  const offset = Math.min(Math.max(opening.offset, 0), ctx.wallLength - width);
  const sill = opening.kind === "door" ? 0 : Math.max(0, opening.sill);
  const height = Math.min(
    Math.max(opening.height, MIN_OPENING_SIZE),
    Math.max(MIN_OPENING_SIZE, ctx.storeyHeight - sill),
  );
  return {
    ...opening,
    width: round(width),
    offset: round(offset),
    sill: round(Math.min(sill, ctx.storeyHeight - height)),
    height: round(height),
  };
}

/** Snap an offset along the wall to the opening grid, keeping it inside the wall. */
export function snapOffset(offset: number, width: number, wallLength: number): number {
  const snapped = snap(offset, OPENING_SNAP);
  return round(Math.min(Math.max(snapped, 0), Math.max(0, wallLength - width)));
}

const round = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * The wall's 2D profile in wall-local coordinates: u runs along the wall from
 * its start, v runs up from the floor. The outer ring is the wall rectangle,
 * counter-clockwise; each hole is a rectangle, clockwise. Invalid openings are
 * skipped so a half-edited opening never produces broken geometry.
 */
export interface WallProfile {
  outer: Vec2[];
  holes: Vec2[][];
}

export function wallProfile(
  wallLength: number,
  storeyHeight: number,
  openings: readonly Opening[],
): WallProfile {
  const outer: Vec2[] = [
    { x: 0, y: 0 },
    { x: wallLength, y: 0 },
    { x: wallLength, y: storeyHeight },
    { x: 0, y: storeyHeight },
  ];
  const holes: Vec2[][] = [];
  for (const o of openings) {
    const valid = isOpeningValid(o, { wallLength, storeyHeight, siblings: openings });
    if (!valid) continue;
    const u0 = o.offset;
    const u1 = o.offset + o.width;
    const v0 = o.sill;
    const v1 = o.sill + o.height;
    holes.push([
      { x: u0, y: v0 },
      { x: u0, y: v1 },
      { x: u1, y: v1 },
      { x: u1, y: v0 },
    ]);
  }
  return { outer, holes };
}

export function defaultOpening(
  kind: Opening["kind"],
): Omit<Opening, "id" | "wallIndex" | "offset" | "constructionId"> {
  return kind === "door"
    ? { kind, width: 1.0, height: 2.1, sill: 0 }
    : { kind, width: 1.2, height: 1.4, sill: 0.9 };
}
