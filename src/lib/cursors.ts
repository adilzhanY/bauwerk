/**
 * Cursor set in the Figma style: a black shape with a white outline, drawn as
 * SVG and applied through CSS variables. Each entry has a hotspot in CSS pixels
 * inside its 24 by 24 box. The CSS built here is injected once at startup.
 */

export interface CursorDef {
  name: string;
  svg: string;
  hotspot: [number, number];
  /** Native fallback when the image cannot load. */
  fallback: string;
}

const outline = 'stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"';
const fill = 'fill="#111111"';
const wrap = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`;

export const CURSORS: CursorDef[] = [
  {
    name: "default",
    svg: wrap(
      `<path d="M5 3 L5 19 L9.5 15 L12.5 21.5 L15.5 20 L12.5 13.5 L18 13.5 Z" ${fill} ${outline}/>`,
    ),
    hotspot: [5, 3],
    fallback: "default",
  },
  {
    name: "pointer",
    svg: wrap(
      `<path d="M9 3.5 C9 2.7 9.7 2 10.5 2 C11.3 2 12 2.7 12 3.5 L12 10 L13 10 L13 9 C13 8.2 13.7 7.5 14.5 7.5 C15.3 7.5 16 8.2 16 9 L16 10.5 L17 10.5 C17 9.7 17.7 9 18.5 9 C19.3 9 20 9.7 20 10.5 L20 16 C20 19.3 17.3 22 14 22 L12.5 22 C10.3 22 8.6 20.9 7.4 19.2 L4.3 14.6 C3.8 13.9 4 12.9 4.7 12.4 C5.4 11.9 6.3 12.1 6.8 12.8 L9 15.5 Z" ${fill} ${outline}/>`,
    ),
    hotspot: [10, 2],
    fallback: "pointer",
  },
  {
    name: "grab",
    svg: wrap(
      `<path d="M7 11 L7 7.5 C7 6.7 7.7 6 8.5 6 C9.3 6 10 6.7 10 7.5 L10 10 L10 5 C10 4.2 10.7 3.5 11.5 3.5 C12.3 3.5 13 4.2 13 5 L13 10 L13 6 C13 5.2 13.7 4.5 14.5 4.5 C15.3 4.5 16 5.2 16 6 L16 10.5 L16 8 C16 7.2 16.7 6.5 17.5 6.5 C18.3 6.5 19 7.2 19 8 L19 15 C19 18.9 16.3 22 12.5 22 C10 22 8.3 21 7 19 L4.5 15.2 C4 14.5 4.2 13.5 4.9 13 C5.6 12.5 6.5 12.7 7 13.4 Z" ${fill} ${outline}/>`,
    ),
    hotspot: [12, 12],
    fallback: "grab",
  },
  {
    name: "grabbing",
    svg: wrap(
      `<path d="M7 13 L7 11 C7 10.2 7.7 9.5 8.5 9.5 C9.3 9.5 10 10.2 10 11 L10 10 C10 9.2 10.7 8.5 11.5 8.5 C12.3 8.5 13 9.2 13 10 L13 10.5 C13 9.7 13.7 9 14.5 9 C15.3 9 16 9.7 16 10.5 L16 11 C16 10.2 16.7 9.5 17.5 9.5 C18.3 9.5 19 10.2 19 11 L19 15.5 C19 19.1 16.3 22 12.5 22 C10 22 8.3 21 7 19 L5 16.2 C4.5 15.5 4.7 14.5 5.4 14 C6.1 13.5 7 13.7 7.5 14.4 Z" ${fill} ${outline}/>`,
    ),
    hotspot: [12, 14],
    fallback: "grabbing",
  },
  {
    name: "crosshair",
    svg: wrap(
      `<g ${outline} ${fill}><rect x="11" y="2" width="2" height="7" rx="1"/><rect x="11" y="15" width="2" height="7" rx="1"/><rect x="2" y="11" width="7" height="2" rx="1"/><rect x="15" y="11" width="7" height="2" rx="1"/><circle cx="12" cy="12" r="1.5"/></g>`,
    ),
    hotspot: [12, 12],
    fallback: "crosshair",
  },
  {
    name: "ew-resize",
    svg: wrap(
      `<path d="M2 12 L7 7.5 L7 10.5 L17 10.5 L17 7.5 L22 12 L17 16.5 L17 13.5 L7 13.5 L7 16.5 Z" ${fill} ${outline}/>`,
    ),
    hotspot: [12, 12],
    fallback: "ew-resize",
  },
  {
    name: "text",
    svg: wrap(
      `<path d="M9 3 L11 3 L11 4.5 L12 5 L13 4.5 L13 3 L15 3 L15 5 L13.5 5 L13.5 19 L15 19 L15 21 L13 21 L13 19.5 L12 19 L11 19.5 L11 21 L9 21 L9 19 L10.5 19 L10.5 5 L9 5 Z" ${fill} ${outline}/>`,
    ),
    hotspot: [12, 12],
    fallback: "text",
  },
  {
    name: "not-allowed",
    svg: wrap(
      `<g fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M6.5 6.5 L17.5 17.5"/></g><g fill="none" stroke="#111111" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M6.5 6.5 L17.5 17.5"/></g>`,
    ),
    hotspot: [12, 12],
    fallback: "not-allowed",
  },
];

export function cursorUrl(def: CursorDef): string {
  const encoded = encodeURIComponent(def.svg)
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
  return `url("data:image/svg+xml,${encoded}") ${def.hotspot[0]} ${def.hotspot[1]}, ${def.fallback}`;
}

/** CSS that defines the cursor variables and applies them by role and state. */
export function cursorCss(): string {
  const vars = CURSORS.map((c) => `  --cursor-${c.name}: ${cursorUrl(c)};`).join("\n");
  return `:root {
${vars}
}
html, body, * { cursor: var(--cursor-default); }
a, button:not(:disabled), summary, label[for],
[role="button"], [role="option"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="combobox"], [role="slider"],
[role="radio"] *, [role="checkbox"] *, [role="switch"] *, button:not(:disabled) * { cursor: var(--cursor-pointer); }
input[type="text"], input[type="text"] * , textarea { cursor: var(--cursor-text); }
.cursor-scrub, .cursor-scrub *, [data-active="true"][role="slider"], [data-active="true"][role="slider"] * { cursor: var(--cursor-ew-resize); }
:disabled, :disabled *, [aria-disabled="true"], [aria-disabled="true"] * { cursor: var(--cursor-not-allowed); }
canvas { cursor: var(--cursor-grab); }
canvas:active { cursor: var(--cursor-grabbing); }
[data-tool="footprint"] canvas, [data-tool="opening"] canvas, [data-tool="interiorWall"] canvas, [data-tool="measure"] canvas { cursor: var(--cursor-crosshair); }
[data-tool="footprint"] canvas:active, [data-tool="opening"] canvas:active, [data-tool="interiorWall"] canvas:active, [data-tool="measure"] canvas:active { cursor: var(--cursor-crosshair); }
`;
}

/** Injects the cursor stylesheet once. */
export function installCursors(): void {
  if (typeof document === "undefined" || document.getElementById("bauwerk-cursors")) return;
  const style = document.createElement("style");
  style.id = "bauwerk-cursors";
  style.textContent = cursorCss();
  document.head.appendChild(style);
}
