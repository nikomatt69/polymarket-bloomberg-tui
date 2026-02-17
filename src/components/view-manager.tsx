import { createSignal } from "solid-js";

export type ViewMode = "standard" | "portfolio" | "analytics" | "comparison";

const [currentView, setCurrentView] = createSignal<ViewMode>("standard");
const [comparisonMarketId, setComparisonMarketId] = createSignal<string | null>(null);

export function switchView(mode: ViewMode) {
  setCurrentView(mode);
}

export function setComparisonMarket(marketId: string | null) {
  setComparisonMarketId(marketId);
}

export function toggleComparison() {
  const current = currentView();
  if (current === "comparison") {
    setCurrentView("standard");
    setComparisonMarketId(null);
  } else {
    setCurrentView("comparison");
  }
}

export function getViewTitle(mode: ViewMode): string {
  switch (mode) {
    case "standard": return "MARKETS";
    case "portfolio": return "PORTFOLIO";
    case "analytics": return "ANALYTICS";
    case "comparison": return "COMPARISON";
    default: return "MARKETS";
  }
}

export const viewShortcuts: Record<string, ViewMode> = {
  "1": "standard",
  "2": "portfolio", 
  "3": "analytics",
  "c": "comparison",
};

export { currentView, comparisonMarketId };
