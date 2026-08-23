import type {
  BasketLine,
  CatalogItem,
  Category,
  RankedStore,
  Store,
  TravelPreferences,
} from "./types";

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;
export const QUANTITY_ERROR = "Quantity must be a whole number between 1 and 99. Need to fill up.";

export function validateQuantity(value: number): string | null {
  if (!Number.isInteger(value) || value < MIN_QUANTITY || value > MAX_QUANTITY) {
    return QUANTITY_ERROR;
  }
  return null;
}

export function validateQuantityInput(value: string): string | null {
  if (!/^[1-9]\d?$/.test(value) || Number(value) > MAX_QUANTITY) {
    return QUANTITY_ERROR;
  }
  return null;
}

export function filterCatalog(
  catalog: CatalogItem[],
  search: string,
  category: Category | "",
): CatalogItem[] {
  const query = search.trim().toLocaleLowerCase("en-MY");

  if (query.length < 2 && !category) {
    return [];
  }

  return catalog
    .filter((item) => {
      const matchesSearch = query.length < 2 || item.name.toLocaleLowerCase("en-MY").includes(query);
      const matchesCategory = !category || item.category === category;
      return matchesSearch && matchesCategory;
    })
    .sort((left, right) => left.name.localeCompare(right.name, "en-MY"))
    .slice(0, 10);
}

export function basketSummary(basket: BasketLine[]) {
  return {
    itemTypes: basket.length,
    totalUnits: basket.reduce((total, line) => total + line.quantity, 0),
  };
}

export function upsertBasketLine(
  basket: BasketLine[],
  itemId: string,
  quantity: number,
): BasketLine[] {
  if (validateQuantity(quantity)) {
    return basket;
  }

  const existing = basket.find((line) => line.itemId === itemId);
  if (!existing) {
    return [...basket, { itemId, quantity }];
  }

  return basket.map((line) =>
    line.itemId === itemId
      ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + quantity) }
      : line,
  );
}

export function replaceBasketItem(
  basket: BasketLine[],
  currentItemId: string,
  alternativeItemId: string,
): BasketLine[] {
  const current = basket.find((line) => line.itemId === currentItemId);
  if (!current) return basket;

  const withoutCurrent = basket.filter((line) => line.itemId !== currentItemId);
  return upsertBasketLine(withoutCurrent, alternativeItemId, current.quantity);
}

function calculateStoreResult(store: Store, basket: BasketLine[]): RankedStore {
  const offersByItem = new Map(store.offers.map((offer) => [offer.itemId, offer]));
  const missingItemIds: string[] = [];
  let basketTotal = 0;
  let latestPriceObservedDate: string | null = null;

  for (const line of basket) {
    const offer = offersByItem.get(line.itemId);
    if (!offer) {
      missingItemIds.push(line.itemId);
      continue;
    }
    basketTotal += offer.price * line.quantity;
    if (!latestPriceObservedDate || offer.priceObservedDate > latestPriceObservedDate) {
      latestPriceObservedDate = offer.priceObservedDate;
    }
  }

  return {
    ...store,
    basketTotal,
    missingItemIds,
    isCompleteBasket: missingItemIds.length === 0,
    latestPriceObservedDate,
  };
}

export function rankReachableStores(
  stores: Store[],
  basket: BasketLine[],
  travel: TravelPreferences,
): RankedStore[] {
  return stores
    .filter((store) => store.distanceKm <= travel.maxDistanceKm)
    .filter((store) => !travel.saraPartnersOnly || store.saraPartner === true)
    .map((store) => calculateStoreResult(store, basket))
    .sort((left, right) => {
      if (left.isCompleteBasket !== right.isCompleteBasket) {
        return left.isCompleteBasket ? -1 : 1;
      }
      return left.basketTotal - right.basketTotal;
    });
}

export function estimateSaraPayment(
  store: RankedStore,
  basket: BasketLine[],
  catalog: CatalogItem[],
  creditBalance: number,
) {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const offerById = new Map(store.offers.map((offer) => [offer.itemId, offer]));

  const verifiedEligibleSpend = basket.reduce((total, line) => {
    const item = catalogById.get(line.itemId);
    const offer = offerById.get(line.itemId);
    if (item?.saraEligible !== true || !offer) return total;
    return total + offer.price * line.quantity;
  }, 0);

  const creditUsed = Math.min(Math.max(creditBalance, 0), verifiedEligibleSpend);
  return {
    verifiedEligibleSpend,
    creditUsed,
    cashRequired: Math.max(0, store.basketTotal - creditUsed),
  };
}

export function formatRinggit(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}
