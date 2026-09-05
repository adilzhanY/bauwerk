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
  iconsOnly = false,
}: Props<V>) {
  const index = options.findIndex((o) => o.value === value);
  const onKeyDown = (e: KeyboardEvent) => {
    const forward =
      e.key === (vertical ? "ArrowDown" : "ArrowRight") ||
      e.key === (vertical ? "ArrowRight" : "ArrowDown");
    const back =
      e.key === (vertical ? "ArrowUp" : "ArrowLeft") ||
      e.key === (vertical ? "ArrowLeft" : "ArrowUp");
    if (!forward && !back) return;
    e.preventDefault();
    const next = options[(index + (forward ? 1 : -1) + options.length) % options.length];
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
        "flex gap-1 rounded-pill border border-line bg-panel p-1",
        vertical && "flex-col",
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
