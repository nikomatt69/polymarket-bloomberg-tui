import { Show, createSignal, createEffect, createMemo } from "solid-js";
import { appState, getSelectedMarket } from "../state";
import { usePriceHistory } from "../hooks/useMarketData";
import { PriceHistory, Market } from "../types/market";
import { Chart } from "./chart";
import { OutcomeTable } from "./outcome-table";
import { formatVolume } from "../utils/format";
import { useTheme } from "../context/theme";
import { getOrderBookSummaries, OrderBookSummary } from "../api/polymarket";
import { isWatched } from "../hooks/useWatchlist";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatClockTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatCountdown(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "resolving";
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatCents(value: number): string {
  return `${(value * 100).toFixed(2)}¢`;
}

function computeRange(prices: number[]): { min: number; max: number; avg: number } {
  if (prices.length === 0) return { min: 0, max: 0, avg: 0 };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((s, v) => s + v, 0) / prices.length;
  return { min, max, avg };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MarketDetails() {
  const { theme } = useTheme();
  const [priceHistory, setPriceHistory] = createSignal<PriceHistory | undefined>();
  const [orderBooks, setOrderBooks] = createSignal<Record<string, OrderBookSummary>>({});
  const selectedMarket = createMemo(() => getSelectedMarket());

  // ── Derived stats ──────────────────────────────────────────────────────────

  const marketPulse = createMemo(() => {
    const history = priceHistory();
    const data = history?.data ?? [];
    if (data.length < 2) return null;

    const prices = data.map((p) => p.price);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const movePct = first > 0 ? ((last - first) / first) * 100 : 0;
    const range = computeRange(prices);
    const regime = movePct > 0.5 ? "BULLISH" : movePct < -0.5 ? "BEARISH" : "NEUTRAL";
    return { last, movePct, regime, range };
  });

  const leadOutcome = createMemo(() => {
    const market = selectedMarket();
    if (!market || market.outcomes.length === 0) return null;
    return [...market.outcomes].sort((a, b) => b.price - a.price)[0];
  });

  const leadBook = createMemo(() => {
    const lead = leadOutcome();
    if (!lead) return null;
    return orderBooks()[lead.id] ?? null;
  });

  // Implied volatility proxy: range / avg
  const impliedVol = createMemo(() => {
    const p = marketPulse();
    if (!p || p.range.avg <= 0) return null;
    return ((p.range.max - p.range.min) / p.range.avg) * 100;
  });

  // ── Data fetching ──────────────────────────────────────────────────────────

  createEffect(() => {
    const market = selectedMarket();
    if (!market || !market.outcomes || market.outcomes.length === 0) {
      setOrderBooks({});
      return;
    }

    let cancelled = false;
    const tokenIds = market.outcomes.map((o) => o.id);

    void (async () => {
      const snapshots = await getOrderBookSummaries(tokenIds);
      if (!cancelled) setOrderBooks(snapshots);
    })();

    return () => { cancelled = true; };
  });

  createEffect(() => {
    if (!appState.selectedMarketId) {
      setPriceHistory(undefined);
      return;
    }

    let cancelled = false;
    void (async () => {
      const history = await usePriceHistory(appState.selectedMarketId, appState.timeframe);
      if (!cancelled) setPriceHistory(history ?? undefined);
    })();

    return () => { cancelled = true; };
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <scrollbox flexGrow={1} width="100%" padding={1}>
      <Show
        when={selectedMarket()}
        fallback={
          <box flexGrow={1} justifyContent="center" alignItems="center">
            <text content="No market selected" fg={theme.textMuted} />
            <text content="Use ↑↓ to select a market" fg={theme.borderSubtle} />
          </box>
        }
      >
        {(market: () => Market) => (
          <box flexDirection="column" width="100%" gap={0}>

            {/* ── Title + badges ─────────────────────────────────────────── */}
            <text content={market().title} fg={theme.textBright} />

            <box flexDirection="row" gap={2} height={1}>
              <text
                content={isWatched(market().id) ? "★ WATCHED" : "· MARKET"}
                fg={isWatched(market().id) ? theme.accent : theme.textMuted}
              />
              <text
                content={`[${(market().category ?? "general").toUpperCase()}]`}
                fg={theme.primary}
              />
              <text
                content={market().closed ? "● CLOSED" : "● OPEN"}
                fg={market().closed ? theme.error : theme.success}
              />
              <Show when={market().resolutionDate && !market().closed}>
                <text
                  content={`Expires ${formatClockTime(market().resolutionDate!)}  (${formatCountdown(market().resolutionDate!)})`}
                  fg={theme.warning}
                />
              </Show>
            </box>

            {/* ── Stat row ───────────────────────────────────────────────── */}
            <box flexDirection="row" gap={3} height={1}>
              <text
                content={`Vol(24h): ${formatVolume(market().volume24h)}`}
                fg={theme.textMuted}
              />
              <text
                content={`Liq: ${formatVolume(market().liquidity)}`}
                fg={theme.textMuted}
              />
              <text
                content={`Outcomes: ${market().outcomes.length}`}
                fg={theme.textMuted}
              />
              <text
                content={`Chg(24h): ${market().change24h >= 0 ? "+" : ""}${market().change24h.toFixed(2)}%`}
                fg={market().change24h >= 0 ? theme.success : theme.error}
              />
            </box>

            {/* ── Leader + order book ────────────────────────────────────── */}
            <Show when={leadOutcome()}>
              <box flexDirection="row" gap={2} height={1}>
                <text
                  content={`Leader: ${leadOutcome()!.title.toUpperCase()}`}
                  fg={theme.text}
                />
                <text
                  content={`${formatCents(leadOutcome()!.price)}`}
                  fg={theme.success}
                />
                <Show when={leadBook()}>
                  <text content="│" fg={theme.borderSubtle} />
                  <text
                    content={`Bid ${leadBook()?.bestBid !== null ? formatCents(leadBook()!.bestBid!) : "--"}`}
                    fg={theme.success}
                  />
                  <text
                    content={`Ask ${leadBook()?.bestAsk !== null ? formatCents(leadBook()!.bestAsk!) : "--"}`}
                    fg={theme.error}
                  />
                  <text
                    content={`Sprd ${leadBook()?.spread !== null ? formatCents(leadBook()!.spread!) : "--"}`}
                    fg={theme.textMuted}
                  />
                </Show>
              </box>
            </Show>

            {/* ── Price pulse ────────────────────────────────────────────── */}
            <Show when={marketPulse()}>
              <box flexDirection="row" gap={2} height={1}>
                <text
                  content={`Pulse: ${marketPulse()!.regime}`}
                  fg={
                    marketPulse()!.regime === "BULLISH"
                      ? theme.success
                      : marketPulse()!.regime === "BEARISH"
                        ? theme.error
                        : theme.warning
                  }
                />
                <text content="│" fg={theme.borderSubtle} />
                <text
                  content={`Move: ${marketPulse()!.movePct >= 0 ? "+" : ""}${marketPulse()!.movePct.toFixed(2)}%`}
                  fg={marketPulse()!.movePct >= 0 ? theme.success : theme.error}
                />
                <text content="│" fg={theme.borderSubtle} />
                <text
                  content={`Range: ${formatCents(marketPulse()!.range.min)} – ${formatCents(marketPulse()!.range.max)}`}
                  fg={theme.textMuted}
                />
                <Show when={impliedVol() !== null}>
                  <text content="│" fg={theme.borderSubtle} />
                  <text
                    content={`Volatility: ${impliedVol()!.toFixed(1)}%`}
                    fg={impliedVol()! > 20 ? theme.warning : theme.textMuted}
                  />
                </Show>
              </box>
            </Show>

            {/* ── Timeframe hint ─────────────────────────────────────────── */}
            <box flexDirection="row" gap={2} height={1}>
              <text content={`Timeframe: ${appState.timeframe.toUpperCase()}`} fg={theme.textMuted} />
              <text content="[1] 1d  [5] 5d  [7] 7d  [A] all" fg={theme.borderSubtle} />
            </box>

            <text content="" />

            {/* ── Chart ──────────────────────────────────────────────────── */}
            <Chart market={market()} priceHistory={priceHistory()} />

            <text content="" />

            {/* ── Outcomes ───────────────────────────────────────────────── */}
            <OutcomeTable market={market()} orderBooks={orderBooks()} />
          </box>
        )}
      </Show>
    </scrollbox>
  );
}
