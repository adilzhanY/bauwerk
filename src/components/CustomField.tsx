import type { ReactNode } from "react";
import { cx } from "./cx";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  /** Renders the label as a scrub handle (used by the number input). */
  labelProps?: React.LabelHTMLAttributes<HTMLLabelElement>;
  children: ReactNode;
}

/** Label above a control, with an optional hint or error line below. */
export function CustomField({ label, htmlFor, hint, error, labelProps, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        {...labelProps}
        className={cx("text-xs font-medium text-muted select-none", labelProps?.className)}
      >
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-mark">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  /** Draws the section without the top rule, for the first one in a panel. */
  first?: boolean;
}

/** A titled block in a side panel. The title is an h2 so panels read as an outline. */
export function CustomSection({ title, action, children, first = false }: SectionProps) {
  return (
    <section className={cx("flex flex-col gap-3 px-3 pt-3 pb-4", !first && "border-t border-line")}>
      <header className="flex h-7 items-center justify-between">
        <h2 className="font-display text-xs font-semibold tracking-wide text-muted uppercase">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Label on the left, mono value on the right. */
export function CustomReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-right font-mono text-sm text-ink">{value}</span>
    </div>
  );
}
