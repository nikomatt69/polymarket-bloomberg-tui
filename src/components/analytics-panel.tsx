import { Show, createSignal, createEffect, createMemo, For } from "solid-js";
import { RGBA } from "@opentui/core";
import { useTheme } from "../context/theme";
import { PanelHeader, SectionTitle, Separator, ProgressBar, DataRow, LoadingState } from "./ui/panel-components";
import { appState, analyticsPanelOpen, setAnalyticsPanelOpen, getFilteredMarkets, highlightedIndex } from "../state";
import { usePriceHistory } from "../hooks/useMarketData";
import { sparkline, volumeBar, barChart, histogram } from "../utils/charts";

interface AnalyticsTab {
  id: "volume" | "liquidity" | "momentum" | "correlation";
  label: string;
}

const ANALYTICS_TABS: AnalyticsTab[] = [
  { id: "volume", label: "Volume" },
  { id: "liquidity", label: "Liquidity" },
  { id: "momentum", label: "Momentum" },
  { id: "correlation", label: "Correlation" },
];

function calculateVolumeProfile(volume24h: number, volume: number): { level: string; score: number } {
  const ratio = volume24h / (volume || 1);
  if (ratio > 0.5) return { level: "Very High", score: 100 };
  if (ratio > 0.3) return { level: "High", score: 75 };
  if (ratio > 0.15) return { level: "Medium", score: 50 };
  if (ratio > 0.05) return { level: "Low", score: 25 };
  return { level: "Very Low", score: 10 };
}

function calculateUnusualVolume(volume24h: number, avgVolume: number): { alert: boolean; message: string } {
  if (avgVolume <= 0) return { alert: false, message: "N/A" };
  const ratio = volume24h / avgVolume;
  if (ratio > 3) return { alert: true, message: `⚠️ Unusual: ${ratio.toFixed(1)}x average` };
  if (ratio > 2) return { alert: true, message: `Noticeable: ${ratio.toFixed(1)}x average` };
  return { alert: false, message: "Normal" };
}

function calculateSpreadScore(outcomes: { price: number }[]): { spread: number; score: number; label: string } {
  if (outcomes.length < 2) return { spread: 0, score: 0, label: "N/A" };
  
  const prices = outcomes.map(o => o.price).sort((a, b) => a - b);
  const spread = (prices[1]! - prices[0]!) * 100;
  
  if (spread < 1) return { spread, score: 100, label: "Excellent" };
  if (spread < 3) return { spread, score: 80, label: "Good" };
  if (spread < 5) return { spread, score: 60, label: "Fair" };
  if (spread < 10) return { spread, score: 40, label: "Poor" };
  return { spread, score: 20, label: "Very Poor" };
}

function calculateDepthScore(liquidity: number, volume24h: number): { score: number; label: string } {
  if (volume24h <= 0) return { score: 0, label: "N/A" };
  const ratio = liquidity / volume24h;
  
  if (ratio > 5) return { score: 100, label: "Excellent" };
  if (ratio > 3) return { score: 80, label: "Good" };
  if (ratio > 2) return { score: 60, label: "Fair" };
  if (ratio > 1) return { score: 40, label: "Poor" };
  return { score: 20, label: "Very Poor" };
}

function calculateTrendStrength(change24h: number, prices: number[]): { strength: number; label: string; direction: "up" | "down" | "neutral" } {
  if (prices.length < 5 || change24h === 0) {
    return { strength: 0, label: "Insufficient Data", direction: "neutral" };
  }
  
  const absChange = Math.abs(change24h);
  let strength: number;
  let direction: "up" | "down" | "neutral";
  
  if (absChange > 20) {
    strength = 100;
  } else if (absChange > 10) {
    strength = 75;
  } else if (absChange > 5) {
    strength = 50;
  } else if (absChange > 2) {
    strength = 25;
  } else {
    strength = 10;
  }
  
  direction = change24h > 0 ? "up" : change24h < 0 ? "down" : "neutral";
  
  return { strength, label: strength > 75 ? "Strong" : strength > 50 ? "Moderate" : strength > 25 ? "Weak" : "Very Weak", direction };
}

