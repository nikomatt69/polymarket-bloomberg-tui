import { Show, createSignal, createEffect, createMemo } from "solid-js";
import { appState, getSelectedMarket } from "../state";
import { usePriceHistory } from "../hooks/useMarketData";
import { PriceHistory, Market } from "../types/market";
import { Chart } from "./chart";
import { OutcomeTable } from "./outcome-table";
import { formatDate, formatVolume } from "../utils/format";
import { useTheme } from "../context/theme";
import { getOrderBookSummaries, OrderBookSummary } from "../api/polymarket";
import { isWatched } from "../hooks/useWatchlist";

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

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatCents(value: number): string {
  return `${(value * 100).toFixed(2)}¢`;
}

function computeRange(prices: number[]): { min: number; max: number; avg: number } {
  if (prices.length === 0) {
    return { min: 0, max: 0, avg: 0 };
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  return { min, max, avg };
}

export function MarketDetails() {
  const { theme } = useTheme();
  const [priceHistory, setPriceHistory] = createSignal<PriceHistory | undefined>();
  const [orderBooks, setOrderBooks] = createSignal<Record<string, OrderBookSummary>>({});
  const selectedMarket = createMemo(() => getSelectedMarket());

  const marketPulse = createMemo(() => {
    const history = priceHistory();
    const data = history?.data ?? [];
    if (data.length < 2) {
      return null;
    }

    const prices = data.map((point) => point.price);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const movePct = first > 0 ? ((last - first) / first) * 100 : 0;
    const range = computeRange(prices);

    const regime = movePct > 0.2 ? "bullish" : movePct < -0.2 ? "bearish" : "range";
    return {
      last,
      movePct,
      regime,
      range,
    };
  });

  createEffect(() => {
    const market = selectedMarket();
    if (!market || market.outcomes.length === 0) {
      setOrderBooks({});
      return;
    }

    let cancelled = false;
    const tokenIds = market.outcomes.map((outcome) => outcome.id);

    void (async () => {
      const snapshots = await getOrderBookSummaries(tokenIds);
      if (!cancelled) {
        setOrderBooks(snapshots);
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  createEffect(() => {
    if (!appState.selectedMarketId) {
      setPriceHistory(undefined);
      return;
    }

    let cancelled = false;
    void (async () => {
      const history = await usePriceHistory(appState.selectedMarketId, appState.timeframe);
      if (!cancelled) {
        setPriceHistory(history ?? undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
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

  return (
    <scrollbox flexGrow={1} width="100%" padding={1}>
      <Show
        when={selectedMarket()}
        fallback={
          <box flexGrow={1} justifyContent="center" alignItems="center">
            <text content="No market selected" fg={theme.textMuted} />
          </box>
        }
      >
        {(market: () => Market) => (
          <box flexDirection="column" width="100%" gap={1}>
            <text content={market().title} fg={theme.textBright} />
            <box flexDirection="row" gap={2}>
              <text content={isWatched(market().id) ? "★ WATCHED" : "• MARKET"} fg={isWatched(market().id) ? theme.accent : theme.textMuted} />
              <text content={`Cat: ${(market().category ?? "general").toUpperCase()}`} fg={theme.textMuted} />
              <text content={market().closed ? "Status: CLOSED" : "Status: OPEN"} fg={market().closed ? theme.error : theme.success} />
              <Show when={market().resolutionDate}>
                <text content={`Expiry: ${formatClockTime(market().resolutionDate!)}`} fg={theme.textMuted} />
                <text content={`(${formatCountdown(market().resolutionDate!)})`} fg={theme.warning} />
              </Show>
            </box>

            <text content={`Vol(24h): ${formatVolume(market().volume24h)}  |  Liquidity: ${formatVolume(market().liquidity)}  |  Outcomes: ${market().outcomes.length}  |  Change(24h): ${market().change24h >= 0 ? "+" : ""}${market().change24h.toFixed(2)}%`} fg={theme.textMuted} />
            <Show when={leadOutcome()}>
              <text
                content={`Leader: ${leadOutcome()!.title.toUpperCase()} ${formatCents(leadOutcome()!.price)}  |  Mid: ${leadBook()?.midpoint !== null && leadBook()?.midpoint !== undefined ? formatCents(leadBook()!.midpoint!) : "--"}  |  Spread: ${leadBook()?.spread !== null && leadBook()?.spread !== undefined ? formatCents(leadBook()!.spread!) : "--"}`}
                fg={theme.text}
              />
            </Show>

            <Show when={marketPulse()}>
              <text
                content={`Pulse: ${marketPulse()!.regime.toUpperCase()}  |  Last: ${formatCents(marketPulse()!.last)}  |  Move: ${marketPulse()!.movePct >= 0 ? "+" : ""}${marketPulse()!.movePct.toFixed(2)}%  |  Range: ${formatCents(marketPulse()!.range.min)} - ${formatCents(marketPulse()!.range.max)}`}
                fg={marketPulse()!.movePct >= 0 ? theme.success : theme.error}
              />
            </Show>

            <Show when={market().resolutionDate && !market().closed}>
              <text content={`Resolves: ${formatDate(market().resolutionDate!)}`} fg={theme.textMuted} />
            </Show>

            <text content="" />
            <Chart market={market()} priceHistory={priceHistory()} />
            <text content="" />
            <OutcomeTable market={market()} orderBooks={orderBooks()} />
          </box>
        )}
      </Show>
    </scrollbox>
  );
}
