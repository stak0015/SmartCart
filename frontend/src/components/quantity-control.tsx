import { Minus, Plus } from "lucide-react";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/features/planner/domain";

interface QuantityControlProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  error?: string | null;
}

export function QuantityControl({ id, value, onChange, label, error }: QuantityControlProps) {
  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= MIN_QUANTITY && parsed <= MAX_QUANTITY;

  function step(delta: number) {
    const next = valid ? parsed + delta : MIN_QUANTITY;
    onChange(String(Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, next))));
  }

  return (
    <div className="quantity-field">
      <span className="sr-only" id={`${id}-label`}>{label}</span>
      <div className="quantity-control">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={valid && parsed <= MIN_QUANTITY}
          aria-label={`Decrease ${label}`}
        >
          <Minus size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-labelledby={`${id}-label`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={valid && parsed >= MAX_QUANTITY}
          aria-label={`Increase ${label}`}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
      {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}
