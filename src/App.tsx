import { useEffect, useMemo, useState } from "react";
import { Viewport } from "@/scene/Viewport";
import { useEditorStore } from "@/store/building";
import { hasWebGL } from "@/lib/webgl";
import { installCursors } from "@/lib/cursors";
import { useSync } from "@/sync/useSync";
import { BottomBar } from "@/ui/BottomBar";
import { LeftPanel } from "@/ui/LeftPanel";
import { PrintView } from "@/ui/PrintView";
import { RightPanel } from "@/ui/RightPanel";
import { EmptyState, TooNarrow, WebGLMissing } from "@/ui/States";
import { ToolRail } from "@/ui/ToolRail";
import { useKeyboardShortcuts } from "@/ui/useKeyboardShortcuts";
import { useT } from "@/i18n/useT";

const MIN_WIDTH = 1024;

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => {
      setWidth(window.innerWidth);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return width;
}

export function App() {
  useKeyboardShortcuts();
  const sync = useSync();
  const width = useWindowWidth();
  const webgl = useMemo(() => hasWebGL(), []);
  const hasStoreys = useEditorStore((s) => s.building.storeys.length > 0);
  const language = useEditorStore((s) => s.language);
  const tool = useEditorStore((s) => s.tool);
  const mapVisible = useEditorStore((s) => s.showMap && s.building.origin !== undefined);
  const t = useT();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    installCursors();
  }, []);

  if (new URLSearchParams(window.location.search).get("print") === "1") return <PrintView />;
  if (width < MIN_WIDTH) return <TooNarrow />;

  return (
    <div className="relative h-full overflow-hidden bg-paper" data-tool={tool}>
      <main className="absolute inset-0">
        {!hasStoreys ? <EmptyState /> : webgl ? <Viewport /> : <WebGLMissing />}
      </main>
      <div className="pointer-events-none absolute inset-0 grid grid-cols-[380px_1fr_360px] grid-rows-[1fr_auto] gap-4 p-4">
        <LeftPanel syncStatus={sync.status} />
        <div className="flex flex-col items-center justify-end pb-1">
          <ToolRail />
        </div>
        <RightPanel />
        {mapVisible && hasStoreys && (
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto absolute right-[380px] bottom-16 rounded-soft bg-paper/85 px-2 py-0.5 text-xs text-muted hover:text-ink"
          >
            {t("map.attribution")}
          </a>
        )}
        <div className="col-span-3 flex justify-center">
          <BottomBar actor={sync.status === "local" ? null : sync} />
        </div>
      </div>
    </div>
  );
}
