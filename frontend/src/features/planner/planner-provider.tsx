"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_TRAVEL, INITIAL_BASKET } from "./mock-data";
import { replaceBasketItem, upsertBasketLine, validateQuantity } from "./domain";
import type { BasketLine, PlannerState, TravelPreferences } from "./types";

const TRAVEL_STORAGE_KEY = "smartcart.travel-preferences.v1";
const TRAVEL_MODES = new Set(["walking", "public-transport", "motorcycle", "car"]);

const INITIAL_STATE: PlannerState = {
  basket: INITIAL_BASKET,
  travel: DEFAULT_TRAVEL,
  saraPlanningEnabled: false,
  saraCreditBalance: 50,
  weeklyBudget: null,
};

interface PlannerContextValue extends PlannerState {
  addItem: (itemId: string, quantity: number) => boolean;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  applyAlternative: (currentItemId: string, alternativeItemId: string) => void;
  updateTravel: (changes: Partial<TravelPreferences>) => void;
  clearRememberedTravel: () => void;
  setSaraPlanningEnabled: (enabled: boolean) => void;
  setSaraCreditBalance: (value: number) => void;
  setWeeklyBudget: (value: number | null) => void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

function readRememberedTravel(): TravelPreferences | null {
  try {
    const raw = window.localStorage.getItem(TRAVEL_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<TravelPreferences>;
    if (
      typeof saved.area !== "string" ||
      typeof saved.maxDistanceKm !== "number" ||
      typeof saved.mode !== "string" ||
      !TRAVEL_MODES.has(saved.mode)
    ) {
      return null;
    }
    return {
      ...DEFAULT_TRAVEL,
      ...saved,
      rememberOnDevice: true,
    } as TravelPreferences;
  } catch {
    return null;
  }
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlannerState>(INITIAL_STATE);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  useEffect(() => {
    const remembered = readRememberedTravel();
    if (remembered) {
      setState((current) => ({ ...current, travel: remembered }));
    }
    setHasLoadedStorage(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) return;
    if (state.travel.rememberOnDevice) {
      window.localStorage.setItem(TRAVEL_STORAGE_KEY, JSON.stringify(state.travel));
    } else {
      window.localStorage.removeItem(TRAVEL_STORAGE_KEY);
    }
  }, [hasLoadedStorage, state.travel]);

  const value = useMemo<PlannerContextValue>(
    () => ({
      ...state,
      addItem(itemId, quantity) {
        if (validateQuantity(quantity)) return false;
        setState((current) => ({
          ...current,
          basket: upsertBasketLine(current.basket, itemId, quantity),
        }));
        return true;
      },
      updateQuantity(itemId, quantity) {
        if (validateQuantity(quantity)) return;
        setState((current) => ({
          ...current,
          basket: current.basket.map((line) =>
            line.itemId === itemId ? { ...line, quantity } : line,
          ),
        }));
      },
      removeItem(itemId) {
        setState((current) => ({
          ...current,
          basket: current.basket.filter((line) => line.itemId !== itemId),
        }));
      },
      applyAlternative(currentItemId, alternativeItemId) {
        setState((current) => ({
          ...current,
          basket: replaceBasketItem(current.basket, currentItemId, alternativeItemId),
        }));
      },
      updateTravel(changes) {
        setState((current) => ({
          ...current,
          travel: { ...current.travel, ...changes },
        }));
      },
      clearRememberedTravel() {
        window.localStorage.removeItem(TRAVEL_STORAGE_KEY);
        setState((current) => ({
          ...current,
          travel: { ...DEFAULT_TRAVEL, rememberOnDevice: false },
        }));
      },
      setSaraPlanningEnabled(enabled) {
        setState((current) => ({ ...current, saraPlanningEnabled: enabled }));
      },
      setSaraCreditBalance(value) {
        setState((current) => ({ ...current, saraCreditBalance: Math.max(0, value) }));
      },
      setWeeklyBudget(value) {
        setState((current) => ({ ...current, weeklyBudget: value }));
      },
    }),
    [state],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner() {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error("usePlanner must be used within PlannerProvider");
  }
  return context;
}

export function findBasketLine(basket: BasketLine[], itemId: string) {
  return basket.find((line) => line.itemId === itemId);
}