function calculateMomentumScore(change24h: number, prices: number[]): { score: number; label: string; signal: string } {
  if (prices.length < 5) return { score: 50, label: "Neutral", signal: "─" };
  
  const recentPrices = prices.slice(-5);
  const momentum = recentPrices[recentPrices.length - 1]! - recentPrices[0]!;
  
  let score: number;
  let label: string;
  let signal: string;
  
  if (momentum > 0.1) {
    score = 90;
    label = "Very Bullish";
    signal = "▲▲";
  } else if (momentum > 0.05) {
    score = 70;
    label = "Bullish";
    signal = "▲";
  } else if (momentum > -0.05) {
    score = 50;
    label = "Neutral";
    signal = "─";
  } else if (momentum > -0.1) {
    score = 30;
    label = "Bearish";
    signal = "▼";
  } else {
    score = 10;
    label = "Very Bearish";
    signal = "▼▼";
  }
  
  return { score, label, signal };
}

function calculateVolatility(prices: number[]): { value: number; label: string } {
  if (prices.length < 3) return { value: 0, label: "N/A" };
  
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1]! > 0) {
      returns.push((prices[i]! - prices[i - 1]!) / prices[i - 1]!);
    }
  }
  
  if (returns.length === 0) return { value: 0, label: "N/A" };
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance) * 100;
  
  let label: string;
  if (stdDev > 10) label = "Very High";
  else if (stdDev > 5) label = "High";
  else if (stdDev > 2) label = "Medium";
  else if (stdDev > 1) label = "Low";
  else label = "Very Low";
  
  return { value: stdDev, label };
}

function generateSparkline(prices: number[], width: number = 12): string {
  if (prices.length < 2) return "─".repeat(width);
  
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  
  if (range === 0) return "─".repeat(width);
  
  const chars = "▁▂▃▄▅▆▇█";
  const step = (width - 1) / (prices.length - 1);
  
  let result = "";
  for (let i = 0; i < width; i++) {
    const idx = Math.min(Math.floor(i / step), prices.length - 1);
    const normalized = (prices[idx]! - min) / range;
    const charIdx = Math.floor(normalized * (chars.length - 1));
    result += chars[charIdx] || "─";
  }
  
  return result;
}

function calculateCorrelation(prices1: number[], prices2: number[]): { value: number; label: string } {
  const len = Math.min(prices1.length, prices2.length);
  if (len < 3) return { value: 0, label: "Insufficient Data" };
  
  const p1 = prices1.slice(-len);
  const p2 = prices2.slice(-len);
  
  const mean1 = p1.reduce((a, b) => a + b, 0) / len;
  const mean2 = p2.reduce((a, b) => a + b, 0) / len;
  
  let num = 0;
  let den1 = 0;
  let den2 = 0;
  
  for (let i = 0; i < len; i++) {
    const dx = p1[i]! - mean1;
    const dy = p2[i]! - mean2;
    num += dx * dy;
    den1 += dx * dx;
    den2 += dy * dy;
  }
  
  const corr = den1 > 0 && den2 > 0 ? num / Math.sqrt(den1 * den2) : 0;
  
  let label: string;
  if (corr > 0.7) label = "Strong Positive";
  else if (corr > 0.3) label = "Moderate Positive";
  else if (corr > -0.3) label = "Weak/None";
  else if (corr > -0.7) label = "Moderate Negative";
  else label = "Strong Negative";
  
  return { value: corr, label };
}

