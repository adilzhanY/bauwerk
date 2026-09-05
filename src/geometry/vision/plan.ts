import { facesOfSegments } from "../rooms";
import {
  area,
  ensureCounterClockwise,
  isSimplePolygon,
  pointOnSegment,
  snapPoint,
} from "../polygon";
import type { Segment, Vec2 } from "../types";
import { GRID_SIZE } from "../types";
import { adaptiveThreshold, close, estimateSkew, rotate, toGray } from "./image";
import type { Binary } from "./image";
import { detectLines, snapEndpoints } from "./lines";
import type { DetectedLine } from "./lines";

/**
 * From a scanned floor plan to a footprint proposal and interior walls.
 *
 * 1. greyscale, adaptive threshold, closing
 * 2. deskew by the dominant near-horizontal direction
 * 3. horizontal and vertical wall lines by run scanning, merged and corner-snapped
 * 4. planar faces of the line graph: the largest face is the footprint, lines
 *    inside it that are not on the boundary are interior walls
 * 5. pixels to metres through the image placement, snapped to the 0.5 m grid
 *
 * Everything is pure over typed arrays so it runs in a worker and in tests.
 */

export interface Placement {
  /** Plan coordinates of the image centre. */
  x: number;
  y: number;
  /** Image width in metres on the ground. */
  widthMetres: number;
}

export interface Proposal {
  /** Footprint in plan metres, counter-clockwise, snapped to the grid. */
  footprint: Vec2[];
  interiorWalls: { segment: Segment; confidence: number }[];
  /** Everything detected, in pixels, for the review overlay. */
  lines: DetectedLine[];
  skewDegrees: number;
  /** Pixel-space footprint for drawing over the image. */
  footprintPixels: Vec2[];
}

export interface PipelineOptions {
  /** Minimum wall length as a fraction of the image width. */
  minLengthFraction?: number;
  maxThicknessFraction?: number;
  deskew?: boolean;
}

export function binarize(rgba: Uint8ClampedArray, width: number, height: number): Binary {
  return close(adaptiveThreshold(toGray(rgba, width, height)));
}

export function analysePlan(
  binary: Binary,
  options: PipelineOptions = {},
): { lines: DetectedLine[]; skewDegrees: number; image: Binary } {
  const skew = options.deskew === false ? 0 : estimateSkew(binary);
  const image = Math.abs(skew) > 0.2 ? rotate(binary, skew) : binary;
  const minLength = Math.max(8, Math.round(binary.width * (options.minLengthFraction ?? 0.04)));
  const maxThickness = Math.max(
    3,
    Math.round(binary.width * (options.maxThicknessFraction ?? 0.03)),
  );
  const raw = detectLines(image, { minLength, maxThickness, mergeGap: Math.round(minLength / 2) });
  const lines = snapEndpoints(raw, Math.max(4, Math.round(minLength / 3)));
  return { lines, skewDegrees: skew, image };
}

/** Converts a pixel point (y down) to plan metres (y up) through the placement. */
export function pixelToPlan(
  p: Vec2,
  imageWidth: number,
  imageHeight: number,
  placement: Placement,
): Vec2 {
  const scale = placement.widthMetres / imageWidth;
  const heightMetres = imageHeight * scale;
  return {
    x: placement.x - placement.widthMetres / 2 + p.x * scale,
    y: placement.y + heightMetres / 2 - p.y * scale,
  };
}

export function proposeFootprint(
  lines: DetectedLine[],
  imageWidth: number,
  imageHeight: number,
  placement: Placement,
  minConfidence = 0.5,
): Proposal | null {
  const kept = lines.filter((l) => l.confidence >= minConfidence);
  const segments: Segment[] = kept.map((l) => l.segment);
  const faces = facesOfSegments(segments);
  if (faces.length === 0) return null;
  // Faces nest: the outer boundary is the union. Take the face with the largest
  // area; when faces tile the plan (rooms), take their union's outline via the
  // face of the boundary-only graph.
  const boundaryLines = kept.filter((l) => isOnHull(l, kept));
  const hullFaces = facesOfSegments(boundaryLines.map((l) => l.segment));
  const outer = (hullFaces.length > 0 ? hullFaces : faces).reduce((best, f) =>
    area(f) > area(best) ? f : best,
  );
  const footprintPixels = outer;
  const toPlan = (p: Vec2) =>
    snapPoint(pixelToPlan(p, imageWidth, imageHeight, placement), GRID_SIZE);
  const footprint = dedupe(ensureCounterClockwise(footprintPixels.map(toPlan)));
  if (!isSimplePolygon(footprint)) return null;
  const onBoundary = (s: Segment) => {
    const n = footprintPixels.length;
    for (let i = 0; i < n; i++) {
      const a = footprintPixels[i];
      const b = footprintPixels[(i + 1) % n];
      if (a && b && pointOnSegment(s.a, a, b, 2) && pointOnSegment(s.b, a, b, 2)) return true;
    }
    return false;
  };
  const interiorWalls = kept
    .filter((l) => !onBoundary(l.segment))
    .map((l) => ({
      segment: { a: toPlan(l.segment.a), b: toPlan(l.segment.b) },
      confidence: l.confidence,
    }))
    .filter(
      (w) => Math.hypot(w.segment.b.x - w.segment.a.x, w.segment.b.y - w.segment.a.y) >= GRID_SIZE,
    );
  return { footprint, interiorWalls, lines, skewDegrees: 0, footprintPixels };
}

/** A line is on the hull when nothing detected lies beyond it on its outer side. */
function isOnHull(l: DetectedLine, all: DetectedLine[]): boolean {
  const s = l.segment;
  const mid = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
  const beyond = (side: number) =>
    all.some((o) => {
      if (o === l) return false;
      const m = { x: (o.segment.a.x + o.segment.b.x) / 2, y: (o.segment.a.y + o.segment.b.y) / 2 };
      const overlaps =
        l.orientation === "h"
          ? Math.min(s.b.x, o.segment.b.x) - Math.max(s.a.x, o.segment.a.x) > 0 ||
            o.orientation === "v"
          : Math.min(s.b.y, o.segment.b.y) - Math.max(s.a.y, o.segment.a.y) > 0 ||
            o.orientation === "h";
      if (!overlaps) return false;
      return l.orientation === "h"
        ? Math.sign(m.y - mid.y) === side && Math.abs(m.y - mid.y) > 2
        : Math.sign(m.x - mid.x) === side && Math.abs(m.x - mid.x) > 2;
    });
  return !beyond(1) || !beyond(-1);
}

function dedupe(points: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 1e-6) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && out.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) < 1e-6)
    out.pop();
  // Drop collinear middle points created by snapping.
  return out.filter((p, i) => {
    const prev = out[(i - 1 + out.length) % out.length];
    const next = out[(i + 1) % out.length];
    if (!prev || !next) return true;
    return Math.abs((p.x - prev.x) * (next.y - p.y) - (p.y - prev.y) * (next.x - p.x)) > 1e-9;
  });
}
