"use client";
// Owner: Shun

import { tripTravelTotalRm } from "@/lib/trip-travel-cost";
import { TravelCostDetails } from "./travel-cost-breakdown";
import { displayItemName } from "@/lib/item-name";
import { formatRm } from "@/lib/format-rm";
import { COPY as APP_COPY, categoryLabel, type Locale } from "@/lib/i18n";
import { tripPaymentBreakdown, boughtLineQuantity, boughtLineTotalRm, boughtLineUnitPrice, listTripRecords, type TripRecord, type TripRecordLine } from "@/lib/trip-history";
import { CatalogueItemImage } from "./catalogue-item-image";
import { SaraEligibilityFlag, SaraStoreTag } from "./store-tags";
import { StoreChainLogo } from "./store-chain-logo";
import { DropdownChevron, UIIcon } from "./ui-icon";

const COPY = {
  en: {
    title: "Shopping history", description: "Review your purchases, store visits and trip costs.",
    empty: "No trips recorded yet", emptyHint: "Record a completed trip from your checklist to see your purchases here.",
    single: "Single-store trip", multi: "Multi-store trip", bought: "items bought", spending: "Total spending",
    purchases: "Purchased items", noBought: "No bought items recorded for this store.", other: "Other purchases",
    receipt: "View purchases & costs", close: "Hide purchases & costs", summary: "Trip costs", items: "Bought items",
    travel: "Travel estimate", total: "Combined total", partial: "Partial spending total",
    partialNote: "Some bought items have no price. Spending includes priced items only.",
    estimateNote: "Fuel and other travel estimates are saved estimates. Recorded tolls are included when available.", travelHeading: "Travel and total cost",
    route: "Travel used an approximate straight-line route.", remove: "Delete trip", unavailable: "Store unavailable",
  },
  ms: {
    title: "Sejarah membeli-belah", description: "Semak pembelian, kedai yang dikunjungi dan kos perjalanan.",
    empty: "Belum ada perjalanan direkodkan", emptyHint: "Rekodkan perjalanan selesai daripada senarai semak untuk melihat pembelian anda di sini.",
    single: "Perjalanan satu kedai", multi: "Perjalanan berbilang kedai", bought: "item dibeli", spending: "Jumlah perbelanjaan",
    purchases: "Item yang dibeli", noBought: "Tiada item dibeli direkodkan untuk kedai ini.", other: "Pembelian lain",
    receipt: "Lihat pembelian & kos", close: "Sembunyikan pembelian & kos", summary: "Kos perjalanan", items: "Item dibeli",
    travel: "Anggaran perjalanan", total: "Jumlah gabungan", partial: "Jumlah perbelanjaan separa",
    partialNote: "Sesetengah item dibeli tiada harga. Perbelanjaan hanya merangkumi item yang mempunyai harga.",
    estimateNote: "Bahan api dan anggaran perjalanan lain ialah anggaran tersimpan. Tol direkodkan termasuk jika tersedia.", travelHeading: "Perjalanan dan jumlah kos",
    route: "Perjalanan menggunakan anggaran jarak garis lurus.", remove: "Padam perjalanan", unavailable: "Kedai tidak tersedia",
  },
} as const;

function tripStores(record: TripRecord, fallbackName: string) {
  const stores = [...(record.stores?.length ? record.stores : [record.store])];
  // Older records may have line assignments without the full stores array.
  for (const line of record.lines) {
    if (line.storePremiseId && !stores.some(store => store.premiseId === line.storePremiseId)) {
      stores.push({ premiseId: line.storePremiseId, premiseCode: line.storePremiseId, name: line.storeName || fallbackName, address: null });
    }
  }
  return stores.filter((store, index) => stores.findIndex(value => value.premiseId === store.premiseId) === index);
}

function PurchasedLine({ line, locale }: { line: TripRecordLine; locale: Locale }) {
  const name = (locale === "ms" ? line.itemNameMs : line.itemNameEn) || line.itemName;
  const unitPrice = boughtLineUnitPrice(line);
  const total = boughtLineTotalRm(line);
  return <li className="history-purchase">
    <span className="history-product-image" aria-hidden="true"><CatalogueItemImage imageUrl={line.imageUrl} fallbackSize={26}/></span>
    <span className="history-product-copy"><strong className="item-name-line" title={name}>{displayItemName(name, locale)}</strong><SaraEligibilityFlag status={line.saraEligible ?? null} candidate={line.saraCategoryCandidate ?? false} copy={APP_COPY[locale]}/><small>{[line.packageSize, categoryLabel(locale, line.category)].filter(Boolean).join(" · ")}</small><small>{boughtLineQuantity(line)} × {unitPrice == null ? "—" : formatRm(unitPrice)}</small></span>
    <strong className="history-line-total">{total == null ? "—" : formatRm(total)}</strong>
  </li>;
}

