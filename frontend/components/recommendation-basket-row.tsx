"use client";
import { useState } from "react";
import type { BasketAlternativeLine } from "@/lib/contracts";
import { currentReplacementImpactRm, type BasketItem } from "@/lib/basket-state";
import { targetAlreadyInBasket, type RecommendationDetailRow } from "@/lib/recommendation-detail";
import { COPY, categoryLabel, type AppCopy, type Locale } from "@/lib/i18n";
import { formatRm } from "@/lib/format-rm";
import { parseQty, stepQty } from "@/lib/result-row";
import { uppercaseItemName } from "@/lib/item-name";
import { localizedPackageSize } from "@/lib/package-size";
import { QuantitySelector } from "./quantity-selector";
import { StoreBasketRow } from "./store-basket-row";
import { SaraEligibilityFlag } from "./store-tags";
import { CatalogueItemImage } from "./catalogue-item-image";
import { DropdownChevron } from "./ui-icon";

function localizedName(copy: AppCopy, name: string | null | undefined, translations?: { itemNameEn?: string | null; itemNameMs?: string | null }): string {
  return uppercaseItemName((copy === COPY.ms ? translations?.itemNameMs : translations?.itemNameEn) || name || "Catalogue item");
}
function packageSizeForCopy(copy: AppCopy, value: string | null | undefined): string | null {
  return localizedPackageSize(value, copy === COPY.ms ? "ms" : "en");
}
function replacementImpactText(copy: AppCopy, impactRm: number | null): string {
  if (impactRm == null) return copy.savingsUnavailable;
  if (impactRm > 0) return copy.saveAmount(formatRm(impactRm));
  if (impactRm < 0) return copy.moreNow(formatRm(Math.abs(impactRm)));
  return copy.sameCostNow;
}
type RecommendationRowProps = {
  row: RecommendationDetailRow; basket: BasketItem[]; copy: AppCopy; locale: Locale;
  onApplyAlternative: (line: BasketAlternativeLine) => void;
  onApplyPack: (row: RecommendationDetailRow, packItemId: string) => void;
  onUndo: (row: RecommendationDetailRow) => void;
  onChangeQuantity: (id: string, quantity: number) => void;
};

export function RecommendationBasketRow({
  row,
  basket,
  copy,
  locale,
  onApplyAlternative,
  onApplyPack,
  onUndo,
  onChangeQuantity,
}: RecommendationRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMedianBaseline = row.source.priceSource === "median" || row.current.priceSource === "median";
  const hasOptions = Boolean(row.replacement || (!hasMedianBaseline && (
    (row.alternatives.alternative && (row.alternatives.savingsRm ?? 0) > 0 && row.alternatives.alternative.itemId !== row.current.itemId)
    || row.alternatives.packOptions?.some(pack => pack.itemId !== row.current.itemId)
  )));
  const currentImageUrl = row.current.imageUrl ?? (
    row.basketItem?.id === `db-${row.current.itemId}` ? row.basketItem.imageUrl : undefined
  );

  return (
    <li className="recommendation-item">
      <StoreBasketRow price={row.current} imageUrl={currentImageUrl} copy={copy} locale={locale}
        originalNote={row.replacement ? ` · ${copy.originally(localizedName(copy, row.replacement.original.name, row.replacement.original))}` : ""}
        replacementNote={row.replacement ? (row.replacement.kind === "pack" ? copy.packChanged : copy.swapped) : null}
        quantityControl={row.basketItem ? <QuantitySelector value={String(row.current.quantity)} onChange={raw => { const quantity = parseQty(raw); if (quantity != null) onChangeQuantity(row.basketItem!.id, quantity); }} onStep={delta => onChangeQuantity(row.basketItem!.id, stepQty(row.current.quantity, delta))} decreaseLabel={copy.decreaseQuantity(row.current.itemName)} increaseLabel={copy.increaseQuantity(row.current.itemName)} quantityLabel={copy.quantityFor(row.current.itemName)} errorId={`store-quantity-${row.source.itemId}`} errorText={copy.quantityError}/> : row.current.quantity}
        disclosure={hasOptions && <button type="button" className="store-item-toggle" aria-expanded={expanded} aria-label={`${expanded ? copy.hidePriceList : copy.viewPriceList}: ${localizedName(copy, row.current.itemName, row.current)}`} onClick={() => setExpanded(value => !value)}><DropdownChevron/></button>} />
      {hasOptions && expanded && <RecommendationItemOptions row={row} basket={basket} copy={copy} locale={locale}
        onApplyAlternative={onApplyAlternative} onApplyPack={onApplyPack} onUndo={onUndo}/>}

    </li>
  );
}

