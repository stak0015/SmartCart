import type { Metadata } from "next";
import type { ReactNode } from "react";
import SmartCartApp from "@/components/smartcart-app";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartCart",
  description: "Plan an affordable household basket by comparing item prices, travel time, and return transport costs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-MY">
      <body><SmartCartApp />{children}</body>
    </html>
  );
}
