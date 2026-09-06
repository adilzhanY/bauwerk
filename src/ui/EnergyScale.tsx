import {
  ENERGY_CLASSES,
  ENERGY_CLASS_COLORS,
  ENERGY_CLASS_UPPER,
  ENERGY_SCALE_MAX,
} from "@/geometry/energy";
import type { EnergySummary } from "@/geometry/energy";
import { useT } from "@/i18n/useT";
import { formatNumber } from "@/lib/format";
import { useEditorStore } from "@/store/building";

interface Props {
  current: EnergySummary;
  /** Second marker below the band, for a scenario. */
  compare?: EnergySummary;
  compareLabel?: string;
  /** Print draws in black on white; the panel uses the theme colours. */
  variant: "panel" | "print";
}

/**
 * The coloured band of the German Energieausweis with a marker for the current
 * state above and, optionally, a scenario below. Values past 300 sit at the end.
 * The accessible name carries the class of the scenario when one is shown.
 */
export function EnergyScale({ current, compare, compareLabel, variant }: Props) {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const num = (v: number) =>
    variant === "print" ? formatNumber(v, "de", 0) : formatNumber(v, language, 0);
  const w = 560;
  const h = compare ? 82 : 60;
  const barY = 26;
  const barH = 18;
  const ink = variant === "print" ? "#000" : "currentColor";
  const x = (v: number) => (Math.min(v, ENERGY_SCALE_MAX) / ENERGY_SCALE_MAX) * w;
  const segments = ENERGY_CLASSES.map((c, i) => ({
    c,
    x0: x(i === 0 ? 0 : (ENERGY_CLASS_UPPER[i - 1] ?? 0)),
    x1: x(ENERGY_CLASS_UPPER[i] ?? ENERGY_SCALE_MAX),
  }));
  const ticks = [0, 50, 100, 150, 200, 250, 300];
  const marker = (v: number, label: string, above: boolean) => {
    const px = Math.max(24, Math.min(w - 24, x(v)));
    const y = above ? barY - 3 : barY + barH + 3;
    const dir = above ? -1 : 1;
    return (
      <g key={label}>
        <path d={`M${x(v)} ${y} l${-5} ${dir * 7} h10 z`} fill={ink} />
        <text
          x={px}
          y={above ? y - 10 : y + 17}
          fontSize="10"
          fontWeight="600"
          textAnchor="middle"
          fill={ink}
        >
          {label}: {num(v)}
        </text>
      </g>
    );
  };
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: "100%", display: "block" }}
      role="img"
      aria-label={`${t("energy.energyClass")}: ${(compare ?? current).energyClass}`}
      className={variant === "panel" ? "text-ink" : undefined}
    >
      {segments.map((s) => (
        <g key={s.c}>
          <rect
            x={s.x0}
            y={barY}
            width={s.x1 - s.x0}
            height={barH}
            fill={ENERGY_CLASS_COLORS[s.c]}
            stroke={variant === "print" ? "#000" : "none"}
            strokeWidth="0.5"
          />
          <text
            x={(s.x0 + s.x1) / 2}
            y={barY + barH - 5}
            fontSize="9.5"
            fontWeight="600"
            textAnchor="middle"
            fill="#1b1d20"
          >
            {s.c}
          </text>
        </g>
      ))}
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={x(v)}
            y1={barY + barH}
            x2={x(v)}
            y2={barY + barH + 3}
            stroke={ink}
            strokeWidth="0.5"
          />
          <text
            x={x(v)}
            y={h - 2}
            fontSize="7.5"
            textAnchor={v === 300 ? "end" : "middle"}
            fill={ink}
            opacity="0.7"
          >
            {v}
          </text>
        </g>
      ))}
      <text x={w - 26} y={h - 2} fontSize="7.5" textAnchor="end" fill={ink} opacity="0.7">
        {"kWh/(m²·a)"}
      </text>
      {marker(current.specificHeatingDemand, t("energy.scenario.current"), true)}
      {compare &&
        marker(
          compare.specificHeatingDemand,
          compareLabel ?? t("energy.scenario.renovated"),
          false,
        )}
    </svg>
  );
}
