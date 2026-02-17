import { Show } from "solid-js";
import { TopBar } from "./top-bar";
import { SearchBar } from "./search-bar";
import { MarketList } from "./market-list";
import { MarketDetails } from "./market-details";
import { PortfolioPanel } from "./portfolio-panel";
import { StatusBar } from "./status-bar";
import { Footer } from "./footer";
import { WalletConnect } from "./wallet-connect";
import { OrderForm } from "./order-form";
import { OrderHistory } from "./order-history";
import { AlertsPanel } from "./alerts-panel";
import { useTheme } from "../context/theme";
import { walletModalOpen, portfolioOpen, orderFormOpen, orderHistoryOpen } from "../state";
import { alertsState } from "../hooks/useAlerts";

export function Layout() {
  const { theme } = useTheme();

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.background}
    >
      {/* Top Bar */}
      <TopBar />

      {/* Search Bar */}
      <box height={1} width="100%" backgroundColor={theme.background}>
        <SearchBar />
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.borderSubtle}>
        <text content="────────────────────────────────────────────────────────────────────────────────" fg={theme.border} />
      </box>

      {/* Main Content */}
      <box flexGrow={1} width="100%" flexDirection="row">
        {/* Left: Market List */}
        <box width="52%" backgroundColor={theme.background}>
          <MarketList />
        </box>

        {/* Vertical Separator */}
        <box width={1} backgroundColor={theme.border}>
          <text content="│" fg={theme.border} />
        </box>

        {/* Right: Details Panel or Portfolio Panel */}
        <box flexGrow={1} backgroundColor={theme.backgroundPanel}>
          <Show when={portfolioOpen()} fallback={<MarketDetails />}>
            <PortfolioPanel />
          </Show>
        </box>
      </box>

      {/* Status Bar */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel}>
        <StatusBar />
      </box>

      {/* Footer */}
      <Footer />

      {/* Wallet Modal Overlay */}
      <Show when={walletModalOpen()}>
        <WalletConnect />
      </Show>

      {/* Order Form Modal */}
      <Show when={orderFormOpen()}>
        <OrderForm />
      </Show>

      {/* Order History Modal */}
      <Show when={orderHistoryOpen()}>
        <OrderHistory />
      </Show>

      {/* Alerts Panel Modal */}
      <Show when={alertsState.panelOpen}>
        <AlertsPanel />
      </Show>
    </box>
  );
}
