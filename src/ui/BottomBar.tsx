import { useRef, useState } from "react";
import { Download, Keyboard, Redo2, Undo2, Upload } from "lucide-react";
import { fromJson, toJson } from "@/geometry/export";
import type { ImportError } from "@/geometry/export";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n";
import { formatArea } from "@/lib/format";
import { useEditorStore } from "@/store/building";
import {
  selectCanRedo,
  selectCanUndo,
  selectRoomCount,
  selectTotalFloorArea,
} from "@/store/selectors";
import { Button, IconButton } from "./controls/Button";
import { ShortcutSheet } from "./ShortcutSheet";

function fileName(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/g, "-")
      .replace(/^-|-$/g, "") || "building";
  const date = new Date().toISOString().slice(0, 10);
  return `bauwerk-${slug}-${date}.json`;
}

export function BottomBar() {
  const t = useT();
  const language = useEditorStore((s) => s.language);
  const building = useEditorStore((s) => s.building);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const loadBuilding = useEditorStore((s) => s.loadBuilding);
  const roomCount = useEditorStore(selectRoomCount);
  const floorArea = useEditorStore(selectTotalFloorArea);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<ImportError | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const onExport = () => {
    const blob = new Blob([toJson(building)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName(building.name);
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (file: File) => {
    const result = fromJson(await file.text());
    if (result.ok) {
      setError(null);
      loadBuilding(result.building);
    } else {
      setError(result.error);
    }
  };

  return (
    <footer className="flex h-10 items-center gap-2 border-t border-border bg-panel px-2">
      <IconButton label={t("bar.undo")} disabled={!canUndo} onClick={undo}>
        <Undo2 size={16} />
      </IconButton>
      <IconButton label={t("bar.redo")} disabled={!canRedo} onClick={redo}>
        <Redo2 size={16} />
      </IconButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <Button variant="ghost" icon={<Download size={14} />} onClick={onExport}>
        {t("bar.export")}
      </Button>
      <Button
        variant="ghost"
        icon={<Upload size={14} />}
        onClick={() => {
          fileInput.current?.click();
        }}
      >
        {t("bar.import")}
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label={t("bar.import")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onImportFile(file);
          e.target.value = "";
        }}
      />
      {error && (
        <span role="alert" className="truncate text-xs text-warning">
          {t(`import.error.${error.code}` as MessageKey, { path: error.path ?? "" })}
        </span>
      )}
      <span className="flex-1" />
      <dl className="flex items-center gap-4 font-mono text-xs text-muted">
        <Stat label={t("status.storeys")} value={String(building.storeys.length)} />
        <Stat label={t("status.rooms")} value={String(roomCount)} />
        <Stat label={t("status.area")} value={formatArea(floorArea, language)} />
      </dl>
      <IconButton
        label={t("bar.shortcuts")}
        onClick={() => {
          setSheetOpen(true);
        }}
      >
        <Keyboard size={16} />
      </IconButton>
      {sheetOpen && (
        <ShortcutSheet
          onClose={() => {
            setSheetOpen(false);
          }}
        />
      )}
    </footer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="font-sans">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </div>
  );
}
