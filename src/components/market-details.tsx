import { Show, createSignal, createEffect, createMemo, For } from "solid-js";
import { appState, getSelectedMarket } from "../state";
import { usePriceHistory } from "../hooks/useMarketData";
import { PriceHistory, Market } from "../types/market";
import { Chart } from "./chart";
import { OutcomeTable } from "./outcome-table";
import { formatVolume, formatPrice } from "../utils/format";
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

// Compute fear/greed style indicator (0-100)
function computeFearGreed(outcomes: { price: number; volume: number; liquidity: number }[]): number {
  if (outcomes.length === 0) return 50;
  if (outcomes.length === 1) {
    // Binary: if price > 0.5, greed; if < 0.5, fear
    return outcomes[0].price > 0.5 
      ? 50 + (outcomes[0].price - 0.5) * 100 
      : 50 - (0.5 - outcomes[0].price) * 100;
  }
  
  // For multi-outcome: factor in volume concentration and price spread
  const totalVolume = outcomes.reduce((sum, o) => sum + o.volume, 0);
  const totalLiquidity = outcomes.reduce((sum, o) => sum + o.liquidity, 0);
  
  if (totalVolume === 0) return 50;
  
  // Volume-weighted price
  const weightedPrice = outcomes.reduce((sum, o) => sum + o.price * o.volume, 0) / totalVolume;
  
  // Liquidity concentration (Herfindahl index)
  const liquidityWeights = outcomes.map(o => o.liquidity / totalLiquidity);
  const hhi = liquidityWeights.reduce((sum, w) => sum + w * w, 0);
  
  // Combine: higher weighted price = greed, lower = fear; higher HHI = more certain
  const priceComponent = weightedPrice * 100; // 0-100
  const certaintyComponent = (hhi - 0.33) / 0.67 * 50; // Normalize to 0-50 based on concentration
  
  return Math.max(0, Math.min(100, priceComponent + certaintyComponent));
}

// Get fear/greed label
function getFearGreedLabel(value: number): string {
  if (value >= 80) return "EXTREME GREED";
  if (value >= 65) return "GREED";
  if (value >= 55) return "SLIGHT GREED";
  if (value >= 45) return "NEUTRAL";
  if (value >= 35) return "SLIGHT FEAR";
  if (value >= 20) return "FEAR";
  return "EXTREME FEAR";
}

// Compute smart money indicator (volume/liquidity ratio)
function computeSmartMoney(volume24h: number, liquidity: number): number {
  if (liquidity === 0) return 0;
  // Ratio > 1 means high trading activity relative to liquidity (smart money active)
  return (volume24h / liquidity) * 100;
}

