import type {
  AlternativeSuggestion,
  BasketLine,
  CatalogItem,
  Store,
  TravelPreferences,
} from "./types";

export const CATALOG: CatalogItem[] = [
  {
    id: "rice-5kg",
    itemCode: "DEMO-001",
    name: "Beras putih tempatan",
    brand: "Cap Seri",
    packageSize: "5 kg",
    unit: "per bag",
    category: "Rice & Grains",
    saraEligible: true,
  },
  {
    id: "rice-10kg",
    itemCode: "DEMO-002",
    name: "Beras putih tempatan",
    brand: "Cap Seri",
    packageSize: "10 kg",
    unit: "per bag",
    category: "Rice & Grains",
    saraEligible: true,
  },
  {
    id: "oil-1kg",
    itemCode: "DEMO-003",
    name: "Minyak masak campuran",
    brand: "Saji",
    packageSize: "1 kg",
    unit: "per polybag",
    category: "Cooking Oil",
    saraEligible: true,
  },
  {
    id: "oil-2kg",
    itemCode: "DEMO-004",
    name: "Minyak masak campuran",
    brand: "Seri Murni",
    packageSize: "2 kg",
    unit: "per bottle",
    category: "Cooking Oil",
    saraEligible: null,
  },
  {
    id: "eggs-a10",
    itemCode: "DEMO-005",
    name: "Telur ayam Gred A",
    brand: "Ladang Kita",
    packageSize: "10 pieces",
    unit: "per tray",
    category: "Eggs & Dairy",
    saraEligible: true,
  },
  {
    id: "milk-uht",
    itemCode: "DEMO-006",
    name: "Susu UHT penuh krim",
    brand: "Lembu Segar",
    packageSize: "1 litre",
    unit: "per pack",
    category: "Eggs & Dairy",
    saraEligible: null,
  },
  {
    id: "spinach",
    itemCode: "DEMO-007",
    name: "Bayam hijau",
    brand: "Unbranded",
    packageSize: "250 g",
    unit: "per bundle",
    category: "Vegetables",
    saraEligible: null,
  },
  {
    id: "sardines",
    itemCode: "DEMO-008",
    name: "Sardin dalam sos tomato",
    brand: "Laut Kita",
    packageSize: "425 g",
    unit: "per can",
    category: "Meat & Fish",
    saraEligible: true,
  },
  {
    id: "tea",
    itemCode: "DEMO-009",
    name: "Teh hitam",
    brand: "Bukit Wangi",
    packageSize: "40 bags",
    unit: "per box",
    category: "Beverages",
    saraEligible: false,
  },
  {
    id: "detergent",
    itemCode: "DEMO-010",
    name: "Serbuk pencuci pakaian",
    brand: "Bersih",
    packageSize: "2.1 kg",
    unit: "per pack",
    category: "Household Essentials",
    saraEligible: null,
  },
  {
    id: "soap",
    itemCode: "DEMO-011",
    name: "Sabun mandi",
    brand: "Harum",
    packageSize: "3 × 80 g",
    unit: "per pack",
    category: "Household Essentials",
    saraEligible: false,
  },
  {
    id: "salt",
    itemCode: "DEMO-012",
    name: "Garam halus",
    brand: "Dapur",
    packageSize: "400 g",
    unit: "per pack",
    category: "Other",
    saraEligible: null,
  },
];

export const INITIAL_BASKET: BasketLine[] = [
  { itemId: "oil-1kg", quantity: 1 },
  { itemId: "eggs-a10", quantity: 1 },
  { itemId: "rice-5kg", quantity: 1 },
];

export const DEFAULT_TRAVEL: TravelPreferences = {
  area: "Kota Bharu, Kelantan",
  mode: "motorcycle",
  maxDistanceKm: 5,
  rememberOnDevice: false,
  saraPartnersOnly: false,
};

const observedDate = "2026-08-18";

function offer(itemId: string, price: number) {
  return { itemId, price, priceObservedDate: observedDate };
}

