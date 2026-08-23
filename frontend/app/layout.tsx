import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartCart",
  description: "Plan an affordable basket at one reachable Malaysian store.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-MY">
      <body>{children}</body>
    </html>
  );
}
