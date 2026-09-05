import { useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/building";
import { CustomSegmented } from "@/components/CustomSegmented";
import { toolIcons, toolLabel } from "./tools";
import { TOOL_ORDER } from "./useKeyboardShortcuts";

/** Floating toolbar centred at the bottom of the viewport, like Figma. */
export function ToolRail() {
  const t = useT();
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  return (
    <nav
      aria-label={t("panel.tools")}
      className="pointer-events-auto rounded-pill border border-line bg-panel p-1.5 shadow-float"
    >
      <CustomSegmented
        label={t("panel.tools")}
        value={tool}
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
