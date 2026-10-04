import type {
  EarlyPurchaseLineRequest,
  EarlyPurchaseSavingsResponse,
} from "./festival-contracts";
import type { BasketItemPrice } from "./contracts";
import {
  boughtLineQuantity,
  boughtLineUnitPrice,
  type TripRecord,
} from "./trip-history";

export function buildEarlyPurchaseRequests(records: TripRecord[]): EarlyPurchaseLineRequest[] {
  return records.flatMap(record => record.lines
    .filter(line => line.status === "bought" && line.catalogueItemId != null && boughtLineUnitPrice(line) != null)
    .map(line => ({
      record_id: record.id,
      item_id: line.catalogueItemId as string,
      quantity: boughtLineQuantity(line),
      unit_price_rm: boughtLineUnitPrice(line) as number,
      purchased_on: record.recordedAt.slice(0, 10),
    })));
}

export function groupEarlySavingsByRecord(
  response: EarlyPurchaseSavingsResponse | null,
): Map<string, number> {
  const values = new Map<string, number>();
  for (const item of response?.items ?? []) {
    values.set(item.record_id, (values.get(item.record_id) ?? 0) + item.saving_rm);
  }
  return values;
}

export function buildStorePreviewLines(prices: BasketItemPrice[]) {
  return prices
    .filter(price => price.priceSource === "store" && price.unitPriceRm != null && price.quantity > 0)
    .map(price => ({
      item_id: price.itemId,
      quantity: price.quantity,
      actual_unit_price_rm: price.unitPriceRm as number,
    }));
}
