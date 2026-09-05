import type { EditorStore } from "./building";
import type { Storey } from "@/geometry/types";

export const selectActiveStorey = (state: EditorStore): Storey | undefined =>
  state.building.storeys.find((s) => s.id === state.activeStoreyId);

export const selectCanUndo = (state: EditorStore): boolean => state.past.length > 0;
export const selectCanRedo = (state: EditorStore): boolean => state.future.length > 0;
