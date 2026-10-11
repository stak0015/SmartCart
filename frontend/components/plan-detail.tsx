"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { BasketAlternativeLine, PricedPlan, StoreRecommendation, TravelLimit, SelectedLocation, TransportMode } from "@/lib/contracts";
import { applyBasketReplacement, lowerCostReplacementChoice, packReplacementChoice, undoBasketReplacement, type BasketItem } from "@/lib/basket-state";
import { getBasketAlternatives } from "@/lib/api-client";
import { editedPlan, planBasketItem, planDetailRows, repriceComparisonOptions } from "@/lib/plan-detail-edits";
import { recommendationDetailTotals, type RecommendationDetailRow } from "@/lib/recommendation-detail";
import { parseQty } from "@/lib/result-row";
import type { AppCopy, Locale } from "@/lib/i18n";
import { mapsPlanRouteUrl } from "@/lib/travel";
import { formatRm } from "@/lib/format-rm";
import { legRoleKey, secondStoreLimitLabel, type StorePlanOption } from "@/lib/multi-store";
import { calculatePlanEstimatedSavings } from "@/lib/estimated-savings";
import { createPlanShoppingChecklist, type ShoppingChecklist } from "@/lib/shopping-checklist";
import { SaraStoreTag } from "./store-tags";
import { TransportModeIcon } from "./transport-mode-icon";
import { StoreChainLogo } from "./store-chain-logo";
import { TripFactsItems } from "./trip-facts";
import { EstimatedSavingsSummary } from "./estimated-savings-summary";
import { TravelCostDetails } from "./travel-cost-breakdown";
import { DropdownChevron, UIIcon } from "./ui-icon";
import { RecommendationBasketRow } from "./recommendation-basket-row";
import { ConfirmationDialog } from "./shopping-checklist";

