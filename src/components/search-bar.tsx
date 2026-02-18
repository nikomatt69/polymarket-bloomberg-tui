import { createMemo } from "solid-js";
import { appState, updateSearchQuery, walletState } from "../state";
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
      <text
        content="POLYMARKET"
        fg={theme.textBright}
        width={12}
      />

      {/* Search Input */}
      <input
        width="100%"
        value={appState.searchQuery}
        onInput={(value: string) => updateSearchQuery(value)}
      />

      {/* Wallet chip */}
      <text
        content={walletChip()}
        fg={walletChipColor()}
      />
    </box>
  );
}
