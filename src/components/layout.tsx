import { Show } from "solid-js";
import { RGBA } from "@opentui/core";
import { TopBar } from "./top-bar";
import { SearchBar } from "./search-bar";
import { QuickActions } from "./quick-actions";
import { MarketList } from "./market-list";
import { MarketDetails } from "./market-details";
import { PortfolioPanel } from "./portfolio-panel";
import { StatusBar } from "./status-bar";
import { Footer } from "./footer";
import { NewsPanel } from "./news-panel";
import { SocialPanel } from "./social-panel";
import { AutomationPanel } from "./automation-panel";
import { SkillsPanel } from "./skills-panel";
import { EnterpriseChat } from "./enterprise-chat";
import { useTheme } from "../context/theme";
import { Separator } from "./ui/panel-components";
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
  orderBookPanelOpen,
  filterPanelOpen,
  analyticsPanelOpen,
  messagesPanelOpen,
  authModalOpen,
  profilePanelOpen,
  userSearchOpen,
  newsPanelOpen,
  socialPanelOpen,
  automationPanelOpen,
  skillsPanelOpen,
  enterpriseChatOpen,
} from "../state";
import { alertsState } from "../hooks/useAlerts";
import { AccountStatsPanel } from "./account-stats";
import { AlertsPanel } from "./alerts-panel";
import { AnalyticsPanel } from "./analytics-panel";
import { AuthModal } from "./auth-modal";
import { ComparisonPanel } from "./comparison-panel";
import { FilterPanel } from "./filter-panel";
import { IndicatorsPanel } from "./indicators-panel";
import { MessagesPanel } from "./messages-panel";
import { OrderBookPanel } from "./order-book-panel";
import { OrderForm } from "./order-form";
import { OrderHistory } from "./order-history";
import { ProfilePanel } from "./profile-panel";
import { SentimentPanel } from "./sentiment-panel";
import { SettingsPanel } from "./settings-panel";
import { ShortcutsPanel } from "./shortcuts-panel";
import { UserSearch } from "./user-search";
import { WalletConnect } from "./wallet-connect";
import { WatchlistPanel } from "./watchlist-panel";

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

      {/* Quick Actions Bar */}
      <QuickActions />

      {/* Separator */}
      <Separator type="heavy" />

      {/* Main Content */}
      <box flexGrow={1} width="100%" flexDirection="column">
        {/* Upper market workspace - fills remaining space */}
        <box width="100%" flexGrow={1} flexDirection="row">
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

      </box>

      {/* Status Bar */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel}>
        <StatusBar />
      </box>

      {/* Footer */}
      <Footer />

      {/* Backdrop — dims main content behind any open panel */}
      <Show when={
        walletModalOpen() || orderFormOpen() || orderHistoryOpen() ||
        alertsState.panelOpen || indicatorsPanelOpen() || sentimentPanelOpen() ||
        comparisonPanelOpen() || watchlistPanelOpen() || settingsPanelOpen() || shortcutsPanelOpen() ||
        orderBookPanelOpen() || filterPanelOpen() || analyticsPanelOpen() || messagesPanelOpen() || authModalOpen() ||
        profilePanelOpen() || userSearchOpen() || newsPanelOpen() || socialPanelOpen() || automationPanelOpen() || skillsPanelOpen() ||
        enterpriseChatOpen()
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

      {/* Auth Modal Overlay */}
      <Show when={authModalOpen()}>
        <AuthModal />
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

      {/* Live Order Book Panel Modal */}
      <Show when={orderBookPanelOpen()}>
        <OrderBookPanel />
      </Show>

      {/* Filter Panel Modal */}
      <Show when={filterPanelOpen()}>
        <FilterPanel />
      </Show>

      {/* Analytics Panel Modal */}
      <Show when={analyticsPanelOpen()}>
        <AnalyticsPanel />
      </Show>

      {/* Messages Panel Modal */}
      <Show when={messagesPanelOpen()}>
        <MessagesPanel />
      </Show>

      {/* Profile Panel Modal */}
      <Show when={profilePanelOpen()}>
        <ProfilePanel />
      </Show>

      {/* User Search Modal */}
      <Show when={userSearchOpen()}>
        <UserSearch />
      </Show>

      {/* News Panel Modal */}
      <Show when={newsPanelOpen()}>
        <NewsPanel />
      </Show>

      {/* Social Sentiment Panel Modal */}
      <Show when={socialPanelOpen()}>
        <SocialPanel />
      </Show>

      {/* Automation Panel Modal */}
      <Show when={automationPanelOpen()}>
        <AutomationPanel />
      </Show>

      {/* Skills Panel Modal */}
      <Show when={skillsPanelOpen()}>
        <SkillsPanel />
      </Show>

      {/* Enterprise Chat Overlay — full screen, highest zIndex */}
      <Show when={enterpriseChatOpen()}>
        <EnterpriseChat />
      </Show>
    </box>
  );
}
