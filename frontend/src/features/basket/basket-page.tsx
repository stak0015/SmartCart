"use client";

import {
  BadgeCheck,
  ChevronRight,
  Info,
  PackageSearch,
  Search,
  ShieldQuestion,
  ShoppingBasket,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { QuantityControl } from "@/components/quantity-control";
import {
  basketSummary,
  filterCatalog,
  validateQuantity,
  validateQuantityInput,
} from "@/features/planner/domain";
import { CATALOG } from "@/features/planner/mock-data";
import { findBasketLine, usePlanner } from "@/features/planner/planner-provider";
import { CATEGORIES, type Category } from "@/features/planner/types";

export function BasketPage() {
  const router = useRouter();
  const {
    basket,
    addItem,
    updateQuantity,
    removeItem,
    saraPlanningEnabled,
    setSaraPlanningEnabled,
    weeklyBudget,
    setWeeklyBudget,
  } = usePlanner();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [emptyError, setEmptyError] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const results = useMemo(() => filterCatalog(CATALOG, search, category), [search, category]);
  const summary = basketSummary(basket);

  function quantityFor(itemId: string) {
    return quantities[itemId] ?? "1";
  }

  function addToBasket(itemId: string, itemName: string) {
    const value = Number(quantityFor(itemId));
    if (validateQuantityInput(quantityFor(itemId))) return;
    addItem(itemId, value);
    setAnnouncement(`${value} ${itemName} added to your basket.`);
    setEmptyError(false);
  }

  function continueToLocation() {
    if (basket.length === 0) {
      setEmptyError(true);
      return;
    }
    router.push("/location");
  }

  return (
    <div className="page-shell">
      <div className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Step 1 of 3</p>
          <h1>Build your essential basket</h1>
          <p>Add the exact items and quantities you intend to buy. We&apos;ll compare the whole basket at one reachable premise.</p>
        </div>
        <div className="prototype-note">
          <Info size={19} aria-hidden="true" />
          <span><strong>Demo catalogue</strong> — item and verification labels below are illustrative until connected to the database.</span>
        </div>
      </div>

      <div className="planner-layout">
        <section className="planner-primary" aria-labelledby="find-items-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Essential basket building</p>
              <h2 id="find-items-title">Find supported items</h2>
            </div>
            <span className="story-chip">US 1.1–1.4</span>
          </div>

          <div className="filter-grid">
            <label className="field">
              <span>Search item name</span>
              <span className="input-with-icon">
                <Search size={19} aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Try ‘beras’ or ‘minyak’"
                  autoComplete="off"
                />
              </span>
              <small>{search.trim().length === 1 ? "Type one more character to search." : "Search begins after 2 characters."}</small>
            </label>

            <label className="field">
              <span>Browse by category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as Category | "")}>
                <option value="">Select a category</option>
                {CATEGORIES.map((itemCategory) => (
                  <option key={itemCategory} value={itemCategory}>{itemCategory}</option>
                ))}
              </select>
              <small>Category and search filters work together.</small>
            </label>
          </div>

          <div className="results-heading" aria-live="polite">
            <h3>Matching items</h3>
            {(search.trim().length >= 2 || category) && <span>{results.length} shown</span>}
          </div>

          {search.trim().length < 2 && !category ? (
            <div className="empty-state">
              <PackageSearch size={31} aria-hidden="true" />
              <h3>Search or choose a category</h3>
              <p>Matching items will appear here with all details visible before you add them.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="empty-state" role="status">
              <PackageSearch size={31} aria-hidden="true" />
              <h3>No items found</h3>
              <p>Try another keyword or category.</p>
            </div>
          ) : (
            <div className="catalog-list">
              {results.map((item) => {
                const quantity = quantityFor(item.id);
                const quantityError = validateQuantityInput(quantity);
                const basketLine = findBasketLine(basket, item.id);
                return (
                  <article className="catalog-row" key={item.id}>
                    <div className="item-monogram" aria-hidden="true">{item.name.slice(0, 1)}</div>
                    <div className="catalog-row__details">
                      <div className="item-title-row">
                        <h3>{item.name}</h3>
                        {item.saraEligible === true ? (
                          <span className="verification-badge verification-badge--positive"><BadgeCheck size={14} /> Verified SARA item</span>
                        ) : item.saraEligible === null ? (
                          <span className="verification-badge"><ShieldQuestion size={14} /> SARA status not verified</span>
                        ) : null}
                      </div>
                      <dl className="item-attributes">
                        <div><dt>Brand</dt><dd>{item.brand}</dd></div>
                        <div><dt>Pack</dt><dd>{item.packageSize}</dd></div>
                        <div><dt>Unit</dt><dd>{item.unit}</dd></div>
                      </dl>
                    </div>
                    <div className="catalog-row__action">
                      <QuantityControl
                        id={`catalog-quantity-${item.id}`}
                        value={quantity}
                        onChange={(value) => setQuantities((current) => ({ ...current, [item.id]: value }))}
                        label={`quantity for ${item.name}, ${item.brand}, ${item.packageSize}`}
                        error={quantityError}
                      />
                      <button
                        className="button button--primary button--small"
                        type="button"
                        disabled={Boolean(quantityError)}
                        onClick={() => addToBasket(item.id, item.name)}
                      >
                        {basketLine ? "Add more" : "Add"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="basket-panel" aria-labelledby="basket-title">
          <div className="basket-panel__title">
            <span className="icon-tile"><ShoppingBasket size={21} aria-hidden="true" /></span>
            <div>
              <p className="section-kicker">Your plan</p>
              <h2 id="basket-title">Your basket</h2>
            </div>
          </div>

          {basket.length === 0 ? (
            <div className="basket-empty">
              <p>Your basket is empty.</p>
              <span>Search and add items to start comparing prices.</span>
            </div>
          ) : (
            <ul className="basket-list">
              {basket.map((line) => {
                const item = CATALOG.find((catalogItem) => catalogItem.id === line.itemId);
                if (!item) return null;
                return (
                  <li key={line.itemId}>
                    <div className="basket-line__heading">
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.brand} · {item.packageSize} · {item.unit}</span>
                      </div>
                      <button className="icon-button icon-button--danger" type="button" onClick={() => removeItem(line.itemId)} aria-label={`Remove ${item.name} from basket`}>
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="basket-line__footer">
                      <span>Quantity</span>
                      <QuantityControl
                        id={`basket-quantity-${item.id}`}
                        value={String(line.quantity)}
                        onChange={(value) => {
                          const parsed = Number(value);
                          if (!validateQuantity(parsed)) updateQuantity(line.itemId, parsed);
                        }}
                        label={`quantity of ${item.name} in basket`}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="basket-summary" aria-live="polite">
            <span>{summary.itemTypes} item {summary.itemTypes === 1 ? "type" : "types"}</span>
            <span aria-hidden="true">·</span>
            <span>{summary.totalUnits} total {summary.totalUnits === 1 ? "unit" : "units"}</span>
          </div>

          <div className="planning-options">
            <label className="check-card">
              <input
                type="checkbox"
                checked={saraPlanningEnabled}
                onChange={(event) => setSaraPlanningEnabled(event.target.checked)}
              />
              <span>
                <strong>Plan with SARA credit</strong>
                <small>Optional. You do not need to disclose income or eligibility.</small>
              </span>
            </label>
            <label className="field field--compact">
              <span><WalletCards size={16} aria-hidden="true" /> Optional basket budget</span>
              <span className="money-input"><span>RM</span><input type="number" min="0" step="1" placeholder="No limit" value={weeklyBudget ?? ""} onChange={(event) => setWeeklyBudget(event.target.value === "" ? null : Math.max(0, Number(event.target.value)))} /></span>
              <small>Used only to highlight trade-offs; it does not profile you.</small>
            </label>
          </div>

          {emptyError && <p className="form-alert" role="alert">Your basket is empty. Add at least one item. Need to fill up.</p>}
          <button className="button button--primary button--wide" type="button" onClick={continueToLocation}>
            Continue to travel <ChevronRight size={18} aria-hidden="true" />
          </button>
          <p className="basket-panel__note">Prices are calculated after your travel boundary is set.</p>
        </aside>
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  );
}
