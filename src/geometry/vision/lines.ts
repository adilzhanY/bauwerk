import type { Segment, Vec2 } from "../types";
import type { Binary } from "./image";

/**
 * Wall line detection for axis-aligned plans. Scans rows for long ink runs and
 * merges vertically adjacent runs into one horizontal wall (its centre line is
 * the segment); the same for columns. This is a restricted Hough transform:
 * only 0 and 90 degrees, which is what floor plans are after deskewing.
 */

export interface DetectedLine {
  segment: Segment;
  /** Wall thickness in pixels. */
  thickness: number;
  /** Share of the run actually covered by ink, 0 to 1. */
  confidence: number;
  orientation: "h" | "v";
}

interface Run {
  start: number;
  end: number;
  /** Cross coordinate (row for horizontal runs). */
  at: number;
}

function runsAlong(img: Binary, horizontal: boolean, minLength: number): Run[] {
  const { width, height, data } = img;
  const outer = horizontal ? height : width;
  const inner = horizontal ? width : height;
  const runs: Run[] = [];
  for (let o = 0; o < outer; o++) {
    let start = -1;
    for (let i = 0; i <= inner; i++) {
      const v = i < inner ? data[horizontal ? o * width + i : i * width + o] : 0;
      if (v === 1 && start === -1) start = i;
      if ((v !== 1 || i === inner) && start !== -1) {
        if (i - start >= minLength) runs.push({ start, end: i - 1, at: o });
        start = -1;
      }
    }
  }
  return runs;
}

/** Groups runs on consecutive rows/columns with strong overlap into thick lines. */
function groupRuns(runs: Run[], maxThickness: number): DetectedLine[] {
  const used = new Uint8Array(runs.length);
  const lines: DetectedLine[] = [];
  for (let i = 0; i < runs.length; i++) {
    if (used[i]) continue;
    const seed = runs[i];
    if (!seed) continue;
    const group = [seed];
    used[i] = 1;
    let last = seed;
    for (let j = i + 1; j < runs.length; j++) {
      const r = runs[j];
      if (!r || used[j]) continue;
      if (r.at > last.at + 1) break;
      if (r.at === last.at) continue;
      const overlap = Math.min(r.end, last.end) - Math.max(r.start, last.start);
      const shorter = Math.min(r.end - r.start, last.end - last.start);
      if (overlap > shorter * 0.6 && group.length < maxThickness) {
        group.push(r);
        used[j] = 1;
        last = r;
      }
    }
    lines.push(toLine(group));
  }
  return lines;
}

function toLine(group: Run[]): DetectedLine {
  const start = Math.min(...group.map((r) => r.start));
  const end = Math.max(...group.map((r) => r.end));
  const at = group.reduce((s, r) => s + r.at, 0) / group.length;
  const covered =
    group.reduce((s, r) => s + (r.end - r.start + 1), 0) / (group.length * (end - start + 1));
  return {
    segment: { a: { x: start, y: at }, b: { x: end, y: at } },
    thickness: group.length,
    confidence: Math.min(1, covered),
    orientation: "h",
  };
}

const swap = (l: DetectedLine): DetectedLine => ({
  ...l,
  orientation: "v",
  segment: { a: { x: l.segment.a.y, y: l.segment.a.x }, b: { x: l.segment.b.y, y: l.segment.b.x } },
});

/** Merges collinear lines whose gap is under `gap` pixels. */
export function mergeCollinear(lines: DetectedLine[], gap: number, tolerance = 2): DetectedLine[] {
  const out: DetectedLine[] = [];
  for (const orientation of ["h", "v"] as const) {
    const same = lines
      .filter((l) => l.orientation === orientation)
      .sort((p, q) => {
        const pa = orientation === "h" ? p.segment.a.y : p.segment.a.x;
        const qa = orientation === "h" ? q.segment.a.y : q.segment.a.x;
        return (
          pa - qa ||
          (orientation === "h" ? p.segment.a.x - q.segment.a.x : p.segment.a.y - q.segment.a.y)
        );
      });
    for (const l of same) {
      const prev = out[out.length - 1];
      const cross = (s: Segment) => (orientation === "h" ? s.a.y : s.a.x);
      const along = (s: Segment): [number, number] =>
        orientation === "h" ? [s.a.x, s.b.x] : [s.a.y, s.b.y];
      if (
        prev?.orientation === orientation &&
        Math.abs(cross(prev.segment) - cross(l.segment)) <= tolerance
      ) {
        const [, pEnd] = along(prev.segment);
        const [lStart, lEnd] = along(l.segment);
        if (lStart - pEnd <= gap) {
          const end = Math.max(pEnd, lEnd);
          if (orientation === "h") prev.segment.b = { x: end, y: prev.segment.a.y };
          else prev.segment.b = { x: prev.segment.a.x, y: end };
          prev.confidence = Math.min(prev.confidence, l.confidence);
          continue;
        }
      }
      out.push({ ...l, segment: { a: { ...l.segment.a }, b: { ...l.segment.b } } });
    }
  }
  return out;
}

export interface DetectOptions {
  /** Shortest run that counts as a wall, in pixels. */
  minLength: number;
  /** Thickest wall in pixels; thicker blobs are text or fills. */
  maxThickness: number;
  /** Gap bridged when merging collinear pieces, in pixels. */
  mergeGap: number;
}

export function detectLines(img: Binary, options: DetectOptions): DetectedLine[] {
  const h = groupRuns(runsAlong(img, true, options.minLength), options.maxThickness);
  const v = groupRuns(runsAlong(img, false, options.minLength), options.maxThickness).map(swap);
  return mergeCollinear([...h, ...v], options.mergeGap);
}

/** Snaps segment endpoints onto the nearest endpoints of other segments within `radius`, closing corners. */
export function snapEndpoints(lines: DetectedLine[], radius: number): DetectedLine[] {
  const points: Vec2[] = lines.flatMap((l) => [l.segment.a, l.segment.b]);
  const snapPoint = (p: Vec2): Vec2 => {
    let best = p;
    let bestD = radius;
    for (const q of points) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > 0 && d < bestD) {
        bestD = d;
        best = q;
      }
    }
    return best;
  };
  return lines.map((l) => {
    const a = snapPoint(l.segment.a);
    const b = snapPoint(l.segment.b);
    // Keep the line straight: a horizontal line snaps only in x at its ends, so re-align.
    const seg: Segment =
      l.orientation === "h"
        ? {
            a: { x: Math.min(a.x, b.x), y: l.segment.a.y },
            b: { x: Math.max(a.x, b.x), y: l.segment.a.y },
          }
        : {
            a: { x: l.segment.a.x, y: Math.min(a.y, b.y) },
            b: { x: l.segment.a.x, y: Math.max(a.y, b.y) },
          };
    return { ...l, segment: seg };
  });
}
