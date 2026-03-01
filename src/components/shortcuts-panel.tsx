/**
 * Shortcuts panel — displays all available keyboard shortcuts
 * Accessible via Ctrl+K or dedicated key
 */

import { useTheme } from "../context/theme";
import { setShortcutsPanelOpen } from "../state";

export function ShortcutsPanel() {
  const { theme } = useTheme();

  const handleClose = () => setShortcutsPanelOpen(false);

  return (
    <box
      position="absolute"
      top={2}
      left="6%"
      width="88%"
      height={24}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={165}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ KEYBOARD SHORTCUTS " fg={theme.highlightText} />
        <box flexGrow={1} />
        <box onMouseDown={handleClose}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.primaryMuted} />

      {/* Content */}
      <box flexDirection="row" flexGrow={1} paddingLeft={2} paddingTop={1} paddingRight={2}>
        {/* Left column */}
        <box flexDirection="column" width={40}>
          <text content="NAVIGATION" fg={theme.primary} />
          <box flexDirection="row">
            <text content="  ↑ / ↓  " fg={theme.textMuted} width={10} />
            <text content="Navigate markets" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  Enter  " fg={theme.textMuted} width={10} />
            <text content="Select market" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  Ctrl+K " fg={theme.textMuted} width={10} />
            <text content="Cycle sort" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  R      " fg={theme.textMuted} width={10} />
            <text content="Refresh data" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  1/5/7/A" fg={theme.textMuted} width={10} />
            <text content="Timeframe" fg={theme.text} />
          </box>
          <text content="" />
          <text content="MARKET" fg={theme.primary} />
          <box flexDirection="row">
            <text content="  X      " fg={theme.textMuted} width={10} />
            <text content="Toggle watchlist" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  F      " fg={theme.textMuted} width={10} />
            <text content="Toggle filter" fg={theme.text} />
          </box>
          <text content="" />
          <text content="SYSTEM" fg={theme.primary} />
          <box flexDirection="row">
            <text content="  E      " fg={theme.textMuted} width={10} />
            <text content="Settings" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  K      " fg={theme.textMuted} width={10} />
            <text content="Shortcuts panel" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  Q      " fg={theme.textMuted} width={10} />
            <text content="Quit" fg={theme.text} />
          </box>
        </box>

        {/* Spacer */}
        <box width={2} />

        {/* Middle column */}
        <box flexDirection="column" width={40}>
          <text content="PANELS" fg={theme.primary} />
          <box flexDirection="row">
            <text content="  W      " fg={theme.textMuted} width={10} />
            <text content="Wallet" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  O      " fg={theme.textMuted} width={10} />
            <text content="Buy order" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  S      " fg={theme.textMuted} width={10} />
            <text content="Sell order" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  H      " fg={theme.textMuted} width={10} />
            <text content="Order history" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  P      " fg={theme.textMuted} width={10} />
            <text content="Portfolio" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  Z      " fg={theme.textMuted} width={10} />
            <text content="Price alerts" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  I      " fg={theme.textMuted} width={10} />
            <text content="Indicators" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  M      " fg={theme.textMuted} width={10} />
            <text content="Sentiment" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  C      " fg={theme.textMuted} width={10} />
            <text content="Compare" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  L      " fg={theme.textMuted} width={10} />
            <text content="Watchlist" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  U      " fg={theme.textMuted} width={10} />
            <text content="Account stats" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  D      " fg={theme.textMuted} width={10} />
            <text content="Live order book" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  a      " fg={theme.textMuted} width={10} />
            <text content="Analytics" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  i      " fg={theme.textMuted} width={10} />
            <text content="AI Assistant" fg={theme.text} />
          </box>
        </box>

        {/* Spacer */}
        <box width={2} />

        {/* Right column - Order History */}
        <box flexDirection="column" width={40}>
          <text content="ORDER HISTORY" fg={theme.primary} />
          <box flexDirection="row">
            <text content="  Tab   " fg={theme.textMuted} width={10} />
            <text content="Open/Trades" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  ↑/↓   " fg={theme.textMuted} width={10} />
            <text content="Navigate" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  C     " fg={theme.textMuted} width={10} />
            <text content="Cancel order" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  A     " fg={theme.textMuted} width={10} />
            <text content="Cancel all" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  Y     " fg={theme.textMuted} width={10} />
            <text content="Cancel selected" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  V     " fg={theme.textMuted} width={10} />
            <text content="Status filter" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  B     " fg={theme.textMuted} width={10} />
            <text content="Side filter" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  G     " fg={theme.textMuted} width={10} />
            <text content="Time window" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  M     " fg={theme.textMuted} width={10} />
            <text content="Market filter" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  /     " fg={theme.textMuted} width={10} />
            <text content="Search" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  D     " fg={theme.textMuted} width={10} />
            <text content="Replay order" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  E     " fg={theme.textMuted} width={10} />
            <text content="Export CSV" fg={theme.text} />
          </box>
          <text content="" />
          <text content="INDICATORS" fg={theme.primary} />
          <box flexDirection="row">
            <text content="  1-4   " fg={theme.textMuted} width={10} />
            <text content="Select indicator" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  +/-    " fg={theme.textMuted} width={10} />
            <text content="Period +/-" fg={theme.text} />
          </box>
          <box flexDirection="row">
            <text content="  R     " fg={theme.textMuted} width={10} />
            <text content="Refresh" fg={theme.text} />
          </box>
        </box>
      </box>

      {/* Footer */}
      <box height={1} paddingLeft={2}>
        <text content="[ESC] Close    [K] Toggle    [Ctrl+K] Cycle sort" fg={theme.textMuted} />
      </box>
    </box>
  );
}
