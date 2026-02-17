/**
 * Wallet connect modal component
 * Press W to open. ESC to close. D to disconnect.
 * C to enter key input mode. ENTER to confirm connection.
 */

import { Show } from "solid-js";
import { useTheme } from "../context/theme";
import {
  walletState,
  walletModalMode,
  walletModalInput,
  setWalletModalInput,
} from "../state";
import { truncateAddress } from "../auth/wallet";

export function WalletConnect() {
  const { theme } = useTheme();

  return (
    <box
      position="absolute"
      top={3}
      left="25%"
      width="50%"
      height={walletState.connected ? 10 : 12}
      backgroundColor={theme.backgroundPanel}
      flexDirection="column"
      zIndex={100}
    >
      {/* Header */}
      <box
        height={1}
        width="100%"
        backgroundColor={theme.primary}
        flexDirection="row"
      >
        <text
          content=" WALLET  "
          fg={theme.highlightText}
          width={10}
        />
        <box flexGrow={1} />
        <text
          content=" [ESC] Close "
          fg={theme.highlightText}
          width={14}
        />
      </box>

      {/* Body */}
      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1}>
        <Show when={walletState.loading}>
          <text content="  Connecting..." fg={theme.warning} />
        </Show>

        <Show when={!walletState.loading && walletState.error !== null}>
          <text content={` ✗ ${walletState.error}`} fg={theme.error} />
        </Show>

        <Show when={!walletState.loading && walletState.connected && walletState.address}>
          <box height={1} />
          <box flexDirection="row">
            <text content="  Address : " fg={theme.textMuted} width={12} />
            <text content={truncateAddress(walletState.address!)} fg={theme.primary} />
          </box>
          <box flexDirection="row">
            <text content="  Balance : " fg={theme.textMuted} width={12} />
            <text
              content={`$${walletState.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`}
              fg={theme.success}
            />
          </box>
          <Show when={walletState.apiKey}>
            <box flexDirection="row">
              <text content="  API Key : " fg={theme.textMuted} width={12} />
              <text content={`${walletState.apiKey!.slice(0, 8)}...`} fg={theme.textMuted} />
            </box>
          </Show>
          <box height={1} />
          <box flexDirection="row">
            <text content="  [D] Disconnect" fg={theme.error} />
            <text content="   [ESC] Close" fg={theme.textMuted} />
          </box>
        </Show>

        <Show when={!walletState.loading && !walletState.connected && walletModalMode() === "view"}>
          <box height={1} />
          <text content="  No wallet connected." fg={theme.textMuted} />
          <box height={1} />
          <text content="  [C] Enter Private Key    [ESC] Close" fg={theme.textMuted} />
        </Show>

        <Show when={!walletState.loading && !walletState.connected && walletModalMode() === "enter"}>
          <box height={1} />
          <text content="  Enter private key (0x...):" fg={theme.textMuted} />
          <box height={1} />
          <input
            width="100%"
            placeholder="0x..."
            value={walletModalInput()}
            focused
            onInput={(v: string) => setWalletModalInput(v)}
          />
          <box height={1} />
          <text content="  [ENTER] Connect    [ESC] Cancel" fg={theme.textMuted} />
        </Show>
      </box>
    </box>
  );
}
