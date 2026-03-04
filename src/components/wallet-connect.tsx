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
import { PanelHeader, DataRow, Separator } from "./ui/panel-components";

function BalanceBar(props: { balance: number; maxBalance?: number }) {
  const { theme } = useTheme();
  const max = () => props.maxBalance ?? Math.max(1000, props.balance * 2);
  const pct = () => Math.min(1, props.balance / max());
  const barWidth = 28;
  const filled = () => Math.round(pct() * barWidth);
  const barColor = () =>
    pct() > 0.7 ? theme.success : pct() > 0.3 ? theme.warning : theme.error;

  return (
    <box flexDirection="row" paddingLeft={0}>
      <text content="[" fg={theme.textMuted} />
      <text content={"█".repeat(filled())} fg={barColor()} />
      <text content={"░".repeat(barWidth - filled())} fg={theme.borderSubtle} />
      <text content={"] " } fg={theme.textMuted} />
      <text content={`${(pct() * 100).toFixed(0)}%`} fg={barColor()} />
    </box>
  );
}

export function WalletConnect() {
  const { theme } = useTheme();

  return (
    <box
      position="absolute"
      top={3}
      left="28%"
      width="44%"
      height={walletState.connected ? 14 : 12}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={100}
    >
      {/* Header */}
      <PanelHeader
        title="WALLET"
        icon="◈"
        onClose={() => setWalletModalOpen(false)}
      />

      {/* Separator */}
      <Separator type="heavy" />

      {/* Body */}
      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
        <Show when={walletState.loading}>
          <text content="◌ Connecting to wallet…" fg={theme.warning} />
        </Show>

        <Show when={!walletState.loading && walletState.error !== null}>
          <text content={`● ${walletState.error}`} fg={theme.error} />
          <text content="" />
          <box onMouseDown={() => setWalletModalMode("enter")}>
            <text content="[C] Try Again  [ESC] Close" fg={theme.textMuted} />
          </box>
        </Show>

        <Show when={!walletState.loading && walletState.connected && walletState.address}>
          {/* Status row */}
          <box flexDirection="row" paddingBottom={0}>
            <text content="● CONNECTED" fg={theme.success} />
            <box flexGrow={1} />
            <Show when={walletState.apiKey}>
              <text content="API ✓" fg={theme.success} />
            </Show>
          </box>

          <Separator type="light" />

          <DataRow label="Address" value={truncateAddress(walletState.address!)} valueColor="accent" />
          <DataRow
            label="Balance"
            value={`$${walletState.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`}
            valueColor="success"
          />

          {/* Balance bar */}
          <box paddingLeft={1} paddingTop={0}>
            <BalanceBar balance={walletState.balance} />
          </box>

          <Show when={walletState.apiKey}>
            <DataRow label="API Key" value={`${walletState.apiKey!.slice(0, 8)}…`} valueColor="muted" />
          </Show>

          <Show when={walletState.funderAddress}>
            <DataRow label="Proxy Wlt" value={truncateAddress(walletState.funderAddress!)} valueColor="muted" />
          </Show>

          <Separator type="light" />

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
          <text content="○ No wallet connected" fg={theme.textMuted} />
          <text content="" />
          <text content="Connect a wallet using your Ethereum private key to" fg={theme.textMuted} />
          <text content="place orders and manage your portfolio positions." fg={theme.textMuted} />
          <text content="" />
          <box onMouseDown={() => setWalletModalMode("enter")}>
            <text content="[C] Enter Private Key" fg={theme.accent} />
            <text content="    [ESC] Close" fg={theme.textMuted} />
          </box>
        </Show>

        <Show when={!walletState.loading && !walletState.connected && walletModalMode() === "enter"}>
          <text content="─── PRIVATE KEY ──────────────────────────────" fg={theme.borderSubtle} />
          <text content="Enter your Ethereum private key (0x...):" fg={theme.textMuted} />
          <text content="● Stored locally  ● Never sent to any server" fg={theme.textMuted} />
          <text content="" />
          <input
            width="100%"
            value={walletModalInput()}
            focused
            onInput={(v: string) => setWalletModalInput(v)}
          />
          <text content="" />
          <box flexDirection="row" gap={3}>
            <text content="[ENTER] Connect" fg={theme.success} />
            <box onMouseDown={() => setWalletModalMode("view")}>
              <text content="[ESC] Cancel" fg={theme.textMuted} />
            </box>
          </box>
        </Show>
      </box>
    </box>
  );
}
