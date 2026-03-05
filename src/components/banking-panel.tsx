/**
 * Banking Panel — Deposit, Withdraw, and Transfer funds
 * Keyboard: ESC to close, Tab to switch tabs
 */

import { Show, For, createSignal, createEffect } from "solid-js";
import { useTheme } from "../context/theme";
import { PanelHeader, SectionTitle, DataRow, Separator, StatusBadge, TabBar } from "./ui/panel-components";
import {
  bankingPanelOpen,
  setBankingPanelOpen,
  bankingPanelTab,
  setBankingPanelTab,
  bankingAsset,
  setBankingAsset,
  bankingAmount,
  setBankingAmount,
  bankingSourceChain,
  setBankingSourceChain,
  bankingDestChain,
  setBankingDestChain,
  bankingAddress,
  setBankingAddress,
  bankingLoading,
  setBankingLoading,
  bankingError,
  setBankingError,
  bankingSuccess,
  setBankingSuccess,
  walletState,
} from "../state";
import { getDepositAddress, getWithdrawalAddress, getBridgeQuote, BridgeQuoteResponse } from "../api/bridge";

const SUPPORTED_ASSETS = ["USDC", "USDT", "ETH", "MATIC", "BTC"];
const SOURCE_CHAINS = [
  { id: "ethereum", name: "Ethereum" },
  { id: "polygon", name: "Polygon" },
  { id: "arbitrum", name: "Arbitrum" },
  { id: "optimism", name: "Optimism" },
  { id: "base", name: "Base" },
];

