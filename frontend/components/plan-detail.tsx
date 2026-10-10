"use client";

import { useState } from "react";
import type { PricedPlan, StoreRecommendation, TravelLimit, SelectedLocation, TransportMode } from "@/lib/contracts";
import type { BasketItem } from "@/lib/basket-state";
import type { AppCopy, Locale } from "@/lib/i18n";
import { mapsPlanRouteUrl } from "@/lib/travel";
import { formatRm } from "@/lib/format-rm";
import { legRoleKey, secondStoreLimitLabel } from "@/lib/multi-store";
import { createPlanShoppingChecklist, type ShoppingChecklist } from "@/lib/shopping-checklist";
import { SaraStoreTag } from "./store-tags";
import { StoreChainLogo } from "./store-chain-logo";
import { TripFactsItems } from "./trip-facts";
import { DropdownChevron, UIIcon } from "./ui-icon";
import { PlanBasketItems } from "./plan-basket-items";
import { ConfirmationDialog } from "./shopping-checklist";

export function PlanDetailView({ plan, stores, basket, secondStoreLimit, copy, locale, isEstimate = false, activeChecklist, onCreateChecklist, onBack, origin, transportMode = "car" }: {
  origin?: SelectedLocation | null; transportMode?: TransportMode;
  plan: PricedPlan; stores: StoreRecommendation[]; basket: BasketItem[]; secondStoreLimit: TravelLimit | null;
  copy: AppCopy; locale: Locale; isEstimate?: boolean; activeChecklist: ShoppingChecklist | null;
  onCreateChecklist: (checklist: ShoppingChecklist) => void; onBack: () => void;
}) {
  const [activeStoreId, setActiveStoreId] = useState(plan.storePremiseIds[0]);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const activeIndex = plan.storePremiseIds.indexOf(activeStoreId);
  const store = stores.find(store => store.premiseId === activeStoreId);
  const lines = plan.assignments.filter(line => line.storePremiseId === activeStoreId);
  const medianCount = plan.assignments.filter(line => line.priceSource === "median").length;
  const assignedSubtotal = lines.reduce((total, line) => total + (line.lineTotalRm ?? 0), 0);
  const credit = plan.assignments.reduce((total, line) => total + (line.saraEligible || line.saraCategoryCandidate ? line.lineTotalRm ?? 0 : 0), 0);
  const createChecklist = () => {
    onCreateChecklist(createPlanShoppingChecklist(plan, stores, basket, {
      routeProvider: isEstimate ? "straight_line" : "google",
      ...(origin ? { routeOrigin: { latitude: origin.latitude, longitude: origin.longitude } } : {}),
    }));
    setReplaceOpen(false);
  };
  return <div className="screen-enter store-detail multi-plan-detail">
    <div className="store-detail-shell">
      <button type="button" className="plan-back-button" onClick={onBack}>← {copy.planDetailBack}</button>
      <nav className="plan-store-tabs" aria-label={copy.basketItems}>{plan.storePremiseIds.map((id, index) => <button type="button" key={id} aria-pressed={activeStoreId === id} onClick={() => setActiveStoreId(id)}><span>{locale === "en" ? `Store ${index + 1}` : `Kedai ${index + 1}`}</span><strong>{plan.storeNames[index]}</strong></button>)}</nav>
      <header className="store-detail-header">
        <div className="store-symbol store-detail-symbol" aria-hidden="true"><StoreChainLogo name={plan.storeNames[activeIndex]} fallback={<UIIcon name="bag" size={28}/>}/></div>
        <div className="store-detail-identity"><h1>{plan.storeNames[activeIndex]}</h1><p>{store ? [store.address, store.district, store.state].filter(Boolean).join(", ") : copy.planDetailAddressUnavailable}</p>{store && <SaraStoreTag status={store.saraStatus} copy={copy}/>}</div>
        <div className="store-detail-facts"><TripFactsItems facts={[
          {icon: <UIIcon name="bag" size={20}/>, label: locale === "en" ? "Items at this store" : "Item di kedai ini", value: `${lines.length} · ${lines.some(line => line.unitPriceRm != null) ? formatRm(assignedSubtotal) : "—"}`},
          {icon: <UIIcon name="route" size={20}/>, label: copy.distance, value: `${plan.totalRouteDistanceKm.toFixed(1)} km`},
          {icon: <UIIcon name="history" size={20}/>, label: copy.travelTime, value: `${plan.totalTravelMinutes} ${copy.minutes}`},
          {icon: <UIIcon name="wallet" size={20}/>, label: copy.returnTravel, value: formatRm(plan.transportCostRm)},
        ]}/></div>
        {origin && <a className="store-detail-route" href={mapsPlanRouteUrl(origin, plan, stores, transportMode)} target="_blank" rel="noopener noreferrer">{copy.openInGoogleMaps} ↗</a>}
      </header>
      <div className="store-detail-layout">
        <section className="store-detail-items">
          <details className="plan-journey"><summary className="dropdown-summary"><span>{copy.planDetailJourneyTitle}</span><DropdownChevron/></summary><ol className="plan-summary-legs">{plan.legs.map(leg => <li key={leg.role}><span><strong>{copy[legRoleKey(leg.role)]}</strong><small>{leg.fromName} → {leg.toName}</small></span><span>{leg.distanceKm.toFixed(1)} km<small>{leg.travelMinutes} {copy.minutes}</small></span></li>)}</ol>{secondStoreLimit && <p className="store-summary-note">{copy.planDetailSecondStoreLimit(secondStoreLimitLabel(secondStoreLimit, copy.minutes))}</p>}</details>
          <div className="store-detail-items-heading"><div><h2>{copy.planDetailItemsAtStore(plan.storeNames[activeIndex])}</h2><p>{copy.itemCount(lines.length)}</p></div></div>
          <PlanBasketItems lines={lines} basket={basket} copy={copy} locale={locale}/>
          <p className="store-price-note">{copy.stockNotVerified}</p>

        </section>
        <aside className="store-detail-sidebar">
          <section className="store-detail-summary">
            <h2><UIIcon name="basket" size={22}/>{locale === "en" ? "Basket summary" : "Ringkasan bakul"}</h2>
            <p className="store-summary-note">{plan.storeNames.join(" → ")} · {copy.itemCount(plan.basketLineCount)}</p>
            <dl className="store-summary-money"><div><dt>{plan.missingItems.length ? copy.partialTotal : medianCount ? copy.estimatedSubtotal : copy.basketSubtotal}</dt><dd>{plan.basketSubtotalRm == null ? "—" : formatRm(plan.basketSubtotalRm)}</dd></div>{plan.basketSubtotalRm != null && <><div><dt>{copy.saraCreditLabel}</dt><dd>{formatRm(credit)}</dd></div><div><dt>{copy.cashNeededLabel}</dt><dd>{formatRm(plan.basketSubtotalRm - credit)}</dd></div></>}</dl>
            {medianCount > 0 && <p className="store-summary-note">{medianCount} · {copy.medianPriceEstimate}</p>}
            {plan.missingItems.length > 0 && <p className="store-summary-note">{copy.missingItemPrices(plan.missingItems.join(", "))}</p>}
            <p className="store-summary-note">{locale === "en" ? "SARA eligibility and final payment should be verified at the store." : "Kelayakan SARA dan bayaran akhir perlu disahkan di kedai."}</p>
            <div className="store-summary-travel"><h3>{locale === "en" ? "Travel and total cost" : "Perjalanan dan jumlah kos"}</h3><div><span>{copy.returnTravel}</span><strong>{formatRm(plan.transportCostRm)}</strong></div><div><span>{plan.missingItems.length ? copy.partialEstimatedTotal : medianCount ? copy.estimatedCombinedTotal : copy.combinedTotal}</span><strong>{plan.combinedTotalRm == null ? "—" : formatRm(plan.combinedTotalRm)}</strong></div></div>
            <button type="button" className="primary-button store-start-button" onClick={() => activeChecklist ? setReplaceOpen(true) : createChecklist()}>{activeChecklist ? copy.replaceChecklist : copy.createChecklist} →</button>
          </section>
        </aside>
      </div>
    </div>
    <ConfirmationDialog open={replaceOpen} title={copy.replaceChecklist} body={copy.replaceChecklistConfirm} confirmLabel={copy.replaceChecklist} cancelLabel={copy.cancel} onCancel={() => setReplaceOpen(false)} onConfirm={createChecklist}/>
  </div>;
}
