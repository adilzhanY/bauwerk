import { Printer } from "lucide-react";
import { LANGUAGES } from "@/i18n";
import { useT } from "@/i18n/useT";
import { example } from "@/lib/examples";
import type { ExampleId } from "@/lib/examples";
import { useEditorStore } from "@/store/building";
import type { Theme } from "@/store/building";
import { CustomButton } from "@/components/CustomButton";
import { CustomCheckbox } from "@/components/CustomCheckbox";
import { CustomNumberInput } from "@/components/CustomNumberInput";
import { CustomSegmented } from "@/components/CustomSegmented";
import { CustomSelect } from "@/components/CustomSelect";
import { CustomTextInput } from "@/components/CustomTextInput";
import { CustomSlider } from "@/components/CustomSlider";
import { CustomField, CustomReadOnly, CustomSection } from "@/components/CustomField";
import { formatNumber } from "@/lib/format";
import { BERLIN_FALLBACK, daylight, formatClock, formatDay, sunAt } from "@/lib/sunTime";

function SunControls() {
  const t = useT();
  const s = useEditorStore();
  const origin = s.building.origin ?? { ...BERLIN_FALLBACK, rotation: 0 };
  const pos = sunAt(s.sun.dayOfYear, s.sun.minutes, origin.lat, origin.lon);
  const dl = daylight(s.sun.dayOfYear, origin.lat, origin.lon);
  return (
    <div className="flex flex-col gap-3">
      <CustomCheckbox
        variant="switch"
        label={t("sun.enabled")}
        checked={s.sun.enabled}
        onChange={(enabled) => {
          s.setSun({ enabled });
        }}
      />
      {s.sun.enabled && (
        <>
          <CustomField label={`${t("sun.day")}: ${formatDay(s.sun.dayOfYear, s.language)}`}>
            <CustomSlider
              label={t("sun.day")}
              value={s.sun.dayOfYear}
              min={1}
              max={365}
              step={1}
              onChange={(dayOfYear) => {
                s.setSun({ dayOfYear });
              }}
              format={(d) => formatDay(d, s.language)}
            />
          </CustomField>
          <CustomField label={`${t("sun.time")}: ${formatClock(s.sun.minutes)}`}>
            <CustomSlider
              label={t("sun.time")}
              value={s.sun.minutes}
              min={0}
              max={1435}
              step={5}
              onChange={(minutes) => {
                s.setSun({ minutes });
              }}
              format={formatClock}
            />
          </CustomField>
          {pos.elevation > 0 ? (
            <>
              <CustomReadOnly
                label={t("sun.elevation")}
                value={`${formatNumber(pos.elevation, s.language, 1)}°`}
              />
              <CustomReadOnly
                label={t("sun.azimuth")}
                value={`${formatNumber(pos.azimuth, s.language, 0)}°`}
              />
            </>
          ) : (
            <p className="text-xs text-muted">{t("sun.below")}</p>
          )}
          {dl && (
            <CustomReadOnly
              label={`${t("sun.rise")} / ${t("sun.set")}`}
              value={`${formatClock(dl.sunrise)} / ${formatClock(dl.sunset)}`}
            />
          )}
        </>
      )}
    </div>
  );
}

export function SettingsSection() {
  const t = useT();
  const s = useEditorStore();
  const themes: Theme[] = ["light", "dark", "system"];

  return (
    <>
      <CustomSection title={t("panel.view")}>
        <CustomCheckbox
          variant="switch"
          label={t("settings.grid")}
          checked={s.showGrid}
          onChange={s.setShowGrid}
        />
        <CustomCheckbox
          variant="switch"
          label={t("view.plan")}
          checked={s.planView}
          onChange={s.setPlanView}
        />
        <CustomCheckbox
          variant="switch"
          label={t("view.uValueBands")}
          checked={s.showUValueBands}
          onChange={s.setShowUValueBands}
        />
        <CustomCheckbox
          variant="switch"
          label={t("bridges.show")}
          checked={s.showBridges}
          onChange={s.setShowBridges}
        />
        <SunControls />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">{t("settings.theme")}</span>
          <CustomSegmented
            label={t("settings.theme")}
            value={s.theme}
            options={themes.map((v) => ({ value: v, label: t(`theme.${v}`) }))}
            onChange={s.setTheme}
          />
        </div>
        <CustomButton
          variant="quiet"
          className="justify-start"
          icon={<Printer size={14} />}
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("print", "1");
            window.open(url.toString(), "_blank");
          }}
        >
          {t("print.open")}
        </CustomButton>
      </CustomSection>
      <CustomSection title={t("panel.settings")}>
        <CustomTextInput
          label={t("building.name")}
          value={s.building.name}
          onCommit={s.renameBuilding}
        />
        <CustomNumberInput
          label={t("settings.wallThickness")}
          value={s.building.wallThickness}
          min={0.1}
          max={1}
          step={0.05}
          unit={t("common.metres")}
          language={s.language}
          onChange={s.setWallThickness}
          onGestureStart={s.beginBatch}
          onGestureEnd={s.endBatch}
        />
        <CustomSelect
          label={t("settings.language")}
          value={s.language}
          options={LANGUAGES.map((l) => ({ value: l, label: l === "de" ? "Deutsch" : "English" }))}
          onChange={s.setLanguage}
        />
        <CustomSelect<ExampleId | "">
          label={t("settings.example")}
          value=""
          options={[
            { value: "", label: t("settings.examplePlaceholder") },
            { value: "house", label: t("example.house") },
            { value: "block", label: t("example.block") },
          ]}
          onChange={(id) => {
            if (id !== "") s.loadBuilding(example(id, s.language));
          }}
        />
      </CustomSection>
    </>
  );
}
