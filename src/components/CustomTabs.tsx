import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "./cx";

export interface TabItem<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
}

interface Props<V extends string> {
  label: string;
  value: V;
  tabs: readonly TabItem<V>[];
  onChange: (value: V) => void;
}

/** Tab list with roving focus. The panel is the caller's, linked by id. */
export function CustomTabs<V extends string>({ label, value, tabs, onChange }: Props<V>) {
  const index = tabs.findIndex((t) => t.value === value);
  const onKeyDown = (e: KeyboardEvent) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    if (next) {
      onChange(next.value);
      (
        e.currentTarget.parentElement?.children[tabs.indexOf(next)] as HTMLElement | undefined
      )?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} className="flex border-b border-line">
      {tabs.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`tab-${t.value}`}
            aria-selected={selected}
            aria-controls={`panel-${t.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(t.value);
            }}
            onKeyDown={onKeyDown}
            className={cx(
              "-mb-px flex h-9 items-center gap-1.5 border-b-2 px-3 font-display text-xs font-semibold tracking-wide uppercase transition-colors",
              selected ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function CustomTabPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      className="flex flex-col"
    >
      {children}
    </div>
  );
}
