import type { Metadata } from "next";
import { RecommendationsPage } from "@/features/recommendations/recommendations-page";

export const metadata: Metadata = { title: "Reachable store recommendations" };

export default function Page() {
  return <RecommendationsPage />;
}
