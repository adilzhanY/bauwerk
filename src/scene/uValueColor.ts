/** Colour for a U-value: green at 0.2 or better, red at 1.5 or worse. */
export function uValueColor(u: number): string {
  const t = Math.min(1, Math.max(0, (u - 0.2) / 1.3));
  const r = Math.round(60 + t * 180);
  const g = Math.round(200 - t * 150);
  return `rgb(${r}, ${g}, 70)`;
}
