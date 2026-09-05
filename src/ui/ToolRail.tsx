import { useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/building";
import { CustomSegmented } from "@/components/CustomSegmented";
import { toolIcons, toolLabel } from "./tools";
import { TOOL_ORDER } from "./useKeyboardShortcuts";

/** Vertical strip of tools on the far left, with key hints. */
export function ToolRail() {
  const t = useT();
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  return (
    <nav
      aria-label={t("panel.tools")}
      className="flex flex-col items-center gap-3 border-r border-line bg-panel px-1.5 py-3"
    >
      <span className="font-display text-[11px] font-semibold tracking-wide text-muted uppercase">
        {t("app.title")}
      </span>
      <CustomSegmented
        label={t("panel.tools")}
        value={tool}
        vertical
        iconsOnly
        options={TOOL_ORDER.map((id, i) => ({
          value: id,
          label: t(toolLabel[id]),
          icon: toolIcons[id],
          hint: String(i + 1),
        }))}
        onChange={setTool}
      />
    </nav>
  );
}
