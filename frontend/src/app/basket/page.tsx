import type { Metadata } from "next";
import { BasketPage } from "@/features/basket/basket-page";

export const metadata: Metadata = { title: "Build your basket" };

export default function Page() {
  return <BasketPage />;
}
