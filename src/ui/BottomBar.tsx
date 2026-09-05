import { useRef, useState } from "react";
import { Download, FileBox, FileDown, Keyboard, Redo2, Undo2, Upload } from "lucide-react";
import { syncConfigFromEnv } from "@/sync/client";
import { syncEnabled } from "@/sync/useSync";
import { fromJson, toJson } from "@/geometry/export";
import type { ImportError } from "@/geometry/export";
import { toIfc } from "@/geometry/ifc";
import { importIfc } from "@/geometry/ifc-import";
import type { IfcImportResult } from "@/geometry/ifc-import";
import { CustomDialog } from "@/components/CustomDialog";
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
import { CustomButton } from "@/components/CustomButton";
import { CustomIconButton } from "@/components/CustomIconButton";
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

/** Status line in mono: undo and redo, export and import, presence, counts, shortcuts. */
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

  const [ifcResult, setIfcResult] = useState<IfcImportResult | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const downloadPdf = async () => {
    const cfg = syncConfigFromEnv();
    if (!cfg) return;
    setPdfBusy(true);
    try {
      const res = await fetch(`${cfg.apiUrl}/reports?lang=${language}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ building }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName(building.name, "pdf");
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setIfcError(t("bar.pdfFailed", { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setPdfBusy(false);
    }
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    if (/\.ifc$/i.test(file.name) || text.startsWith("ISO-10303-21")) {
      const result = importIfc(text, language);
      if (result.ok) {
        setError(null);
        setIfcResult(result);
      } else {
        setIfcError(t("ifcImport.failed", { message: result.message }));
      }
      return;
    }
    const result = fromJson(text, language);
    if (result.ok) {
      setError(null);
      loadBuilding(result.building);
    } else {
      setError(result.error);
    }
  };
  const [ifcError, setIfcError] = useState<string | null>(null);

  return (
    <footer className="pointer-events-auto flex h-12 items-center gap-1 rounded-pill border border-line bg-panel px-3 text-sm shadow-float">
      <CustomIconButton label={t("bar.undo")} size="sm" disabled={!canUndo} onClick={undo}>
        <Undo2 size={15} />
      </CustomIconButton>
      <CustomIconButton label={t("bar.redo")} size="sm" disabled={!canRedo} onClick={redo}>
        <Redo2 size={15} />
      </CustomIconButton>
      <span aria-hidden className="mx-1 h-5 w-px bg-line" />
      <CustomButton
        variant="quiet"
        icon={<Download size={14} />}
        onClick={() => {
          download(toJson(building), fileName(building.name, "json"), "application/json");
        }}
      >
        {t("bar.export")}
      </CustomButton>
      <CustomButton
        variant="quiet"
        icon={<FileBox size={14} />}
        onClick={() => {
          const name = fileName(building.name, "ifc");
          download(toIfc(building, { fileName: name }), name, "application/x-step");
        }}
      >
        {t("bar.exportIfc")}
      </CustomButton>
      {syncEnabled && (
        <CustomButton
          variant="quiet"
          icon={<FileDown size={14} />}
          loading={pdfBusy}
          onClick={() => {
            void downloadPdf();
          }}
        >
          {t("bar.pdf")}
        </CustomButton>
      )}
      <CustomButton
        variant="quiet"
        icon={<Upload size={14} />}
        onClick={() => {
          fileInput.current?.click();
        }}
      >
        {t("bar.import")}
      </CustomButton>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json,.ifc"
        className="hidden"
        aria-label={t("bar.import")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onImportFile(file);
          e.target.value = "";
        }}
      />
      {error && (
        <span role="alert" className="truncate font-sans text-xs text-mark">
          {t(`import.error.${error.code}` as MessageKey, { path: error.path ?? "" })}
        </span>
      )}
      {ifcError && (
        <span role="alert" className="truncate font-sans text-xs text-mark">
          {ifcError}
        </span>
      )}
      {ifcResult && (
        <CustomDialog
          title={t("ifcImport.title")}
          closeLabel={t("ifcImport.cancel")}
          onClose={() => {
            setIfcResult(null);
          }}
        >
          <div className="flex flex-col gap-3 font-sans text-sm">
            <p className="text-ink">{t("ifcImport.summary", ifcResult.stats)}</p>
            {ifcResult.report.length === 0 ? (
              <p className="text-muted">{t("ifcImport.clean")}</p>
            ) : (
              <>
                <p className="text-muted">{t("ifcImport.reduced")}</p>
                <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-xs text-ink">
                  {ifcResult.report.map((r, i) => (
                    <li key={i}>
                      {t(`ifcImport.code.${r.code}` as MessageKey)}{" "}
                      <span className="font-num text-muted">
                        {r.entity}
                        {r.detail ? ` (${r.detail})` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="flex gap-2">
              <CustomButton
                variant="primary"
                onClick={() => {
                  loadBuilding(ifcResult.building);
                  setIfcResult(null);
                }}
              >
                {t("ifcImport.load")}
              </CustomButton>
              <CustomButton
                variant="quiet"
                onClick={() => {
                  setIfcResult(null);
                }}
              >
                {t("ifcImport.cancel")}
              </CustomButton>
            </div>
          </div>
        </CustomDialog>
      )}
      <span className="flex-1" />
      {actor && (
        <div
          className="flex items-center gap-1"
          title={t("presence.title")}
          aria-label={t("presence.title")}
        >
          <span
            className="h-3 w-3 rounded-full ring-2 ring-ink"
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
          <span className="ml-1 text-muted">{actor.actor}</span>
        </div>
      )}
      <dl className="flex items-center gap-4 text-muted" aria-label={t("bar.status")}>
        <Stat label={t("status.storeys")} value={String(building.storeys.length)} />
        <Stat label={t("status.rooms")} value={String(roomCount)} />
        <Stat label={t("status.area")} value={formatArea(floorArea, language)} />
      </dl>
      <CustomIconButton
        label={t("bar.shortcuts")}
        size="sm"
        onClick={() => {
          setSheetOpen(true);
        }}
      >
        <Keyboard size={15} />
      </CustomIconButton>
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
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
