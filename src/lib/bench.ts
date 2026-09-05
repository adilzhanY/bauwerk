import { DEFAULT_ASSIGNMENT, PRESET_IDS, defaultConstructions } from "@/geometry/constructions";
import { computeRooms } from "@/geometry/rooms";
import type { Building, Opening, Storey } from "@/geometry/types";
import type { Language } from "@/i18n";
import { defaultRoomName, defaultStoreyName } from "@/i18n";
import { createId } from "./ids";

export const BENCH_STOREYS = 50;
export const BENCH_OPENINGS_PER_STOREY = 20;

/** A 20 by 12 m tower with fifty storeys and twenty openings each, for the frame time benchmark. */
export function benchBuilding(language: Language = "en"): Building {
  const footprint = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 12 },
    { x: 0, y: 12 },
  ];
  const walls = [
    { a: { x: 7, y: 0 }, b: { x: 7, y: 12 } },
    { a: { x: 13, y: 0 }, b: { x: 13, y: 12 } },
    { a: { x: 0, y: 6 }, b: { x: 20, y: 6 } },
  ];
  const storeys: Storey[] = Array.from({ length: BENCH_STOREYS }, (_, i) => {
    const openings: Opening[] = [];
    // Five windows on each long wall, five on each short wall: twenty per storey.
    for (const [wallIndex, length] of [
      [0, 20],
      [1, 12],
      [2, 20],
      [3, 12],
    ] as const) {
      for (let k = 0; k < 5; k++) {
        const width = 1.2;
        const offset = Math.round((((k + 0.5) * length) / 5 - width / 2) * 10) / 10;
        openings.push({
          id: createId("opening"),
          wallIndex,
          kind: "window",
          offset,
          width,
          height: 1.4,
          sill: 0.9,
          constructionId: PRESET_IDS.glazingDouble,
        });
      }
    }
    return {
      id: createId("storey"),
      name: defaultStoreyName(i, language),
      height: 3,
      openings,
      interiorWalls: walls,
      rooms: computeRooms(footprint, walls, [], {
        createId: () => createId("room"),
        defaultName: (n) => defaultRoomName(n, language),
      }),
    };
  });
  return {
    id: createId("building"),
    name: "Benchmark",
    footprint,
    wallThickness: 0.3,
    storeys,
    zones: [],
    constructions: defaultConstructions(language),
    ...DEFAULT_ASSIGNMENT,
  };
}

/** Frame time statistics in milliseconds. */
export interface FrameStats {
  count: number;
  mean: number;
  p50: number;
  p95: number;
  max: number;
  fps: number;
}

export function frameStats(frameTimesMs: readonly number[]): FrameStats {
  if (frameTimesMs.length === 0) return { count: 0, mean: 0, p50: 0, p95: 0, max: 0, fps: 0 };
  const sorted = [...frameTimesMs].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return {
    count: sorted.length,
    mean,
    p50: at(0.5),
    p95: at(0.95),
    max: sorted[sorted.length - 1] ?? 0,
    fps: mean > 0 ? 1000 / mean : 0,
  };
}
