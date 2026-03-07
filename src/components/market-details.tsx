import { Show, createSignal, createEffect, createMemo, For } from "solid-js";
import {
  appState,
  getSelectedMarket,
  setTimeframe,
  wsConnectionStatus,
  rtdsConnected,
  userWsConnected,
  sportsScores,
  getLastPrice,
  showToast,
} from "../state";
import { usePriceHistory } from "../hooks/useMarketData";
import { PriceHistory, Market, Timeframe } from "../types/market";
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

function computeFearGreed(outcomes: { price: number; volume: number; liquidity: number }[]): number {
  if (outcomes.length === 0) return 50;
  if (outcomes.length === 1) {
    return outcomes[0].price > 0.5
      ? 50 + (outcomes[0].price - 0.5) * 100
      : 50 - (0.5 - outcomes[0].price) * 100;
  }

  const totalVolume = outcomes.reduce((sum, o) => sum + o.volume, 0);
  const totalLiquidity = outcomes.reduce((sum, o) => sum + o.liquidity, 0);

  if (totalVolume === 0) return 50;

  const weightedPrice = outcomes.reduce((sum, o) => sum + o.price * o.volume, 0) / totalVolume;
  const liquidityWeights = outcomes.map(o => o.liquidity / totalLiquidity);
  const hhi = liquidityWeights.reduce((sum, w) => sum + w * w, 0);
  const priceComponent = weightedPrice * 100;
  const certaintyComponent = (hhi - 0.33) / 0.67 * 50;

  return Math.max(0, Math.min(100, priceComponent + certaintyComponent));
}

function getFearGreedLabel(value: number): string {
  if (value >= 80) return "EXTREME GREED";
  if (value >= 65) return "GREED";
  if (value >= 55) return "SLIGHT GREED";
  if (value >= 45) return "NEUTRAL";
  if (value >= 35) return "SLIGHT FEAR";
  if (value >= 20) return "FEAR";
  return "EXTREME FEAR";
}

function computeSmartMoney(volume24h: number, liquidity: number): number {
  if (liquidity === 0) return 0;
  return (volume24h / liquidity) * 100;
}

function getSmartMoneyLabel(value: number): string {
  if (value >= 30) return "VERY HIGH";
  if (value >= 15) return "HIGH";
  if (value >= 5) return "MODERATE";
  if (value >= 2) return "LOW";
  return "MINIMAL";
}

