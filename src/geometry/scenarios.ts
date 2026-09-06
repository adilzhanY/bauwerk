import { bestInCategory } from "./constructions";
import { computeEnergy } from "./energy";
import type { EnergySummary } from "./energy";
import { buildRoof } from "./roof";
import type { Building, Construction, ConstructionCategory, Scenario } from "./types";

/**
 * Renovation scenarios are override sets on top of the current building: which
 * construction each category uses, the thermal bridge detailing, and optionally
 * the roof. A change to the baseline flows into every variant.
 *
 * Costs are rough gross prices per square metre of element for the German
 * market in 2025, in the range of the BKI Baukosten index and public renovation
 * cost guides; they are starting points a consultant replaces, marked as such.
 * Saving per year is the heating demand difference times an energy price.
 */

export type { Scenario };

export interface ScenarioResult {
  scenario: Scenario;
  energy: EnergySummary;
  /** Euro. */
  investment: number;
  /** Euro per year against the baseline. */
  savingPerYear: number;
  /** Years, Infinity when nothing is saved. */
  payback: number;
  /** kWh/a saved. */
  demandSaved: number;
}

/** €/m² installed, by construction preset id. Unknown ids cost the category default. */
export const CONSTRUCTION_COST: Record<string, number> = {
  c_wall_insulated: 180,
  c_wall_1970: 120,
  c_roof_insulated: 200,
  c_floor_insulated: 90,
  c_glazing_triple: 700,
  c_glazing_double: 500,
  c_door_insulated: 2200,
};
export const CATEGORY_DEFAULT_COST: Record<ConstructionCategory, number> = {
  wall: 170,
  roof: 190,
  floor: 90,
  window: 600,
  door: 2000,
};
export const ENERGY_PRICE_PER_KWH = 0.12;

export function costOf(construction: Construction): number {
  return CONSTRUCTION_COST[construction.id] ?? CATEGORY_DEFAULT_COST[construction.category];
}

const keyOf: Record<ConstructionCategory, keyof Building> = {
  wall: "wallConstructionId",
  floor: "floorConstructionId",
  roof: "roofConstructionId",
  window: "windowConstructionId",
  door: "doorConstructionId",
};

/** The building with the scenario's overrides applied. */
export function applyScenario(building: Building, scenario: Scenario): Building {
  const b: Building = {
    ...building,
    storeys: building.storeys.map((s) => ({ ...s, openings: s.openings.map((o) => ({ ...o })) })),
  };
  for (const category of ["wall", "floor", "roof"] as const) {
    const id = scenario.overrides[category];
    if (id && b.constructions.some((c) => c.id === id))
      (b as unknown as Record<string, unknown>)[keyOf[category]] = id;
  }
  for (const kind of ["window", "door"] as const) {
    const id = scenario.overrides[kind];
    if (!id || !b.constructions.some((c) => c.id === id)) continue;
    (b as unknown as Record<string, unknown>)[keyOf[kind]] = id;
    for (const s of b.storeys)
      for (const o of s.openings) if (o.kind === kind) o.constructionId = id;
  }
  if (scenario.bridgeDetail) b.bridgeDetail = scenario.bridgeDetail;
  if (scenario.roof) b.roof = { ...building.roof, ...scenario.roof };
  return b;
}

/** The built-in "full envelope" variant: best construction in every category and good details. */
export function fullEnvelopeScenario(building: Building): Scenario {
  const overrides: Scenario["overrides"] = {};
  for (const c of ["wall", "floor", "roof", "window", "door"] as const) {
    const best = bestInCategory(building.constructions, c);
    if (best) overrides[c] = best.id;
  }
  return { id: "full-envelope", name: "Full envelope", overrides, bridgeDetail: "good" };
}

export function evaluateScenario(
  building: Building,
  scenario: Scenario,
  baseline = computeEnergy(building),
): ScenarioResult {
  const variant = applyScenario(building, scenario);
  const energy = computeEnergy(variant);
  const investment = investmentOf(building, variant);
  const demandSaved = Math.max(0, baseline.heatingDemand - energy.heatingDemand);
  const savingPerYear = demandSaved * ENERGY_PRICE_PER_KWH;
  return {
    scenario,
    energy,
    investment,
    savingPerYear,
    payback: savingPerYear > 0 ? investment / savingPerYear : Infinity,
    demandSaved,
  };
}

