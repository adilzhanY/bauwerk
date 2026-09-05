import { Printer } from "lucide-react";
import { LANGUAGES } from "@/i18n";
import { useT } from "@/i18n/useT";
import { example } from "@/lib/examples";
import type { ExampleId } from "@/lib/examples";
import { useEditorStore } from "@/store/building";
import type { Theme } from "@/store/building";
import { CustomButton } from "@/components/CustomButton";
import { CustomCheckbox } from "@/components/CustomCheckbox";
import { CustomSection } from "@/components/CustomField";
import { CustomNumberInput } from "@/components/CustomNumberInput";
import { CustomSegmented } from "@/components/CustomSegmented";
import { CustomSelect } from "@/components/CustomSelect";
import { CustomTextInput } from "@/components/CustomTextInput";

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