/** Build an ASCII probability bar: fills 10 chars proportionally */
function probBar(price: number): string {
  const filled = Math.round(Math.max(0, Math.min(1, price)) * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

/** 20-char Fear/Greed bar (0–100) */
function fgBar(value: number): string {
  const width = 20;
  const filled = Math.round(Math.max(0, Math.min(100, value)) / 100 * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/** 15-char Smart Money bar (0–50% → full) */
function smBar(value: number): string {
  const width = 15;
  const pct = Math.min(100, value * 2);
  const filled = Math.round(pct / 100 * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/** Labeled section divider: ─── LABEL ────────── */
function sectionLine(label: string, totalWidth: number = 50): string {
  const prefix = `─── ${label} `;
  const remaining = Math.max(0, totalWidth - prefix.length);
  return prefix + "─".repeat(remaining);
}

/** WS dot indicator: char + fg level */
function wsDot(connected: boolean, status?: string): { char: string; level: "ok" | "warn" | "off" } {
  if (status === "connected" || connected) return { char: "●", level: "ok" };
  if (status === "connecting" || status === "reconnecting") return { char: "○", level: "warn" };
  return { char: "·", level: "off" };
}

const TIMEFRAMES: Timeframe[] = ["1h", "4h", "1d", "5d", "1w", "1M", "all"];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MarketDetails() {
  const { theme } = useTheme();
  const [priceHistory, setPriceHistory] = createSignal<PriceHistory | undefined>();
  const [orderBooks, setOrderBooks] = createSignal<Record<string, OrderBookSummary>>({});
  const [copyConfirm, setCopyConfirm] = createSignal(false);
  const selectedMarket = createMemo(() => getSelectedMarket());

  // Copy market URL - show in toast for TUI
  const copyMarketUrl = () => {
    const market = selectedMarket();
    if (!market) return;

    const slug = market.slug || market.id;
    const url = `https://polymarket.com/market/${slug}`;
    showToast(`URL: ${url}`, "info");
    setCopyConfirm(true);
    setTimeout(() => setCopyConfirm(false), 2000);
  };

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

  const impliedVol = createMemo(() => {
    const p = marketPulse();
    if (!p || p.range.avg <= 0) return null;
    return ((p.range.max - p.range.min) / p.range.avg) * 100;
  });

  const fearGreed = createMemo(() => {
    const market = selectedMarket();
    if (!market || market.outcomes.length === 0) return null;
    return computeFearGreed(market.outcomes);
  });

  const smartMoney = createMemo(() => {
    const market = selectedMarket();
    if (!market) return null;
    return computeSmartMoney(market.volume24h, market.liquidity);
  });

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

    // Use live WS price if available
    const currentYes = getLastPrice(yesOutcome.id) ?? yesOutcome.price;
    const currentNo = getLastPrice(noOutcome.id) ?? noOutcome.price;
    const impliedYes = currentYes / (currentYes + currentNo) * 100;
    const spread = Math.abs(100 - (currentYes * 100 + currentNo * 100));

    return { currentYes, currentNo, impliedYes, spread, yesId: yesOutcome.id, noId: noOutcome.id };
  });

  const probabilityDistribution = createMemo(() => {
    const market = selectedMarket();
    if (!market || market.outcomes.length === 0) return null;

    const total = market.outcomes.reduce((sum, o) => sum + o.price, 0);
    return market.outcomes.map(o => {
      const liveP = getLastPrice(o.id);
      const price = liveP ?? o.price;
      return {
        id: o.id,
        title: o.title,
        price,
        isLive: liveP !== undefined,
        percentage: total > 0 ? (price / total) * 100 : 0,
        book: orderBooks()[o.id] ?? null,
      };
    });
  });

  /** Hours until resolution (for closing soon warning) */
  const hoursToClose = createMemo(() => {
    const market = selectedMarket();
    if (!market?.resolutionDate || market.closed) return null;
    const diffMs = market.resolutionDate.getTime() - Date.now();
    if (diffMs <= 0) return null;
    return diffMs / (1000 * 60 * 60);
  });

  /** Is this a sports market? */
  const isSportsMarket = createMemo(() => {
    const market = selectedMarket();
    if (!market) return false;
    return (market.category ?? "").toLowerCase().includes("sport");
  });

  /** Live sports score for this market */
  const liveScore = createMemo(() => {
    const market = selectedMarket();
    if (!market || !isSportsMarket()) return null;
    const scores = sportsScores();
    if (market.slug && scores[market.slug]) {
      return scores[market.slug];
    }
    const key = Object.keys(scores).find(k =>
      k === market.id || market.outcomes.some(o => o.id === k) || scores[k]?.slug === market.slug
    );
    return key ? scores[key] : null;
  });

  // ── WS status ──────────────────────────────────────────────────────────────
  const clobDot = () => wsDot(false, wsConnectionStatus());
  const rtdsDot = () => wsDot(rtdsConnected());
  const userDot = () => wsDot(userWsConnected());

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

            {/* ── WS status row ───────────────────────────────────────────── */}
            <box flexDirection="row" height={1} gap={1}>
              <text content="WS:" fg={theme.borderSubtle} />
              <text
                content={`${clobDot().char}CLOB`}
                fg={clobDot().level === "ok" ? theme.success : clobDot().level === "warn" ? theme.warning : theme.borderSubtle}
              />
              <text content="·" fg={theme.borderSubtle} />
              <text
                content={`${rtdsDot().char}RTDS`}
                fg={rtdsDot().level === "ok" ? theme.success : rtdsDot().level === "warn" ? theme.warning : theme.borderSubtle}
              />
              <text content="·" fg={theme.borderSubtle} />
              <text
                content={`${userDot().char}User`}
                fg={userDot().level === "ok" ? theme.success : userDot().level === "warn" ? theme.warning : theme.borderSubtle}
              />
            </box>

            {/* ── Closing Soon Warning ────────────────────────────────────── */}
            <Show when={hoursToClose() !== null && hoursToClose()! <= 72}>
              <box flexDirection="row" width="100%" backgroundColor={theme.warningMuted} paddingLeft={1}>
                <text content="⚠ " fg={theme.warning} />
                <text
                  content={
                    hoursToClose()! < 1
                      ? `MARKET CLOSES IN ${Math.round(hoursToClose()! * 60)}m — URGENT`
                      : hoursToClose()! < 24
                        ? `MARKET CLOSES IN ${Math.round(hoursToClose()!)}h — Consider position before resolution`
                        : `MARKET CLOSES IN ${Math.floor(hoursToClose()! / 24)}d ${Math.round(hoursToClose()! % 24)}h — Closing soon`
                  }
                  fg={theme.warning}
                />
              </box>
            </Show>

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
                  fg={hoursToClose() !== null && hoursToClose()! <= 72 ? theme.warning : theme.textMuted}
                />
              </Show>
            </box>

            {/* ── Description ────────────────────────────────────────────── */}
            <Show when={(market() as any).description}>
              <text
                content={((market() as any).description as string).slice(0, 160)}
                fg={theme.textMuted}
              />
            </Show>

            {/* ── OVERVIEW section ───────────────────────────────────────── */}
            <text content={sectionLine("OVERVIEW")} fg={theme.borderSubtle} />

            <box flexDirection="row" gap={2} height={1}>
              <text content="Vol(24h)" fg={theme.textMuted} />
              <text content={formatVolume(market().volume24h)} fg={theme.text} />
              <text content="│" fg={theme.borderSubtle} />
              <text content="Liq" fg={theme.textMuted} />
              <text content={formatVolume(market().liquidity)} fg={theme.accent} />
              <text content="│" fg={theme.borderSubtle} />
              <text content="Outcomes" fg={theme.textMuted} />
              <text content={market().outcomes.length.toString()} fg={theme.text} />
              <text content="│" fg={theme.borderSubtle} />
              <text content="Chg(24h)" fg={theme.textMuted} />
              <text
                content={`${market().change24h >= 0 ? "+" : ""}${market().change24h.toFixed(2)}%`}
                fg={market().change24h >= 0 ? theme.success : theme.error}
              />
            </box>

            {/* ── LIVE SPORTS SCORES section ─────────────────────────────── */}
            <Show when={isSportsMarket() && liveScore()}>
              <text content={sectionLine("LIVE SCORE")} fg={theme.borderSubtle} />
              <box flexDirection="row" gap={2} height={1}>
                <text content={liveScore()!.homeTeam ?? "Home"} fg={theme.text} />
                <text
                  content={`${liveScore()!.homeScore ?? 0}`}
                  fg={theme.success}
                />
                <text content=":" fg={theme.textMuted} />
                <text
                  content={`${liveScore()!.awayScore ?? 0}`}
                  fg={theme.error}
                />
                <text content={liveScore()!.awayTeam ?? "Away"} fg={theme.text} />
                <Show when={liveScore()!.period}>
                  <text content="│" fg={theme.borderSubtle} />
                  <text content={`Period: ${liveScore()!.period}`} fg={theme.textMuted} />
                </Show>
                <Show when={liveScore()!.status}>
                  <text content="│" fg={theme.borderSubtle} />
                  <text
                    content={liveScore()!.status}
                    fg={liveScore()!.status === "live" ? theme.success : theme.textMuted}
                  />
                </Show>
              </box>
            </Show>

            {/* ── Leader + order book ────────────────────────────────────── */}
            <Show when={leadOutcome()}>
              {/* Live price indicator */}
              <box flexDirection="row" gap={2} height={1}>
                <text
                  content={`Leader: ${leadOutcome()!.title.toUpperCase()}`}
                  fg={theme.text}
                />
                <text
                  content={formatCents(getLastPrice(leadOutcome()!.id) ?? leadOutcome()!.price)}
                  fg={getLastPrice(leadOutcome()!.id) !== undefined ? theme.accent : theme.success}
                />
                <Show when={getLastPrice(leadOutcome()!.id) !== undefined}>
                  <text content="⚡LIVE" fg={theme.accent} />
                </Show>
                <Show when={leadBook()}>
                  <text content="│" fg={theme.borderSubtle} />
                  <text content="▲" fg={theme.success} />
                  <text
                    content={`Bid ${leadBook()?.bestBid !== null ? formatCents(leadBook()!.bestBid!) : "--"}`}
                    fg={theme.success}
                  />
                  <text content="▼" fg={theme.error} />
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
              <Show when={resolutionComparison()}>
                <box flexDirection="row" height={1} gap={1}>
                  <text content="YES" fg={theme.success} />
                  <text content={probBar(resolutionComparison()!.currentYes)} fg={theme.success} />
                  <text content={`${(resolutionComparison()!.currentYes * 100).toFixed(0)}%`} fg={theme.success} />
                  <text content="  NO" fg={theme.error} />
                  <text content={probBar(resolutionComparison()!.currentNo)} fg={theme.error} />
                  <text content={`${(resolutionComparison()!.currentNo * 100).toFixed(0)}%`} fg={theme.error} />
                  <Show when={getLastPrice(resolutionComparison()!.yesId) !== undefined || getLastPrice(resolutionComparison()!.noId) !== undefined}>
                    <text content=" ⚡" fg={theme.accent} />
                  </Show>
                </box>
              </Show>
            </Show>

            {/* ── PROBABILITIES section ───────────────────────────────────── */}
            <Show when={probabilityDistribution() && probabilityDistribution()!.length > 0}>
              <text content={sectionLine("PROBABILITIES")} fg={theme.borderSubtle} />
              <For each={probabilityDistribution()!.slice(0, 6)}>
                {(outcome) => {
                  const isYes = outcome.title.toLowerCase().includes("yes") || outcome.price >= 0.5;
                  const barColor = () => isYes ? theme.success : theme.error;
                  return (
                    <box flexDirection="row" height={1}>
                      <text
                        content={(outcome.isLive ? "⚡" : " ") + outcome.title.toUpperCase().slice(0, 7).padEnd(7, " ")}
                        fg={outcome.isLive ? theme.accent : theme.text}
                        width={9}
                      />
                      <text content={probBar(outcome.price)} fg={barColor()} width={11} />
                      <text
                        content={` ${outcome.percentage.toFixed(1)}%`}
                        fg={barColor()}
                        width={7}
                      />
                      <text
                        content={`  ${formatCents(outcome.price)}`}
                        fg={outcome.isLive ? theme.accent : theme.textMuted}
                        width={8}
                      />
                      {/* Bid/ask from order book per outcome */}
                      <Show when={outcome.book}>
                        <text content=" " fg={theme.borderSubtle} width={1} />
                        <text
                          content={`B:${outcome.book!.bestBid !== null ? formatCents(outcome.book!.bestBid!) : "--"}`}
                          fg={theme.success}
                          width={9}
                        />
                        <text
                          content={`A:${outcome.book!.bestAsk !== null ? formatCents(outcome.book!.bestAsk!) : "--"}`}
                          fg={theme.error}
                          width={9}
                        />
                      </Show>
                    </box>
                  );
                }}
              </For>
              <Show when={probabilityDistribution()!.length > 6}>
                <text content={`  …and ${probabilityDistribution()!.length - 6} more outcomes`} fg={theme.textMuted} />
              </Show>
              <text content="  ↓ Scroll down for OUTCOMES with [BUY]/[SELL] buttons" fg={theme.textMuted} />
            </Show>

            {/* ── MARKET ANALYSIS section ─────────────────────────────────── */}
            <text content={sectionLine("MARKET ANALYSIS")} fg={theme.borderSubtle} />

            <Show when={marketPulse()}>
              <box flexDirection="row" gap={2} height={1}>
                <text
                  content={`Regime: ${marketPulse()!.regime}`}
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
                    content={`Vol: ${impliedVol()!.toFixed(1)}%`}
                    fg={impliedVol()! > 20 ? theme.warning : theme.textMuted}
                  />
                </Show>
              </box>
            </Show>

            <Show when={fearGreed() !== null}>
              <box flexDirection="row" height={1} gap={1}>
                <text content="Fear/Greed" fg={theme.textMuted} />
                <text
                  content={fgBar(fearGreed()!)}
                  fg={fearGreed()! >= 55 ? theme.success : fearGreed()! <= 45 ? theme.error : theme.warning}
                />
                <text
                  content={`${fearGreed()!.toFixed(0)} ${getFearGreedLabel(fearGreed()!)}`}
                  fg={fearGreed()! >= 55 ? theme.success : fearGreed()! <= 45 ? theme.error : theme.warning}
                />
              </box>
            </Show>
            <Show when={smartMoney() !== null}>
              <box flexDirection="row" height={1} gap={1}>
                <text content="Smart$     " fg={theme.textMuted} />
                <text
                  content={smBar(smartMoney()!)}
                  fg={smartMoney()! >= 15 ? theme.success : smartMoney()! >= 5 ? theme.warning : theme.textMuted}
                />
                <text
                  content={`${smartMoney()!.toFixed(1)}% ${getSmartMoneyLabel(smartMoney()!)}`}
                  fg={smartMoney()! >= 15 ? theme.success : smartMoney()! >= 5 ? theme.warning : theme.textMuted}
                />
              </box>
            </Show>

            <Show when={resolutionComparison()}>
              <box flexDirection="row" gap={2} height={1}>
                <text content="Implied:" fg={theme.textMuted} />
                <text
                  content={`YES ${formatPrice(resolutionComparison()!.currentYes)} (${resolutionComparison()!.impliedYes.toFixed(1)}%)`}
                  fg={theme.success}
                />
                <text content="│" fg={theme.borderSubtle} />
                <text
                  content={`Spread: ${resolutionComparison()!.spread.toFixed(2)}%`}
                  fg={resolutionComparison()!.spread > 5 ? theme.error : theme.textMuted}
                />
              </box>
            </Show>

            {/* ── PRICE HISTORY section ───────────────────────────────────── */}
            <text content={sectionLine("PRICE HISTORY")} fg={theme.borderSubtle} />

            {/* Timeframe as visual clickable tabs */}
            <box flexDirection="row" height={1} gap={1}>
              <For each={TIMEFRAMES}>
                {(tf) => {
                  const isActive = () => appState.timeframe === tf;
                  return (
                    <box
                      paddingLeft={1}
                      paddingRight={1}
                      backgroundColor={isActive() ? theme.accent : theme.backgroundPanel}
                      onMouseDown={() => setTimeframe(tf)}
                    >
                      <text
                        content={tf.toUpperCase()}
                        fg={isActive() ? theme.background : theme.textMuted}
                      />
                    </box>
                  );
                }}
              </For>
              <text content="  [1-7] to switch" fg={theme.borderSubtle} />
            </box>

            <text content="" />

            {/* ── Chart ──────────────────────────────────────────────────── */}
            <Chart market={market()} priceHistory={priceHistory()} />

            <text content="" />

            {/* ── OUTCOMES section ────────────────────────────────────────── */}
            <text content={sectionLine("OUTCOMES")} fg={theme.borderSubtle} />
            <OutcomeTable market={market()} orderBooks={orderBooks()} />

            {/* Footer hint */}
            <box flexDirection="row" paddingTop={1}>
              <text content="[C] Copy URL" fg={copyConfirm() ? theme.success : theme.textMuted} />
              <Show when={copyConfirm()}>
                <text content=" ✓ Copied!" fg={theme.success} />
              </Show>
            </box>
          </box>
        )}
      </Show>
    </scrollbox>
  );
}
