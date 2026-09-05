import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { distance } from "@/geometry/polygon";
import { useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/building";
import { Button } from "./controls/Button";
import { Section } from "./controls/Field";
import { NumberField } from "./controls/NumberField";

/** Floor plan image on the ground for tracing. Local UI state only. */
export function UnderlaySection() {
  const t = useT();
  const underlay = useEditorStore((s) => s.underlay);
  const setUnderlay = useEditorStore((s) => s.setUnderlay);
  const measurement = useEditorStore((s) => s.measurement);
  const fileInput = useRef<HTMLInputElement>(null);
  const [knownLength, setKnownLength] = useState(5);

  const load = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      if (underlay) URL.revokeObjectURL(underlay.url);
      setUnderlay({
        url,
        widthMetres: 20,
        aspect: img.height / img.width,
        x: 5,
        y: 4,
        opacity: 0.6,
      });
    };
    img.src = url;
  };

  const applyScale = () => {
    if (!underlay || !measurement) return;
    const measured = distance(measurement.a, measurement.b);
    if (measured <= 0) return;
    setUnderlay({ ...underlay, widthMetres: (underlay.widthMetres * knownLength) / measured });
  };

  return (
    <Section title={t("underlay.title")}>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          icon={<ImagePlus size={14} />}
          onClick={() => {
            fileInput.current?.click();
          }}
        >
          {t("underlay.load")}
        </Button>
        {underlay && (
          <Button
            variant="ghost"
            icon={<Trash2 size={14} />}
            onClick={() => {
              URL.revokeObjectURL(underlay.url);
              setUnderlay(null);
            }}
          >
            {t("underlay.remove")}
          </Button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={t("underlay.load")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) load(file);
          e.target.value = "";
        }}
      />
      {underlay && (
        <>
          <NumberField
            label={t("underlay.width")}
            value={underlay.widthMetres}
            min={1}
            max={200}
            step={0.1}
            unit={t("common.metres")}
            onCommit={(widthMetres) => {
              setUnderlay({ ...underlay, widthMetres });
            }}
          />
          <NumberField
            label={t("underlay.x")}
            value={underlay.x}
            min={-100}
            max={100}
            step={0.1}
            unit={t("common.metres")}
            onCommit={(x) => {
              setUnderlay({ ...underlay, x });
            }}
          />
          <NumberField
            label={t("underlay.y")}
            value={underlay.y}
            min={-100}
            max={100}
            step={0.1}
            unit={t("common.metres")}
            onCommit={(y) => {
              setUnderlay({ ...underlay, y });
            }}
          />
          <NumberField
            label={t("underlay.opacity")}
            value={underlay.opacity}
            min={0.1}
            max={1}
            step={0.05}
            onCommit={(opacity) => {
              setUnderlay({ ...underlay, opacity });
            }}
          />
          <p className="text-xs text-muted">{t("underlay.scaleHint")}</p>
          <NumberField
            label={t("underlay.knownLength")}
            value={knownLength}
            min={0.1}
            max={100}
            step={0.1}
            unit={t("common.metres")}
            slider={false}
            onCommit={setKnownLength}
          />
          <Button variant="default" disabled={!measurement} onClick={applyScale}>
            {t("underlay.applyScale")}
          </Button>
        </>
      )}
      <p className="text-xs text-muted">{t("underlay.local")}</p>
    </Section>
  );
}
