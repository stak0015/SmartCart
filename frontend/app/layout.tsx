import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartCart",
  description: "Plan an affordable household basket by comparing item prices, travel time, and return transport costs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-MY">
      <body>{children}</body>
    </html>
  );
}
