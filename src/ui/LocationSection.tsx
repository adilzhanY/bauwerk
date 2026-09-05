import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { epsgForZone, toUtm } from "@/geometry/geo";
import { fromGeoJson, toGeoJson } from "@/geometry/geojson";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n";
import { formatNumber } from "@/lib/format";
import { useEditorStore } from "@/store/building";
import { CustomButton } from "@/components/CustomButton";
import { CustomCheckbox } from "@/components/CustomCheckbox";
import { CustomReadOnly, CustomSection } from "@/components/CustomField";
import { CustomNumberInput } from "@/components/CustomNumberInput";

const BERLIN = { lat: 52.516275, lon: 13.377704, rotation: 0 };

export function LocationSection() {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const building = useEditorStore((s) => s.building);
  const setOrigin = useEditorStore((s) => s.setOrigin);
  const setFootprint = useEditorStore((s) => s.setFootprint);
  const beginBatch = useEditorStore((s) => s.beginBatch);
  const endBatch = useEditorStore((s) => s.endBatch);
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
  const batch = { onGestureStart: beginBatch, onGestureEnd: endBatch };

  return (
    <CustomSection title={t("location.title")}>
      <CustomCheckbox
        variant="switch"
        label={t("location.enabled")}
        checked={origin !== undefined}
        onChange={(on) => {
          setOrigin(on ? BERLIN : undefined);
        }}
      />
      {origin && utm && (
        <>
          <CustomNumberInput
            label={t("location.lat")}
            value={origin.lat}
            min={-90}
            max={90}
            step={0.000001}
            slider={false}
            unit="°"
            language={language}
            onChange={(lat) => {
              setOrigin({ ...origin, lat });
            }}
            {...batch}
          />
          <CustomNumberInput
            label={t("location.lon")}
            value={origin.lon}
            min={-180}
            max={180}
            step={0.000001}
            slider={false}
            unit="°"
            language={language}
            onChange={(lon) => {
              setOrigin({ ...origin, lon });
            }}
            {...batch}
          />
          <CustomNumberInput
            label={t("location.rotation")}
            value={origin.rotation}
            min={0}
            max={359}
            step={1}
            unit="°"
            language={language}
            onChange={(rotation) => {
              setOrigin({ ...origin, rotation });
            }}
            {...batch}
          />
          <CustomReadOnly
            label={`${t("location.utm")} ${utm.zone}${utm.north ? "N" : "S"} (EPSG:${epsgForZone(utm.zone)})`}
            value={`${formatNumber(utm.easting, language, 1)} E, ${formatNumber(utm.northing, language, 1)} N`}
          />
          <CustomButton
            variant="quiet"
            className="self-start"
            icon={<Download size={14} />}
            onClick={onExport}
          >
            {t("location.exportGeoJson")}
          </CustomButton>
        </>
      )}
      <CustomButton
        variant="quiet"
        className="self-start"
        icon={<Upload size={14} />}
        onClick={() => {
          fileInput.current?.click();
        }}
      >
        {t("location.importGeoJson")}
      </CustomButton>
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
        <p role="alert" className="text-xs text-mark">
          {t(error)}
        </p>
      )}
    </CustomSection>
  );
}
