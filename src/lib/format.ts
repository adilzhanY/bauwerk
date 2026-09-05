import type { Language } from "@/i18n";

const locale = (language: Language) => (language === "de" ? "de-DE" : "en-GB");

export function formatNumber(value: number, language: Language, digits = 2): string {
  return new Intl.NumberFormat(locale(language), {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export const formatMetres = (value: number, language: Language): string =>
  `${formatNumber(value, language, 2)} m`;

export const formatArea = (value: number, language: Language): string =>
  `${formatNumber(value, language, 2)} m²`;

/** Parses a number typed in the locale's format. Accepts both comma and dot. */
export function parseNumber(text: string): number | null {
  const normalised = text.trim().replace(/\s/g, "").replace(",", ".");
  if (normalised === "") return null;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}
