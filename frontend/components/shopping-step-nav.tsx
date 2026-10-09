"use client";

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
  return <nav className="shopping-step-nav" aria-label={locale === "en" ? "Shopping steps" : "Langkah membeli-belah"}>
    <ol>{STEPS.map((step, index) => <li key={step}>
      <button type="button" aria-current={step === current ? "step" : undefined}
        disabled={step !== current && !available.includes(step)} onClick={() => onNavigate(step)}>
        <span className="shopping-step-number" aria-hidden="true">{index + 1}</span>{LABELS[locale][index]}
      </button>
    </li>)}</ol>
  </nav>;
}
