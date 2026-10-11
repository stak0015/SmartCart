"use client";
// Owner: Shun | Contributors: Zhihao
import type { ReactNode } from "react";
import { DEFAULT_QTY, MAX_QTY, parseQty } from "@/lib/result-row";
export function QuantitySelector({
  value,
  onChange,
  onStep,
  decreaseLabel,
  increaseLabel,
  quantityLabel,
  errorId,
  errorText,
  action,
}: {
  value: string;
  onChange: (value: string) => void;
  onStep: (delta: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  quantityLabel: string;
  errorId?: string;
  errorText?: string;
  action?: ReactNode;
}) {
  const qty = parseQty(value);

  return (
    <div className="quantity-selector flex min-w-0 flex-col gap-2 sm:items-start">
      <div className="flex min-w-0 flex-wrap items-center justify-start gap-2">
        <button type="button" aria-label={decreaseLabel} disabled={qty === DEFAULT_QTY} onClick={() => onStep(-1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbd8d1] text-lg text-[#007d38] disabled:opacity-40">−</button>
        <input
          type="text"
          inputMode="numeric"
          aria-label={quantityLabel}
          aria-invalid={qty === null}
          aria-describedby={qty === null && errorId ? errorId : undefined}
          value={value}
          onChange={event => onChange(event.target.value)}
          className={`h-11 w-12 rounded-xl border text-center text-sm font-bold focus:outline-none ${qty === null ? "border-[#c92a2a] bg-[#fff5f5] text-[#93000a] focus:border-[#c92a2a]" : "border-[#cbd8d1] text-[#10152e] focus:border-[#007d38]"}`}
        />
        <button type="button" aria-label={increaseLabel} disabled={qty === MAX_QTY} onClick={() => onStep(1)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#007d38] text-lg text-white disabled:opacity-40">+</button>
        {action}
      </div>
      {qty === null && errorId && errorText && (
        <p id={errorId} role="alert" className="max-w-full break-words text-right text-[13px] font-semibold leading-5 text-[#c92a2a]">{errorText}</p>
      )}
    </div>
  );
}
