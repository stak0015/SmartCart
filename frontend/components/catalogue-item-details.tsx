"use client";
// Owner: Shun
import type { ReactNode } from "react";
import type { Item } from "@/lib/api";
import { categoryLabel, type AppCopy, type Locale } from "@/lib/i18n";
import { localizedPackageSize } from "@/lib/package-size";
import { resultRowFields } from "@/lib/result-row";
import { cataloguePrice } from "@/lib/catalogue-price";
import { CatalogueItemImage } from "./catalogue-item-image";
import { SaraEligibilityFlag } from "./store-tags";

/**
 * The body of the item details window: picture, pack size, category, SARA
 * label and price. Shared by the Shop screen and by details opened from
 * Planned items or the checklist, so all three show the same information.
 */
export function CatalogueItemDetails({ item, priceTrendsButton, copy, locale }: {
  item: Item; priceTrendsButton: ReactNode; copy: AppCopy; locale: Locale;
}) {
  const fields = resultRowFields(item);
  return <div className="catalogue-dialog-details">
    <div className="product-visual"><span aria-hidden="true"><CatalogueItemImage imageUrl={item.image_url}/></span>{priceTrendsButton}</div>
    <p>{localizedPackageSize(fields.packageSize, locale)} · {categoryLabel(locale, item.category)}</p>
    <SaraEligibilityFlag status={item.sara_eligible} candidate={item.sara_category_candidate} copy={copy}/>
    <strong className="product-price">{cataloguePrice(item, locale)}</strong>
    {item.price_range && <p>{item.price_range.price_source === "median"
      ? (locale === "en" ? "Estimated from prices across stores nationally (middle 95%, outliers left out). Per unit; final price depends on your store." : "Anggaran daripada harga di kedai seluruh negara (95% pertengahan, harga luar biasa dikecualikan). Seunit; harga akhir bergantung pada kedai.")
      : locale === "en" ? `Recorded at ${item.price_range.store_count} nearby stores. Per unit; final price depends on your store.` : `Direkodkan di ${item.price_range.store_count} kedai berdekatan. Seunit; harga akhir bergantung pada kedai.`}</p>}
  </div>;
}