export function AnalyticsPanel() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = createSignal<AnalyticsTab["id"]>("volume");
  const [history, setHistory] = createSignal<{ price: number }[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [compareMarketId, setCompareMarketId] = createSignal<string | null>(null);
  const [compareHistory, setCompareHistory] = createSignal<{ price: number }[]>([]);
  
  const markets = createMemo(() => getFilteredMarkets());
  const selectedMarket = createMemo(() => {
    const idx = highlightedIndex();
    return markets()[idx];
  });
  
  createEffect(() => {
    const market = selectedMarket();
    if (!market) {
      setHistory([]);
      return;
    }
    
    let cancelled = false;
    setLoading(true);
    
    void (async () => {
      try {
        const priceHistory = await usePriceHistory(market.id, appState.timeframe);
        if (!cancelled && priceHistory) {
          setHistory(priceHistory.data.map(p => ({ price: p.price })));
        }
      } catch {
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    
    return () => { cancelled = true; };
  });
  
  createEffect(() => {
    const compId = compareMarketId();
    if (!compId) {
      setCompareHistory([]);
      return;
    }
    
    let cancelled = false;
    
    void (async () => {
      try {
        const priceHistory = await usePriceHistory(compId, appState.timeframe);
        if (!cancelled && priceHistory) {
          setCompareHistory(priceHistory.data.map(p => ({ price: p.price })));
        }
      } catch {
        if (!cancelled) setCompareHistory([]);
      }
    })();
    
    return () => { cancelled = true; };
  });
  
  const volumeProfile = createMemo(() => {
    const market = selectedMarket();
    if (!market) return null;
    return calculateVolumeProfile(market.volume24h, market.volume);
  });
  
  const unusualVolume = createMemo(() => {
    const market = selectedMarket();
    if (!market) return { alert: false, message: "N/A" };
    const avgVolume = market.volume / 30 || market.volume24h;
    return calculateUnusualVolume(market.volume24h, avgVolume);
  });
  
  const spreadScore = createMemo(() => {
    const market = selectedMarket();
    if (!market) return { spread: 0, score: 0, label: "N/A" };
    return calculateSpreadScore(market.outcomes);
  });
  
  const depthScore = createMemo(() => {
    const market = selectedMarket();
    if (!market) return { score: 0, label: "N/A" };
    return calculateDepthScore(market.liquidity, market.volume24h);
  });
  
  const trendStrength = createMemo(() => {
    const market = selectedMarket();
    if (!market) return { strength: 0, label: "N/A", direction: "neutral" as const };
    const prices = history().map(h => h.price);
    return calculateTrendStrength(market.change24h, prices);
  });
  
  const momentumScore = createMemo(() => {
    const market = selectedMarket();
    if (!market) return { score: 50, label: "N/A", signal: "─" };
    const prices = history().map(h => h.price);
    return calculateMomentumScore(market.change24h, prices);
  });
  
  const volatility = createMemo(() => {
    const prices = history().map(h => h.price);
    return calculateVolatility(prices);
  });
  
  const priceSparkline = createMemo(() => {
    const prices = history().map(h => h.price);
    return generateSparkline(prices);
  });
  
  const correlation = createMemo(() => {
    const prices1 = history().map(h => h.price);
    const prices2 = compareHistory().map(h => h.price);
    return calculateCorrelation(prices1, prices2);
  });
  
  const compareOptions = createMemo(() => {
    const current = selectedMarket();
    return markets().filter(m => m.id !== current?.id).slice(0, 10);
  });
  
  const sectionLine = (label: string) => {
    const prefix = `─── ${label} `;
    const fill = "─".repeat(Math.max(2, 30 - prefix.length));
    return prefix + fill;
  };

  const renderVolumeTab = () => (
    <box flexDirection="column" flexGrow={1} paddingTop={1}>
      <Show when={selectedMarket()}>
        <box paddingLeft={2}>
          <text content={sectionLine("VOLUME PROFILE")} fg={theme.borderSubtle} />
        </box>
        <DataRow
          label="24h Volume"
          value={`$${(selectedMarket()!.volume24h / 1000).toFixed(1)}K`}
          valueColor="text"
        />
        <DataRow
          label="Total Volume"
          value={`$${(selectedMarket()!.volume / 1000000).toFixed(2)}M`}
          valueColor="muted"
        />
        <DataRow
          label="Profile"
          value={volumeProfile()?.level || "N/A"}
          valueColor={volumeProfile()?.level === "Very High" || volumeProfile()?.level === "High" ? "success" : "warning"}
        />
        <box paddingLeft={2} flexDirection="row">
          <text content="Score  " fg={theme.textMuted} />
          <text
            content={"█".repeat(Math.round((volumeProfile()?.score ?? 0) / 100 * 20)) + "░".repeat(20 - Math.round((volumeProfile()?.score ?? 0) / 100 * 20))}
            fg={volumeProfile()?.level === "Very High" || volumeProfile()?.level === "High" ? theme.success : theme.warning}
          />
          <text content={` ${volumeProfile()?.score || 0}/100`} fg={theme.textMuted} />
        </box>

        <box paddingLeft={1} paddingTop={0}>
          <text content="Vol  " fg={theme.textMuted} />
          <text
            content={volumeBar(volumeProfile()?.score ?? 0, 100, 22)}
            fg={volumeProfile()?.level === "Very High" || volumeProfile()?.level === "High" ? theme.success : theme.warning}
          />
        </box>
        <box paddingLeft={1}>
          <text content="Prc  " fg={theme.textMuted} />
          <text
            content={priceSparkline()}
            fg={trendStrength().direction === "up" ? theme.success : trendStrength().direction === "down" ? theme.error : theme.textMuted}
          />
        </box>

        <box paddingLeft={2} paddingTop={1}>
          <text content={sectionLine("ACTIVITY")} fg={theme.borderSubtle} />
        </box>
        <DataRow
          label="Alert"
          value={unusualVolume().message}
          valueColor={unusualVolume().alert ? "warning" : "muted"}
        />

        <Separator type="light" />
        <box flexDirection="row" paddingLeft={2} paddingTop={0}>
          <text content="[1]Vol [2]Liq [3]Mom [4]Corr  [ESC]Close" fg={theme.textMuted} />
        </box>
      </Show>

      <Show when={!selectedMarket()}>
        <box paddingLeft={2} paddingTop={1}>
          <text content="Select a market to view analytics" fg={theme.textMuted} />
        </box>
      </Show>
    </box>
  );

  const renderLiquidityTab = () => (
    <box flexDirection="column" flexGrow={1} paddingTop={1}>
      <Show when={selectedMarket()}>
        <box paddingLeft={2}>
          <text content={sectionLine("SPREAD & DEPTH")} fg={theme.borderSubtle} />
        </box>
        <DataRow
          label="Bid-Ask Spread"
          value={`${spreadScore().spread.toFixed(2)}%`}
          valueColor={spreadScore().spread < 3 ? "success" : spreadScore().spread < 5 ? "warning" : "error"}
        />
        <DataRow label="Spread Rating" value={spreadScore().label} valueColor="muted" />
        <box paddingLeft={2} flexDirection="row">
          <text content="Depth  " fg={theme.textMuted} />
          <text
            content={"█".repeat(Math.round(depthScore().score / 100 * 20)) + "░".repeat(20 - Math.round(depthScore().score / 100 * 20))}
            fg={depthScore().score > 60 ? theme.success : depthScore().score > 40 ? theme.warning : theme.error}
          />
          <text content={` ${depthScore().score}/100 ${depthScore().label}`} fg={theme.textMuted} />
        </box>

        <box paddingLeft={2} paddingTop={1}>
          <text content={sectionLine("MARKET DEPTH")} fg={theme.borderSubtle} />
        </box>
        <DataRow
          label="Liquidity"
          value={`$${(selectedMarket()!.liquidity / 1000).toFixed(1)}K`}
          valueColor="text"
        />
        <DataRow
          label="Liq/Vol Ratio"
          value={`${(selectedMarket()!.liquidity / (selectedMarket()!.volume24h || 1)).toFixed(2)}x`}
          valueColor="muted"
        />
        <DataRow
          label="Volatility"
          value={`${volatility().value.toFixed(2)}% (${volatility().label})`}
          valueColor={volatility().value > 5 ? "error" : volatility().value > 2 ? "warning" : "success"}
        />

        <Separator type="light" />
        <box flexDirection="row" paddingLeft={2}>
          <text content="[1]Vol [2]Liq [3]Mom [4]Corr  [ESC]Close" fg={theme.textMuted} />
        </box>
      </Show>

      <Show when={!selectedMarket()}>
        <box paddingLeft={2} paddingTop={1}>
          <text content="Select a market to view analytics" fg={theme.textMuted} />
        </box>
      </Show>
    </box>
  );

  const renderMomentumTab = () => (
    <box flexDirection="column" flexGrow={1} paddingTop={1}>
      <Show when={selectedMarket()}>
        <box paddingLeft={2}>
          <text content={sectionLine("TREND")} fg={theme.borderSubtle} />
        </box>
        <DataRow
          label="Direction"
          value={trendStrength().direction === "up" ? "▲ Bullish" : trendStrength().direction === "down" ? "▼ Bearish" : "─ Neutral"}
          valueColor={trendStrength().direction === "up" ? "success" : trendStrength().direction === "down" ? "error" : "muted"}
        />
        <DataRow
          label="Trend Strength"
          value={`${trendStrength().label} (${trendStrength().strength}/100)`}
          valueColor={trendStrength().strength > 50 ? "success" : trendStrength().strength > 25 ? "warning" : "error"}
        />
        <DataRow
          label="24h Change"
          value={`${selectedMarket()!.change24h >= 0 ? "▲ +" : "▼ "}${selectedMarket()!.change24h.toFixed(2)}%`}
          valueColor={selectedMarket()!.change24h >= 0 ? "success" : "error"}
        />

        <box paddingLeft={2} paddingTop={1}>
          <text content={sectionLine("MOMENTUM")} fg={theme.borderSubtle} />
        </box>
        <DataRow
          label="Signal"
          value={`${momentumScore().signal} ${momentumScore().label}`}
          valueColor={momentumScore().score > 60 ? "success" : momentumScore().score < 40 ? "error" : "warning"}
        />
        <DataRow label="Score" value={`${momentumScore().score}/100`} valueColor="muted" />

        <box paddingLeft={1}>
          <text content="Mom  " fg={theme.textMuted} />
          <text
            content={volumeBar(momentumScore().score, 100, 22)}
            fg={momentumScore().score > 60 ? theme.success : momentumScore().score < 40 ? theme.error : theme.warning}
          />
        </box>
        <box paddingLeft={1}>
          <text content="Prc  " fg={theme.textMuted} />
          <text
            content={priceSparkline()}
            fg={trendStrength().direction === "up" ? theme.success : trendStrength().direction === "down" ? theme.error : theme.textMuted}
          />
        </box>

        <Separator type="light" />
        <box flexDirection="row" paddingLeft={2}>
          <text content="[1]Vol [2]Liq [3]Mom [4]Corr  [ESC]Close" fg={theme.textMuted} />
        </box>
      </Show>

      <Show when={!selectedMarket()}>
        <box paddingLeft={2} paddingTop={1}>
          <text content="Select a market to view analytics" fg={theme.textMuted} />
        </box>
      </Show>
    </box>
  );

  const renderCorrelationTab = () => {
    const current = selectedMarket();
    const top5 = () => markets().filter(m => m.id !== current?.id).slice(0, 5);
    const baseDir = () => current ? (current.change24h > 0.5 ? 1 : current.change24h < -0.5 ? -1 : 0) : 0;
    const proxyCorr = (m: ReturnType<typeof markets>[0]) => {
      const dir = m.change24h > 0.5 ? 1 : m.change24h < -0.5 ? -1 : 0;
      if (baseDir() === 0 || dir === 0) return 0;
      return baseDir() === dir ? 1 : -1;
    };
    return (
      <box flexDirection="column" flexGrow={1} paddingTop={1}>
        <box paddingLeft={2}>
          <text content={sectionLine("PRIMARY MARKET")} fg={theme.borderSubtle} />
        </box>

        <Show when={current}>
          <box paddingLeft={1} paddingRight={1}>
            <text content={current!.title.slice(0, 38)} fg={theme.text} />
          </box>

          <box paddingLeft={2} paddingTop={1}>
            <text content={sectionLine("MARKET CORRELATION")} fg={theme.borderSubtle} />
          </box>

          <box flexDirection="row" paddingLeft={1}>
            <text content={"MARKET".padEnd(37)} fg={theme.textMuted} width={37} />
            <text content={"CHG24".padStart(6)} fg={theme.textMuted} width={7} />
            <text content={"CORR".padStart(5)} fg={theme.textMuted} />
          </box>

          <For each={top5()}>
            {(m) => {
              const corr = proxyCorr(m);
              return (
                <box flexDirection="row" width="100%" paddingLeft={1}>
                  <text content={m.title.slice(0, 36).padEnd(37, " ")} fg={theme.text} width={37} />
                  <text
                    content={`${m.change24h >= 0 ? "+" : ""}${m.change24h.toFixed(1)}%`.padStart(6)}
                    fg={m.change24h > 0 ? theme.success : m.change24h < 0 ? theme.error : theme.textMuted}
                    width={7}
                  />
                  <text
                    content={corr === 1 ? " +1.0" : corr === -1 ? " -1.0" : "  0.0"}
                    fg={corr === 1 ? theme.success : corr === -1 ? theme.error : theme.textMuted}
                  />
                </box>
              );
            }}
          </For>

          <Separator type="light" />
          <box flexDirection="row" paddingLeft={2}>
            <text content="[1]Vol [2]Liq [3]Mom [4]Corr  [ESC]Close" fg={theme.textMuted} />
          </box>
        </Show>

        <Show when={!current}>
          <box paddingLeft={2} paddingTop={1}>
            <text content="Select a market to view analytics" fg={theme.textMuted} />
          </box>
        </Show>
      </box>
    );
  };
  
  return (
    <box
      position="absolute"
      top={2}
      left="8%"
      width="84%"
      height={24}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={150}
    >
      <PanelHeader
        title="MARKET ANALYTICS"
        icon="◈"
        subtitle={selectedMarket() ? selectedMarket()!.title.slice(0, 20) : undefined}
        onClose={() => setAnalyticsPanelOpen(false)}
      />

      {/* Tab bar */}
      <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel}>
        <For each={ANALYTICS_TABS}>
          {(tab) => (
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={activeTab() === tab.id ? theme.primary : undefined}
              onMouseDown={() => setActiveTab(tab.id)}
            >
              <text
                content={` ${tab.label.toUpperCase()} `}
                fg={activeTab() === tab.id ? theme.highlightText : theme.textMuted}
              />
            </box>
          )}
        </For>
      </box>

      <Separator type="heavy" />

      <Show when={loading()}>
        <LoadingState message="Loading analytics data…" />
      </Show>

      <Show when={!loading()}>
        <Show when={activeTab() === "volume"}>{renderVolumeTab()}</Show>
        <Show when={activeTab() === "liquidity"}>{renderLiquidityTab()}</Show>
        <Show when={activeTab() === "momentum"}>{renderMomentumTab()}</Show>
        <Show when={activeTab() === "correlation"}>{renderCorrelationTab()}</Show>
      </Show>
    </box>
  );
}
