import { useId, useRef, useState } from "react";
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

const round = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * Number input with an optional slider. Both update the model live, on every
 * slider tick and every valid keystroke, so the 3D view follows the hand. A
 * whole gesture (pointer down to up, focus to blur) is one undo step through
 * the history batch. Numbers display with the locale's decimal separator and
 * accept both comma and dot.
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
  const beginBatch = useEditorStore((s) => s.beginBatch);
  const endBatch = useEditorStore((s) => s.endBatch);
  const fmt = (v: number) => formatNumber(v, language, 3);
  const [draft, setDraft] = useState(fmt(value));
  const [editing, setEditing] = useState(false);
  const [last, setLast] = useState({ value, language });
  const inBatch = useRef(false);

  if (!editing && (value !== last.value || language !== last.language)) {
    // The store value or locale changed underneath us: reset the draft.
    setLast({ value, language });
    setDraft(fmt(value));
  }

  const start = () => {
    if (inBatch.current) return;
    inBatch.current = true;
    beginBatch();
  };
  const finish = () => {
    if (!inBatch.current) return;
    inBatch.current = false;
    endBatch();
  };

  const commitLive = (next: number) => {
    if (next !== value) onCommit(next);
  };

  const onText = (text: string) => {
    setDraft(text);
    const parsed = parseNumber(text);
    if (parsed === null || parsed < min || parsed > max) return;
    commitLive(round(parsed));
  };

  const onTextBlur = () => {
    setEditing(false);
    finish();
    const parsed = parseNumber(draft);
    if (parsed === null) {
      setDraft(fmt(value));
      return;
    }
    const clamped = round(Math.min(max, Math.max(min, Math.round(parsed / step) * step)));
    if (clamped !== value) onCommit(clamped);
    setDraft(fmt(clamped));
    setLast({ value: clamped, language });
  };

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
            value={value}
            onPointerDown={start}
            onKeyDown={start}
            onChange={(e) => {
              start();
              commitLive(round(Number(e.target.value)));
            }}
            onPointerUp={finish}
            onKeyUp={finish}
            onBlur={finish}
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
            value={editing ? draft : fmt(value)}
            onFocus={() => {
              setEditing(true);
              setDraft(fmt(value));
              start();
            }}
            onChange={(e) => {
              onText(e.target.value);
            }}
            onBlur={onTextBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraft(fmt(value));
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="h-full min-w-0 flex-1 bg-transparent px-2 font-mono text-sm text-fg"
          />
          {unit && <span className="pr-2 text-xs text-muted">{unit}</span>}
        </div>
      </div>
    </Field>
  );
}
