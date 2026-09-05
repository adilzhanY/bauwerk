import type { EditorStore } from "./building";
import type { Building, Id, Storey } from "@/geometry/types";

export const selectActiveStorey = (state: EditorStore): Storey | undefined =>
  state.building.storeys.find((s) => s.id === state.activeStoreyId);

export const selectCanUndo = (state: EditorStore): boolean => state.past.length > 0;
export const selectCanRedo = (state: EditorStore): boolean => state.future.length > 0;

/** Height of the storey floor above the ground, the sum of the storeys below it. */
export function storeyElevation(building: Building, storeyId: Id): number {
  let y = 0;
  for (const s of building.storeys) {
    if (s.id === storeyId) return y;
    y += s.height;
  }
  return y;
}

export const selectTotalHeight = (state: EditorStore): number =>
  state.building.storeys.reduce((sum, s) => sum + s.height, 0);

export const selectRoomCount = (state: EditorStore): number =>
  state.building.storeys.reduce((sum, s) => sum + s.rooms.length, 0);

export const selectTotalFloorArea = (state: EditorStore): number =>
  state.building.storeys.reduce((sum, s) => sum + s.rooms.reduce((a, r) => a + r.area, 0), 0);
