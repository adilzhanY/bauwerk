import { useId, useState } from "react";
import { useEditorStore } from "@/store/building";
import { formatNumber, parseNumber } from "@/lib/format";
import { Field } from "./Field";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  slider?: boolean;
  invalid?: boolean;
  hint?: string;
  onCommit: (value: number) => void;
}

/**
 * Number input with an optional slider. Both edit the same value: the slider
 * commits on release, the text input on blur or Enter. Numbers display with the
 * locale's decimal separator and accept both comma and dot.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  slider = true,
  invalid = false,
  hint,
  onCommit,
}: Props) {
  const id = useId();
  const language = useEditorStore((s) => s.language);
  const [draft, setDraft] = useState(formatNumber(value, language, 3));
  const [sliding, setSliding] = useState<number | null>(null);
  const [last, setLast] = useState({ value, language });
  if (value !== last.value || language !== last.language) {
    // The store value or locale changed underneath us: reset the draft.
    setLast({ value, language });
    setDraft(formatNumber(value, language, 3));
  }

  const commitText = () => {
    const parsed = parseNumber(draft);
    if (parsed === null) {
      setDraft(formatNumber(value, language, 3));
      return;
    }
    const rounded = Math.round(parsed / step) * step;
    const next = Math.round(rounded * 1e6) / 1e6;
    if (next !== value) onCommit(next);
    else setDraft(formatNumber(value, language, 3));
  };

  const shown = sliding ?? value;
  const border = invalid ? "border-warning" : "border-border";

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center gap-2">
        {slider && (
          <input
            type="range"
            aria-label={label}
            min={min}
            max={max}
            step={step}
            value={shown}
            onChange={(e) => {
              setSliding(Number(e.target.value));
            }}
            onPointerUp={() => {
              if (sliding !== null && sliding !== value) onCommit(sliding);
              setSliding(null);
            }}
            onKeyUp={() => {
              if (sliding !== null && sliding !== value) onCommit(sliding);
              setSliding(null);
            }}
            onBlur={() => {
              if (sliding !== null && sliding !== value) onCommit(sliding);
              setSliding(null);
            }}
            className="min-w-0 flex-1 accent-accent"
          />
        )}
        <div
          className={`flex h-8 items-center rounded border bg-bg ${border} ${slider ? "w-24" : "flex-1"}`}
        >
          <input
            id={id}
            type="text"
            inputMode="decimal"
            value={sliding === null ? draft : formatNumber(sliding, language, 3)}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setDraft(formatNumber(value, language, 3));
            }}
            className="h-full min-w-0 flex-1 bg-transparent px-2 font-mono text-sm text-fg"
          />
          {unit && <span className="pr-2 text-xs text-muted">{unit}</span>}
        </div>
      </div>
    </Field>
  );
}