// These records are deliberately labelled as demo data in the interface. They
// exercise the recommendation UI without presenting a premise or SARA match as
// a verified real-world fact.
export const DEMO_STORES: Store[] = [
  {
    id: "demo-store-1",
    premiseName: "Demo Pasar Mini Murni",
    area: "Kota Bharu",
    distanceKm: 2.4,
    travelMinutes: 8,
    saraPartner: true,
    offers: [offer("rice-5kg", 15.9), offer("rice-10kg", 29.8), offer("oil-1kg", 12.5), offer("oil-2kg", 24.4), offer("eggs-a10", 13), offer("milk-uht", 7.6), offer("spinach", 3.2), offer("sardines", 9.4), offer("tea", 6.1), offer("detergent", 15.7), offer("soap", 4.9), offer("salt", 1.2)],
  },
  {
    id: "demo-store-2",
    premiseName: "Demo Kedai Harmoni",
    area: "Kota Bharu",
    distanceKm: 1.3,
    travelMinutes: 5,
    saraPartner: null,
    offers: [offer("rice-5kg", 17.2), offer("rice-10kg", 31.1), offer("oil-1kg", 13), offer("oil-2kg", 23.9), offer("eggs-a10", 14.5), offer("milk-uht", 7.4), offer("spinach", 3), offer("sardines", 9.2), offer("tea", 5.9), offer("detergent", 16.2), offer("soap", 4.6), offer("salt", 1.1)],
  },
  {
    id: "demo-store-3",
    premiseName: "Demo Pasaraya Sejahtera",
    area: "Kota Bharu",
    distanceKm: 4.1,
    travelMinutes: 13,
    saraPartner: true,
    offers: [offer("rice-5kg", 16.5), offer("rice-10kg", 30), offer("oil-1kg", 14.2), offer("oil-2kg", 25.6), offer("eggs-a10", 15), offer("milk-uht", 7.9), offer("spinach", 2.8), offer("sardines", 9.8), offer("tea", 5.7), offer("detergent", 14.9), offer("soap", 5.1), offer("salt", 1.25)],
  },
  {
    id: "demo-store-4",
    premiseName: "Demo Kedai Desa Amanah",
    area: "Kota Bharu",
    distanceKm: 3.6,
    travelMinutes: 11,
    saraPartner: false,
    offers: [offer("rice-5kg", 15.5), offer("oil-1kg", 12.8), offer("milk-uht", 7.2), offer("spinach", 2.9), offer("sardines", 9.1), offer("tea", 6), offer("detergent", 15.2), offer("soap", 4.7), offer("salt", 1.15)],
  },
  {
    id: "demo-store-5",
    premiseName: "Demo Pasar Mini Ceria",
    area: "Kota Bharu",
    distanceKm: 4.8,
    travelMinutes: 15,
    saraPartner: null,
    offers: [offer("rice-5kg", 16.1), offer("rice-10kg", 30.6), offer("oil-1kg", 13.1), offer("oil-2kg", 24.8), offer("eggs-a10", 13.8), offer("milk-uht", 7.5), offer("spinach", 3.1), offer("sardines", 9.6), offer("tea", 5.8), offer("detergent", 15.4), offer("soap", 4.8), offer("salt", 1.18)],
  },
  {
    id: "demo-store-6",
    premiseName: "Demo Kedai Jiran",
    area: "Kota Bharu",
    distanceKm: 5,
    travelMinutes: 16,
    saraPartner: true,
    offers: [offer("rice-5kg", 17), offer("rice-10kg", 31.4), offer("oil-1kg", 12.9), offer("oil-2kg", 25), offer("eggs-a10", 14.1), offer("milk-uht", 7.8), offer("spinach", 3.15), offer("sardines", 9.5), offer("tea", 6.2), offer("detergent", 15.8), offer("soap", 4.95), offer("salt", 1.22)],
  },
  {
    id: "demo-store-7",
    premiseName: "Demo Pasar Taman",
    area: "Kota Bharu",
    distanceKm: 6.7,
    travelMinutes: 20,
    saraPartner: true,
    offers: [offer("rice-5kg", 15.7), offer("rice-10kg", 29.6), offer("oil-1kg", 12.4), offer("oil-2kg", 24), offer("eggs-a10", 12.9), offer("milk-uht", 7.35), offer("spinach", 2.75), offer("sardines", 9), offer("tea", 5.6), offer("detergent", 14.8), offer("soap", 4.55), offer("salt", 1.05)],
  },
];

export const DEMO_ALTERNATIVES: AlternativeSuggestion[] = [
  {
    id: "rice-pack-value",
    currentItemId: "rice-5kg",
    alternativeItemId: "rice-10kg",
    currentPrice: 15.9,
    alternativePrice: 29.8,
    note: "Higher upfront cost, lower illustrative cost per kg (RM2.98 instead of RM3.18).",
  },
  {
    id: "oil-immediate-saving",
    currentItemId: "oil-2kg",
    alternativeItemId: "oil-1kg",
    currentPrice: 24.4,
    alternativePrice: 12.5,
    note: "Lower immediate spend, but a smaller pack. Compare how much you need before switching.",
  },
];
