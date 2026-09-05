import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { IconButton } from "./controls/Button";

interface Props {
  onClose: () => void;
}

export function ShortcutSheet({ onClose }: Props) {
  const t = useT();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const rows: [string, string][] = [
    [t("shortcuts.undo"), "Ctrl+Z"],
    [t("shortcuts.redo"), "Ctrl+Shift+Z, Ctrl+Y"],
    [t("shortcuts.delete"), "Delete"],
    [t("shortcuts.escape"), "Esc"],
    [t("shortcuts.tools"), "1 to 5"],
    [t("shortcuts.storeys"), "PageUp, PageDown"],
    [t("shortcuts.orbit"), t("shortcuts.orbitKeys")],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="w-[420px] rounded-lg border border-border bg-panel p-4 shadow-xl outline-none"
      >
        <header className="mb-3 flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-lg font-semibold text-fg">
            {t("shortcuts.title")}
          </h2>
          <IconButton label={t("shortcuts.close")} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, keys]) => (
              <tr key={label} className="border-t border-border">
                <td className="py-2 text-fg">{label}</td>
                <td className="py-2 text-right font-mono text-xs text-muted">{keys}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
