import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { CustomIconButton } from "./CustomIconButton";

interface Props {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal with a focus trap. Escape and a click on the backdrop close it; focus returns to the opener. */
export function CustomDialog({ title, closeLabel, onClose, children, width = 440 }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (!firstItem || !lastItem) return;
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
        }}
        style={{ width, maxWidth: "100%" }}
        className="rounded-md border border-line bg-paper p-5 shadow-2xl outline-none"
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 id="dialog-title" className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
          <CustomIconButton label={closeLabel} size="sm" onClick={onClose}>
            <X size={16} />
          </CustomIconButton>
        </header>
        {children}
      </div>
    </div>
  );
}
