import { Check } from "lucide-react";
import { ZONE_COLORS } from "@/lib/colors";

interface Props {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

/** Radio group of the six fixed zone colours. */
export function ColorSwatches({ label, value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-2">
        {ZONE_COLORS.map((color) => {
          const selected = color === value;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color}
              title={color}
              onClick={() => {
                onChange(color);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${selected ? "border-fg" : "border-transparent"}`}
              style={{ background: color }}
            >
              {selected && <Check size={14} className="text-bg" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
