import { Show } from "solid-js";
import { RGBA } from "@opentui/core";
import { TopBar } from "./top-bar";
import { SearchBar } from "./search-bar";
import { MarketList } from "./market-list";
import { MarketDetails } from "./market-details";
import { PortfolioPanel } from "./portfolio-panel";
import { StatusBar } from "./status-bar";
import { Footer } from "./footer";
import { ChatInput } from "./chat-input";
import { ChatPanel } from "./chat-panel";
import { WalletConnect } from "./wallet-connect";
import { OrderForm } from "./order-form";
import { OrderHistory } from "./order-history";
import { AlertsPanel } from "./alerts-panel";
import { IndicatorsPanel } from "./indicators-panel";
import { SentimentPanel } from "./sentiment-panel";
import { ComparisonPanel } from "./comparison-panel";
import { WatchlistPanel } from "./watchlist-panel";
import { AccountStatsPanel } from "./account-stats";
import { SettingsPanel } from "./settings-panel";
import { ShortcutsPanel } from "./shortcuts-panel";
import { useTheme } from "../context/theme";
import {
  walletModalOpen,
  portfolioOpen,
  orderFormOpen,
  orderHistoryOpen,
  indicatorsPanelOpen,
  sentimentPanelOpen,
  comparisonPanelOpen,
  comparisonSelectedMarketId,
  watchlistPanelOpen,
  accountStatsOpen,
  settingsPanelOpen,
  shortcutsPanelOpen,
} from "../state";
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

      {/* Gap */}
      <box height={1} width="100%" backgroundColor={theme.background} />

      {/* Search Bar */}
      <box height={1} width="100%" backgroundColor={theme.background}>
        <SearchBar />
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.borderSubtle}>
        <text content="────────────────────────────────────────────────────────────────────────────────" fg={theme.border} />
      </box>

      {/* Main Content */}
      <box flexGrow={1} width="100%" flexDirection="column">
        {/* Upper market workspace */}
        <box width="100%" height="70%" flexDirection="row">
          {/* Left: Market List */}
          <box width="52%" backgroundColor={theme.background}>
            <MarketList />
          </box>

          {/* Vertical Separator */}
          <box width={1} backgroundColor={theme.border}>
            <text content="│" fg={theme.border} />
          </box>

          {/* Right: Details / Portfolio */}
          <box flexGrow={1} backgroundColor={theme.backgroundPanel}>
            <Show when={portfolioOpen()} fallback={<MarketDetails />}>
              <PortfolioPanel />
            </Show>
          </box>
        </box>

        {/* Horizontal separator before chat */}
        <box height={1} width="100%" backgroundColor={theme.borderSubtle}>
          <text content="────────────────────────────────────────────────────────────────────────────────" fg={theme.border} />
        </box>

        {/* Lower chat workspace */}
        <box flexGrow={1} width="100%" backgroundColor={theme.backgroundPanel}>
          <ChatPanel />
        </box>
      </box>

      {/* Status Bar */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel}>
        <StatusBar />
      </box>

      {/* Footer */}
      <Footer />

      {/* Chat Input */}
      <ChatInput />

      {/* Backdrop — dims main content behind any open panel */}
      <Show when={
        walletModalOpen() || orderFormOpen() || orderHistoryOpen() ||
        alertsState.panelOpen || indicatorsPanelOpen() || sentimentPanelOpen() ||
        comparisonPanelOpen() || watchlistPanelOpen() || settingsPanelOpen() || shortcutsPanelOpen()
      }>
        <box
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          backgroundColor={RGBA.fromInts(0, 0, 0, 200)}
          zIndex={90}
        />
      </Show>

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

      {/* Indicators Panel Modal */}
      <Show when={indicatorsPanelOpen()}>
        <IndicatorsPanel />
      </Show>

      {/* Sentiment Panel Modal */}
      <Show when={sentimentPanelOpen()}>
        <SentimentPanel />
      </Show>

      {/* Comparison Panel Modal */}
      <Show when={comparisonPanelOpen()}>
        <ComparisonPanel secondaryMarketId={comparisonSelectedMarketId()} />
      </Show>

      {/* Watchlist Panel Modal */}
      <Show when={watchlistPanelOpen()}>
        <WatchlistPanel />
      </Show>

      {/* Account Stats Panel Modal */}
      <Show when={accountStatsOpen()}>
        <AccountStatsPanel />
      </Show>

      {/* Settings Panel Modal */}
      <Show when={settingsPanelOpen()}>
        <SettingsPanel />
      </Show>

      {/* Shortcuts Panel Modal */}
      <Show when={shortcutsPanelOpen()}>
        <ShortcutsPanel />
      </Show>
    </box>
  );
}
