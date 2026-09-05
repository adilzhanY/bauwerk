import { useT } from "@/i18n/useT";
import { CustomDialog } from "@/components/CustomDialog";

export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const rows: [string, string][] = [
    [t("shortcuts.undo"), "Ctrl+Z"],
    [t("shortcuts.redo"), "Ctrl+Shift+Z, Ctrl+Y"],
    [t("shortcuts.delete"), "Delete"],
    [t("shortcuts.escape"), "Esc"],
    [t("shortcuts.tools"), "1 to 6"],
    [t("shortcuts.storeys"), "PageUp, PageDown"],
    [t("shortcuts.orbit"), t("shortcuts.orbitKeys")],
  ];
  return (
    <CustomDialog title={t("shortcuts.title")} closeLabel={t("shortcuts.close")} onClose={onClose}>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, keys]) => (
            <tr key={label} className="border-t border-line">
              <td className="py-2 text-ink">{label}</td>
              <td className="py-2 text-right font-mono text-xs text-muted">{keys}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CustomDialog>
  );
}
