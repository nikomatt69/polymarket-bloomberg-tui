/**
 * Aggregated Order Book Component
 * Shows order book aggregated by price levels with order count
 */

import { createSignal, createEffect, onCleanup, createMemo, For, Show } from "solid-js";
import { RGBA } from "@opentui/core";
import { useTheme } from "../context/theme";
import { getAggregatedOrderBook, AggregatedBook, AggregatedOrder } from "../api/clob/additional";
import { clobCircuitBreaker, dedupRequest } from "../api/clob/enhanced-book";

interface AggregatedBookPanelProps {
  tokenId: string;
  depth?: number;
  onClose?: () => void;
}

const DISPLAY_LEVELS = 10;
const BAR_WIDTH = 16;

function formatSize(s: number): string {
  if (s >= 1_000_000) return `${(s / 1_000_000).toFixed(1)}M`;
  if (s >= 1_000) return `${(s / 1_000).toFixed(1)}K`;
  return s.toFixed(0);
}

function formatPrice(p: number): string {
  return `${(p * 100).toFixed(2)}¢`;
}

function buildBar(fraction: number, width: number): string {
  const filled = Math.max(0, Math.round(fraction * width));
  return "█".repeat(filled);
}

export function AggregatedBookPanel(props: AggregatedBookPanelProps) {
  const { theme } = useTheme();
  const [book, setBook] = createSignal<AggregatedBook | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [lastUpdate, setLastUpdate] = createSignal<number | null>(null);
  
  const depth = () => props.depth ?? 10;
  
  // Refresh data periodically
  createEffect(() => {
    const tokenId = props.tokenId;
    if (!tokenId) return;
    
    let cancelled = false;
    
    const fetchBook = async () => {
      try {
        const data = await dedupRequest(
          `aggbook:${tokenId}:${depth()}`,
          () => clobCircuitBreaker.execute(() => getAggregatedOrderBook(tokenId, depth()))
        );
        
        if (!cancelled) {
          setBook(data);
          setLastUpdate(Date.now());
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    void fetchBook();
    
    // Auto-refresh every 5 seconds
    const timer = setInterval(() => {
      void fetchBook();
    }, 5000);
    
    onCleanup(() => {
      cancelled = true;
      clearInterval(timer);
    });
  });
  
  // Compute derived metrics
  const metrics = createMemo(() => {
    const b = book();
    if (!b) return null;
    
    const bestBid = b.bids[0]?.price ?? 0;
    const bestAsk = b.asks[0]?.price ?? 0;
    const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : null;
    const midPrice = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : null;
    
    const totalBidSize = b.bids.reduce((s, b) => s + b.size, 0);
    const totalAskSize = b.asks.reduce((s, a) => s + a.size, 0);
    const totalBidOrders = b.bids.reduce((s, b) => s + b.orders, 0);
    const totalAskOrders = b.asks.reduce((s, a) => s + a.orders, 0);
    
    const imbalance = totalBidSize + totalAskSize > 0 
      ? totalBidSize / (totalBidSize + totalAskSize) 
      : 0.5;
    
    // VWAP
    const bidWeighted = b.bids.reduce((s, b) => s + b.price * b.size, 0);
    const askWeighted = b.asks.reduce((s, a) => s + a.price * a.size, 0);
    const totalSize = totalBidSize + totalAskSize;
    const vwap = totalSize > 0 ? (bidWeighted + askWeighted) / totalSize : null;
    
    return {
      spread,
      midPrice,
      totalBidSize,
      totalAskSize,
      totalBidOrders,
      totalAskOrders,
      imbalance,
      vwap,
    };
  });
  
  const maxSize = createMemo(() => {
    const b = book();
    if (!b) return 1;
    const maxBid = Math.max(...b.bids.map((b) => b.size), 0);
    const maxAsk = Math.max(...b.asks.map((a) => a.size), 0);
    return Math.max(maxBid, maxAsk, 1);
  });
  
  return (
    <box 
      position="absolute" 
      top={5} 
      left="15%" 
      width="70%" 
      height={20}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={160}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ AGGREGATED ORDER BOOK " fg={theme.highlightText} />
        <Show when={book()}>
          <text content={` ${book()!.market || props.tokenId}`} fg={theme.highlightText} />
        </Show>
        <box flexGrow={1} />
        <text content={` Updated: ${lastUpdate() ? new Date(lastUpdate()!).toLocaleTimeString() : "—"} `} fg={theme.textMuted} />
        <Show when={props.onClose}>
          <box onMouseDown={() => props.onClose?.()}>
            <text content=" [ESC] ✕ " fg={theme.highlightText} />
          </box>
        </Show>
      </box>
      
      {/* Metrics bar */}
      <Show when={metrics()}>
        {(m: () => NonNullable<ReturnType<typeof metrics>>) => (
          <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row">
            <Show when={m().midPrice !== null}>
              <text content={` Mid: ${formatPrice(m().midPrice!)} `} fg={theme.textBright} />
              <text content=" | " fg={theme.borderSubtle} />
            </Show>
            <Show when={m().spread !== null}>
              <text content={` Spread: ${formatPrice(m().spread!)} `} fg={theme.textMuted} />
              <text content=" | " fg={theme.borderSubtle} />
            </Show>
            <text content={` Bid Vol: ${formatSize(m().totalBidSize)} (${m().totalBidOrders} orders) `} fg={theme.success} />
            <text content=" | " fg={theme.borderSubtle} />
            <text content={` Ask Vol: ${formatSize(m().totalAskSize)} (${m().totalAskOrders} orders) `} fg={theme.error} />
            <text content=" | " fg={theme.borderSubtle} />
            <text 
              content={` Imb: ${(m().imbalance * 100).toFixed(0)}% `}
              fg={m().imbalance > 0.6 ? theme.success : m().imbalance < 0.4 ? theme.error : theme.textMuted}
            />
            <Show when={m().vwap !== null}>
              <text content=" | " fg={theme.borderSubtle} />
              <text content={` VWAP: ${formatPrice(m().vwap!)} `} fg={theme.accent} />
            </Show>
          </box>
        )}
      </Show>
      
      {/* Column headers */}
      <box height={1} width="100%" flexDirection="row">
        <box width="50%" flexDirection="row" justifyContent="flex-end">
          <text content={"ORDERS".padStart(8)} fg={theme.textMuted} />
          <text content={"SIZE".padStart(10)} fg={theme.textMuted} />
          <text content={"DEPTH".padEnd(BAR_WIDTH + 1)} fg={theme.textMuted} />
          <text content={"BID".padStart(10)} fg={theme.success} />
        </box>
        <box width={2} />
        <box width="50%" flexDirection="row">
          <text content={"ASK".padEnd(10)} fg={theme.error} />
          <text content={"DEPTH".padStart(BAR_WIDTH + 1)} fg={theme.textMuted} />
          <text content={"SIZE".padStart(10)} fg={theme.textMuted} />
          <text content={"ORDERS".padStart(8)} fg={theme.textMuted} />
        </box>
      </box>
      
      {/* Content */}
      <Show when={loading()}>
        <box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center">
          <text content="Loading aggregated order book..." fg={theme.textMuted} />
        </box>
      </Show>
      
      <Show when={error()}>
        <box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center">
          <text content={`Error: ${error()}`} fg={theme.error} />
        </box>
      </Show>
      
      <Show when={!loading() && !error() && book()}>
        {(b: () => NonNullable<ReturnType<typeof book>>) => (
          <box flexGrow={1} flexDirection="column" overflow="hidden">
            <For each={Array.from({ length: DISPLAY_LEVELS }, (_, i) => i)}>
              {(rowIdx) => {
                const bid = () => b().bids[rowIdx];
                const ask = () => b().asks[rowIdx];
                
                return (
                  <box height={1} width="100%" flexDirection="row">
                    {/* Bid side */}
                    <box width="50%" flexDirection="row" justifyContent="flex-end">
                      <Show when={bid()}>
                        {(bidData: () => AggregatedOrder) => {
                          const frac = () => bidData().size / maxSize();
                          return (
                            <>
                              <text content={String(bidData().orders).padStart(8)} fg={theme.primary} />
                              <text content={formatSize(bidData().size).padStart(10)} fg={theme.textMuted} />
                              <text 
                                content={buildBar(frac(), BAR_WIDTH).padEnd(BAR_WIDTH + 1)} 
                                fg={theme.success} 
                              />
                              <text content={formatPrice(bidData().price).padStart(10)} fg={theme.success} />
                            </>
                          );
                        }}
                      </Show>
                    </box>
                    
                    {/* Center */}
                    <box width={2} />
                    
                    {/* Ask side */}
                    <box width="50%" flexDirection="row">
                      <Show when={ask()}>
                        {(askData: () => AggregatedOrder) => {
                          const frac = () => askData().size / maxSize();
                          return (
                            <>
                              <text content={formatPrice(askData().price).padEnd(10)} fg={theme.error} />
                              <text 
                                content={(" " + buildBar(frac(), BAR_WIDTH)).padEnd(BAR_WIDTH + 1)} 
                                fg={theme.error} 
                              />
                              <text content={formatSize(askData().size).padStart(10)} fg={theme.textMuted} />
                              <text content={String(askData().orders).padStart(8)} fg={theme.primary} />
                            </>
                          );
                        }}
                      </Show>
                    </box>
                  </box>
                );
              }}
            </For>
          </box>
        )}
      </Show>
      
      {/* Footer */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel}>
        <text content=" Aggregated by price level | [ESC] Close " fg={theme.textMuted} />
      </box>
    </box>
  );
}

// Mini version for embedding in other components
interface MiniAggregatedBookProps {
  tokenId: string;
  maxLevels?: number;
}

export function MiniAggregatedBook(props: MiniAggregatedBookProps) {
  const { theme } = useTheme();
  const [book, setBook] = createSignal<AggregatedBook | null>(null);
  const [loading, setLoading] = createSignal(true);
  
  createEffect(() => {
    const tokenId = props.tokenId;
    if (!tokenId) return;
    
    let cancelled = false;
    
    void (async () => {
      try {
        const data = await getAggregatedOrderBook(tokenId, props.maxLevels ?? 5);
        if (!cancelled) {
          setBook(data);
        }
      } catch {
        // Ignore
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    
    return () => { cancelled = true; };
  });
  
  return (
    <box flexDirection="column">
      <Show when={loading()}>
        <text content="Loading..." fg={theme.textMuted} />
      </Show>
      
      <Show when={!loading() && book()}>
        {(b: () => NonNullable<ReturnType<typeof book>>) => (
          <>
            {/* Bids */}
            <For each={b().bids.slice(0, props.maxLevels ?? 5)}>
              {(level) => (
                <box flexDirection="row">
                  <text content={`${formatSize(level.size)} × ${level.orders}`} fg={theme.success} />
                  <text content={` @ ${formatPrice(level.price)}`} fg={theme.textMuted} />
                </box>
              )}
            </For>
            
            {/* Spread */}
            <box flexDirection="row" justifyContent="center">
              <text content="───" fg={theme.borderSubtle} />
              <Show when={b().bids[0] && b().asks[0]}>
                <text 
                  content={` Spread: ${formatPrice(b().asks[0]!.price - b().bids[0]!.price)} `} 
                  fg={theme.textMuted} 
                />
              </Show>
              <text content="───" fg={theme.borderSubtle} />
            </box>
            
            {/* Asks */}
            <For each={b().asks.slice(0, props.maxLevels ?? 5)}>
              {(level) => (
                <box flexDirection="row">
                  <text content={`${formatSize(level.size)} × ${level.orders}`} fg={theme.error} />
                  <text content={` @ ${formatPrice(level.price)}`} fg={theme.textMuted} />
                </box>
              )}
            </For>
          </>
        )}
      </Show>
    </box>
  );
}