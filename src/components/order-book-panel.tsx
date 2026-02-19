/**
 * Live order book depth panel with real-time WebSocket streaming.
 * Connects to wss://ws-subscriptions-clob.polymarket.com/ws/ and shows
 * live bid/ask levels with visual depth bars.
 *
 * Keyboard: ESC to close, Tab to switch outcomes (if multi-outcome market)
 */

import { createSignal, createEffect, onCleanup, createMemo, For, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useTheme } from "../context/theme";
import { appState, setOrderBookPanelOpen } from "../state";
import { createClobWebSocket, WsStatus } from "../api/ws";
import type { WsBookSnapshot, WsPriceChange, WsTrade } from "../api/ws";
import { getMarketDepth } from "../api/polymarket";

interface DepthLevel {
  price: number;
  size: number;
}

interface BookState {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

interface LastTrade {
  price: number;
  size: number;
  side: "BUY" | "SELL";
}

function buildBar(fraction: number, width: number): string {
  const filled = Math.max(0, Math.round(fraction * width));
  return "█".repeat(filled);
}

function formatPrice(p: number): string {
  return p.toFixed(4);
}

function formatSize(s: number): string {
  if (s >= 1_000_000) return `${(s / 1_000_000).toFixed(1)}M`;
  if (s >= 1_000) return `${(s / 1_000).toFixed(1)}K`;
  return s.toFixed(0);
}

const DISPLAY_LEVELS = 12;
const BAR_WIDTH = 18;

export function OrderBookPanel() {
  const { theme } = useTheme();

  const [wsStatus, setWsStatus] = createSignal<WsStatus>("disconnected");
  const [lastTrade, setLastTrade] = createSignal<LastTrade | null>(null);
  const [selectedOutcomeIdx, setSelectedOutcomeIdx] = createSignal(0);
  const [loadingSnapshot, setLoadingSnapshot] = createSignal(true);

  const [book, setBook] = createStore<BookState>({ bids: [], asks: [] });

  const selectedMarket = createMemo(() =>
    appState.markets.find((m) => m.id === appState.selectedMarketId)
  );

  const selectedOutcome = createMemo(() => {
    const market = selectedMarket();
    if (!market) return null;
    return market.outcomes[selectedOutcomeIdx()] ?? market.outcomes[0] ?? null;
  });

  const spread = createMemo(() => {
    const bestAsk = book.asks[0]?.price ?? 0;
    const bestBid = book.bids[0]?.price ?? 0;
    if (bestAsk > 0 && bestBid > 0) return bestAsk - bestBid;
    return null;
  });

  const maxBidSize = createMemo(() => Math.max(...book.bids.map((b) => b.size), 1));
  const maxAskSize = createMemo(() => Math.max(...book.asks.map((a) => a.size), 1));

  // Bootstrap REST snapshot, then switch to live WebSocket deltas
  createEffect(() => {
    const outcome = selectedOutcome();
    if (!outcome) {
      setBook({ bids: [], asks: [] });
      return;
    }

    const tokenId = outcome.id;
    let cancelled = false;

    // Fetch initial REST snapshot
    setLoadingSnapshot(true);
    void (async () => {
      const depth = await getMarketDepth(tokenId, 20);
      if (cancelled) return;
      setLoadingSnapshot(false);
      if (depth) {
        setBook({
          bids: depth.bids.map((l) => ({ price: l.price, size: l.size })),
          asks: depth.asks.map((l) => ({ price: l.price, size: l.size })),
        });
      }
    })();

    // Set up WebSocket for real-time updates
    const ws = createClobWebSocket();

    const offStatus = ws.onStatus((status) => setWsStatus(status));

    const offMsg = ws.onMessage((msg) => {
      if (msg.assetId !== tokenId) return;

      if (msg.type === "book") {
        const snap = msg as WsBookSnapshot;
        setBook({
          bids: snap.bids
            .filter((l) => l.size > 0)
            .sort((a, b) => b.price - a.price),
          asks: snap.asks
            .filter((l) => l.size > 0)
            .sort((a, b) => a.price - b.price),
        });
      } else if (msg.type === "price_change") {
        const delta = msg as WsPriceChange;
        const key = delta.side === "BUY" ? "bids" : "asks";
        setBook(
          key,
          produce((levels: DepthLevel[]) => {
            const idx = levels.findIndex((l) => Math.abs(l.price - delta.price) < 1e-8);
            if (delta.size <= 0) {
              if (idx >= 0) levels.splice(idx, 1);
            } else if (idx >= 0) {
              levels[idx].size = delta.size;
            } else {
              levels.push({ price: delta.price, size: delta.size });
              if (key === "bids") {
                levels.sort((a: DepthLevel, b: DepthLevel) => b.price - a.price);
              } else {
                levels.sort((a: DepthLevel, b: DepthLevel) => a.price - b.price);
              }
            }
          })
        );
      } else if (msg.type === "last_trade_price") {
        const trade = msg as WsTrade;
        setLastTrade({ price: trade.price, size: trade.size, side: trade.side });
      }
    });

    ws.connect();
    ws.subscribe([tokenId]);

    onCleanup(() => {
      cancelled = true;
      offStatus();
      offMsg();
      ws.destroy();
    });
  });

  const handleTabOutcome = () => {
    const market = selectedMarket();
    if (!market || market.outcomes.length <= 1) return;
    setSelectedOutcomeIdx((i) => (i + 1) % market.outcomes.length);
  };

  return (
    <box
      position="absolute"
      top={2}
      left="10%"
      width="80%"
      height={32}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={160}
    >
      {/* ── Header ── */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ▤ LIVE ORDER BOOK " fg={theme.highlightText} />
        <Show when={selectedMarket()}>
          <text
            content={` ${(selectedMarket()!.title ?? "").slice(0, 30)}`}
            fg={theme.highlightText}
          />
        </Show>
        <box flexGrow={1} />
        <text
          content={wsStatus() === "connected" ? " ● LIVE " : wsStatus() === "connecting" ? " ◌ CONNECTING " : " ○ OFFLINE "}
          fg={wsStatus() === "connected" ? theme.success : wsStatus() === "connecting" ? theme.warning : theme.error}
        />
        <box onMouseDown={() => setOrderBookPanelOpen(false)}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* ── Sub-header: outcome selector + spread + last trade ── */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
        <Show when={selectedMarket() && selectedMarket()!.outcomes.length > 1}>
          <box onMouseDown={handleTabOutcome}>
            <text
              content={` [TAB] ${selectedOutcome()?.title ?? "—"} `}
              fg={theme.accent}
            />
          </box>
          <text content=" | " fg={theme.borderSubtle} />
        </Show>
        <Show when={spread() !== null}>
          <text content={` Spread: ${(spread()! * 100).toFixed(2)}¢ `} fg={theme.textMuted} />
          <text content=" | " fg={theme.borderSubtle} />
        </Show>
        <Show when={lastTrade()}>
          {(trade) => (
            <text
              content={` Last: ${(trade().price * 100).toFixed(2)}¢  ${formatSize(trade().size)} shares `}
              fg={trade().side === "BUY" ? theme.success : theme.error}
            />
          )}
        </Show>
        <Show when={loadingSnapshot()}>
          <text content=" Loading snapshot… " fg={theme.textMuted} />
        </Show>
      </box>

      {/* ── Column headers ── */}
      <box height={1} width="100%" flexDirection="row">
        <box width="50%" flexDirection="row" justifyContent="flex-end">
          <text content={"DEPTH".padEnd(BAR_WIDTH + 1)} fg={theme.textMuted} />
          <text content={"SIZE".padStart(8)} fg={theme.textMuted} />
          <text content={"BID".padStart(8)} fg={theme.success} />
        </box>
        <box width={2} />
        <box width="50%" flexDirection="row">
          <text content={"ASK".padEnd(8)} fg={theme.error} />
          <text content={"SIZE".padStart(8)} fg={theme.textMuted} />
          <text content={"DEPTH".padStart(BAR_WIDTH + 1)} fg={theme.textMuted} />
        </box>
      </box>

      {/* ── Depth rows ── */}
      <box flexGrow={1} flexDirection="column" overflow="hidden">
        <For each={Array.from({ length: DISPLAY_LEVELS }, (_, i) => i)}>
          {(rowIdx) => {
            const bid = () => book.bids[rowIdx];
            const ask = () => book.asks[rowIdx];

            return (
              <box height={1} width="100%" flexDirection="row">
                {/* Bid side */}
                <box width="50%" flexDirection="row" justifyContent="flex-end">
                  <Show when={bid()}>
                    {(b) => (
                      <>
                        <text
                          content={buildBar(b().size / maxBidSize(), BAR_WIDTH).padEnd(BAR_WIDTH + 1)}
                          fg={theme.successMuted}
                        />
                        <text
                          content={formatSize(b().size).padStart(8)}
                          fg={theme.textMuted}
                        />
                        <text
                          content={formatPrice(b().price).padStart(8)}
                          fg={theme.success}
                        />
                      </>
                    )}
                  </Show>
                </box>

                {/* Centre gap */}
                <box width={2} />

                {/* Ask side */}
                <box width="50%" flexDirection="row">
                  <Show when={ask()}>
                    {(a) => (
                      <>
                        <text
                          content={formatPrice(a().price).padEnd(8)}
                          fg={theme.error}
                        />
                        <text
                          content={formatSize(a().size).padStart(8)}
                          fg={theme.textMuted}
                        />
                        <text
                          content={(" " + buildBar(a().size / maxAskSize(), BAR_WIDTH)).padEnd(BAR_WIDTH + 1)}
                          fg={theme.errorMuted}
                        />
                      </>
                    )}
                  </Show>
                </box>
              </box>
            );
          }}
        </For>
      </box>

      {/* ── Footer ── */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel}>
        <text
          content=" [ESC] Close  [TAB] Switch outcome  ● WebSocket streams live deltas "
          fg={theme.textMuted}
        />
      </box>
    </box>
  );
}