/** Sum over changed categories of element area times the new construction's cost. */
export function investmentOf(baseline: Building, variant: Building): number {
  const energy = computeEnergy(variant);
  const changed = (category: ConstructionCategory) =>
    (baseline as unknown as Record<string, string>)[keyOf[category]] !==
    (variant as unknown as Record<string, string>)[keyOf[category]];
  const construction = (id: string) => variant.constructions.find((c) => c.id === id);
  let total = 0;
  if (changed("wall"))
    total +=
      energy.wallNetArea *
      costOf(
        construction(variant.wallConstructionId) ?? {
          id: "",
          name: "",
          category: "wall",
          uValue: 1,
        },
      );
  if (changed("roof"))
    total +=
      buildRoof(variant, 0).area *
      costOf(
        construction(variant.roofConstructionId) ?? {
          id: "",
          name: "",
          category: "roof",
          uValue: 1,
        },
      );
  if (changed("floor"))
    total +=
      (energy.storeys[0]?.floorArea ?? 0) *
      costOf(
        construction(variant.floorConstructionId) ?? {
          id: "",
          name: "",
          category: "floor",
          uValue: 1,
        },
      );
  if (changed("window"))
    total +=
      energy.windowArea *
      costOf(
        construction(variant.windowConstructionId) ?? {
          id: "",
          name: "",
          category: "window",
          uValue: 1,
        },
      );
  if (changed("door")) {
    const doors = variant.storeys.reduce(
      (n, s) => n + s.openings.filter((o) => o.kind === "door").length,
      0,
    );
    total +=
      doors *
      costOf(
        construction(variant.doorConstructionId) ?? {
          id: "",
          name: "",
          category: "door",
          uValue: 1,
        },
      );
  }
  return Math.round(total);
}

export function evaluateAll(building: Building): ScenarioResult[] {
  const baseline = computeEnergy(building);
  const list = [fullEnvelopeScenario(building), ...(building.scenarios ?? [])];
  return list.map((s) => evaluateScenario(building, s, baseline));
}

export interface RoadmapStep {
  index: number;
  scenario: Scenario;
  /** Years after the start; the first step is year 0. */
  year: number;
  /** The building after this and all earlier steps. */
  energy: EnergySummary;
  /** Euro for this step alone. */
  investment: number;
  /** Euro for this and all earlier steps. */
  cumulativeInvestment: number;
  /** Euro per year against the original building, after this step. */
  savingPerYear: number;
  /** kWh/a this step saves against the previous one. */
  demandSaved: number;
}

/**
 * A renovation roadmap in the manner of the individueller Sanierungsfahrplan
 * (iSFP): the saved scenarios ordered by their own payback, cheapest win first,
 * applied one after another so every step shows the building as it will be
 * after everything before it. Later overrides win over earlier ones. Without
 * saved scenarios the full envelope variant is the single step.
 */
export function buildRoadmap(building: Building, yearsBetweenSteps = 3): RoadmapStep[] {
  const baseline = computeEnergy(building);
  const own = building.scenarios ?? [];
  const ordered =
    own.length === 0
      ? [fullEnvelopeScenario(building)]
      : [...own].sort(
          (a, b) =>
            evaluateScenario(building, a, baseline).payback -
            evaluateScenario(building, b, baseline).payback,
        );
  const steps: RoadmapStep[] = [];
  let current = building;
  let previousEnergy = baseline;
  let cumulative = 0;
  ordered.forEach((scenario, index) => {
    const next = applyScenario(current, scenario);
    const energy = computeEnergy(next);
    const investment = investmentOf(current, next);
    cumulative += investment;
    steps.push({
      index,
      scenario,
      year: index * yearsBetweenSteps,
      energy,
      investment,
      cumulativeInvestment: cumulative,
      savingPerYear:
        Math.max(0, baseline.heatingDemand - energy.heatingDemand) * ENERGY_PRICE_PER_KWH,
      demandSaved: Math.max(0, previousEnergy.heatingDemand - energy.heatingDemand),
    });
    current = next;
    previousEnergy = energy;
  });
  return steps;
}
