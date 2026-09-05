import { describe, expect, it } from "vitest";
import { daylight, formatClock, germanUtcOffsetHours, instantFor, sunAt } from "./sunTime";

describe("German local time helpers", () => {
  it("switches between CET and CEST at the last Sundays of March and October", () => {
    expect(germanUtcOffsetHours(15, 2026)).toBe(1); // January
    expect(germanUtcOffsetHours(172, 2026)).toBe(2); // June
    expect(germanUtcOffsetHours(355, 2026)).toBe(1); // December
    // 2026: DST starts 29 March (day 88) and ends 25 October (day 298).
    expect(germanUtcOffsetHours(87, 2026)).toBe(1);
    expect(germanUtcOffsetHours(88, 2026)).toBe(2);
    expect(germanUtcOffsetHours(297, 2026)).toBe(2);
    expect(germanUtcOffsetHours(298, 2026)).toBe(1);
  });

  it("builds the UTC instant from local minutes and finds the sun high at 14:00 CEST in June", () => {
    const d = instantFor(172, 14 * 60, 2026);
    expect(d.getUTCHours()).toBe(12);
    const sun = sunAt(172, 13 * 60 + 6, 52.52, 13.405);
    expect(sun.elevation).toBeGreaterThan(60);
    expect(formatClock(14 * 60 + 5)).toBe("14:05");
    const dl = daylight(172, 52.52, 13.405)!;
    expect(formatClock(dl.sunrise)).toMatch(/^04:4\d$/);
    expect(formatClock(dl.sunset)).toMatch(/^21:3\d$/);
  });
});
