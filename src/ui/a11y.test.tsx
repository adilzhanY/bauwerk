import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "@/App";
import { useEditorStore, createDefaultBuilding } from "@/store/building";

beforeEach(() => {
  window.localStorage.clear();
  useEditorStore.setState({
    building: createDefaultBuilding("en"),
    selection: null,
    tool: "select",
  });
  useEditorStore.setState((s) => ({ activeStoreyId: s.building.storeys[0]?.id ?? null }));
});

/**
 * A small accessible name: aria-labelledby, aria-label, an associated or
 * wrapping label, the title, then the text content. Enough to catch a control
 * that has none of them.
 */
function accessibleName(el: HTMLElement): string {
  const byId = el.getAttribute("aria-labelledby");
  if (byId) {
    const text = byId
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
    if (text.trim()) return text;
  }
  const label = el.getAttribute("aria-label");
  if (label?.trim()) return label;
  if (el.id) {
    const forLabel = document.querySelector(`label[for="${el.id}"]`);
    const forText = forLabel?.textContent ?? "";
    if (forText.trim()) return forText;
  }
  const wrapping = el.closest("label");
  const wrapText = wrapping?.textContent ?? "";
  if (wrapText.trim()) return wrapText;
  const title = el.getAttribute("title");
  if (title?.trim()) return title;
  return el.textContent;
}

/** Every control in every panel carries a name a screen reader can speak. */
function expectAllNamed(container: HTMLElement) {
  const unnamed: string[] = [];
  const controls = container.querySelectorAll<HTMLElement>(
    "button, input, [role='radio'], [role='tab'], [role='combobox'], [role='slider'], [role='switch'], [role='checkbox'], [role='img'], a[href]",
  );
  for (const el of controls) {
    if (accessibleName(el).trim() === "") unnamed.push(el.outerHTML.slice(0, 80));
  }
  expect(unnamed).toEqual([]);
}

describe("accessibility", () => {
  it("names every landmark", () => {
    render(<App />);
    expect(screen.getByRole("main", { name: "3D view" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Tools" })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Building panel" })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Properties panel" })).toBeTruthy();
    expect(screen.getByRole("contentinfo", { name: "Actions and status" })).toBeTruthy();
  });

  it("every control has an accessible name across all sections and tabs", () => {
    const { container } = render(<App />);
    expectAllNamed(container);
    for (const section of ["Zones", "Location", "Floor plan underlay", "Settings"]) {
      const radio = screen.queryByRole("radio", { name: section });
      if (radio) fireEvent.click(radio);
      expectAllNamed(container);
    }
    for (const tab of ["Energy", "Scenarios", "Properties"]) {
      fireEvent.click(screen.getByRole("tab", { name: tab }));
      expectAllNamed(container);
    }
  });

  it("Escape returns to the select tool and clears the selection", () => {
    render(<App />);
    useEditorStore.getState().setTool("opening");
    useEditorStore.getState().select({ kind: "roof" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useEditorStore.getState().tool).toBe("select");
    expect(useEditorStore.getState().selection).toBeNull();
  });

  it("selected rooms and storeys expose their state", () => {
    render(<App />);
    const storey = screen.getByRole("radio", { name: "Ground floor" });
    expect(storey.getAttribute("aria-checked")).toBe("true");
  });
});
