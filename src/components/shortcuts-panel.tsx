/**
 * Shortcuts panel — displays all available keyboard shortcuts
 * Accessible via Ctrl+K or dedicated key
 */

import { useTheme } from "../context/theme";
import { PanelHeader, SectionTitle, Separator } from "./ui/panel-components";
import { setShortcutsPanelOpen } from "../state";

function ShortcutRow(props: { keys: string; description: string }) {
  const { theme } = useTheme();
  return (
    <box flexDirection="row">
      <text content={props.keys} fg={theme.accent} width={12} />
      <text content={props.description} fg={theme.text} />
    </box>
  );
}

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
      <PanelHeader
        title="KEYBOARD SHORTCUTS"
        icon="◈"
        onClose={handleClose}
      />

      <Separator type="heavy" />

      {/* Content */}
      <box flexDirection="row" flexGrow={1} paddingTop={1} paddingRight={2}>
        {/* Column 1: Navigation & Market */}
        <box flexDirection="column" width={38} paddingLeft={2}>
          <SectionTitle title="Navigation" icon="◈" />
          <ShortcutRow keys="↑ / ↓   " description="Navigate markets" />
          <ShortcutRow keys="Enter    " description="AI Chat" />
          <ShortcutRow keys="Ctrl+K  " description="Cycle sort" />
          <ShortcutRow keys="R        " description="Refresh data" />
          <ShortcutRow keys="1-7      " description="Timeframe (1h→all)" />
          <ShortcutRow keys="/        " description="Search" />
          <box height={1} />
          <SectionTitle title="Market" icon="◈" />
          <ShortcutRow keys="X        " description="Toggle watchlist" />
          <ShortcutRow keys="F        " description="Watchlist filter" />
          <ShortcutRow keys="L        " description="Filter panel" />
          <ShortcutRow keys="Shift+L  " description="Watchlist panel" />
        </box>

        {/* Column 2: Trading Panels */}
        <box flexDirection="column" width={38} paddingLeft={1}>
          <SectionTitle title="Trading" icon="◈" />
          <ShortcutRow keys="W        " description="Wallet" />
          <ShortcutRow keys="O        " description="Buy order" />
          <ShortcutRow keys="S        " description="Sell order" />
          <ShortcutRow keys="H        " description="Order history" />
          <ShortcutRow keys="P        " description="Portfolio" />
          <ShortcutRow keys="U        " description="Account stats" />
          <ShortcutRow keys="Z        " description="Price alerts" />
          <box height={1} />
          <SectionTitle title="Data" icon="◈" />
          <ShortcutRow keys="D        " description="Live order book" />
          <ShortcutRow keys="I        " description="Indicators" />
          <ShortcutRow keys="M        " description="Sentiment" />
          <ShortcutRow keys="C        " description="Compare" />
        </box>

        {/* Column 3: Info Panels */}
        <box flexDirection="column" width={38} paddingLeft={1}>
          <SectionTitle title="Info Panels" icon="◈" />
          <ShortcutRow keys="A        " description="Analytics" />
          <ShortcutRow keys="N        " description="News" />
          <ShortcutRow keys="T        " description="Social" />
          <ShortcutRow keys="B        " description="Automation" />
          <ShortcutRow keys="V        " description="Skills" />
          <ShortcutRow keys="Shift+M  " description="Messages" />
          <ShortcutRow keys="Ctrl+X   " description="User profile" />
          <ShortcutRow keys="Ctrl+Y   " description="User search" />
          <ShortcutRow keys="G        " description="Auth / Login" />
        </box>

        {/* Column 4: System & Order History */}
        <box flexDirection="column" width={38} paddingLeft={1}>
          <SectionTitle title="System" icon="◈" />
          <ShortcutRow keys="E        " description="Settings" />
          <ShortcutRow keys="K        " description="Shortcuts panel" />
          <ShortcutRow keys="Q        " description="Quit" />
          <box height={1} />
          <SectionTitle title="In Order History" icon="◈" />
          <ShortcutRow keys="Tab      " description="Open/Trades" />
          <ShortcutRow keys="C        " description="Cancel selected" />
          <ShortcutRow keys="A        " description="Cancel all" />
          <ShortcutRow keys="Y        " description="Cancel market" />
          <ShortcutRow keys="V        " description="Status filter" />
          <ShortcutRow keys="B        " description="Side filter" />
          <ShortcutRow keys="G        " description="Time window" />
          <ShortcutRow keys="E        " description="Export CSV" />
          <ShortcutRow keys="D        " description="Duplicate order" />
        </box>
      </box>

      {/* Footer */}
      <Separator type="light" />
      <box height={1} paddingLeft={2}>
        <text content="[ESC/K] Close    [Ctrl+K] Cycle sort    [Enter] AI Chat    [Q] Quit" fg={theme.textMuted} />
      </box>
    </box>
  );
}
