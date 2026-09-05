import { useId, useState } from "react";
import { Field } from "./Field";

interface Props {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}

/** Text input that commits on blur or Enter, so a rename is one undo step. */
export function TextField({ label, value, onCommit }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    // The store value changed underneath us (undo, another control): reset the draft.
    setLastValue(value);
    setDraft(value);
  }
  const commit = () => {
    const next = draft.trim();
    if (next !== "" && next !== value) onCommit(next);
    else setDraft(value);
  };
  return (
    <Field label={label} htmlFor={id}>
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(value);
        }}
        className="h-8 rounded border border-border bg-bg px-2 text-sm text-fg"
      />
    </Field>
  );
}
