import { computeEnergy } from "@/geometry/energy";
import { bounds, edges } from "@/geometry/polygon";
import type { Storey } from "@/geometry/types";
import { useT } from "@/i18n/useT";
import { formatArea, formatMetres, formatNumber } from "@/lib/format";
import { useEditorStore } from "@/store/building";

/** Static report for the customer meeting: plan per storey, energy summary, room table. Printed with the browser. */
export function PrintView() {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const building = useEditorStore((s) => s.building);
  const energy = computeEnergy(building);
  const renovated = computeEnergy(building, { renovated: true });
  const date = new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB").format(new Date());
  const num = (v: number, d = 1) => formatNumber(v, language, d);

  return (
    <div
      className="min-h-full bg-white p-10 font-sans text-black print:p-0"
      style={{ colorScheme: "light" }}
    >
      <div className="mb-6 flex items-center justify-between print:hidden">
        <a href={window.location.pathname} className="text-sm text-select underline">
          {t("print.back")}
        </a>
        <button
          type="button"
          onClick={() => {
            window.print();
          }}
          className="rounded-sm border border-black px-3 py-1 font-sans text-sm"
        >
          {t("print.print")}
        </button>
      </div>
      <h1 className="font-display text-title font-semibold">{building.name}</h1>
      <p className="mb-6 text-sm text-neutral-600">{t("print.title")}</p>

      <section className="mb-8 grid grid-cols-3 gap-4 text-sm">
        <Stat
          label={t("energy.energyClass")}
          value={`${energy.energyClass} (${t("energy.scenario.renovated")}: ${renovated.energyClass})`}
        />
        <Stat
          label={t("energy.specificHeatingDemand")}
          value={`${num(energy.specificHeatingDemand, 0)} kWh/(m²a)`}
        />
        <Stat label={t("energy.heatingDemand")} value={`${num(energy.heatingDemand, 0)} kWh/a`} />
        <Stat label={t("energy.transmissionLoss")} value={`${num(energy.transmissionLoss)} W/K`} />
        <Stat label={t("energy.envelopeArea")} value={formatArea(energy.envelopeArea, language)} />
        <Stat
          label={t("energy.windowToWall")}
          value={`${num(energy.windowToWallRatio * 100, 0)} %`}
        />
      </section>

      {building.storeys.map((storey) => (
        <section key={storey.id} className="mb-8 break-inside-avoid">
          <h2 className="mb-2 text-lg font-semibold">
            {storey.name}{" "}
            <span className="font-normal text-neutral-500">
              ({formatMetres(storey.height, language)})
            </span>
          </h2>
          <div className="grid grid-cols-[1fr_1fr] gap-6">
            <StoreyPlan storey={storey} />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1">{t("room.title")}</th>
                  <th className="py-1">{t("room.zone")}</th>
                  <th className="py-1 text-right">{t("room.area")}</th>
                </tr>
              </thead>
              <tbody>
                {storey.rooms.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-300">
                    <td className="py-1">{r.name}</td>
                    <td className="py-1">
                      {building.zones.find((z) => z.id === r.zoneId)?.name ?? ""}
                    </td>
                    <td className="py-1 text-right font-mono">{formatArea(r.area, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="mt-8 text-xs text-neutral-500">{t("print.generated", { date })}</p>
      <p className="text-xs text-neutral-500">{t("energy.assumptions")}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-300 p-2">
      <div className="text-xs text-neutral-600">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

function StoreyPlan({ storey }: { storey: Storey }) {
  const building = useEditorStore((s) => s.building);
  const { min, max } = bounds(building.footprint);
  const pad = 1;
  const w = max.x - min.x + 2 * pad;
  const h = max.y - min.y + 2 * pad;
  // SVG y grows downwards; the plan's +y is north, so flip.
  const pt = (p: { x: number; y: number }) => `${p.x - min.x + pad},${max.y - p.y + pad}`;
  const es = edges(building.footprint);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full border border-neutral-300"
      role="img"
      aria-label={storey.name}
    >
      {storey.rooms.map((r) => {
        const zone = building.zones.find((z) => z.id === r.zoneId);
        return (
          <polygon
            key={r.id}
            points={r.polygon.map(pt).join(" ")}
            fill={zone?.color ?? "#f0f0f0"}
            fillOpacity={0.5}
            stroke="none"
          />
        );
      })}
      <polygon
        points={building.footprint.map(pt).join(" ")}
        fill="none"
        stroke="#000"
        strokeWidth={0.3}
      />
      {storey.interiorWalls.map((s, i) => (
        <line
          key={i}
          x1={s.a.x - min.x + pad}
          y1={max.y - s.a.y + pad}
          x2={s.b.x - min.x + pad}
          y2={max.y - s.b.y + pad}
          stroke="#000"
          strokeWidth={0.1}
        />
      ))}
      {storey.openings.map((o) => {
        const e = es[o.wallIndex];
        if (!e) return null;
        const a = { x: e.a.x + e.direction.x * o.offset, y: e.a.y + e.direction.y * o.offset };
        const b = { x: a.x + e.direction.x * o.width, y: a.y + e.direction.y * o.width };
        return (
          <line
            key={o.id}
            x1={a.x - min.x + pad}
            y1={max.y - a.y + pad}
            x2={b.x - min.x + pad}
            y2={max.y - b.y + pad}
            stroke={o.kind === "door" ? "#a67c52" : "#3a86c8"}
            strokeWidth={0.35}
          />
        );
      })}
      {storey.rooms.map((r) => {
        const c = r.polygon.reduce(
          (s, p) => ({ x: s.x + p.x / r.polygon.length, y: s.y + p.y / r.polygon.length }),
          { x: 0, y: 0 },
        );
        return (
          <text
            key={`${r.id}-l`}
            x={c.x - min.x + pad}
            y={max.y - c.y + pad}
            fontSize={0.45}
            textAnchor="middle"
            fill="#000"
          >
            {r.name}
          </text>
        );
      })}
    </svg>
  );
}
