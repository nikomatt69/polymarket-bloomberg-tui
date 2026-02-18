import { createMemo } from "solid-js";
import {
  appState,
  updateSearchQuery,
  walletState,
  searchInputFocused,
  setSearchInputFocused,
} from "../state";
import { useTheme } from "../context/theme";
import { truncateAddress } from "../auth/wallet";

export function SearchBar() {
  const { theme } = useTheme();

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
      <box onMouseDown={() => setSearchInputFocused(true)}>
        <text
          content={searchInputFocused() ? "Search* " : "Search  "}
          fg={searchInputFocused() ? theme.primary : theme.textBright}
          width={8}
        />
      </box>
      <text content="Markets " fg={theme.textBright} width={8} />

      {/* Search Input */}
      <box flexGrow={1} onMouseDown={() => setSearchInputFocused(true)}>
        <input
          width="100%"
          value={appState.searchQuery}
          focused={searchInputFocused()}
          onInput={(value: string) => {
            setSearchInputFocused(true);
            updateSearchQuery(value);
          }}
        />
      </box>

      <text
        content={searchInputFocused() ? " [ESC] Done " : " [/ ] Focus "}
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
