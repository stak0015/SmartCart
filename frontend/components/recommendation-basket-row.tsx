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
export function RecommendationBasketRow({
  row,
  basket,
  copy,
  locale,
  onApplyAlternative,
  onApplyPack,
  onUndo,
  onChangeQuantity,
}: {
  row: RecommendationDetailRow;
  basket: BasketItem[];
  copy: AppCopy;
  locale: Locale;
  onApplyAlternative: (line: BasketAlternativeLine) => void;
  onApplyPack: (row: RecommendationDetailRow, packItemId: string) => void;
  onUndo: (row: RecommendationDetailRow) => void;
  onChangeQuantity: (id: string, quantity: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
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
  const hasOptions = Boolean(row.replacement || lowerCostAvailable || hasOtherPacks);
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
      {hasOptions && expanded && <div className="store-item-options">

      {row.replacement && row.basketItem && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f3faf7] px-3 py-2 text-xs text-[#286d67]">
          <span className="font-semibold">{replacementImpactText(copy, impactRm)}</span>
          <button type="button" onClick={() => onUndo(row)} className="min-h-9 font-extrabold text-[#007d38] underline underline-offset-2">{copy.undoSwap}</button>
        </div>
      )}

      {lowerCostAvailable && alternative && suggestion.savingsRm != null && (
        <div className="mt-2 flex flex-col gap-2 rounded-xl bg-[#f3faf7] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#286d67]">{copy.lowerPriceNow}</p>
            <p className="mt-0.5 break-words text-xs font-semibold text-[#10152e]">{localizedName(copy, alternative.itemName, alternative)}</p>
            <p className="text-[11px] text-[#526078]">{categoryLabel(locale, alternative.category)}</p>
            <p className="text-[11px] text-[#718078]">{packageSizeForCopy(copy, alternative.packageSize ?? alternative.unit) ?? "—"}</p>
            <p className="mt-0.5 text-[11px] font-bold text-[#175f4b]">{copy.saveAmount(formatRm(suggestion.savingsRm))}</p>
            {eligibilityChanges && (
              <div className="mt-1"><SaraEligibilityFlag status={alternative.saraEligible} candidate={alternative.saraCategoryCandidate} copy={copy} /></div>
            )}
          </div>
          <button
            type="button"
            disabled={lowerCostDuplicate}
            onClick={() => onApplyAlternative(suggestion)}
            aria-label={`${copy.swapAndSave}: ${localizedName(copy, alternative.itemName, alternative)}`}
            className="min-h-11 shrink-0 rounded-lg bg-[#007d38] px-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#9db5ac]"
          >
            {lowerCostDuplicate ? copy.alreadyInBasket : copy.swapAndSave}
          </button>
        </div>
      )}

      {hasOtherPacks && bestPack && (
        <details className="pack-comparison mt-2 rounded-xl border border-[#dce5e0] bg-white">
          <summary className="dropdown-summary cursor-pointer list-none px-3 py-2.5 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#10152e]">{copy.comparePackSizes(packOptions.length)}</p>
                <p className="mt-0.5 break-words text-[11px] text-[#526078]">
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
                <div key={pack.itemId} className={`pack-option ${isCurrent ? "bg-[#e7f7f0] ring-1 ring-[#007d38]" : "bg-[#f4f8f9]"}`}>
                  <div className="flex flex-wrap gap-1">
                    {pack.isBestValue && <span className="rounded-md bg-[#007d38] px-1.5 py-0.5 text-[9px] font-extrabold text-white">{copy.bestUnitValue}</span>}
                    {isCurrent && <span className="rounded-md bg-[#e2e9e5] px-1.5 py-0.5 text-[9px] font-extrabold text-[#526078]">{copy.currentPack}</span>}
                  </div>
                  <p className="mt-1 break-words text-xs font-bold leading-4 text-[#10152e]">{localizedName(copy, pack.itemName, pack)}</p>
                  <p className="text-[11px] text-[#526078]">{categoryLabel(locale, pack.category)}</p>
                  <p className="text-[11px] text-[#718078]">{packageSizeForCopy(copy, pack.packageSize) ?? "—"}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-[#10152e]">{pack.totalPriceRm != null ? formatRm(pack.totalPriceRm) : "—"}</p>
                      <p className="text-[10px] text-[#526078]">{pack.pricePerUnitRm != null ? copy.packUnitPrice(formatRm(pack.pricePerUnitRm), pack.unitKind) : "—"}</p>
                      {upfrontText && !isCurrent && <p className="mt-0.5 text-[10px] font-semibold text-[#526078]">{upfrontText}</p>}
                    </div>
                    {!isCurrent && (
                      <button
                        type="button"
                        disabled={duplicate}
                        onClick={() => onApplyPack(row, pack.itemId)}
                        aria-label={`${copy.choosePack}: ${localizedName(copy, pack.itemName, pack)}`}
                        className="min-h-11 shrink-0 rounded-lg border border-[#007d38] bg-[#007d38] px-2.5 text-[11px] font-extrabold text-white disabled:cursor-not-allowed disabled:border-[#b8d3c6] disabled:bg-[#e8f4ee] disabled:text-[#245d4b]"
                      >
                        {duplicate ? copy.alreadyInBasket : copy.choosePack}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
      </div>}
    </li>
  );
}
