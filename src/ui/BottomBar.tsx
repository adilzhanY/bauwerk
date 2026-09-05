import { useRef, useState } from "react";
import { Download, FileBox, Keyboard, Redo2, Undo2, Upload } from "lucide-react";
import { fromJson, toJson } from "@/geometry/export";
import { toIfc } from "@/geometry/ifc";
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

function fileName(name: string, extension: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/g, "-")
      .replace(/^-|-$/g, "") || "building";
  const date = new Date().toISOString().slice(0, 10);
  return `bauwerk-${slug}-${date}.${extension}`;
}

function download(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  actor: { actor: string; color: string } | null;
}

export function BottomBar({ actor }: Props) {
  const t = useT();
  const presence = useEditorStore((s) => s.presence);
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
    download(toJson(building), fileName(building.name, "json"), "application/json");
  };
  const onExportIfc = () => {
    const name = fileName(building.name, "ifc");
    download(toIfc(building, { fileName: name }), name, "application/x-step");
  };

  const onImportFile = async (file: File) => {
    const result = fromJson(await file.text(), language);
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
      <Button variant="ghost" icon={<FileBox size={14} />} onClick={onExportIfc}>
        {t("bar.exportIfc")}
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
      {actor && (
        <div
          className="flex items-center gap-1"
          title={t("presence.title")}
          aria-label={t("presence.title")}
        >
          <span
            className="h-3 w-3 rounded-full ring-2 ring-fg"
            style={{ background: actor.color }}
            title={actor.actor}
          />
          {presence.map((p) => (
            <span
              key={p.actor}
              className="h-3 w-3 rounded-full"
              style={{ background: p.color }}
              title={p.actor}
            />
          ))}
          <span className="ml-1 font-mono text-xs text-muted">{actor.actor}</span>
        </div>
      )}
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
