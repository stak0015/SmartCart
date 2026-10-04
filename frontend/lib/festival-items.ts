import type { FestivalItemPrice, FestivalTopItem } from "./festival-contracts";
import type { BasketItem } from "./basket-state";

export type FestivalItemSort = "rise_desc" | "rise_asc";

export function sortFestivalItems(
  items: FestivalItemPrice[],
  direction: FestivalItemSort,
): FestivalItemPrice[] {
  return [...items].sort((left, right) => {
    const leftValue = left.rise_pct == null ? null : Number(left.rise_pct);
    const rightValue = right.rise_pct == null ? null : Number(right.rise_pct);
    if (leftValue == null && rightValue == null) return left.item_name.localeCompare(right.item_name);
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    const difference = direction === "rise_desc" ? rightValue - leftValue : leftValue - rightValue;
    return difference !== 0 ? difference : left.item_name.localeCompare(right.item_name);
  });
}

export function festivalTopItemToBasketItem(item: FestivalTopItem): BasketItem {
  if (!item.item_id) {
    throw new Error("The catalogue item id is required to add a festival recommendation.");
  }
  return {
    id: `db-${item.item_id}`,
    name: item.item_name,
    itemNameEn: item.item_name_en,
    itemNameMs: item.item_name_ms,
    imageUrl: item.image_url,
    size: item.package_size || item.unit || "—",
    qty: 1,
    saraEligible: item.sara_eligible,
    saraCategoryCandidate: item.sara_category_candidate,
    category: item.category,
    sourceCategory: item.source_category,
  };
}
