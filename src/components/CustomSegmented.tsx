import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "./cx";

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
  hint?: string;
}

interface Props<V extends string> {
  label: string;
  value: V;
  options: readonly SegmentOption<V>[];
  onChange: (value: V) => void;
  /** Stack vertically, for the tool rail. */
  vertical?: boolean;
  /** Use two columns when several text labels need more room than one row provides. */
  wrap?: boolean;
  /** Icon-only buttons with the label as tooltip. */
  iconsOnly?: boolean;
}

/** Mutually exclusive options as a radiogroup. Arrow keys move, roving tabindex. */
export function CustomSegmented<V extends string>({
  label,
  value,
  options,
  onChange,
  vertical = false,
  wrap = false,
  iconsOnly = false,
}: Props<V>) {
  const index = options.findIndex((o) => o.value === value);
  const onKeyDown = (e: KeyboardEvent) => {
    const delta = wrap
      ? { ArrowRight: 1, ArrowDown: 2, ArrowLeft: -1, ArrowUp: -2 }[e.key]
      : {
          [vertical ? "ArrowDown" : "ArrowRight"]: 1,
          [vertical ? "ArrowRight" : "ArrowDown"]: 1,
          [vertical ? "ArrowUp" : "ArrowLeft"]: -1,
          [vertical ? "ArrowLeft" : "ArrowUp"]: -1,
        }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const next = options[(index + delta + options.length) % options.length];
    if (next) {
      onChange(next.value);
      (
        e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined
      )?.focus();
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        "gap-1 border border-line bg-panel p-1",
        wrap ? "grid grid-cols-2 rounded-card" : "flex rounded-pill",
        vertical && !wrap && "flex-col",
      )}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={iconsOnly ? o.label : undefined}
            title={o.hint ? `${o.label} (${o.hint})` : o.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(o.value);
            }}
            onKeyDown={onKeyDown}
            className={cx(
              "relative flex items-center justify-center gap-1.5 rounded-pill transition-colors",
              // Flex items refuse to shrink below their text by default, so a fourth
              // option pushed the last pill out of the track. min-w-0 lets them share
              // the width, and dense groups drop to the smaller size.
              iconsOnly
                ? o.hint
                  ? "h-11 px-3 text-sm"
                  : "h-11 w-11 text-sm"
                : wrap
                  ? "h-9 min-w-0 px-3 text-sm"
                  : cx("h-9 min-w-0 flex-1", options.length > 3 ? "px-2 text-xs" : "px-3 text-sm"),
              selected ? "bg-ink text-paper" : "text-muted hover:bg-panel-2 hover:text-ink",
            )}
          >
            {o.icon}
            {!iconsOnly && <span className="truncate">{o.label}</span>}
            {iconsOnly && o.hint && (
              <span aria-hidden className="font-num text-xs leading-none opacity-70">
                {o.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
