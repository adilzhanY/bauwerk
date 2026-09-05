import type { Construction, ConstructionCategory } from "./types";

/**
 * Default construction presets. Ids are stable so files written before the
 * energy layer existed can be migrated onto them. U-values are typical German
 * values by construction period, in W/(m²K), rounded; they are starting points
 * the user edits, not survey data.
 */
export const PRESET_IDS = {
  wallBrick: "c_wall_brick",
  wall1970: "c_wall_1970",
  wallInsulated: "c_wall_insulated",
  glazingSingle: "c_glazing_single",
  glazingDouble: "c_glazing_double",
  glazingTriple: "c_glazing_triple",
  doorOld: "c_door_old",
  doorInsulated: "c_door_insulated",
  floorBare: "c_floor_bare",
  floorInsulated: "c_floor_insulated",
  roofBare: "c_roof_bare",
  roofInsulated: "c_roof_insulated",
} as const;

type PresetKey = keyof typeof PRESET_IDS;

const presetDefs: Record<
  PresetKey,
  { category: ConstructionCategory; uValue: number; en: string; de: string }
> = {
  wallBrick: {
    category: "wall",
    uValue: 1.4,
    en: "Brick wall, uninsulated",
    de: "Ziegelwand, ungedämmt",
  },
  wall1970: { category: "wall", uValue: 1.0, en: "Wall, 1970s", de: "Wand, 1970er" },
  wallInsulated: { category: "wall", uValue: 0.25, en: "Wall, insulated", de: "Wand, gedämmt" },
  glazingSingle: { category: "window", uValue: 5.0, en: "Single glazing", de: "Einfachverglasung" },
  glazingDouble: {
    category: "window",
    uValue: 2.8,
    en: "Double glazing",
    de: "Zweifachverglasung",
  },
  glazingTriple: {
    category: "window",
    uValue: 0.8,
    en: "Triple glazing",
    de: "Dreifachverglasung",
  },
  doorOld: { category: "door", uValue: 3.0, en: "Door, old", de: "Tür, alt" },
  doorInsulated: { category: "door", uValue: 1.3, en: "Door, insulated", de: "Tür, gedämmt" },
  floorBare: {
    category: "floor",
    uValue: 1.0,
    en: "Floor slab, uninsulated",
    de: "Bodenplatte, ungedämmt",
  },
  floorInsulated: {
    category: "floor",
    uValue: 0.35,
    en: "Floor slab, insulated",
    de: "Bodenplatte, gedämmt",
  },
  roofBare: { category: "roof", uValue: 1.3, en: "Roof, uninsulated", de: "Dach, ungedämmt" },
  roofInsulated: { category: "roof", uValue: 0.2, en: "Roof, insulated", de: "Dach, gedämmt" },
};

export function defaultConstructions(language: "en" | "de"): Construction[] {
  return (Object.keys(presetDefs) as PresetKey[]).map((key) => {
    const def = presetDefs[key];
    return { id: PRESET_IDS[key], name: def[language], category: def.category, uValue: def.uValue };
  });
}

/** Default assignment for a building that has no energy data yet: the uninsulated stock. */
export const DEFAULT_ASSIGNMENT = {
  wallConstructionId: PRESET_IDS.wallBrick,
  floorConstructionId: PRESET_IDS.floorBare,
  roofConstructionId: PRESET_IDS.roofBare,
  windowConstructionId: PRESET_IDS.glazingDouble,
  doorConstructionId: PRESET_IDS.doorOld,
} as const;

/** The construction with the lowest U-value in the same category: the "after renovation" choice. */
export function bestInCategory(
  all: readonly Construction[],
  category: ConstructionCategory,
): Construction | undefined {
  return all
    .filter((c) => c.category === category)
    .reduce<Construction | undefined>(
      (best, c) => (best === undefined || c.uValue < best.uValue ? c : best),
      undefined,
    );
}

export function findConstruction(
  all: readonly Construction[],
  id: string,
): Construction | undefined {
  return all.find((c) => c.id === id);
}
