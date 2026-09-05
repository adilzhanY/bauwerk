import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "default" | "primary" | "quiet" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  active?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  default: "border-line bg-paper text-ink hover:border-line-strong hover:bg-panel-2",
  primary: "border-ink bg-ink text-paper hover:opacity-90",
  quiet: "border-transparent bg-transparent text-ink hover:bg-panel-2",
  danger: "border-line bg-paper text-mark hover:border-mark hover:bg-mark-soft",
};

/** Text button. Keyboard focus is drawn by the global focus ring. */
export function CustomButton({
  variant = "default",
  icon,
  loading = false,
  active = false,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      disabled={(disabled ?? false) || loading}
      aria-busy={loading || undefined}
      aria-pressed={active || undefined}
      className={cx(
        "inline-flex h-8 items-center gap-2 rounded-sm border px-3 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        active && "border-select bg-select-soft text-select",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
    />
  );
}