export function ReceiptHistoryScreen({ history, locale, onDeleteTrip }: {
  history: TripRecord[]; locale: Locale; onDeleteTrip: (recordId: string) => void;
}) {
  const copy = COPY[locale];
  const records = listTripRecords(history);
  const dateFormat = new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });
  return <div className="screen-enter history-screen shopping-history">
    <header className="history-page-heading"><div><h1 className="page-title">{copy.title}</h1><p className="page-intro">{copy.description}</p></div>{records.length > 0 && <span className="history-count">{records.length} {locale === "en" ? (records.length === 1 ? "trip" : "trips") : "perjalanan"}</span>}</header>
    {records.length === 0 ? <section className="history-empty"><UIIcon name="history" size={32}/><h2>{copy.empty}</h2><p>{copy.emptyHint}</p></section> : <ol className="history-trip-list">{records.map(record => {
      const stores = tripStores(record, copy.unavailable);
      const multi = stores.length > 1;
      const bought = record.lines.filter(line => line.status === "bought");
      const payment = tripPaymentBreakdown(record.lines);
      const partial = bought.some(line => boughtLineTotalRm(line) == null);
      const travelTotal = tripTravelTotalRm(record);
      const total = record.actualTotalRm == null || travelTotal == null ? null : Math.round((record.actualTotalRm + travelTotal + Number.EPSILON) * 100) / 100;
      const groups = stores.map(store => ({ id: store.premiseId, name: store.name, address: store.address, isStore: true, lines: bought.filter(line => line.storePremiseId === store.premiseId || (!multi && !line.storePremiseId)) }));
      const unassigned = multi ? bought.filter(line => !line.storePremiseId) : [];
      if (unassigned.length) groups.push({ id: "unassigned", name: copy.other, address: null, isStore: false, lines: unassigned });
      return <li key={record.id} className="history-trip-card">
        <div className="history-record-header">
          <div className="history-trip-meta"><time dateTime={record.recordedAt}>{dateFormat.format(new Date(record.recordedAt))}</time><span className="history-trip-kind">{multi ? copy.multi : copy.single}</span><span>{bought.length} {copy.bought}</span></div>
          <span className="history-store-list">{stores.map((store, storeIndex) => <span className="history-store" key={store.premiseId}>
            <span className="history-store-logo" aria-hidden="true"><StoreChainLogo name={store.name}/></span>
            <span className="history-store-copy">{multi && <small>{locale === "en" ? "Store" : "Kedai"} {storeIndex + 1}</small>}<strong>{store.name}</strong>{store.saraStatus && <SaraStoreTag status={store.saraStatus} copy={APP_COPY[locale]}/>}</span>
          </span>)}</span>
          <span className="history-heading-total"><small>{copy.spending}</small><strong>{total == null ? "—" : formatRm(total)}</strong>{partial && <small className="history-partial-label">{copy.partial}</small>}</span>
          <button type="button" className="history-delete" aria-label={`${copy.remove}: ${stores.map(store => store.name).join(" → ")}`} onClick={() => onDeleteTrip(record.id)}><UIIcon name="trash" size={16}/><span>{copy.remove}</span></button>
        </div>
      <details className="history-receipt">
        <summary className="history-trip-heading">
          <span className="history-view-label">{copy.receipt}</span><span className="history-close-label">{copy.close}</span><DropdownChevron/>
        </summary>
        <div className="history-trip-body">
          <section className="history-purchases" aria-label={copy.purchases}>{groups.map(group => <section key={group.id} className="history-store-purchases">
            <div className="history-group-heading"><div className="history-group-store">{group.isStore && <span className="history-store-logo" aria-hidden="true"><StoreChainLogo name={group.name}/></span>}<div><h2>{group.name}</h2>{group.address && <p>{group.address}</p>}</div></div><span>{group.lines.length} {copy.bought}</span></div>
            {group.lines.length ? <ul>{group.lines.map(line => <PurchasedLine key={line.id} line={line} locale={locale}/>)}</ul> : <p className="history-note">{copy.noBought}</p>}
          </section>)}</section>
          <aside className="history-summary store-detail-sidebar">
            <section className="store-detail-summary">
              <h2><UIIcon name="basket" size={22}/>{copy.summary}</h2>
              <dl className="store-summary-money"><div><dt>{copy.items}</dt><dd>{record.actualTotalRm == null ? "—" : formatRm(record.actualTotalRm)}</dd></div><div><dt>{APP_COPY[locale].saraCreditLabel}</dt><dd>{payment.saraCreditRm == null ? "—" : formatRm(payment.saraCreditRm)}</dd></div><div><dt>{APP_COPY[locale].cashNeededLabel}</dt><dd>{payment.cashNeededRm == null ? "—" : formatRm(payment.cashNeededRm)}</dd></div></dl><p className="history-note">{payment.saraCreditRm == null ? (locale === "en" ? "The payment breakdown is unavailable without priced bought items and saved SARA eligibility." : "Pecahan bayaran tidak tersedia tanpa harga item dibeli dan kelayakan SARA tersimpan.") : (locale === "en" ? "Estimated allocation for bought items. SARA eligibility and final payment should be verified at the store." : "Anggaran agihan untuk item dibeli. Kelayakan SARA dan bayaran akhir perlu disahkan di kedai.")}</p>
              {partial && <p className="history-warning">{copy.partialNote}</p>}
              <div className="store-summary-travel"><h3>{copy.travelHeading}</h3>{record.travelCostBreakdowns?.length ? <TravelCostDetails breakdowns={record.travelCostBreakdowns} locale={locale} roundTrip={!multi} recordedTollCostRm={record.actualTollCostRm} showTollInfo={false}/> : <><div><span>{copy.travel}</span><strong>{record.estimatedRoundTripCostRm == null ? "—" : formatRm(record.estimatedRoundTripCostRm)}</strong></div><div><span>{locale === "en" ? "Recorded tolls" : "Tol direkodkan"}</span><strong>{record.actualTollCostRm == null ? "—" : formatRm(record.actualTollCostRm)}</strong></div></>}<div className="history-combined-total"><span>{copy.total}</span><strong>{total == null ? "—" : formatRm(total)}</strong></div></div>
              <p className="history-note">{copy.estimateNote}</p>
              {record.routeProvider === "straight_line" && <p className="history-note">{copy.route}</p>}
            </section>
          </aside>
        </div>
      </details></li>;
    })}</ol>}
  </div>;
}
