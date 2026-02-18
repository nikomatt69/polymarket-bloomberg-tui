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
  setWalletModalOpen,
  setWalletModalMode,
} from "../state";
import { truncateAddress } from "../auth/wallet";
import { disconnectWalletHook, connectWallet } from "../hooks/useWallet";

export function WalletConnect() {
  const { theme } = useTheme();

  return (
    <box
      position="absolute"
      top={3}
      left="28%"
      width="44%"
      height={walletState.connected ? 10 : 12}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={100}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ WALLET " fg={theme.highlightText} />
        <box flexGrow={1} />
        <box onMouseDown={() => setWalletModalOpen(false)}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.primaryMuted} />

      {/* Body */}
      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
        <Show when={walletState.loading}>
          <text content="Connecting..." fg={theme.warning} />
        </Show>

        <Show when={!walletState.loading && walletState.error !== null}>
          <text content={`✗ ${walletState.error}`} fg={theme.error} />
        </Show>

        <Show when={!walletState.loading && walletState.connected && walletState.address}>
          <box flexDirection="row" gap={1}>
            <text content="Address :" fg={theme.textMuted} width={10} />
            <text content={truncateAddress(walletState.address!)} fg={theme.primary} />
          </box>
          <box flexDirection="row" gap={1}>
            <text content="Balance :" fg={theme.textMuted} width={10} />
            <text
              content={`$${walletState.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`}
              fg={theme.success}
            />
          </box>
          <Show when={walletState.apiKey}>
            <box flexDirection="row" gap={1}>
              <text content="API Key :" fg={theme.textMuted} width={10} />
              <text content={`${walletState.apiKey!.slice(0, 8)}...`} fg={theme.textMuted} />
            </box>
          </Show>
          <text content="" />
          <box flexDirection="row" gap={3}>
            <box onMouseDown={() => disconnectWalletHook()}>
              <text content="[D] Disconnect" fg={theme.error} />
            </box>
            <box onMouseDown={() => setWalletModalOpen(false)}>
              <text content="[ESC] Close" fg={theme.textMuted} />
            </box>
          </box>
        </Show>

        <Show when={!walletState.loading && !walletState.connected && walletModalMode() === "view"}>
          <text content="No wallet connected." fg={theme.textMuted} />
          <text content="" />
          <box onMouseDown={() => setWalletModalMode("enter")}>
            <text content="[C] Enter Private Key    [ESC] Close" fg={theme.textMuted} />
          </box>
        </Show>

        <Show when={!walletState.loading && !walletState.connected && walletModalMode() === "enter"}>
          <text content="Enter private key (0x...):" fg={theme.textMuted} />
          <text content="" />
          <input
            width="100%"
            value={walletModalInput()}
            focused
            onInput={(v: string) => setWalletModalInput(v)}
          />
          <text content="" />
          <text content="[ENTER] Connect    [ESC] Cancel" fg={theme.textMuted} />
        </Show>
      </box>
    </box>
  );
}
