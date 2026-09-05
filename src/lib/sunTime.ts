import { sunPosition, sunriseSunset } from "@/geometry/sun";
import type { SunPosition } from "@/geometry/sun";

export const BERLIN_FALLBACK = { lat: 52.516275, lon: 13.377704 };

/** Local time in Germany: CEST from the last Sunday of March to the last Sunday of October, else CET. */
export function germanUtcOffsetHours(dayOfYear: number, year: number): number {
  const date = dateFromDay(year, dayOfYear);
  const lastSunday = (month: number) => {
    const d = new Date(Date.UTC(year, month + 1, 0));
    return new Date(Date.UTC(year, month, d.getUTCDate() - d.getUTCDay()));
  };
  const start = lastSunday(2);
  const end = lastSunday(9);
  return date >= start && date < end ? 2 : 1;
}

export function dateFromDay(year: number, dayOfYear: number): Date {
  return new Date(Date.UTC(year, 0, 1) + (dayOfYear - 1) * 86400000);
}

/** Builds the UTC instant for a day of the year and local minutes past midnight. */
export function instantFor(
  dayOfYear: number,
  localMinutes: number,
  year = new Date().getUTCFullYear(),
): Date {
  const offset = germanUtcOffsetHours(dayOfYear, year);
  const day = dateFromDay(year, dayOfYear);
  return new Date(day.getTime() + (localMinutes - offset * 60) * 60000);
}

export function sunAt(
  dayOfYear: number,
  localMinutes: number,
  lat: number,
  lon: number,
): SunPosition {
  return sunPosition(instantFor(dayOfYear, localMinutes), lat, lon);
}

/** Sunrise and sunset as local minutes for the day. */
export function daylight(
  dayOfYear: number,
  lat: number,
  lon: number,
): { sunrise: number; sunset: number } | null {
  const year = new Date().getUTCFullYear();
  const r = sunriseSunset(dateFromDay(year, dayOfYear), lat, lon);
  if (!r) return null;
  const offset = germanUtcOffsetHours(dayOfYear, year) * 60;
  return { sunrise: r.sunrise + offset, sunset: r.sunset + offset };
}

export const formatClock = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function formatDay(dayOfYear: number, language: "en" | "de"): string {
  const d = dateFromDay(new Date().getUTCFullYear(), dayOfYear);
  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(d);
}
