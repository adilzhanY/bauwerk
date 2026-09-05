import { useMemo } from "react";
import { bestInCategory } from "@/geometry/constructions";
import { ENERGY_CLASS_COLORS, computeEnergy } from "@/geometry/energy";
import type { EnergyClass, EnergySummary, Orientation } from "@/geometry/energy";
import type { ConstructionCategory } from "@/geometry/types";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n";
import { formatArea, formatNumber } from "@/lib/format";
import { useEditorStore } from "@/store/building";
import type { ConstructionTarget } from "@/store/building";
import { ReadOnly } from "./controls/Field";
import { NumberField } from "./controls/NumberField";
import { Select } from "./controls/Select";

const CLASSES: EnergyClass[] = ["A+", "A", "B", "C", "D", "E", "F", "G", "H"];

const categoryKey: Record<ConstructionCategory | "interiorWall", MessageKey> = {
  wall: "category.wall",
  window: "category.window",
  door: "category.door",
  floor: "category.floor",
  roof: "category.roof",
  interiorWall: "category.interiorWall",
};

/** Shown in the right panel when nothing is selected. */
export function EnergyPanel() {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const building = useEditorStore((s) => s.building);
  const renovated = useEditorStore((s) => s.renovatedView);
  const setRenovatedView = useEditorStore((s) => s.setRenovatedView);

  const current = useMemo(() => computeEnergy(building), [building]);
  const after = useMemo(() => computeEnergy(building, { renovated: true }), [building]);
  const shown = renovated ? after : current;
  const saving = current.heatingDemand > 0 ? 1 - after.heatingDemand / current.heatingDemand : 0;

  const num = (v: number, digits = 1) => formatNumber(v, language, digits);
  const pct = (v: number) => `${num(v * 100, 0)} %`;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label={t("energy.title")}
        className="grid grid-cols-2 gap-1 rounded border border-border p-1"
      >
        {([false, true] as const).map((on) => (
          <button
            key={String(on)}
            type="button"
            role="radio"
            aria-checked={renovated === on}
            onClick={() => {
              setRenovatedView(on);
            }}
            className={`h-7 rounded text-sm ${renovated === on ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"}`}
          >
            {t(on ? "energy.scenario.renovated" : "energy.scenario.current")}
          </button>
        ))}
      </div>

      <ClassBand value={shown.energyClass} />
      <div className="grid grid-cols-2 gap-2">
        <Big
          label={t("energy.specificHeatingDemand")}
          value={num(shown.specificHeatingDemand, 0)}
          unit="kWh/(m²a)"
        />
        <Big label={t("energy.heatingDemand")} value={num(shown.heatingDemand, 0)} unit="kWh/a" />
      </div>
      {renovated && current.heatingDemand > 0 && (
        <ReadOnly label={t("energy.saving")} value={pct(saving)} />
      )}
      <p className="text-xs leading-relaxed text-muted">{t("energy.scenario.hint")}</p>

      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <ReadOnly
          label={t("energy.transmissionLoss")}
          value={`${num(shown.transmissionLoss)} W/K`}
        />
        <ReadOnly
          label={t("energy.specificTransmissionLoss")}
          value={`${num(shown.specificTransmissionLoss, 2)} W/(m²K)`}
        />
        <ReadOnly label={t("energy.ventilationLoss")} value={`${num(shown.ventilationLoss)} W/K`} />
        <ReadOnly
          label={t("energy.envelopeArea")}
          value={formatArea(shown.envelopeArea, language)}
        />
        <ReadOnly label={t("energy.wallArea")} value={formatArea(shown.wallNetArea, language)} />
        <ReadOnly label={t("energy.windowArea")} value={formatArea(shown.windowArea, language)} />
        <ReadOnly label={t("energy.doorArea")} value={formatArea(shown.doorArea, language)} />
        <ReadOnly label={t("energy.windowToWall")} value={pct(shown.windowToWallRatio)} />
        <ReadOnly
          label={t("energy.heatedFloorArea")}
          value={formatArea(shown.heatedFloorArea, language)}
        />
        <ReadOnly label={t("energy.heatedVolume")} value={`${num(shown.heatedVolume)} m³`} />
      </div>

      <Orientations summary={shown} />
      <Zones summary={shown} />
      <Assignments />
      <Constructions />
      <p className="text-xs leading-relaxed text-muted">{t("energy.assumptions")}</p>
    </div>
  );
}

