"use client";

import { useEffect, useRef } from "react";

type Step = "location" | "shop" | "basket" | "compare" | "store" | "checklist";
const STEPS: Step[] = ["location", "shop", "basket", "compare", "store", "checklist"];
const LABELS = {
  en: ["Travel", "Shop", "Basket", "Recommendations", "Store details", "Checklist"],
  ms: ["Perjalanan", "Beli-belah", "Bakul", "Cadangan", "Butiran kedai", "Senarai semak"],
};

export function ShoppingStepNav({ current, locale, available, onNavigate }: {
  current: Step;
  locale: "en" | "ms";
  available: Step[];
  onNavigate: (step: Step) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const currentIndex = STEPS.indexOf(current);

  // On phones the row scrolls sideways, so keep the active step in view when it changes.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !active) return;
    const left = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [current]);

  return <nav className="shopping-step-nav" aria-label={locale === "en" ? "Shopping steps" : "Langkah membeli-belah"}>
    <ol ref={listRef}>{STEPS.map((step, index) => {
      const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
      return <li key={step} data-state={state}>
        <button type="button" aria-current={step === current ? "step" : undefined}
          disabled={step !== current && !available.includes(step)} onClick={() => onNavigate(step)}>
          <span className="shopping-step-number" aria-hidden="true">
            {state === "done"
              ? <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 4.5"/></svg>
              : index + 1}
          </span>
          {LABELS[locale][index]}
        </button>
      </li>;
    })}</ol>
  </nav>;
}
