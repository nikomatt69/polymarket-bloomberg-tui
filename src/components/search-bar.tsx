import { createMemo } from "solid-js";
import {
  appState,
  walletState,
  filterState,
  setFilterPanelOpen,
  setSearchPanelOpen,
} from "../state";
import { useTheme } from "../context/theme";
import { truncateAddress } from "../auth/wallet";

export function SearchBar() {
  const { theme } = useTheme();

  const hasActiveFilters = createMemo(() =>
    filterState.volumeMin !== undefined ||
    filterState.volumeMax !== undefined ||
    filterState.priceMin !== undefined ||
    filterState.priceMax !== undefined ||
    filterState.liquidityMin !== undefined ||
    filterState.category !== undefined ||
    filterState.sortBy2 !== undefined
  );

  const walletChip = createMemo(() => {
    if (walletState.loading) return " ⟳ Connecting... ";
    if (walletState.connected && walletState.address) {
      return ` ◉ ${truncateAddress(walletState.address)} `;
    }
    return " ○ [W] Connect ";
  });

  const walletChipColor = createMemo(() => {
    if (walletState.loading) return theme.warning;
    if (walletState.connected) return theme.success;
    return theme.textMuted;
  });

  return (
    <box flexDirection="row" width="100%" backgroundColor={theme.background}>
      {/* Logo/Brand */}
      <text
        content="◈"
        fg={theme.primary}
        width={2}
      />
      <box onMouseDown={() => setSearchPanelOpen(true)}>
        <text
          content="Search  "
          fg={theme.textBright}
          width={8}
        />
      </box>
      <text content="Markets " fg={theme.textBright} width={8} />

      {/* Search Input — click opens full search panel */}
      <box flexGrow={1} onMouseDown={() => setSearchPanelOpen(true)}>
        <text
          content={appState.searchQuery ? appState.searchQuery : "  [/] Open search panel…"}
          fg={appState.searchQuery ? theme.text : theme.textMuted}
          width="100%"
        />
      </box>

      {/* Filter indicator */}
      <box
        paddingX={1}
        backgroundColor={hasActiveFilters() ? theme.accent : undefined}
        onMouseDown={() => setFilterPanelOpen(true)}
      >
        <text
          content={hasActiveFilters() ? " [L] Filters*" : " [L] Filters "}
          fg={hasActiveFilters() ? theme.background : theme.textMuted}
        />
      </box>

      <text
        content=" [/] Search "
        fg={theme.textMuted}
      />

      {/* Wallet chip */}
      <text
        content={walletChip()}
        fg={walletChipColor()}
      />
    </box>
  );
}
