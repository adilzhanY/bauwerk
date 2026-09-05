import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "primary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  active?: boolean;
}

const styles: Record<Variant, string> = {
  default: "border border-border bg-bg text-fg hover:bg-border/60",
  primary: "border border-accent bg-accent text-white hover:bg-accent/90",
  ghost: "border border-transparent text-fg hover:bg-border/60",
  danger: "border border-border text-warning hover:bg-warning/10",
};

export function Button({
  variant = "default",
  icon,
  active = false,
  className = "",
  children,
  ...rest
}: Props) {
  const activeStyle = active ? "bg-accent/15 border-accent text-accent" : "";
  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center gap-2 rounded px-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${activeStyle} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}

/** Icon-only button. `label` is the accessible name and the tooltip. */
export function IconButton({
  label,
  active = false,
  className = "",
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-accent bg-accent/15 text-accent"
          : "border-transparent text-muted hover:bg-border/60 hover:text-fg"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
