"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STEPS = [
  { number: 1, label: "Build basket", shortLabel: "Basket", href: "/basket" as const },
  { number: 2, label: "Set travel", shortLabel: "Travel", href: "/location" as const },
  { number: 3, label: "Choose store", shortLabel: "Stores", href: "/recommendations" as const },
];

export function PlannerSteps() {
  const pathname = usePathname();
  const activeIndex = Math.max(0, STEPS.findIndex((step) => pathname.startsWith(step.href)));

  return (
    <nav className="planner-nav" aria-label="Basket planning progress">
      <ol className="planner-steps">
        {STEPS.map((step, index) => {
          const active = index === activeIndex;
          const complete = index < activeIndex;
          return (
            <li key={step.href} className={active ? "is-active" : complete ? "is-complete" : ""}>
              <Link href={step.href} aria-current={active ? "step" : undefined}>
                <span className="step-number" aria-hidden="true">
                  {complete ? <Check size={16} strokeWidth={3} /> : step.number}
                </span>
                <span className="step-label">
                  <span className="step-label__long">{step.label}</span>
                  <span className="step-label__short">{step.shortLabel}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
