"use client";

import type { BasketItem } from "@/lib/basket-state";
import type { PlanStoreAssignment } from "@/lib/contracts";
import { type AppCopy, type Locale } from "@/lib/i18n";
import { StoreBasketRow } from "./store-basket-row";

export function PlanBasketItems({ lines, basket, copy, locale }: {
  lines: PlanStoreAssignment[]; basket: BasketItem[]; copy: AppCopy; locale: Locale;
}) {
  return <>
    <div className="store-item-columns" aria-hidden="true"><span>{locale === "en" ? "Product" : "Produk"}</span><span>SARA</span><span>{locale === "en" ? "Unit size" : "Saiz unit"}</span><span>{locale === "en" ? "Qty" : "Kuantiti"}</span><span>{locale === "en" ? "Unit price" : "Harga unit"}</span><span>{locale === "en" ? "Total" : "Jumlah"}</span><span/></div>
    <ul className="store-item-list">
      {lines.map(line => {
        const item = basket.find(item => item.id === `db-${line.itemId}`);
        const name = (locale === "ms" ? line.itemNameMs : line.itemNameEn) || line.itemName || item?.name || line.itemId;
        return <li key={line.itemId} className="recommendation-item">
          <StoreBasketRow copy={copy} locale={locale} imageUrl={item?.imageUrl} price={{
            itemId: line.itemId, itemName: String(name), itemNameEn: line.itemNameEn, itemNameMs: line.itemNameMs,
            packageSize: line.unit || item?.size || null, quantity: line.quantity,
            unitPriceRm: line.unitPriceRm, lineTotalRm: line.lineTotalRm, observedDate: line.observedDate,
            priceSource: line.priceSource, category: line.category ?? item?.category ?? null,
            saraEligible: line.saraEligible ?? null, saraCategoryCandidate: line.saraCategoryCandidate ?? false,
            isSaraCreditCandidate: Boolean(line.saraEligible || line.saraCategoryCandidate),
          }}/>
        </li>;
      })}
    </ul>
    {lines.length === 0 && <p className="store-detail-message">{locale === "en" ? "No basket items assigned to this store." : "Tiada item bakul diperuntukkan kepada kedai ini."}</p>}
  </>;
}
