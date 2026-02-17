import { Show } from "solid-js";
import { SearchBar } from "./search-bar";
import { MarketList } from "./market-list";
import { MarketDetails } from "./market-details";
import { StatusBar } from "./status-bar";
import { WalletConnect } from "./wallet-connect";
import { useTheme } from "../context/theme";
import { walletModalOpen } from "../state";

export function Layout() {
  const { theme } = useTheme();

  return (
    <box 
      width="100%" 
      height="100%" 
      flexDirection="column"
      backgroundColor={theme.background}
    >
      {/* Top Search Bar */}
      <box height={1} width="100%" backgroundColor={theme.background}>
        <SearchBar />
      </box>

      {/* Main Content */}
      <box flexGrow={1} width="100%" flexDirection="row">
        {/* Left: Market List */}
        <box width="55%" backgroundColor={theme.background}>
          <MarketList />
        </box>
        
        {/* Right: Details Panel */}
        <box flexGrow={1} backgroundColor={theme.backgroundPanel}>
          <MarketDetails />
        </box>
      </box>

      {/* Bottom Status Bar */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel}>
        <StatusBar />
      </box>

      {/* Wallet Modal Overlay */}
      <Show when={walletModalOpen()}>
        <WalletConnect />
      </Show>
    </box>
  );
}
