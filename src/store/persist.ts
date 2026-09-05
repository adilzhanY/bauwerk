import { saveBuilding, saveLanguage } from "@/lib/storage";
import type { createEditorStore } from "./building";

const SAVE_DELAY_MS = 300;

/** Autosaves the building (debounced) and the language to localStorage. */
export function startPersistence(store: ReturnType<typeof createEditorStore>): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return store.subscribe((state, previous) => {
    if (state.language !== previous.language) saveLanguage(state.language);
    if (state.building !== previous.building) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        saveBuilding(state.building);
      }, SAVE_DELAY_MS);
    }
  });
}
