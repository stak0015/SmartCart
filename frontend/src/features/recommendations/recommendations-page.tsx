"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  Info,
  MapPin,
  PackageCheck,
  RefreshCcw,
  Route,
  ShieldQuestion,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  estimateSaraPayment,
  formatRinggit,
  rankReachableStores,
} from "@/features/planner/domain";
import {
  CATALOG,
  DEMO_ALTERNATIVES,
  DEMO_STORES,
} from "@/features/planner/mock-data";
import { usePlanner } from "@/features/planner/planner-provider";
import type { RankedStore, TravelMode } from "@/features/planner/types";

const TRANSPORT_LABELS: Record<TravelMode, string> = {
  walking: "walking",
  "public-transport": "public transport",
  motorcycle: "motorcycle",
  car: "car",
};

function formatObservedDate(value: string | null) {
  if (!value) return "No recorded price date";
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function StoreCard({
  store,
  rank,
  isRecommended,
}: {
  store: RankedStore;
  rank?: number;
  isRecommended?: boolean;
}) {
  const offersByItem = new Map(store.offers.map((offer) => [offer.itemId, offer]));
  const { basket } = usePlanner();

  return (
    <article className={`store-card ${isRecommended ? "store-card--recommended" : ""}`}>
      <div className="store-card__topline">
        <div className="store-rank" aria-label={rank ? `Rank ${rank}` : "Partial basket result"}>
          {rank ?? "–"}
        </div>
        <div className="store-card__identity">
          <p className="section-kicker">Illustrative premise</p>
          <h3>{store.premiseName}</h3>
          <span><MapPin size={14} aria-hidden="true" /> {store.distanceKm.toFixed(1)} km · about {store.travelMinutes} min</span>
        </div>
        {isRecommended && <span className="recommendation-badge"><Sparkles size={15} /> Best complete basket</span>}
      </div>

      <div className="store-metrics">
        <div><span>{store.isCompleteBasket ? "Basket total" : "Known-item total"}</span><strong>{formatRinggit(store.basketTotal)}</strong></div>
        <div><span>Coverage</span><strong>{store.isCompleteBasket ? "All items" : `${store.missingItemIds.length} missing`}</strong></div>
        <div><span>Recorded prices</span><strong>{formatObservedDate(store.latestPriceObservedDate)}</strong></div>
      </div>

      <div className="store-labels">
        {store.saraPartner === true ? (
          <span className="verification-badge verification-badge--positive"><BadgeCheck size={14} /> Verified SARA partner (demo)</span>
        ) : store.saraPartner === null ? (
          <span className="verification-badge"><ShieldQuestion size={14} /> Partner status not verified</span>
        ) : (
          <span className="verification-badge">Not listed as a partner in demo data</span>
        )}
        {!store.isCompleteBasket && <span className="verification-badge verification-badge--warning"><AlertTriangle size={14} /> Not recommended as a complete trip</span>}
      </div>

      <div className="store-card__details">
        <details>
          <summary>Why this result <ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="details-copy">
            {isRecommended ? (
              <p>This is the lowest-priced premise inside your selected travel boundary with a recorded price for every basket item. Distance is used as a boundary, then complete baskets are ranked by total price.</p>
            ) : store.isCompleteBasket ? (
              <p>This premise is reachable and has a recorded price for every basket item, but its total is higher than the first-ranked complete basket.</p>
            ) : (
              <p>This premise is reachable, but it has no recorded price for {store.missingItemIds.length} basket {store.missingItemIds.length === 1 ? "item" : "items"}. It is separated so a deceptively low partial total is not recommended.</p>
            )}
          </div>
        </details>
        <details>
          <summary>View price breakdown <ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="price-breakdown">
            <table>
              <thead><tr><th>Item</th><th>Qty</th><th>Recorded price</th><th>Line total</th></tr></thead>
              <tbody>
                {basket.map((line) => {
                  const item = CATALOG.find((catalogItem) => catalogItem.id === line.itemId);
                  const offer = offersByItem.get(line.itemId);
                  if (!item) return null;
                  return (
                    <tr key={line.itemId}>
                      <td>{item.name}<small>{item.brand} · {item.packageSize}</small></td>
                      <td>{line.quantity}</td>
                      <td>{offer ? formatRinggit(offer.price) : "No record"}</td>
                      <td>{offer ? formatRinggit(offer.price * line.quantity) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p><Info size={15} aria-hidden="true" /> A price observation does not confirm that an item is currently in stock.</p>
          </div>
        </details>
      </div>
    </article>
  );
}

export function RecommendationsPage() {
  const {
    basket,
    travel,
    saraPlanningEnabled,
    saraCreditBalance,
    setSaraCreditBalance,
    weeklyBudget,
    applyAlternative,
  } = usePlanner();
  const [visibleCount, setVisibleCount] = useState(5);
  const [announcement, setAnnouncement] = useState("");

  const ranked = useMemo(
    () => rankReachableStores(DEMO_STORES, basket, travel),
    [basket, travel],
  );
  const completeStores = ranked.filter((store) => store.isCompleteBasket);
  const partialStores = ranked.filter((store) => !store.isCompleteBasket);
  const recommended = completeStores[0];
  const visibleCompleteStores = completeStores.slice(0, visibleCount);
  const averageTotal = completeStores.length
    ? completeStores.reduce((total, store) => total + store.basketTotal, 0) / completeStores.length
    : 0;
  const savingsVsAverage = recommended ? averageTotal - recommended.basketTotal : 0;
  const saraPayment = recommended && saraPlanningEnabled
    ? estimateSaraPayment(recommended, basket, CATALOG, saraCreditBalance)
    : null;
  const relevantAlternatives = DEMO_ALTERNATIVES.filter((suggestion) =>
    basket.some((line) => line.itemId === suggestion.currentItemId),
  );

  if (basket.length === 0) {
    return (
      <section className="empty-page">
        <p className="eyebrow">Basket needed</p>
        <h1>There is nothing to compare yet</h1>
        <p>Add at least one household essential, then set your travel boundary.</p>
        <Link className="button button--primary" href="/basket"><ArrowLeft size={17} /> Build a basket</Link>
      </section>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-heading page-heading--results">
        <div>
          <p className="eyebrow">Step 3 of 3</p>
          <h1>One shop, ranked for your whole basket</h1>
          <p>
            Comparing demo premises within {travel.maxDistanceKm} km of {travel.area} by {TRANSPORT_LABELS[travel.mode]}.
            {travel.saraPartnersOnly ? " Only verified demo SARA partners are included." : ""}
          </p>
        </div>
        <Link className="button button--secondary" href="/location"><RefreshCcw size={17} /> Change travel</Link>
      </div>

      <div className="data-caveat" role="note">
        <Info size={20} aria-hidden="true" />
        <p><strong>Prototype results:</strong> premise names, distances, prices and verification labels on this page are illustrative. The production adapter will use the PostgreSQL schema and a mapping provider.</p>
      </div>

      {recommended ? (
        <section className="recommendation-hero" aria-labelledby="recommendation-summary-title">
          <div className="recommendation-hero__lead">
            <span className="hero-icon"><StoreIcon size={27} aria-hidden="true" /></span>
            <div>
              <p className="section-kicker">Recommended single premise</p>
              <h2 id="recommendation-summary-title">{recommended.premiseName}</h2>
              <p>Complete basket · {recommended.distanceKm.toFixed(1)} km away · about {recommended.travelMinutes} min</p>
            </div>
          </div>
          <div className="recommendation-hero__price">
            <span>Basket total</span>
            <strong>{formatRinggit(recommended.basketTotal)}</strong>
            <small>{savingsVsAverage > 0 ? `${formatRinggit(savingsVsAverage)} below the reachable-store average` : "Lowest complete total found"}</small>
          </div>
          {weeklyBudget !== null && (
            <div className={`budget-status ${recommended.basketTotal <= weeklyBudget ? "budget-status--good" : "budget-status--over"}`}>
              <WalletCards size={19} aria-hidden="true" />
              <span>
                <strong>{recommended.basketTotal <= weeklyBudget ? `${formatRinggit(weeklyBudget - recommended.basketTotal)} under your basket budget` : `${formatRinggit(recommended.basketTotal - weeklyBudget)} over your basket budget`}</strong>
                <small>Budget is used only for this comparison.</small>
              </span>
            </div>
          )}
        </section>
      ) : (
        <section className="no-results" role="status">
          <AlertTriangle size={28} aria-hidden="true" />
          <div><h2>No complete basket found inside this boundary</h2><p>Try a wider travel limit, turn off the partner-only filter, or review partial results below.</p></div>
        </section>
      )}

      <div className="results-layout">
        <section className="store-results" aria-labelledby="reachable-stores-title">
          <div className="section-heading">
            <div><p className="section-kicker">Reachable store recommendation</p><h2 id="reachable-stores-title">Complete basket, cheapest first</h2></div>
            <span className="story-chip">US 2.2–2.4</span>
          </div>
          {visibleCompleteStores.length ? (
            <div className="store-list">
              {visibleCompleteStores.map((store, index) => (
                <StoreCard key={store.id} store={store} rank={index + 1} isRecommended={index === 0} />
              ))}
            </div>
          ) : (
            <div className="empty-state"><Route size={30} /><h3>No matching complete premises</h3><p>Your filters may be too narrow for this basket.</p></div>
          )}
          {visibleCount < completeStores.length && (
            <button className="button button--secondary button--wide" type="button" onClick={() => setVisibleCount((count) => count + 5)}>
              Show 5 more premises
            </button>
          )}

          {partialStores.length > 0 && (
            <div className="partial-results">
              <div className="section-heading section-heading--compact">
                <div><p className="section-kicker">Not recommended</p><h2>Partial basket records</h2></div>
                <span>{partialStores.length}</span>
              </div>
              <p className="supporting-text">These totals exclude missing price records and are not comparable with a complete basket.</p>
              <div className="store-list">
                {partialStores.map((store) => <StoreCard key={store.id} store={store} />)}
              </div>
            </div>
          )}
        </section>

        <aside className="insights-column">
          <section className="insight-card" aria-labelledby="budget-alternatives-title">
            <div className="insight-card__heading">
              <span className="icon-tile icon-tile--amber"><CircleDollarSign size={21} /></span>
              <div><p className="section-kicker">Smart budget alternatives</p><h2 id="budget-alternatives-title">Value trade-offs</h2></div>
              <span className="story-chip">Epic 3</span>
            </div>
            {relevantAlternatives.length ? (
              <div className="alternative-list">
                {relevantAlternatives.map((suggestion) => {
                  const currentItem = CATALOG.find((item) => item.id === suggestion.currentItemId);
                  const alternative = CATALOG.find((item) => item.id === suggestion.alternativeItemId);
                  if (!currentItem || !alternative) return null;
                  const priceDifference = suggestion.alternativePrice - suggestion.currentPrice;
                  return (
                    <article key={suggestion.id} className="alternative-card">
                      <div className="alternative-card__flag"><Sparkles size={15} /> Review value</div>
                      <h3>{alternative.name} · {alternative.packageSize}</h3>
                      <p>Instead of {currentItem.packageSize} from {currentItem.brand}</p>
                      <div className="tradeoff-grid">
                        <div><span>Spend now</span><strong>{formatRinggit(suggestion.alternativePrice)}</strong><small>{priceDifference >= 0 ? `+${formatRinggit(priceDifference)}` : `${formatRinggit(Math.abs(priceDifference))} less`}</small></div>
                        <div><span>Why consider it</span><strong>{priceDifference > 0 ? "Better unit value" : "Lower upfront cost"}</strong><small>Illustrative comparison</small></div>
                      </div>
                      <p className="alternative-note">{suggestion.note}</p>
                      <button
                        className="button button--secondary button--wide"
                        type="button"
                        onClick={() => {
                          applyAlternative(suggestion.currentItemId, suggestion.alternativeItemId);
                          setAnnouncement(`${currentItem.name} was replaced with ${alternative.packageSize}. Store totals have been recalculated.`);
                        }}
                      >
                        Apply alternative
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="compact-empty"><PackageCheck size={24} /><p>No current basket items have a demo alternative. The feature boundary is ready for a real recommendation model.</p></div>
            )}
          </section>

          {saraPlanningEnabled && recommended && (
            <section className="insight-card insight-card--teal" aria-labelledby="sara-breakdown-title">
              <div className="insight-card__heading">
                <span className="icon-tile"><ShoppingBag size={21} /></span>
                <div><p className="section-kicker">SARA-aware plan</p><h2 id="sara-breakdown-title">Estimated credit and cash</h2></div>
                <span className="story-chip">Epic 4</span>
              </div>
              <label className="field field--compact">
                <span>Credit available for this shop</span>
                <span className="money-input"><span>RM</span><input type="number" min="0" step="1" value={saraCreditBalance} onChange={(event) => setSaraCreditBalance(Number(event.target.value))} /></span>
                <small>This value stays in the current session and is not an eligibility check.</small>
              </label>
              {saraPayment && (
                <dl className="payment-breakdown">
                  <div><dt>Verified eligible items</dt><dd>{formatRinggit(saraPayment.verifiedEligibleSpend)}</dd></div>
                  <div><dt>Estimated SARA credit</dt><dd>− {formatRinggit(saraPayment.creditUsed)}</dd></div>
                  <div className="payment-breakdown__total"><dt>Estimated cash needed</dt><dd>{formatRinggit(saraPayment.cashRequired)}</dd></div>
                </dl>
              )}
              <p className="card-caveat"><Info size={15} /> Planning estimate only. Confirm current item eligibility, premise participation and available credit before purchase.</p>
            </section>
          )}

          <section className="insight-card insight-card--plain" aria-labelledby="data-meaning-title">
            <div className="insight-card__heading">
              <span className="icon-tile icon-tile--soft"><CalendarClock size={21} /></span>
              <div><p className="section-kicker">Price freshness</p><h2 id="data-meaning-title">What the data means</h2></div>
            </div>
            <ul className="meaning-list">
              <li><strong>Price observed</strong><span>The date PriceCatcher recorded a price.</span></li>
              <li><strong>Reachable</strong><span>Inside your chosen demo boundary, not a guarantee that the route suits you.</span></li>
              <li><strong>Missing price</strong><span>Unknown for this comparison; it does not prove an item is unavailable.</span></li>
            </ul>
          </section>
        </aside>
      </div>

      <div className="bottom-actions">
        <Link className="text-button" href="/basket"><ArrowLeft size={16} /> Edit basket</Link>
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  );
}