export function PlanDetailView({ plan: originalPlan, stores, basket, onSetBasket, secondStoreLimit, copy, locale, isEstimate = false, activeChecklist, onCreateChecklist, onBack, origin, transportMode = "car", comparisonOptions = [] }: {
  onSetBasket: Dispatch<SetStateAction<BasketItem[]>>;
  comparisonOptions?: StorePlanOption[];
  origin?: SelectedLocation | null; transportMode?: TransportMode;
  plan: PricedPlan; stores: StoreRecommendation[]; basket: BasketItem[]; secondStoreLimit: TravelLimit | null;
  copy: AppCopy; locale: Locale; isEstimate?: boolean; activeChecklist: ShoppingChecklist | null;
  onCreateChecklist: (checklist: ShoppingChecklist) => void; onBack: () => void;
}) {
  const [activeStoreId, setActiveStoreId] = useState(originalPlan.storePremiseIds[0]);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, BasketAlternativeLine[]>>({});
  const [alternativesLoading, setAlternativesLoading] = useState(true);
  const [alternativesError, setAlternativesError] = useState(false);
  const requestKey = JSON.stringify(originalPlan.storePremiseIds.map(id => ({ id, lines: originalPlan.assignments
    .filter(line => line.storePremiseId === id)
    .map(line => ({ itemId: line.itemId, quantity: planBasketItem(basket, line.itemId)?.qty ?? line.quantity })) })));
  useEffect(() => {
    const controller = new AbortController();
    const requests = JSON.parse(requestKey) as Array<{ id: string; lines: Array<{ itemId: string; quantity: number }> }>;
    setAlternativesLoading(true);
    setAlternativesError(false);
    Promise.allSettled(requests.map(request => getBasketAlternatives(request.id, request.lines, controller.signal)))
      .then(results => {
        if (controller.signal.aborted) return;
        const next: Record<string, BasketAlternativeLine[]> = {};
        results.forEach((result, index) => { if (result.status === "fulfilled") next[requests[index].id] = result.value.lines; });
        setSuggestions(next);
        setAlternativesError(results.some(result => result.status === "rejected"));
        setAlternativesLoading(false);
      });
    return () => controller.abort();
  }, [requestKey]);
  const rowsByStore = useMemo(() => Object.fromEntries(originalPlan.storePremiseIds.map(id => {
    const store = stores.find(value => value.premiseId === id) ?? { premiseId: id, basketLines: [], basketPrices: [] };
    return [id, planDetailRows(originalPlan, store, basket, suggestions[id]).map(row => ({ ...row,
      alternatives: { ...row.alternatives, quantity: row.current.quantity,
        savingsRm: row.alternatives.alternative?.unitPriceRm != null && row.source.unitPriceRm != null
          ? Math.round((row.source.unitPriceRm - row.alternatives.alternative.unitPriceRm) * row.current.quantity * 100) / 100 : null },
    }))];
  })), [originalPlan, stores, basket, suggestions]);
  const plan = editedPlan(originalPlan, rowsByStore);
  const totals = recommendationDetailTotals(Object.values(rowsByStore).flat());
  const baselinePlan = { ...originalPlan, basketSubtotalRm: totals.originalSubtotalRm,
    combinedTotalRm: totals.originalSubtotalRm == null ? null : Number((totals.originalSubtotalRm + originalPlan.transportCostRm).toFixed(2)) };
  const estimatedSavings = calculatePlanEstimatedSavings(baselinePlan, repriceComparisonOptions(comparisonOptions, basket), isEstimate ? "straight_line" : "google", plan);
  const activeIndex = plan.storePremiseIds.indexOf(activeStoreId);
  const store = stores.find(store => store.premiseId === activeStoreId);
  const lines = rowsByStore[activeStoreId] ?? [];
  const medianCount = plan.assignments.filter(line => line.priceSource === "median").length;
  const credit = totals.saraCreditRm ?? 0;
  const hasFuelBreakdown = plan.storeCount === 1 ? !!store?.travelCostBreakdown : plan.legs.length > 0 && plan.legs.every(leg => !!leg.travelCostBreakdown);
  const modeLabel = transportMode === "public_transport" ? copy.publicTransport : transportMode === "walk" ? copy.walking : copy[transportMode];
  const applyAlternative = (line: BasketAlternativeLine) => {
    if (!store || line.source.priceSource === "median") return;
    const choice = lowerCostReplacementChoice(line);
    if (choice) onSetBasket(current => applyBasketReplacement(current, choice, { id: store.premiseId, name: store.name }));
  };
  const applyPack = (row: RecommendationDetailRow, id: string) => {
    if (!store || row.source.priceSource === "median" || row.current.priceSource === "median") return;
    const pack = row.alternatives.packOptions?.find(value => value.itemId === id);
    const choice = pack && packReplacementChoice(row.alternatives, pack);
    if (choice) onSetBasket(current => applyBasketReplacement(current, choice, { id: store.premiseId, name: store.name }));
  };
  const createChecklist = () => {
    onCreateChecklist(createPlanShoppingChecklist(plan, stores, basket, {
      routeProvider: isEstimate ? "straight_line" : "google",
      estimatedSavings,
      ...(origin ? { routeOrigin: { latitude: origin.latitude, longitude: origin.longitude } } : {}),
    }));
    setReplaceOpen(false);
  };
  return <div className="screen-enter store-detail multi-plan-detail">
    <div className="store-detail-shell">
      <button type="button" className="plan-back-button" onClick={onBack}>← {copy.planDetailBack}</button>
      <nav className="plan-store-tabs" aria-label={copy.basketItems}>{plan.storePremiseIds.map((id, index) => <button type="button" key={id} aria-pressed={activeStoreId === id} onClick={() => setActiveStoreId(id)}><span>{locale === "en" ? `Store ${index + 1}` : `Kedai ${index + 1}`}</span><strong>{plan.storeNames[index]}</strong></button>)}</nav>
      <header className="store-detail-header">
        <div className="store-symbol store-detail-symbol" aria-hidden="true"><StoreChainLogo name={plan.storeNames[activeIndex]}/></div>
        <div className="store-detail-identity"><h1>{plan.storeNames[activeIndex]}</h1><p>{store ? [store.address, store.district, store.state].filter(Boolean).join(", ") : copy.planDetailAddressUnavailable}</p>{store && <SaraStoreTag status={store.saraStatus} copy={copy}/>}</div>
        <div className="store-detail-facts"><TripFactsItems facts={[
          {icon: <UIIcon name="home"/>, label: locale === "en" ? "From" : "Dari", value: origin?.label || "—"},
          {icon: <TransportModeIcon mode={transportMode} color="#526078"/>, label: copy.transportMode, value: modeLabel},
          {icon: <UIIcon name="route" size={20}/>, label: copy.distance, value: `${plan.totalRouteDistanceKm.toFixed(1)} km`},
          {icon: <UIIcon name="history" size={20}/>, label: copy.travelTime, value: `${plan.totalTravelMinutes} ${copy.minutes}`},
        ]}/></div>
        {origin && <a className="store-detail-route" href={mapsPlanRouteUrl(origin, plan, stores, transportMode)} target="_blank" rel="noopener noreferrer">{copy.openInGoogleMaps} ↗</a>}
      </header>
      <div className="store-detail-layout">
        <section className="store-detail-items">
          <details className="plan-journey"><summary className="dropdown-summary"><span>{copy.planDetailJourneyTitle}</span><DropdownChevron/></summary><ol className="plan-summary-legs">{plan.legs.map(leg => <li key={leg.role}><span><strong>{copy[legRoleKey(leg.role)]}</strong><small>{leg.fromName} → {leg.toName}</small></span><span>{leg.distanceKm.toFixed(1)} km<small>{leg.travelMinutes} {copy.minutes}</small></span></li>)}</ol>{secondStoreLimit && <p className="store-summary-note">{copy.planDetailSecondStoreLimit(secondStoreLimitLabel(secondStoreLimit, copy.minutes))}</p>}</details>
          <div className="store-detail-items-heading"><div><h2>{copy.planDetailItemsAtStore(plan.storeNames[activeIndex])}</h2><p>{copy.itemCount(lines.length)}</p></div></div>
          <div className="store-item-columns" aria-hidden="true"><span>{locale === "en" ? "Product" : "Produk"}</span><span>SARA</span><span>{locale === "en" ? "Unit size" : "Saiz unit"}</span><span>{locale === "en" ? "Qty" : "Kuantiti"}</span><span>{locale === "en" ? "Unit price" : "Harga unit"}</span><span>{locale === "en" ? "Total" : "Jumlah"}</span><span/></div>
          {alternativesLoading && <p role="status" className="store-detail-message">{copy.alternativesLoading}</p>}
          {alternativesError && <p role="alert" className="store-detail-message">{copy.alternativesUnavailable}</p>}
          <ul className="store-item-list">{lines.map(row => <RecommendationBasketRow key={row.source.itemId} row={row} basket={basket} copy={copy} locale={locale}
            onApplyAlternative={applyAlternative} onApplyPack={applyPack}
            onUndo={row => { if (row.basketItem) onSetBasket(current => undoBasketReplacement(current, row.basketItem!.id)); }}
            onChangeQuantity={(id, quantity) => { if (parseQty(String(quantity)) != null) onSetBasket(current => current.map(item => item.id === id ? { ...item, qty: quantity } : item)); }}/>)}</ul>
          <p className="store-price-note">{copy.stockNotVerified}</p>

        </section>
        <aside className="store-detail-sidebar">
          <section className="store-detail-summary">
            <h2><UIIcon name="basket" size={22}/>{locale === "en" ? "Basket summary" : "Ringkasan bakul"}</h2>
            <p className="store-summary-note">{plan.storeNames.join(" → ")} · {copy.itemCount(plan.basketLineCount)}</p>
            <dl className="store-summary-money"><div><dt>{plan.missingItems.length ? (medianCount ? copy.estimatedPartialTotal : copy.partialTotal) : medianCount ? copy.estimatedSubtotal : copy.basketSubtotal}</dt><dd>{plan.basketSubtotalRm == null ? "—" : formatRm(plan.basketSubtotalRm)}</dd></div>{plan.basketSubtotalRm != null && <><div><dt>{copy.saraCreditLabel}</dt><dd>{formatRm(credit)}</dd></div><div><dt>{copy.cashNeededLabel}</dt><dd>{formatRm(plan.basketSubtotalRm - credit)}</dd></div></>}</dl>
            {medianCount > 0 && <p className="store-summary-note">{medianCount} · {copy.medianPriceEstimate}</p>}
            {plan.missingItems.length > 0 && <p className="store-summary-note">{copy.missingItemPrices(plan.missingItems.join(", "))}</p>}
            <p className="store-summary-note">{locale === "en" ? "SARA eligibility and final payment should be verified at the store." : "Kelayakan SARA dan bayaran akhir perlu disahkan di kedai."}</p>
            <div className="store-summary-travel"><h3>{locale === "en" ? "Travel and total cost" : "Perjalanan dan jumlah kos"}</h3>{!hasFuelBreakdown && <div><span>{copy.returnTravel}</span><strong>{formatRm(plan.transportCostRm)}</strong></div>}<TravelCostDetails breakdowns={plan.storeCount === 1 ? [store?.travelCostBreakdown] : plan.legs.map(leg => leg.travelCostBreakdown)} locale={locale} roundTrip/><div><span>{plan.missingItems.length ? copy.partialEstimatedTotal : medianCount ? copy.estimatedCombinedTotal : copy.combinedTotal}</span><strong>{plan.combinedTotalRm == null ? "—" : formatRm(plan.combinedTotalRm)}</strong></div></div>
            <button type="button" className="primary-button store-start-button" disabled={alternativesLoading} onClick={() => activeChecklist ? setReplaceOpen(true) : createChecklist()}>{alternativesLoading ? copy.checklistPreparing : activeChecklist ? copy.replaceChecklist : copy.createChecklist}</button>
          </section>
          {!alternativesLoading && <EstimatedSavingsSummary snapshot={estimatedSavings} locale={locale}/>}
        </aside>
      </div>
    </div>
    <ConfirmationDialog open={replaceOpen} title={copy.replaceChecklist} body={copy.replaceChecklistConfirm} confirmLabel={copy.replaceChecklist} cancelLabel={copy.cancel} onCancel={() => setReplaceOpen(false)} onConfirm={createChecklist}/>
  </div>;
}
