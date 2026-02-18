import {
  activeMainView,
  setActiveMainView,
  comparisonSelectedMarketId,
  setComparisonSelectedMarketId,
} from "../state";

export type ViewMode = "standard" | "portfolio" | "analytics" | "comparison";

const currentView = (): ViewMode =>
  comparisonSelectedMarketId() !== null
    ? "comparison"
    :
  activeMainView() === "portfolio" ? "portfolio" : "standard";

const comparisonMarketId = comparisonSelectedMarketId;

export function switchView(mode: ViewMode) {
  if (mode === "portfolio") {
    setActiveMainView("portfolio");
    return;
  }

  setActiveMainView("market");
}

export function setComparisonMarket(marketId: string | null) {
  setComparisonSelectedMarketId(marketId);
}

export function toggleComparison() {
  const current = currentView();
  if (current === "comparison") {
    setActiveMainView("market");
    setComparisonSelectedMarketId(null);
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
