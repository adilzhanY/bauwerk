import { useEffect, useMemo, useState } from "react";
import { Viewport } from "@/scene/Viewport";
import { useEditorStore } from "@/store/building";
import { BottomBar } from "@/ui/BottomBar";
import { LeftPanel } from "@/ui/LeftPanel";
import { RightPanel } from "@/ui/RightPanel";
import { hasWebGL } from "@/lib/webgl";
import { EmptyState, TooNarrow, WebGLMissing } from "@/ui/States";
import { useKeyboardShortcuts } from "@/ui/useKeyboardShortcuts";
import { useSync } from "@/sync/useSync";
import { PrintView } from "@/ui/PrintView";

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

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  if (new URLSearchParams(window.location.search).get("print") === "1") return <PrintView />;
  if (width < MIN_WIDTH) return <TooNarrow />;

  return (
    <div className="grid h-full grid-cols-[280px_1fr_300px] grid-rows-[1fr_40px]">
      <LeftPanel syncStatus={sync.status} />
      <main className="relative min-w-0 bg-bg">
        {!hasStoreys ? <EmptyState /> : webgl ? <Viewport /> : <WebGLMissing />}
      </main>
      <RightPanel />
      <div className="col-span-3">
        <BottomBar actor={sync.status === "local" ? null : sync} />
      </div>
    </div>
  );
}
