"use client";

import type { PricedPlan, StoreRecommendation, TravelLimit } from "@/lib/contracts";
import type { AppCopy, Locale } from "@/lib/i18n";
import { localizedPackageSize } from "@/lib/package-size";
import { formatRm } from "@/lib/format-rm";
import { groupAssignmentsByStore, legRoleKey, secondStoreLimitLabel } from "@/lib/multi-store";
import { SaraStoreTag } from "./store-tags";
import { UIIcon } from "./ui-icon";

/**
 * US 6.4 — inspect one two-store plan: the visit order and journey, what to buy
 * at each store, and the combined cost behind it.
 *
 * This is an in-place detail view inside CompareScreen (not a URL route). That
 * choice is what satisfies AC 6.4.4 / 6.4.6: because CompareScreen is never
 * unmounted while the detail is open, the basket, travel preferences, the
 * multi-store toggle, the second-store constraint type and its selected presets
 * all stay exactly as the shopper left them on return. A route-based view would
 * drop the in-memory recommendation result and force a re-request.
 *
 * Data sources, and why nothing is guessed:
 * - The journey (legs, inter-store time, reverse-order cost, return totals) is
 *   carried on the PricedPlan itself, echoed by the backend in US 6.3.
 * - Per-store address / SARA / freshness labels come from that store's own
 *   StoreRecommendation, looked up by premise id (AC 6.4.3). A second store is
 *   constrained by the store-to-store limit and may sit outside the original
 *   travel limit, so it can be absent from `recommendations`; when it is, its
 *   labels show "unavailable" rather than borrowing another store's (which is
 *   exactly the mix-up AC 6.4.3 forbids).
 */
