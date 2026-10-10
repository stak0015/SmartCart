"use client";

import { useState } from "react";
import type { PricedPlan, StoreRecommendation } from "@/lib/contracts";
import type { BasketItem } from "@/lib/basket-state";
import type { AppCopy, Locale } from "@/lib/i18n";
import { formatRm } from "@/lib/format-rm";
import { StoreChainLogo } from "./store-chain-logo";
import { SaraStoreTag } from "./store-tags";
import { DropdownChevron, UIIcon } from "./ui-icon";
import { StorePriceTable } from "./store-basket-row";

export function MultiPlanCard({ plan, copy, basket, stores, locale, onSelectPlan, routeUrl, isRecommended = false }: {
  plan: PricedPlan; copy: AppCopy; basket: BasketItem[]; stores: StoreRecommendation[]; locale: Locale;
  routeUrl?: string; onSelectPlan: (planId: string) => void; isRecommended?: boolean;
}) {
  const [pricesExpanded, setPricesExpanded] = useState(false);
  const medianCount = plan.assignments.filter(line => line.priceSource === "median").length;
  const officialCount = plan.pricedLineCount - medianCount;
  const totalLabel = plan.missingItems.length ? copy.partialEstimatedTotal : medianCount ? copy.estimatedCombinedTotal : copy.combinedTotal;
  const priceListId = `plan-prices-${plan.planId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return <article className={"store-card multi-plan-card " + (isRecommended ? "is-recommended" : "")}>
    <div className="store-card-marker">{isRecommended && <span>★ {copy.recommendedStore}</span>}<small>{copy.twoStorePlanLabel}</small></div>
    <header className="multi-plan-stores">{plan.storePremiseIds.map((id, index) => {
      const store = stores.find(store => store.premiseId === id);
      return <div key={id} className="store-card-header"><div className="store-symbol" aria-hidden="true"><StoreChainLogo name={plan.storeNames[index]} fallback={<UIIcon name="bag" size={24}/>}/></div><div className="store-card-identity"><small>{locale === "en" ? `Store ${index + 1}` : `Kedai ${index + 1}`}</small><h3>{plan.storeNames[index]}</h3>{store && <SaraStoreTag status={store.saraStatus} copy={copy}/>}</div></div>;
    })}</header>
    <div className="store-card-travel"><div className="store-card-trip-fact"><UIIcon name="route" size={20}/><small>{copy.distance}</small><strong>{plan.totalRouteDistanceKm.toFixed(1)} km</strong></div><div className="store-card-trip-fact"><UIIcon name="history" size={20}/><small>{copy.travelTime}</small><strong>{plan.totalTravelMinutes} {copy.minutes}</strong></div><div className="store-card-trip-fact"><UIIcon name="wallet" size={20}/><small>{copy.returnTravel}</small><strong>{formatRm(plan.transportCostRm)}</strong></div>{routeUrl && <a className="store-card-route" href={routeUrl} target="_blank" rel="noopener noreferrer">{copy.openInGoogleMaps} ↗</a>}</div>

    <div className="store-card-costs"><div><span>{medianCount ? copy.estimatedSubtotal : copy.basketSubtotal}</span><strong>{plan.basketSubtotalRm == null ? "—" : formatRm(plan.basketSubtotalRm)}</strong></div><div><span>{copy.returnTravel}</span><strong>{formatRm(plan.transportCostRm)}</strong></div><div className="store-card-grand-total"><span>{totalLabel}</span><strong>{plan.combinedTotalRm == null ? "—" : formatRm(plan.combinedTotalRm)}</strong></div></div>
    <div className="price-coverage"><span>{officialCount} {locale === "en" ? "store prices" : "harga kedai"} · {medianCount} {locale === "en" ? "median estimates" : "anggaran median"}{plan.missingItems.length > 0 && ` · ${plan.missingItems.length} ${locale === "en" ? "missing prices" : "tiada harga"}`}</span><progress max={plan.basketLineCount || 1} value={officialCount} aria-label={copy.priceCoverage(officialCount, plan.basketLineCount)}/></div>
    <div className="store-card-actions"><div className="store-price-anchor"><button type="button" className="store-price-trigger" aria-expanded={pricesExpanded} aria-controls={priceListId} onClick={() => setPricesExpanded(value => !value)}>{pricesExpanded ? copy.hidePriceList : copy.viewPriceList}<DropdownChevron/></button>{pricesExpanded && <div id={priceListId} className="store-price-popover plan-price-popover" onKeyDown={event => { if (event.key === "Escape") setPricesExpanded(false); }}><div className="store-price-popover-heading"><strong>{copy.basketItems}</strong><button type="button" onClick={() => setPricesExpanded(false)} aria-label={copy.dismiss}>×</button></div>{plan.storePremiseIds.map((id, index) => <div key={id}><h4>{plan.storeNames[index]}</h4><StorePriceTable prices={plan.assignments.filter(line => line.storePremiseId === id).map(line => ({...line, itemName: line.itemName || basket.find(item => item.id === `db-${line.itemId}`)?.name || line.itemId, packageSize: line.unit}))} copy={copy} locale={locale}/></div>)}</div>}</div><button type="button" className="store-select-button" onClick={() => onSelectPlan(plan.planId)}>{copy.planDetailViewButton}<span aria-hidden="true">→</span></button></div>
  </article>;
}