function truncateAddress(addr: string): string {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function BankingPanel() {
  const { theme } = useTheme();

  const [quote, setQuote] = createSignal<BridgeQuoteResponse | null>(null);

  const handleTabChange = (tab: string) => {
    setBankingPanelTab(tab as "deposit" | "withdraw" | "transfer");
    setBankingError(null);
    setBankingSuccess(null);
    setQuote(null);
  };

  // Fetch quote when amount changes
  createEffect(() => {
    const amount = bankingAmount();
    const asset = bankingAsset();
    const srcChain = bankingSourceChain();
    const dstChain = bankingDestChain();
    const tab = bankingPanelTab();

    if (amount && parseFloat(amount) > 0 && tab !== "transfer") {
      void (async () => {
        const src = tab === "deposit" ? srcChain : dstChain;
        const dst = tab === "deposit" ? dstChain : srcChain;
        const q = await getBridgeQuote(asset, amount, src, dst);
        setQuote(q);
      })();
    } else {
      setQuote(null);
    }
  });

  const handleDeposit = async () => {
    if (!bankingAmount() || !parseFloat(bankingAmount())) {
      setBankingError("Please enter an amount");
      return;
    }

    setBankingLoading(true);
    setBankingError(null);
    setBankingSuccess(null);

    try {
      const result = await getDepositAddress(
        bankingAsset(),
        bankingSourceChain(),
        bankingDestChain()
      );

      if (result) {
        setBankingSuccess(`Deposit address: ${result.address}${result.memo ? ` (memo: ${result.memo})` : ""}`);
      } else {
        setBankingError("Failed to get deposit address");
      }
    } catch (err) {
      setBankingError(`Error: ${err}`);
    } finally {
      setBankingLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!bankingAmount() || !bankingAddress()) {
      setBankingError("Please enter amount and destination address");
      return;
    }

    setBankingLoading(true);
    setBankingError(null);
    setBankingSuccess(null);

    try {
      // For withdrawals, we show the address to send funds to
      const result = await getWithdrawalAddress(
        bankingAsset(),
        bankingSourceChain(),
        bankingDestChain()
      );

      if (result) {
        setBankingSuccess(`Withdraw to: ${result.address}`);
      } else {
        setBankingError("Failed to get withdrawal address");
      }
    } catch (err) {
      setBankingError(`Error: ${err}`);
    } finally {
      setBankingLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!bankingAmount() || !bankingAddress()) {
      setBankingError("Please enter amount and destination address");
      return;
    }

    setBankingLoading(true);
    setBankingError(null);
    setBankingSuccess(null);

    // Internal transfer between connected wallet and funder
    const fromAddr = walletState.address;
    const toAddr = bankingAddress();

    setBankingSuccess(`Transfer ${bankingAmount()} ${bankingAsset()} from ${truncateAddress(fromAddr!)} to ${truncateAddress(toAddr)} - Use your external wallet to send`);
    setBankingLoading(false);
  };

  return (
    <box
      position="absolute"
      top={3}
      left="15%"
      width="70%"
      height={22}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={170}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ BANKING " fg={theme.highlightText} />
        <Show when={walletState.connected}>
          <text content=" │ " fg={theme.primaryMuted} />
          <text content={truncateAddress(walletState.address!)} fg={theme.highlightText} />
        </Show>
        <box flexGrow={1} />
        <box onMouseDown={() => setBankingPanelOpen(false)}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Tab bar */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
        <box onMouseDown={() => handleTabChange("deposit")}>
          <text
            content={bankingPanelTab() === "deposit" ? " ▶ DEPOSIT " : "   DEPOSIT "}
            fg={bankingPanelTab() === "deposit" ? theme.primary : theme.textMuted}
          />
        </box>
        <box onMouseDown={() => handleTabChange("withdraw")}>
          <text
            content={bankingPanelTab() === "withdraw" ? " ▶ WITHDRAW " : "   WITHDRAW "}
            fg={bankingPanelTab() === "withdraw" ? theme.primary : theme.textMuted}
          />
        </box>
        <box onMouseDown={() => handleTabChange("transfer")}>
          <text
            content={bankingPanelTab() === "transfer" ? " ▶ TRANSFER " : "   TRANSFER "}
            fg={bankingPanelTab() === "transfer" ? theme.primary : theme.textMuted}
          />
        </box>
        <box flexGrow={1} />
        <text content="[TAB] switch  [type] enter amount " fg={theme.textMuted} />
      </box>

      {/* Content */}
      <box flexDirection="column" padding={1} flexGrow={1}>
        <Show when={!walletState.connected}>
          <box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center">
            <text content="○ Connect wallet first" fg={theme.textMuted} />
          </box>
        </Show>

        <Show when={walletState.connected}>
          {/* Asset selection */}
          <box flexDirection="row" width="100%" gap={2}>
            <text content="Asset: " fg={theme.textMuted} />
            <For each={SUPPORTED_ASSETS}>
              {(asset) => (
                <box onMouseDown={() => setBankingAsset(asset)}>
                  <text
                    content={bankingAsset() === asset ? ` [${asset}] ` : `  ${asset}  `}
                    fg={bankingAsset() === asset ? theme.primary : theme.textMuted}
                  />
                </box>
              )}
            </For>
          </box>

          <Separator type="light" />

          {/* Chain selection */}
          <Show when={bankingPanelTab() !== "transfer"}>
            <box flexDirection="row" width="100%" gap={4}>
              <box flexDirection="column">
                <text content="From Chain:" fg={theme.textMuted} />
                <box flexDirection="row" gap={1}>
                  <For each={SOURCE_CHAINS.filter(c => c.id !== bankingDestChain())}>
                    {(chain) => (
                      <box onMouseDown={() => setBankingSourceChain(chain.id)}>
                        <text
                          content={bankingSourceChain() === chain.id ? `[${chain.name}]` : ` ${chain.name} `}
                          fg={bankingSourceChain() === chain.id ? theme.primary : theme.textMuted}
                        />
                      </box>
                    )}
                  </For>
                </box>
              </box>
              <box flexDirection="column">
                <text content="To Chain:" fg={theme.textMuted} />
                <box flexDirection="row" gap={1}>
                  <For each={SOURCE_CHAINS.filter(c => c.id !== bankingSourceChain())}>
                    {(chain) => (
                      <box onMouseDown={() => setBankingDestChain(chain.id)}>
                        <text
                          content={bankingDestChain() === chain.id ? `[${chain.name}]` : ` ${chain.name} `}
                          fg={bankingDestChain() === chain.id ? theme.primary : theme.textMuted}
                        />
                      </box>
                    )}
                  </For>
                </box>
              </box>
            </box>
            <Separator type="light" />
          </Show>

          {/* Amount input */}
          <box flexDirection="row" width="100%" gap={2} alignItems="center">
            <text content="Amount: " fg={theme.textMuted} />
            <text content={bankingAmount() || "0"} fg={theme.text} />
            <text content=" USDC" fg={theme.textMuted} />
          </box>

          {/* Quote display */}
          <Show when={quote()}>
            <box flexDirection="column" width="100%" paddingTop={1}>
              <text content="─── QUOTE ───" fg={theme.borderSubtle} />
              <text
                content={`Receive: ~${quote()!.estimatedReceiveAmount} ${bankingAsset()} (${quote()!.estimatedDuration})`}
                fg={theme.success}
              />
              <text content={`Fees: ${quote()!.fees.map(f => `${f.amount} ${f.asset}`).join(", ")}`} fg={theme.textMuted} />
            </box>
          </Show>

          {/* Address input for withdraw/transfer */}
          <Show when={bankingPanelTab() !== "deposit"}>
            <box flexDirection="row" width="100%" gap={2} paddingTop={1}>
              <text content="To: " fg={theme.textMuted} />
              <text content={bankingAddress() || "(enter address)"} fg={bankingAddress() ? theme.text : theme.textMuted} />
            </box>
          </Show>

          {/* Error/Success messages */}
          <Show when={bankingError()}>
            <box paddingTop={1}>
              <text content={`✕ ${bankingError()}`} fg={theme.error} />
            </box>
          </Show>
          <Show when={bankingSuccess()}>
            <box paddingTop={1}>
              <text content={`✓ ${bankingSuccess()}`} fg={theme.success} />
            </box>
          </Show>

          {/* Action button */}
          <box paddingTop={1}>
            <Show when={bankingLoading()}>
              <text content="◌ Processing…" fg={theme.warning} />
            </Show>
            <Show when={!bankingLoading()}>
              <box
                onMouseDown={() => {
                  if (bankingPanelTab() === "deposit") handleDeposit();
                  else if (bankingPanelTab() === "withdraw") handleWithdraw();
                  else handleTransfer();
                }}
              >
                <text
                  content={bankingPanelTab() === "deposit" ? " [GET DEPOSIT ADDRESS] "
                    : bankingPanelTab() === "withdraw" ? " [GET WITHDRAW ADDRESS] "
                    : " [PREPARE TRANSFER] "}
                  fg={theme.primary}
                />
              </box>
            </Show>
          </box>

          {/* Help text */}
          <box flexGrow={1} />
          <text content="─── HELP ───" fg={theme.borderSubtle} />
          <text content="Deposit: Get address to send crypto from external wallet" fg={theme.textMuted} />
          <text content="Withdraw: Get Polymarket address to withdraw to" fg={theme.textMuted} />
          <text content="Transfer: Move funds between your EOA and Proxy wallet" fg={theme.textMuted} />
        </Show>
      </box>

      {/* Footer */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel}>
        <text content=" [ESC] Close  [TAB] Switch tab  [Enter] Execute " fg={theme.textMuted} />
      </box>
    </box>
  );
}
