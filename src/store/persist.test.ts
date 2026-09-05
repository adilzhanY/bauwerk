import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetIds } from "@/lib/ids";
import { loadBuilding, loadLanguage } from "@/lib/storage";
import { createEditorStore } from "./building";
import { startPersistence } from "./persist";

describe("persistence", () => {
  beforeEach(() => {
    resetIds();
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves the language at once and the building after a short delay", () => {
    const store = createEditorStore();
    const stop = startPersistence(store);

    store.getState().setLanguage("de");
    expect(loadLanguage()).toBe("de");

    store.getState().setWallThickness(0.45);
    expect(loadBuilding()).toBeNull();
    vi.advanceTimersByTime(400);
    expect(loadBuilding()?.wallThickness).toBe(0.45);

    stop();
    store.getState().setWallThickness(0.5);
    vi.advanceTimersByTime(400);
    expect(loadBuilding()?.wallThickness).toBe(0.45);
  });

  it("a fresh store restores the saved building", () => {
    const store = createEditorStore();
    startPersistence(store);
    store.getState().addStorey();
    vi.advanceTimersByTime(400);
    const restored = createEditorStore({ building: loadBuilding() ?? undefined });
    expect(restored.getState().building.storeys).toHaveLength(2);
  });

  it("ignores a corrupt autosave", () => {
    localStorage.setItem("bauwerk.building", "{broken");
    expect(loadBuilding()).toBeNull();
  });
});