function ClassBand({ value }: { value: EnergyClass }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{t("energy.energyClass")}</span>
      <div className="flex gap-0.5" aria-label={`${t("energy.energyClass")}: ${value}`}>
        {CLASSES.map((c) => (
          <div
            key={c}
            className={`flex h-7 flex-1 items-center justify-center rounded-sm font-mono text-xs ${c === value ? "ring-2 ring-fg" : "opacity-50"}`}
            style={{ background: ENERGY_CLASS_COLORS[c], color: "#0f1115" }}
          >
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

function Big({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded border border-border bg-bg p-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-mono text-xl text-fg">{value}</div>
      <div className="text-xs text-muted">{unit}</div>
    </div>
  );
}

function Orientations({ summary }: { summary: EnergySummary }) {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const totals: Record<Orientation, { wall: number; window: number }> = {
    N: { wall: 0, window: 0 },
    E: { wall: 0, window: 0 },
    S: { wall: 0, window: 0 },
    W: { wall: 0, window: 0 },
  };
  for (const s of summary.storeys) {
    for (const o of ["N", "E", "S", "W"] as const) {
      totals[o].wall += s.windowToWall[o].wall;
      totals[o].window += s.windowToWall[o].window;
    }
  }
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      <span className="text-xs font-medium text-muted">{t("energy.byOrientation")}</span>
      {(["N", "E", "S", "W"] as const).map((o) => {
        const b = totals[o];
        const ratio = b.wall > 0 ? b.window / b.wall : 0;
        return (
          <ReadOnly
            key={o}
            label={t(`orientation.${o}`)}
            value={`${formatArea(b.window, language)} (${formatNumber(ratio * 100, language, 0)} %)`}
          />
        );
      })}
    </div>
  );
}

function Zones({ summary }: { summary: EnergySummary }) {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const zones = useEditorStore((s) => s.building.zones);
  if (summary.zones.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      <span className="text-xs font-medium text-muted">{t("energy.byZone")}</span>
      {summary.zones.map((z) => {
        const zone = zones.find((x) => x.id === z.zoneId);
        return (
          <div
            key={z.zoneId ?? "none"}
            className="flex items-baseline justify-between gap-2 text-xs"
          >
            <span className="flex items-center gap-1.5 text-muted">
              {zone && <span className="h-2 w-2 rounded-full" style={{ background: zone.color }} />}
              {zone?.name ?? t("zone.none")}
            </span>
            <span className="font-mono text-fg">
              {formatArea(z.floorArea, language)} · {formatNumber(z.transmissionLoss, language, 1)}{" "}
              W/K
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Assignments() {
  const t = useT();
  const building = useEditorStore((s) => s.building);
  const assign = useEditorStore((s) => s.assignConstruction);
  const options = (category: ConstructionCategory) =>
    building.constructions
      .filter((c) => c.category === category)
      .map((c) => ({ value: c.id, label: `${c.name} (${c.uValue})` }));
  const rows: {
    label: MessageKey;
    target: ConstructionTarget;
    category: ConstructionCategory;
    value: string;
  }[] = [
    {
      label: "energy.wallConstruction",
      target: { kind: "wall" },
      category: "wall",
      value: building.wallConstructionId,
    },
    {
      label: "energy.floorConstruction",
      target: { kind: "floor" },
      category: "floor",
      value: building.floorConstructionId,
    },
    {
      label: "energy.roofConstruction",
      target: { kind: "roof" },
      category: "roof",
      value: building.roofConstructionId,
    },
    {
      label: "energy.windowDefault",
      target: { kind: "window" },
      category: "window",
      value: building.windowConstructionId,
    },
    {
      label: "energy.doorDefault",
      target: { kind: "door" },
      category: "door",
      value: building.doorConstructionId,
    },
  ];
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      {rows.map((r) => (
        <Select
          key={r.label}
          label={t(r.label)}
          value={r.value}
          options={options(r.category)}
          onChange={(id) => {
            assign(r.target, id);
          }}
        />
      ))}
    </div>
  );
}

function Constructions() {
  const t = useT();
  const constructions = useEditorStore((s) => s.building.constructions);
  const update = useEditorStore((s) => s.updateConstruction);
  return (
    <details className="border-t border-border pt-3">
      <summary className="cursor-pointer text-xs font-medium text-muted">
        {t("energy.constructions")} ({t("energy.uValue")}, {t("energy.uValueUnit")})
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        {constructions.map((c) => (
          <NumberField
            key={c.id}
            label={`${t(categoryKey[c.category])}: ${c.name}`}
            value={c.uValue}
            min={0.1}
            max={6}
            step={0.05}
            slider={false}
            onCommit={(uValue) => {
              update(c.id, { uValue });
            }}
          />
        ))}
      </div>
    </details>
  );
}

/** Construction picker for one opening or the wall, with the resulting U·A. */
export function ConstructionSelect({
  category,
  value,
  area,
  target,
}: {
  category: ConstructionCategory;
  value: string;
  area: number;
  target: ConstructionTarget;
}) {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const constructions = useEditorStore((s) => s.building.constructions);
  const assign = useEditorStore((s) => s.assignConstruction);
  const chosen =
    constructions.find((c) => c.id === value) ?? bestInCategory(constructions, category);
  return (
    <>
      <Select
        label={t("energy.construction")}
        value={value}
        options={constructions
          .filter((c) => c.category === category)
          .map((c) => ({ value: c.id, label: `${c.name} (${c.uValue})` }))}
        onChange={(id) => {
          assign(target, id);
        }}
      />
      <ReadOnly
        label={t("energy.elementLoss")}
        value={`${formatNumber((chosen?.uValue ?? 0) * area, language, 2)} W/K`}
      />
    </>
  );
}
