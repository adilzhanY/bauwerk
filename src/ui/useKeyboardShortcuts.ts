import { useEffect } from "react";
import { useEditorStore } from "@/store/building";
import type { Tool } from "@/store/building";

export const TOOL_ORDER: Tool[] = ["select", "footprint", "opening", "interiorWall", "zone"];

function inTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Ctrl+Z undo, Ctrl+Shift+Z or Ctrl+Y redo, Delete removes the selection,
 * Escape clears it, 1 to 5 switch tools, PageUp and PageDown switch storeys.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditorStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (inTextField(e.target)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        s.deleteSelection();
        return;
      }
      if (e.key === "Escape") {
        s.clearSelection();
        return;
      }
      const toolIndex = Number(e.key) - 1;
      const tool = TOOL_ORDER[toolIndex];
      if (!mod && e.key >= "1" && e.key <= "5" && tool) {
        s.setTool(tool);
        return;
      }
      if (e.key === "PageUp" || e.key === "PageDown") {
        e.preventDefault();
        const list = s.building.storeys;
        const index = list.findIndex((st) => st.id === s.activeStoreyId);
        const next = list[index + (e.key === "PageUp" ? 1 : -1)];
        if (next) s.setActiveStorey(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