export function RecommendationItemOptions({ row, basket, copy, locale, onApplyAlternative, onApplyPack, onUndo }: Omit<RecommendationRowProps, "onChangeQuantity">) {
  const suggestion = row.alternatives;
  const alternative = suggestion.alternative;
  // A median baseline is useful for an estimate, but it is not a store price
  // against which savings or pack-value recommendations can be claimed.
  const hasMedianBaseline = row.source.priceSource === "median" || row.current.priceSource === "median";
  const lowerCostAvailable = Boolean(
    !hasMedianBaseline
    &&
    alternative
    && suggestion.savingsRm != null
    && suggestion.savingsRm > 0
    && alternative.itemId !== row.current.itemId,
  );
  const lowerCostDuplicate = alternative
    ? targetAlreadyInBasket(basket, row.source.itemId, alternative.itemId)
    : false;
  const eligibilityChanges = alternative ? (
    alternative.saraEligible !== row.current.saraEligible
    || alternative.saraCategoryCandidate !== row.current.saraCategoryCandidate
  ) : false;
  const packOptions = hasMedianBaseline ? [] : suggestion.packOptions ?? [];
  const bestPack = packOptions.find(pack => pack.isBestValue) ?? packOptions[0];
  const impactRm = row.basketItem ? currentReplacementImpactRm(row.basketItem) : null;
  const hasOtherPacks = packOptions.some(pack => pack.itemId !== row.current.itemId);
  return (
    <div className="store-item-options">

      {row.replacement && row.basketItem && (
        <div className="alternative-impact">
          <span className="font-semibold">{replacementImpactText(copy, impactRm)}</span>
          <button type="button" onClick={() => onUndo(row)} className="alternative-undo">{copy.undoSwap}</button>
        </div>
      )}

      {lowerCostAvailable && alternative && suggestion.savingsRm != null && (
        <div className="alternative-option cheaper-option">
          <span className="alternative-image" aria-hidden="true"><CatalogueItemImage imageUrl={alternative.imageUrl} fallbackSize={26}/></span>
          <div className="alternative-identity">
            <span className="alternative-badge">{copy.lowerPriceNow}</span>
            <p className="alternative-name">{localizedName(copy, alternative.itemName, alternative)}</p>
            <p className="alternative-category">{categoryLabel(locale, alternative.category)}</p>
            <p className="alternative-size">{packageSizeForCopy(copy, alternative.packageSize ?? alternative.unit) ?? "—"}</p>

            {eligibilityChanges && (
              <div className="mt-1"><SaraEligibilityFlag status={alternative.saraEligible} candidate={alternative.saraCategoryCandidate} copy={copy} /></div>
            )}
          </div>
          <div className="alternative-pricing"><strong>{alternative.unitPriceRm == null ? "—" : formatRm(alternative.unitPriceRm)}</strong><small>{copy.saveAmount(formatRm(suggestion.savingsRm))}</small></div>
          <button
            type="button"
            disabled={lowerCostDuplicate}
            onClick={() => onApplyAlternative(suggestion)}
            aria-label={`${copy.swapAndSave}: ${localizedName(copy, alternative.itemName, alternative)}`}
            className="alternative-action"
          >
            {lowerCostDuplicate ? copy.alreadyInBasket : copy.swapAndSave}
          </button>
        </div>
      )}

      {hasOtherPacks && bestPack && (
        <details className="pack-comparison">
          <summary className="dropdown-summary pack-comparison-summary">
            <div className="pack-comparison-heading">
              <div className="min-w-0">
                <p className="pack-comparison-title">{copy.comparePackSizes(packOptions.length)}</p>
                <p className="pack-comparison-note">
                  {bestPack.itemId === row.current.itemId
                    ? copy.currentPackBestValue
                    : `${copy.bestUnitValue}: ${packageSizeForCopy(copy, bestPack.packageSize) ?? "—"} · ${bestPack.pricePerUnitRm != null ? copy.packUnitPrice(formatRm(bestPack.pricePerUnitRm), bestPack.unitKind) : "—"}`}
                </p>
              </div>
              <DropdownChevron className="text-[#007d38]"/>
            </div>
          </summary>
          <div className="pack-options">
            {packOptions.map(pack => {
              const isCurrent = pack.itemId === row.current.itemId;
              const duplicate = targetAlreadyInBasket(basket, row.source.itemId, pack.itemId);
              const unitDifference = pack.totalPriceRm != null && row.current.unitPriceRm != null
                ? Number(((pack.totalPriceRm - row.current.unitPriceRm) * row.current.quantity).toFixed(2))
                : null;
              const upfrontText = unitDifference == null
                ? null
                : unitDifference > 0
                  ? copy.moreNow(formatRm(unitDifference))
                  : unitDifference < 0
                    ? copy.lessNow(formatRm(Math.abs(unitDifference)))
                    : copy.sameCostNow;
              return (
                <div key={pack.itemId} className={`alternative-option pack-option${isCurrent ? " is-current" : ""}`}>
                  <span className="alternative-image" aria-hidden="true"><CatalogueItemImage imageUrl={pack.imageUrl} fallbackSize={26}/></span>
                  <div className="alternative-identity">
                    <div className="alternative-badges">
                      {pack.isBestValue && <span className="alternative-badge">{copy.bestUnitValue}</span>}
                      {isCurrent && <span className="alternative-badge is-current">{copy.currentPack}</span>}
                    </div>
                    <p className="alternative-name">{localizedName(copy, pack.itemName, pack)}</p>
                    <p className="alternative-category">{categoryLabel(locale, pack.category)}</p>
                    <p className="alternative-size">{packageSizeForCopy(copy, pack.packageSize) ?? "—"}</p>
                    <SaraEligibilityFlag status={pack.saraEligible} candidate={pack.saraCategoryCandidate} copy={copy}/>
                  </div>
                  <div className="alternative-pricing">
                    <p className="alternative-price">{pack.totalPriceRm != null ? formatRm(pack.totalPriceRm) : "—"}</p>
                    <p className="alternative-unit-price">{pack.pricePerUnitRm != null ? copy.packUnitPrice(formatRm(pack.pricePerUnitRm), pack.unitKind) : "—"}</p>
                    {upfrontText && !isCurrent && <p className="alternative-tradeoff">{upfrontText}</p>}
                  </div>
                  {!isCurrent && (
                    <button
                      type="button"
                      disabled={duplicate}
                      onClick={() => onApplyPack(row, pack.itemId)}
                      aria-label={`${copy.choosePack}: ${localizedName(copy, pack.itemName, pack)}`}
                      className="alternative-action is-secondary"
                    >
                      {duplicate ? copy.alreadyInBasket : copy.choosePack}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
