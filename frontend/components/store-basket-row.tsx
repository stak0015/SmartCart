import type { ReactNode } from "react";
import type { RecommendationDetailPrice } from "@/lib/recommendation-detail";
import { categoryLabel, type AppCopy, type Locale } from "@/lib/i18n";
import { localizedPackageSize } from "@/lib/package-size";
import { formatRm } from "@/lib/format-rm";
import { CatalogueItemImage } from "./catalogue-item-image";
import { SaraEligibilityFlag } from "./store-tags";

export function StoreBasketRow({price, imageUrl, copy, locale, originalNote, replacementNote, quantityControl, disclosure}: {
  price: RecommendationDetailPrice; imageUrl?: string | null; copy: AppCopy; locale: Locale;
  originalNote?: string; replacementNote?: ReactNode; quantityControl?: ReactNode; disclosure?: ReactNode;
}) {
  const name = (locale === "ms" ? price.itemNameMs : price.itemNameEn) || price.itemName;
  return (
      <div className="store-item-row">
        <span className="store-item-image" aria-hidden="true"><CatalogueItemImage imageUrl={imageUrl} fallbackSize={27}/></span>
        <div className="store-item-name">
          <strong>{name}</strong>
          <small>{categoryLabel(locale, price.category)}</small>
          <small>{localizedPackageSize(price.packageSize, locale) ?? "—"}<span className="store-item-mobile-quantity"> × {price.quantity}</span>{originalNote}</small>
          {replacementNote && <small className="store-item-replaced">{replacementNote}</small>}
          {price.priceSource === "median" && <small className="store-item-estimate">{copy.medianPriceEstimate}</small>}
        </div>
        <div className="store-item-sara"><SaraEligibilityFlag status={price.saraEligible} candidate={price.saraCategoryCandidate} copy={copy}/></div>
        <span className="store-item-package">{localizedPackageSize(price.packageSize, locale) ?? "—"}</span>
        <div className="store-item-quantity">
          {quantityControl ?? price.quantity}
        </div>
        <span className="store-item-unit-price">{price.unitPriceRm == null ? "—" : formatRm(price.unitPriceRm)}</span>
        <strong className="store-item-total">{price.lineTotalRm == null ? copy.noStorePrice : formatRm(price.lineTotalRm)}</strong>
        {disclosure}
      </div>
  );
}

export function StorePriceTable({prices, copy, locale}: {
  prices: Pick<RecommendationDetailPrice, "itemId" | "itemName" | "itemNameEn" | "itemNameMs" | "packageSize" | "quantity" | "unitPriceRm" | "lineTotalRm" | "priceSource">[];
  copy: AppCopy; locale: Locale;
}) {
  return <>
    <div className="store-price-table-head"><span>Item</span><span>{locale === "ms" ? "Saiz" : "Pack"}</span><span>{locale === "ms" ? "Kuantiti" : "Qty"}</span><span>{locale === "ms" ? "Harga" : "Unit"}</span><span>{locale === "ms" ? "Jumlah" : "Total"}</span></div>
    <ul>{prices.map(price => <li key={price.itemId} className="store-price-table-row"><span>{(locale === "ms" ? price.itemNameMs : price.itemNameEn) || price.itemName}{price.priceSource === "median" && <small>{copy.medianPriceEstimate}</small>}</span><span>{localizedPackageSize(price.packageSize, locale) ?? "—"}</span><span>{price.quantity}</span><span>{price.unitPriceRm == null ? "—" : formatRm(price.unitPriceRm)}</span><strong>{price.lineTotalRm == null ? "—" : formatRm(price.lineTotalRm)}</strong></li>)}</ul>
  </>;
}
