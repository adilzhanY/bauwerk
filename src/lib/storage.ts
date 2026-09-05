import { fromJson, toJson } from "@/geometry/export";
import type { Building } from "@/geometry/types";
import type { Language } from "@/i18n";

const BUILDING_KEY = "bauwerk.building";
const LANGUAGE_KEY = "bauwerk.language";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadLanguage(): Language | null {
  const v = storage()?.getItem(LANGUAGE_KEY);
  return v === "en" || v === "de" ? v : null;
}

export function saveLanguage(language: Language): void {
  storage()?.setItem(LANGUAGE_KEY, language);
}

/** Returns the autosaved building, or null when there is none or it fails validation. */
export function loadBuilding(): Building | null {
  const text = storage()?.getItem(BUILDING_KEY);
  if (!text) return null;
  const result = fromJson(text);
  return result.ok ? result.building : null;
}

export function saveBuilding(building: Building): void {
  storage()?.setItem(BUILDING_KEY, toJson(building));
}

export function clearBuilding(): void {
  storage()?.removeItem(BUILDING_KEY);
}
