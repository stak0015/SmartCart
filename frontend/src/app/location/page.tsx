import type { Metadata } from "next";
import { LocationPage } from "@/features/location/location-page";

export const metadata: Metadata = { title: "Set travel preferences" };

export default function Page() {
  return <LocationPage />;
}