// Get smart money label
function getSmartMoneyLabel(value: number): string {
  if (value >= 30) return "VERY HIGH";
  if (value >= 15) return "HIGH";
  if (value >= 5) return "MODERATE";
  if (value >= 2) return "LOW";
  return "MINIMAL";
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

  // Fear/Greed indicator (0-100)
  const fearGreed = createMemo(() => {
    const market = selectedMarket();
    if (!market || market.outcomes.length === 0) return null;
    return computeFearGreed(market.outcomes);
  });

  // Smart money indicator (volume/liquidity ratio)
  const smartMoney = createMemo(() => {
    const market = selectedMarket();
    if (!market) return null;
    return computeSmartMoney(market.volume24h, market.liquidity);
  });

  // Resolution probability comparison (for binary markets)
  const resolutionComparison = createMemo(() => {
    const market = selectedMarket();
    if (!market || market.outcomes.length !== 2) return null;
    
    const yesOutcome = market.outcomes.find(o => 
      o.title.toLowerCase() === "yes" || o.title.toLowerCase().includes("yes")
    );
    const noOutcome = market.outcomes.find(o => 
      o.title.toLowerCase() === "no" || o.title.toLowerCase().includes("no")
    );
    
    if (!yesOutcome || !noOutcome) return null;
    
    const currentYes = yesOutcome.price;
    const currentNo = noOutcome.price;
    const impliedYes = currentYes / (currentYes + currentNo) * 100; // Normalized probability
    const spread = Math.abs(100 - (currentYes * 100 + currentNo * 100));
    
    return { currentYes, currentNo, impliedYes, spread };
  });

  // Probability distribution for outcomes
  const probabilityDistribution = createMemo(() => {
    const market = selectedMarket();
    if (!market || market.outcomes.length === 0) return null;
    
    const total = market.outcomes.reduce((sum, o) => sum + o.price, 0);
    return market.outcomes.map(o => ({
      title: o.title,
      price: o.price,
      percentage: total > 0 ? (o.price / total) * 100 : 0
    }));
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

            {/* ── Fear/Greed & Smart Money Indicators ────────────────────── */}
            <Show when={fearGreed() !== null || smartMoney() !== null}>
              <box flexDirection="row" gap={2} height={1}>
                <Show when={fearGreed() !== null}>
                  <text content="Fear/Greed:" fg={theme.textMuted} />
                  <text
                    content={`${getFearGreedLabel(fearGreed()!)} (${fearGreed()!.toFixed(0)})`}
                    fg={
                      fearGreed()! >= 55
                        ? theme.success
                        : fearGreed()! <= 45
                          ? theme.error
                          : theme.warning
                    }
                  />
                </Show>
                <Show when={fearGreed() !== null && smartMoney() !== null}>
                  <text content="│" fg={theme.borderSubtle} />
                </Show>
                <Show when={smartMoney() !== null}>
                  <text content="Smart Money:" fg={theme.textMuted} />
                  <text
                    content={`${getSmartMoneyLabel(smartMoney()!)} (${smartMoney()!.toFixed(1)}%)`}
                    fg={
                      smartMoney()! >= 15
                        ? theme.success
                        : smartMoney()! >= 5
                          ? theme.warning
                          : theme.textMuted
                    }
                  />
                </Show>
              </box>
            </Show>

            {/* ── Probability Distribution ────────────────────────────────── */}
            <Show when={probabilityDistribution() && probabilityDistribution()!.length > 0}>
              <box flexDirection="row" gap={1} height={1}>
                <text content="Probabilities:" fg={theme.textMuted} />
                <For each={probabilityDistribution()}>
                  {(outcome) => (
                    <>
                      <text
                        content={`${outcome.title.toUpperCase().slice(0,4)} ${outcome.percentage.toFixed(1)}%`}
                        fg={outcome.title.toLowerCase().includes("yes") ? theme.success : theme.error}
                      />
                      <text content="│" fg={theme.borderSubtle} />
                    </>
                  )}
                </For>
              </box>
            </Show>

            {/* ── Resolution Probability vs Current Price ─────────────────── */}
            <Show when={resolutionComparison()}>
              <box flexDirection="row" gap={2} height={1}>
                <text content="Implied vs Actual:" fg={theme.textMuted} />
                <text
                  content={`Yes: ${formatPrice(resolutionComparison()!.currentYes)} (implied ${resolutionComparison()!.impliedYes.toFixed(1)}%)`}
                  fg={theme.success}
                />
                <text content="│" fg={theme.borderSubtle} />
                <text
                  content={`Spread: ${resolutionComparison()!.spread.toFixed(2)}%`}
                  fg={resolutionComparison()!.spread > 5 ? theme.error : theme.textMuted}
                />
              </box>
            </Show>

            {/* ── Timeframe hint ─────────────────────────────────────────── */}
            <box flexDirection="row" gap={2} height={1}>
              <text content={`Timeframe: ${appState.timeframe.toUpperCase()}`} fg={theme.textMuted} />
              <text content="[1] 1h  [2] 4h  [3] 1d  [4] 5d  [5] 1w  [6] 1M  [7] all" fg={theme.borderSubtle} />
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
