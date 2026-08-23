import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PlannerProvider } from "@/features/planner/planner-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SmartCart - Accessible basket planner",
    template: "%s | SmartCart",
  },
  description:
    "Plan an affordable household-essential basket at one reachable Malaysian store using PriceCatcher data.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-MY">
      <body>
        <PlannerProvider>
          <AppShell>{children}</AppShell>
        </PlannerProvider>
      </body>
    </html>
  );
}
