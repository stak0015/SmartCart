"use client";
// Owners: Shun, Randy

import { useState } from "react";
import type { PricedPlan, StoreRecommendation, TransportMode } from "@/lib/contracts";
import type { BasketItem } from "@/lib/basket-state";
import type { AppCopy, Locale } from "@/lib/i18n";
import { formatRm } from "@/lib/format-rm";
import { TransportModeIcon } from "./transport-mode-icon";
import { StoreChainLogo } from "./store-chain-logo";
import { SaraStoreTag } from "./store-tags";
import { DropdownChevron, UIIcon } from "./ui-icon";
import { StorePriceTable } from "./store-basket-row";

// The card carries one SARA tag, shown only when every store in the plan is a
// verified partner; the plan page shows each store's own tag (AC 6.4.3).
function planSaraStatus(plan: PricedPlan, stores: StoreRecommendation[]) {
  return plan.storePremiseIds.every(id => stores.find(store => store.premiseId === id)?.saraStatus === "verified") ? "verified" : "unverified";
}

export function MultiPlanCard({ plan, copy, basket, stores, locale, onSelectPlan, routeUrl, isRecommended = false, transportMode = "car" }: {
  plan: PricedPlan; copy: AppCopy; basket: BasketItem[]; stores: StoreRecommendation[]; locale: Locale;
  transportMode?: TransportMode; routeUrl?: string; onSelectPlan: (planId: string) => void; isRecommended?: boolean;
}) {
  const [pricesExpanded, setPricesExpanded] = useState(false);
  const medianCount = plan.assignments.filter(line => line.priceSource === "median").length;
  const officialCount = plan.pricedLineCount - medianCount;
  const totalLabel = plan.missingItems.length ? copy.partialEstimatedTotal : medianCount ? copy.estimatedCombinedTotal : copy.combinedTotal;
  const priceListId = `plan-prices-${plan.planId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return <article className={"store-card multi-plan-card " + (isRecommended ? "is-recommended" : "")}>
    <div className="store-card-marker">{isRecommended && <span>★ {copy.recommendedStore}</span>}<small>{copy.twoStorePlanLabel}</small></div>
    {/* Both stores share one header row so a two-store card is the same height
        as a single-store card; per-store details are on the plan page (US 6.4). */}
    <header className="store-card-header multi-plan-header">
      <div className="multi-plan-logos" aria-hidden="true">{plan.storeNames.map((name, index) => <div key={index} className="store-symbol"><StoreChainLogo name={name}/></div>)}</div>
      <div className="store-card-identity">
        <h3 title={plan.storeNames.join(" + ")}>{plan.storeNames.map((name, index) => <span key={index}>{index > 0 && <span className="multi-plan-plus" aria-label={locale === "en" ? "and" : "dan"}> + </span>}{name}</span>)}</h3>
        {planSaraStatus(plan, stores) === "verified" && <SaraStoreTag status="verified" copy={copy}/>}
      </div>
    </header>
    <div className="store-card-travel"><div className="store-card-trip-fact"><TransportModeIcon mode={transportMode} color="#526078"/><small>{copy.distance}</small><strong>{plan.totalRouteDistanceKm.toFixed(1)} km</strong></div><div className="store-card-trip-fact"><UIIcon name="history" size={20}/><small>{copy.travelTime}</small><strong>{plan.totalTravelMinutes} {copy.minutes}</strong></div><div className="store-card-trip-fact"><UIIcon name="wallet" size={20}/><small>{copy.returnTravel}</small><strong>{formatRm(plan.transportCostRm)}</strong></div>{routeUrl && <a className="store-card-route" href={routeUrl} target="_blank" rel="noopener noreferrer">{copy.openInGoogleMaps} ↗</a>}</div>

    <div className="store-card-costs"><div><span>{plan.missingItems.length ? (medianCount ? copy.estimatedPartialTotal : copy.partialTotal) : medianCount ? copy.estimatedSubtotal : copy.basketSubtotal}{plan.basketLineCount ? ` (${plan.basketLineCount})` : ""}</span><strong>{plan.basketSubtotalRm == null ? "—" : formatRm(plan.basketSubtotalRm)}</strong></div><div><span>{copy.returnTravel}</span><strong>{formatRm(plan.transportCostRm)}</strong></div><div className="store-card-grand-total"><span>{totalLabel}</span><strong>{plan.combinedTotalRm == null ? "—" : formatRm(plan.combinedTotalRm)}</strong></div></div>
    <div className="price-coverage"><span>{officialCount} {locale === "en" ? "store prices" : "harga kedai"} · {medianCount} {locale === "en" ? "estimated prices" : "harga anggaran"}{plan.missingItems.length > 0 && ` · ${plan.missingItems.length} ${locale === "en" ? "missing prices" : "tiada harga"}`}</span><progress max={plan.basketLineCount || 1} value={officialCount} aria-label={copy.priceCoverage(officialCount, plan.basketLineCount)}/></div>
    <div className="store-card-actions"><div className="store-price-anchor"><button type="button" className="store-price-trigger" aria-expanded={pricesExpanded} aria-controls={priceListId} onClick={() => setPricesExpanded(value => !value)}>{pricesExpanded ? copy.hidePriceList : copy.viewPriceList}<DropdownChevron/></button>{pricesExpanded && <div id={priceListId} className="store-price-popover plan-price-popover" onKeyDown={event => { if (event.key === "Escape") setPricesExpanded(false); }}><div className="store-price-popover-heading"><strong>{copy.basketItems}</strong><button type="button" onClick={() => setPricesExpanded(false)} aria-label={copy.dismiss}>×</button></div>{plan.storePremiseIds.map((id, index) => <div key={id}><h4>{plan.storeNames[index]}</h4><StorePriceTable prices={plan.assignments.filter(line => line.storePremiseId === id).map(line => ({...line, itemName: line.itemName || basket.find(item => item.id === `db-${line.itemId}`)?.name || line.itemId, packageSize: line.unit}))} copy={copy} locale={locale}/></div>)}{plan.missingItems.length > 0 && <p className="store-price-missing">{copy.missingItemPrices(plan.missingItems.join(", "))}</p>}</div>}</div><button type="button" className="store-select-button" onClick={() => onSelectPlan(plan.planId)}>{copy.planDetailViewButton}</button></div>
  </article>;
}
