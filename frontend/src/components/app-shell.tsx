import { Accessibility, ExternalLink, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PlannerSteps } from "./planner-steps";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/basket" aria-label="SmartCart basket planner home">
            <span className="brand__mark" aria-hidden="true">
              <ShoppingBasket size={23} strokeWidth={2.2} />
            </span>
            <span>
              <strong>SmartCart</strong>
              <small>Plan one reachable shop</small>
            </span>
          </Link>
          <div className="header-note" title="This interface uses illustrative data while integrations are developed">
            <span className="status-dot" aria-hidden="true" />
            Iteration 1 prototype
          </div>
        </div>
      </header>

      <PlannerSteps />

      <main id="main-content" className="main-content">
        {children}
      </main>

      <footer className="site-footer">
        <div>
          <span className="footer-title"><Accessibility size={18} /> Designed for WCAG 2.2</span>
          <p>Clear focus states, keyboard controls, readable contrast and no account required.</p>
        </div>
        <p className="footer-source">
          Price records will come from PriceCatcher. A recorded price does not confirm current stock.
          {" "}
          <a href="https://pricecatcher.kpdn.gov.my/" target="_blank" rel="noreferrer">
            PriceCatcher <ExternalLink size={13} aria-hidden="true" />
          </a>
        </p>
      </footer>
    </>
  );
}
