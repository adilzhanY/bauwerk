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
import { bounds } from "@/geometry/polygon";
import { selectTotalHeight } from "@/store/selectors";

function CutControls() {
  const t = useT();
  const s = useEditorStore();
  const height = selectTotalHeight(s);
  const { min, max } = bounds(s.building.footprint);
  const range =
    s.sectionCut.axis === "horizontal"
      ? { min: 0.1, max: Math.max(1, height + 1) }
      : s.sectionCut.axis === "x"
        ? { min: min.x - 1, max: max.x + 1 }
        : { min: min.y - 1, max: max.y + 1 };
  return (
    <div className="flex flex-col gap-3">
      <CustomCheckbox
        variant="switch"
        label={t("view.sectionCut")}
        checked={s.sectionCut.enabled}
        onChange={(enabled) => {
          s.setSectionCut({ enabled });
        }}
      />
      {s.sectionCut.enabled && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">{t("view.cutAxis")}</span>
            <CustomSegmented
              label={t("view.cutAxis")}
              value={s.sectionCut.axis}
              options={[
                { value: "horizontal", label: t("view.cutHorizontal") },
                { value: "x", label: t("view.cutX") },
                { value: "y", label: t("view.cutY") },
              ]}
              onChange={(axis) => {
                s.setSectionCut({ axis });
              }}
            />
          </div>
          <CustomNumberInput
            label={t("view.cutValue")}
            value={s.sectionCut.value}
            min={range.min}
            max={range.max}
            step={0.1}
            unit={t("common.metres")}
            language={s.language}
            onChange={(value) => {
              s.setSectionCut({ value });
            }}
          />
        </>
      )}
    </div>
  );
}

function OtherStoreysControls() {
  const t = useT();
  const s = useEditorStore();
  const o = s.otherStoreys;
  const showOpacity = o.above === "ghost" || o.below === "ghost" || o.roof === "ghost";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">{t("view.storeysAbove")}</span>
        <CustomSegmented
          label={t("view.storeysAbove")}
          value={o.above}
          options={[
            { value: "hidden", label: t("view.storeysHidden") },
            { value: "outline", label: t("view.storeysOutline") },
            { value: "ghost", label: t("view.storeysGhost") },
          ]}
          onChange={(above) => {
            s.setOtherStoreys({ above });
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">{t("view.storeysBelow")}</span>
        <CustomSegmented
          label={t("view.storeysBelow")}
          value={o.below}
          options={[
            { value: "outline", label: t("view.storeysOutline") },
            { value: "ghost", label: t("view.storeysGhost") },
            { value: "solid", label: t("view.storeysSolid") },
          ]}
          onChange={(below) => {
            s.setOtherStoreys({ below });
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">{t("view.roofDisplay")}</span>
        <CustomSegmented
          label={t("view.roofDisplay")}
          value={o.roof}
          options={[
            { value: "hidden", label: t("view.storeysHidden") },
            { value: "outline", label: t("view.storeysOutline") },
            { value: "ghost", label: t("view.storeysGhost") },
            { value: "solid", label: t("view.storeysSolid") },
          ]}
          onChange={(roof) => {
            s.setOtherStoreys({ roof });
          }}
        />
      </div>
      {showOpacity && (
        <CustomField
          label={`${t("view.ghostOpacity")}: ${formatNumber(Math.round(o.ghostOpacity * 100), s.language)} %`}
        >
          <CustomSlider
            label={t("view.ghostOpacity")}
            value={Math.round(o.ghostOpacity * 100)}
            min={5}
            max={60}
            step={5}
            onChange={(pct) => {
              s.setOtherStoreys({ ghostOpacity: pct / 100 });
            }}
            format={(pct) => `${formatNumber(pct, s.language)} %`}
          />
        </CustomField>
      )}
    </div>
  );
}

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
        <OtherStoreysControls />
        <SunControls />
        <CutControls />
        <CustomCheckbox
          variant="switch"
          label={t("view.walkthrough")}
          checked={s.walkthrough}
          onChange={s.setWalkthrough}
        />
        {s.walkthrough && (
          <>
            <p className="text-xs text-muted">{t("view.walkHint")}</p>
            <CustomButton id="walk-lock" variant="primary" className="self-start">
              {t("view.walkStart")}
            </CustomButton>
          </>
        )}
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
