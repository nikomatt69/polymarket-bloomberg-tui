/**
 * TopBar — Bloomberg-style header with portfolio P&L, AI status, market movers
 */

import { createSignal, onCleanup, onMount, createMemo, Show } from "solid-js";
import { useTheme } from "../context/theme";
import { appState, walletState, newsItems } from "../state";
import { positionsState } from "../hooks/usePositions";
import { getActiveAIProvider } from "../state";
import type { Market } from "../types/market";

function fmtClock(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit", year: "numeric" }).toUpperCase();
}

function fmtVol(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  if (Math.abs(n) >= 1000) return `${sign}$${(n / 1000).toFixed(1)}K`;
  return `${sign}$${n.toFixed(2)}`;
}

function fmtPnlPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function TopBar() {
  const { theme } = useTheme();
  const [now, setNow] = createSignal(new Date());
  const [tickerIdx, setTickerIdx] = createSignal(0);

  onMount(() => {
    const clockId = setInterval(() => setNow(new Date()), 1000);
    const tickerId = setInterval(() => {
      setTickerIdx((i) => (i + 1) % Math.max(1, Math.min(newsItems().length, 5)));
    }, 5000);
    onCleanup(() => { clearInterval(clockId); clearInterval(tickerId); });
  });

  const totalVol = createMemo(() =>
    appState.markets.reduce((sum, m) => sum + (m.volume24h ?? 0), 0)
  );

  const totalOI = createMemo(() =>
    appState.markets.reduce((sum, m) => sum + ((m as any).openInterest ?? 0), 0)
  );

  const breadth = createMemo(() => {
    let r = 0, f = 0, u = 0;
    for (const m of appState.markets) {
      if (m.change24h > 0.5) r++;
      else if (m.change24h < -0.5) f++;
      else u++;
    }
    return { r, f, u };
  });

  const marketCount = createMemo(() => appState.markets.length);

  const tickerItem = createMemo(() => newsItems().slice(0, 5)[tickerIdx()] ?? null);

  const portfolioPnl = createMemo(() => {
    const positions = positionsState.positions;
    if (positions.length === 0) return { value: 0, pct: 0 };
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalCost = positions.reduce((sum, p) => sum + p.initialValue, 0);
    const value = totalValue - totalCost;
    const pct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
    return { value, pct };
  });

  const marketMover = createMemo((): Market | null => {
    const markets = appState.markets;
    if (markets.length === 0) return null;
    let best: Market | null = null;
    for (const m of markets) {
      const change = m.change24h ?? -Infinity;
      const bestChange = best?.change24h ?? -Infinity;
      if (change > bestChange) {
        best = m;
      }
    }
    return best;
  });

  const aiProvider = createMemo(() => getActiveAIProvider());
  const aiStatus = createMemo(() => {
    const provider = aiProvider();
    if (!provider) return { label: "AI:OFF", color: theme.error };
    const modelShort = provider.model.split("-").slice(0, 2).join("-").slice(0, 14);
    return { label: `◉ ${modelShort}`, color: theme.success };
  });

  const worstMover = createMemo((): Market | null => {
    const markets = appState.markets;
    if (markets.length === 0) return null;
    let worst: Market | null = null;
    for (const m of markets) {
      const change = m.change24h ?? Infinity;
      const worstChange = worst?.change24h ?? Infinity;
      if (change < worstChange) worst = m;
    }
    return worst;
  });

  const positionCount = createMemo(() => positionsState.positions.length);

  return (
    <box
      height={1}
      width="100%"
      flexDirection="row"
      backgroundColor={theme.primary}
      paddingLeft={1}
      paddingRight={1}
    >
      {/* Brand */}
      <text content="◈ POLYMARKET" fg={theme.highlightText} width={14} />
      <text content=" TUI " fg={theme.highlightText} width={5} />

      {/* Separator */}
      <text content="│" fg={theme.primaryMuted} width={1} />

      {/* Market stats */}
      <text content={` ${marketCount()} mkts`} fg={theme.highlightText} width={11} />
      <text content="│" fg={theme.primaryMuted} width={1} />
      <text content={` Vol: ${fmtVol(totalVol())}`} fg={theme.highlightText} width={14} />
      <Show when={totalOI() > 0}>
        <text content="│" fg={theme.primaryMuted} width={1} />
        <text content={` OI: ${fmtVol(totalOI())}`} fg={theme.highlightText} width={12} />
      </Show>
      <text content="│" fg={theme.primaryMuted} width={1} />
      <text content=" " fg={theme.primaryMuted} />
      <text content={`▲${breadth().r}`} fg={theme.success} />
      <text content=" " fg={theme.primaryMuted} />
      <text content={`▼${breadth().f}`} fg={theme.error} />
      <text content=" " fg={theme.primaryMuted} />
      <text content={`─${breadth().u}`} fg={theme.primaryMuted} />

      {/* Top market mover (up) */}
      <Show when={marketMover()}>
        {(m: () => Market) => (
          <>
            <text content="│" fg={theme.primaryMuted} width={1} />
            <text content=" ▲ " fg={theme.success} />
            <text content={m().title.slice(0, 13)} fg={theme.success} width={14} />
            <text content={fmtPnlPct(m().change24h)} fg={theme.success} />
          </>
        )}
      </Show>
      {/* Worst mover (down) */}
      <Show when={worstMover()}>
        {(m: () => Market) => (
          <>
            <text content=" │" fg={theme.primaryMuted} />
            <text content=" ▼ " fg={theme.error} />
            <text content={m().title.slice(0, 13)} fg={theme.error} width={14} />
            <text content={fmtPnlPct(m().change24h)} fg={theme.error} />
          </>
        )}
      </Show>

      {/* Separator */}
      <text content="│" fg={theme.primaryMuted} width={1} />

      {/* Portfolio P&L */}
      <Show when={walletState.connected && positionCount() > 0}>
        <text content=" P&L: " fg={theme.highlightText} />
        <text 
          content={fmtPnl(portfolioPnl().value)} 
          fg={portfolioPnl().value >= 0 ? theme.success : theme.error} 
        />
        <text 
          content={` (${fmtPnlPct(portfolioPnl().pct)})`} 
          fg={portfolioPnl().pct >= 0 ? theme.success : theme.error} 
        />
        <text content="│" fg={theme.primaryMuted} width={1} />
      </Show>

      {/* Wallet status */}
      <text content=" " fg={theme.primaryMuted} />
      <text
        content={walletState.connected ? `◉ ${walletState.address?.slice(0, 6)}…${walletState.address?.slice(-4)}` : "○ Disconnected"}
        fg={walletState.connected ? theme.success : theme.error}
        width={18}
      />

      {/* AI Status */}
      <text content="│" fg={theme.primaryMuted} width={1} />
      <text content={` [${aiStatus().label}]`} fg={aiStatus().color} />

      {/* News ticker */}
      <box flexGrow={1} overflow="hidden">
        <Show when={tickerItem()}>
          {(item: () => import("../state").NewsItem) => (
            <text
              content={`  ◈ ${item().title?.slice(0, 45) ?? "News"}…`}
              fg={theme.primaryMuted}
            />
          )}
        </Show>
      </box>

      {/* Clock */}
      <text content={fmtDate(now())} fg={theme.highlightText} width={18} />
      <text content={fmtClock(now())} fg={theme.highlightText} width={8} />
    </box>
  );
}
