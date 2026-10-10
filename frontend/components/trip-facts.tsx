import type { ReactNode } from "react";
export function TripFactsItems({facts}: {facts: {icon: ReactNode; label: string; value: ReactNode}[]}) {
  return <>{facts.map(fact => <span key={fact.label}>{fact.icon}<small>{fact.label}</small><strong>{fact.value}</strong></span>)}</>;
}
