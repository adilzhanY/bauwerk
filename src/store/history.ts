import type { StateCreator, StoreMutatorIdentifier } from "zustand";
import type { Building } from "@/geometry/types";

export const HISTORY_LIMIT = 200;

export interface HistorySlice {
  past: Building[];
  future: Building[];
  undo: () => void;
  redo: () => void;
  /** Runs `fn` without recording building changes. For applying remote state. */
  withoutHistory: (fn: () => void) => void;
}

interface WithBuilding {
  building: Building;
}

/**
 * Undo and redo middleware. It watches the `building` slice only: whenever a
 * state update replaces `building` with a new reference, the previous one is
 * pushed onto `past` and `future` is cleared. UI state (selection, tool,
 * language, active storey) is never recorded and never touched by undo.
 *
 * Buildings are immutable values (Immer produces fresh objects), so keeping
 * references is enough to restore an exact previous state.
 */
type History = <
  T extends WithBuilding,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, Mps, Mcs>,
) => StateCreator<T & HistorySlice, Mps, Mcs>;

type HistoryImpl = <T extends WithBuilding>(
  initializer: StateCreator<T>,
) => StateCreator<T & HistorySlice>;

const historyImpl: HistoryImpl = (initializer) => (set, get, api) => {
  type S = ReturnType<typeof initializer> & HistorySlice;
  let restoring = false;

  const trackedSet: typeof set = (partial, replace) => {
    const before = get().building;
    if (replace === true) {
      set(partial as Parameters<typeof set>[0], true);
    } else {
      set(partial);
    }
    const after = get().building;
    if (restoring || before === after) return;
    set((state) => {
      const past = [...state.past, before];
      if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
      return { past, future: [] } as Partial<S>;
    });
  };

  const restore = (direction: "undo" | "redo") => {
    const state = get();
    const source = direction === "undo" ? state.past : state.future;
    const target = source[source.length - 1];
    if (target === undefined) return;
    restoring = true;
    try {
      set(
        (direction === "undo"
          ? {
              building: target,
              past: source.slice(0, -1),
              future: [...state.future, state.building],
            }
          : {
              building: target,
              future: source.slice(0, -1),
              past: [...state.past, state.building],
            }) as Partial<S>,
      );
    } finally {
      restoring = false;
    }
  };

  const base = initializer(trackedSet, get, api);
  return {
    ...base,
    past: [],
    future: [],
    undo: () => {
      restore("undo");
    },
    redo: () => {
      restore("redo");
    },
    withoutHistory: (fn) => {
      const previous = restoring;
      restoring = true;
      try {
        fn();
      } finally {
        restoring = previous;
      }
    },
  };
};

export const history = historyImpl as unknown as History;
