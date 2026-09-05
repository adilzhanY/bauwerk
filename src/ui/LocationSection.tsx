import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { epsgForZone, toUtm } from "@/geometry/geo";
import { fromGeoJson, toGeoJson } from "@/geometry/geojson";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n";
import { formatNumber } from "@/lib/format";
import { useEditorStore } from "@/store/building";
import { Button } from "./controls/Button";
import { ReadOnly, Section } from "./controls/Field";
import { NumberField } from "./controls/NumberField";

const BERLIN = { lat: 52.516275, lon: 13.377704, rotation: 0 };

export function LocationSection() {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const building = useEditorStore((s) => s.building);
  const setOrigin = useEditorStore((s) => s.setOrigin);
  const setFootprint = useEditorStore((s) => s.setFootprint);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const origin = building.origin;

  const onExport = () => {
    if (!origin) return;
    const blob = new Blob([JSON.stringify(toGeoJson(building), null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bauwerk-${building.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    const result = fromGeoJson(await file.text());
    if (!result.ok) {
      setError(`geojson.error.${result.error}`);
      return;
    }
    setError(null);
    setFootprint(result.footprint, result.origin);
  };

  const utm = origin ? toUtm(origin) : null;

  return (
    <Section title={t("location.title")}>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={origin !== undefined}
          onChange={(e) => {
            setOrigin(e.target.checked ? BERLIN : undefined);
          }}
          className="accent-accent"
        />
        {t("location.enabled")}
      </label>
      {origin && utm && (
        <>
          <NumberField
            label={t("location.lat")}
            value={origin.lat}
            min={-90}
            max={90}
            step={0.000001}
            slider={false}
            unit="°"
            onCommit={(lat) => {
              setOrigin({ ...origin, lat });
            }}
          />
          <NumberField
            label={t("location.lon")}
            value={origin.lon}
            min={-180}
            max={180}
            step={0.000001}
            slider={false}
            unit="°"
            onCommit={(lon) => {
              setOrigin({ ...origin, lon });
            }}
          />
          <NumberField
            label={t("location.rotation")}
            value={origin.rotation}
            min={0}
            max={359}
            step={1}
            unit="°"
            onCommit={(rotation) => {
              setOrigin({ ...origin, rotation });
            }}
          />
          <ReadOnly
            label={`${t("location.utm")} ${utm.zone}${utm.north ? "N" : "S"} (EPSG:${epsgForZone(utm.zone)})`}
            value={`${formatNumber(utm.easting, language, 1)} E, ${formatNumber(utm.northing, language, 1)} N`}
          />
          <Button variant="ghost" icon={<Download size={14} />} onClick={onExport}>
            {t("location.exportGeoJson")}
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        icon={<Upload size={14} />}
        onClick={() => {
          fileInput.current?.click();
        }}
      >
        {t("location.importGeoJson")}
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".geojson,.json,application/geo+json"
        className="hidden"
        aria-label={t("location.importGeoJson")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onImport(file);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted">{t("location.importHint")}</p>
      {error && (
        <p role="alert" className="text-xs text-warning">
          {t(error)}
        </p>
      )}
    </Section>
  );
}