export function PlanDetailView({
  plan,
  stores,
  secondStoreLimit,
  copy,
  locale,
  onBack,
}: {
  plan: PricedPlan;
  stores: StoreRecommendation[];
  secondStoreLimit: TravelLimit | null;
  copy: AppCopy;
  locale: Locale;
  onBack: () => void;
}) {
  const byId = new Map(stores.map(store => [store.premiseId, store]));
  const groups = groupAssignmentsByStore(plan);

  return (
    <div className="screen-enter compare-screen pb-8">
      <div className="flex flex-col gap-5 px-4 pb-6 pt-5 sm:px-6 sm:pt-8">
        <button
          type="button"
          onClick={onBack}
          className="flex w-fit min-h-11 items-center gap-1 text-sm font-bold text-[#00535b]"
        >
          <span aria-hidden="true">←</span> {copy.planDetailBack}
        </button>

        <header className="flex flex-col gap-1">
          <h1 className="text-[26px] font-extrabold leading-8 tracking-[-0.6px] text-[#10152e] sm:text-[30px]">
            {plan.storeNames.join(" → ")}
          </h1>
          {/* The basis is disclosed, matching the comparison list. */}
          <p className="text-xs leading-4 text-[#718078]">{copy.multiStorePriceBasis}</p>
        </header>

        {/* AC 6.4.1: the journey — visit order, each leg, and the applied
            second-store limit that governs the store-to-store leg. */}
        <section className="rounded-2xl border border-[#dce5e0] bg-white p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#10152e]">
            <UIIcon name="route" size={20} /> {copy.planDetailJourneyTitle}
          </h2>
          {secondStoreLimit && (
            <p className="mt-2 text-xs font-semibold text-[#00535b]">
              {copy.planDetailSecondStoreLimit(secondStoreLimitLabel(secondStoreLimit, copy.minutes))}
            </p>
          )}

          <ol className="mt-3 flex flex-col gap-2">
            {plan.legs.map((leg, index) => {
              const isInterStore = leg.role === "first_to_second";
              return (
                <li
                  key={`${leg.role}-${index}`}
                  className={
                    "rounded-xl px-3 py-2 " +
                    (isInterStore ? "bg-[#eef6f1] ring-1 ring-[#cfe4d8]" : "bg-[#f4f8f9]")
                  }
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-[#10152e]">
                      {copy[legRoleKey(leg.role)]}
                    </span>
                    <span className="shrink-0 text-sm font-bold text-[#10152e]">
                      {leg.distanceKm.toFixed(1)} km · {leg.travelMinutes} {copy.minutes}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#526078]">
                    {leg.fromName} → {leg.toName} · {formatRm(leg.costRm)}
                  </p>
                  {/* AC 6.4.1/6.2.1: name which leg the second-store limits govern,
                      so the shopper is not left guessing home→store vs store→store. */}
                  {isInterStore && (
                    <p className="mt-1 text-xs font-medium text-[#00535b]">{copy.legInterStoreNote}</p>
                  )}
                </li>
              );
            })}
          </ol>

          <dl className="mt-3 flex flex-col gap-1.5 border-t border-[#e8ecea] pt-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[#526078]">{copy.planDetailTotalReturn}</dt>
              <dd className="font-semibold text-[#10152e]">
                {plan.totalRouteDistanceKm.toFixed(1)} km · {plan.totalTravelMinutes} {copy.minutes}
              </dd>
            </div>
            {/* AC 6.2.5 transparency: show what the rejected reverse order cost. */}
            {plan.reverseOrderCostRm !== null && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[#526078]">{copy.planDetailReverseOrder(formatRm(plan.reverseOrderCostRm))}</dt>
                <dd />
              </div>
            )}
          </dl>
        </section>

        {/* AC 6.4.2 / 6.4.3: purchases grouped by store; each store carries its
            OWN address, SARA and freshness labels, never another store's. */}
        {groups.map((group, index) => {
          const store = byId.get(group.storePremiseId) ?? null;
          return (
            <section key={group.storePremiseId} className="rounded-2xl border border-[#dce5e0] bg-white p-4">
              <header className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-bold text-[#10152e]">
                    <span className="mr-2 text-xs font-bold text-[#718078]">{index + 1}.</span>
                    {copy.planDetailItemsAtStore(group.storeName)}
                  </h2>
                  <span className="shrink-0 text-sm font-extrabold text-[#00535b]">
                    {formatRm(group.subtotalRm)}
                  </span>
                </div>
                {/* AC 6.4.1 "available address": shown when this store is in the
                    recommendation list, otherwise stated as unavailable — never
                    copied from the other store. */}
                <p className="text-xs text-[#526078]">
                  {store
                    ? [store.address, store.district, store.state].filter(Boolean).join(", ") || copy.planDetailAddressUnavailable
                    : copy.planDetailAddressUnavailable}
                </p>
                {/* AC 6.4.3: this store's own SARA eligibility label. */}
                {store && <SaraStoreTag status={store.saraStatus} copy={copy} />}
              </header>

              <ul className="mt-3 flex flex-col gap-2">
                {group.lines.map(line => (
                  <li
                    key={line.itemId}
                    className="flex items-start justify-between gap-3 border-b border-[#e2e9e5] pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-[13px] font-semibold text-[#10152e]">
                        {line.itemName ?? line.itemId}
                      </p>
                      {/* AC 6.4.2: pack spec, quantity, unit price, line total. */}
                      <p className="text-[11px] text-[#526078]">
                        {(localizedPackageSize(line.unit, locale) ?? "—")} · ×{line.quantity} ·{" "}
                        {formatRm(line.unitPriceRm)}
                      </p>
                      {/* AC 6.4.2: this line's own price observation date. */}
                      <p className="mt-0.5 text-[11px] text-[#718078]">
                        {line.observedDate ? copy.priceObserved(line.observedDate) : copy.priceDateUnavailable}
                      </p>
                    </div>
                    <strong className="shrink-0 text-sm text-[#10152e]">{formatRm(line.lineTotalRm)}</strong>
                  </li>
                ))}
                {group.lines.length === 0 && (
                  <li className="text-xs text-[#718078]">{copy.planMissingItems("—")}</li>
                )}
              </ul>
            </section>
          );
        })}

        {/* AC 6.4.1: the cost summary — basket, transport, combined total. */}
        <section className="rounded-2xl border border-[#dce5e0] bg-white p-4">
          <dl className="flex flex-col gap-1.5 text-sm">
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
        </section>
      </div>
    </div>
  );
}
