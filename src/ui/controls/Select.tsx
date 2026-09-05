import { useId } from "react";
import { Field } from "./Field";

interface Option<V extends string> {
  value: V;
  label: string;
}

interface Props<V extends string> {
  label: string;
  value: V;
  options: readonly Option<V>[];
  onChange: (value: V) => void;
}

export function Select<V extends string>({ label, value, options, onChange }: Props<V>) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value as V);
        }}
        className="h-8 rounded border border-border bg-bg px-2 text-sm text-fg"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
