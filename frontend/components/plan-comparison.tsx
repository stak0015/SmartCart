"use client";

import type { PlanComparison, PricedPlan } from "@/lib/contracts";
import type { AppCopy } from "@/lib/i18n";
import { formatRm } from "@/lib/format-rm";
import { savingState } from "@/lib/multi-store";

/**
 * US 6.3 — combined-cost comparison of single-store and two-store plans.
 *
 * Render rules, all driven by the backend's already-computed figures so this
 * component invents nothing:
 * - AC 6.3.3: `completePlans` arrive cheapest-combined-total first and are shown
 *   in that order.
 * - AC 6.3.4: `incompletePlans` render in a separate, clearly-labelled group and
 *   never inside the ranked complete list.
 * - AC 6.3.5: a positive saving states the amount and the baseline store.
 * - AC 6.3.6: when no baseline existed the backend sends null and nothing
 *   numeric is claimed — no "RM0 saving".
 *
 * The single-store card list from Epic 2 is rendered elsewhere and is untouched;
 * this is an additional comparison view that only appears when the backend
 * produced a `comparison` (basket sent + at least one two-store plan).
 */
export function PlanComparisonSection({
  comparison,
  copy,
  onSelectPlan,
}: {
  comparison: PlanComparison;
  copy: AppCopy;
  onSelectPlan: (planId: string) => void;
}) {
  const { completePlans, incompletePlans } = comparison;
  if (completePlans.length === 0 && incompletePlans.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-label={copy.planComparisonTitle}>
      <div>
        <h2 className="text-[20px] font-extrabold leading-7 text-[#10152e]">
          {copy.planComparisonTitle}
        </h2>
        {/* The basis is disclosed rather than implied: these totals use official
            store prices only, so they differ from the store cards above, which
            may include median estimates. */}
        <p className="mt-1 text-xs leading-4 text-[#718078]">{copy.multiStorePriceBasis}</p>
      </div>

      {completePlans.map(plan => (
        <PlanCard
          key={plan.planId}
          plan={plan}
          copy={copy}
          baselineName={comparison.singleStoreBaselineName}
          onSelectPlan={onSelectPlan}
        />
      ))}

      {incompletePlans.length > 0 && (
        <div className="mt-2 flex flex-col gap-3">
          {/* AC 6.3.4: kept visually apart and explicitly not ranked. */}
          <div>
            <h3 className="text-sm font-bold leading-5 text-[#10152e]">
              {copy.incompletePlansTitle}
            </h3>
            <p className="mt-1 text-xs leading-4 text-[#718078]">{copy.incompletePlansNote}</p>
          </div>
          {incompletePlans.map(plan => (
            <PlanCard
              key={plan.planId}
              plan={plan}
              copy={copy}
              baselineName={comparison.singleStoreBaselineName}
              onSelectPlan={onSelectPlan}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PlanCard({
  plan,
  copy,
  baselineName,
  onSelectPlan,
}: {
  plan: PricedPlan;
  copy: AppCopy;
  baselineName: string | null;
  onSelectPlan: (planId: string) => void;
}) {
  const isTwoStore = plan.storeCount === 2;
  const label = isTwoStore ? copy.twoStorePlanLabel : copy.singleStorePlanLabel;
  // A negative saving is shown as a real amount, not silently dropped, so a more
  // expensive split is never implied to be a win.
  const state = savingState(plan.savingVsSingleRm);
  const absoluteSaving = plan.savingVsSingleRm === null
    ? null
    : formatRm(Math.abs(plan.savingVsSingleRm));

  return (
    <article className="rounded-2xl border border-[#dce5e0] bg-white p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-bold leading-6 text-[#10152e]">{plan.storeNames.join(" → ")}</h3>
        <span className="shrink-0 rounded-full bg-[#e8f1ec] px-2.5 py-1 text-xs font-bold text-[#00535b]">
          {label}
        </span>
      </header>

      {/* AC 6.3.2: the combined total is the sum of the two lines below, shown
          separately so the arithmetic is checkable rather than asserted. */}
      <dl className="mt-3 flex flex-col gap-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[#526078]">{copy.planBasketSubtotal}</dt>
          <dd className="font-semibold text-[#10152e]">{formatRm(plan.basketSubtotalRm)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[#526078]">{copy.planTransportCost}</dt>
          <dd className="font-semibold text-[#10152e]">{formatRm(plan.transportCostRm)}</dd>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-[#e8ecea] pt-2">
          <dt className="font-bold text-[#10152e]">{copy.planCombinedTotal}</dt>
          <dd className="text-lg font-extrabold text-[#00535b]">{formatRm(plan.combinedTotalRm)}</dd>
        </div>
      </dl>

      {/* AC 6.3.4: an incomplete plan shows coverage and a partial total, and is
          labelled as such rather than presented as a cheapest option. */}
      {!plan.isComplete && (
        <div className="mt-3 rounded-xl bg-[#fff7e8] px-3 py-2 text-xs leading-4 text-[#7a4d00]">
          <p className="font-bold">
            {copy.planPartialTotal}: {formatRm(plan.combinedTotalRm)} ·{" "}
            {copy.planPriceCoverage(plan.pricedLineCount, plan.basketLineCount)}
          </p>
          {plan.missingItems.length > 0 && (
            <p className="mt-1">{copy.planMissingItems(plan.missingItems.join(", "))}</p>
          )}
        </div>
      )}

      {/* AC 6.3.5 / 6.3.6: the saving claim is driven entirely by the backend's
          null-or-number. Null renders an explanatory line with no amount. */}
      {isTwoStore && state === "save" && absoluteSaving !== null && (
        <p className="mt-3 text-sm font-semibold leading-5 text-[#007d38]">
          {copy.planSavingVsSingle(
            absoluteSaving,
            // "save" implies a baseline existed, so the name is present; the
            // fallback only guards the type, never names a wrong store.
            baselineName ?? copy.singleStorePlanLabel,
          )}
        </p>
      )}
      {isTwoStore && state === "more" && absoluteSaving !== null && (
        <p className="mt-3 text-sm font-semibold leading-5 text-[#93000a]">
          {copy.planCostsMoreThanSingle(absoluteSaving)}
        </p>
      )}
      {/* "equal" and "none" both mean no money is saved: equal is a zero saving,
          none means no baseline existed (AC 6.3.6). Neither claims an amount. */}
      {isTwoStore && (state === "equal" || state === "none") && (
        <p className="mt-3 text-sm leading-5 text-[#526078]">
          {copy.planNoSingleStoreBaseline}
        </p>
      )}

      {/* US 6.4: only two-store plans get a detail view — the visit order and
          per-store shopping list. A single-store plan already has the store
          overview route, so it is not offered here. */}
      {isTwoStore && (
        <button
          type="button"
          onClick={() => onSelectPlan(plan.planId)}
          className="mt-3 min-h-11 rounded-xl border border-[#007d38] bg-white px-4 text-sm font-bold text-[#007d38]"
        >
          {copy.planDetailViewButton} <span aria-hidden="true">→</span>
        </button>
      )}
    </article>
  );
}
