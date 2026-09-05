import { describe, expect, it } from "vitest";
import { CURSORS, CURSOR_SIZE, cursorCss, cursorUrl, installCursors } from "./cursors";

describe("cursors", () => {
  it("every cursor is valid SVG with a hotspot inside its 24 px box", () => {
    expect(CURSORS.map((c) => c.name)).toEqual([
      "default",
      "pointer",
      "grab",
      "grabbing",
      "crosshair",
      "ew-resize",
      "text",
      "not-allowed",
    ]);
    for (const c of CURSORS) {
      const doc = new DOMParser().parseFromString(c.svg, "image/svg+xml");
      expect(doc.querySelector("parsererror"), c.name).toBeNull();
      expect(doc.documentElement.tagName).toBe("svg");
      expect(c.hotspot[0]).toBeGreaterThanOrEqual(0);
      expect(c.hotspot[0]).toBeLessThan(24);
      expect(c.hotspot[1]).toBeGreaterThanOrEqual(0);
      expect(c.hotspot[1]).toBeLessThan(24);
      const url = cursorUrl(c);
      expect(url).toMatch(/^url\("data:image\/svg\+xml,.*"\) \d+ \d+, [a-z-]+$/);
      const [hx, hy] = /"\) (\d+) (\d+),/.exec(url)!.slice(1, 3).map(Number);
      expect(hx).toBeLessThan(CURSOR_SIZE);
      expect(hy).toBeLessThan(CURSOR_SIZE);
      expect(decodeURIComponent(url)).toContain(`width="${CURSOR_SIZE}"`);
    }
  });

  it("the stylesheet maps roles and tool states and installs once", () => {
    const css = cursorCss();
    expect(css).toContain('[role="slider"]');
    expect(css).toContain("canvas:active { cursor: var(--cursor-grabbing); }");
    expect(css).toContain('[data-tool="measure"] canvas');
    expect(css).toContain(":disabled");
    installCursors();
    installCursors();
    expect(document.querySelectorAll("#bauwerk-cursors")).toHaveLength(1);
  });
});
