import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name and tooltip. */
  label: string;
  pressed?: boolean;
  size?: "sm" | "md";
  /** Small key hint drawn in the corner, for the tool rail. */
  hint?: string;
}

/** Square icon-only button. `pressed` makes it a toggle with aria-pressed. */
export function CustomIconButton({
  label,
  pressed,
  size = "md",
  hint,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={hint ? `${label} (${hint})` : label}
      aria-pressed={pressed}
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center rounded-pill border transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-9 w-7" : "h-11 w-11",
        pressed
          ? "border-select bg-select-soft text-select"
          : "border-transparent text-muted hover:bg-panel-2 hover:text-ink",
        className,
      )}
      {...rest}
    >
      {children}
      {hint && (
        <span
          aria-hidden
          className="absolute right-0.5 bottom-0 font-num text-xs leading-none text-muted"
        >
          {hint}
        </span>
      )}
    </button>
  );
}
