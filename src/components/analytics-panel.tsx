import { Show, createSignal, createEffect, createMemo, For } from "solid-js";
import { RGBA } from "@opentui/core";
import { useTheme } from "../context/theme";
import { appState, analyticsPanelOpen, setAnalyticsPanelOpen, getFilteredMarkets, highlightedIndex } from "../state";
import { usePriceHistory } from "../hooks/useMarketData";

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
  
  const sparkline = createMemo(() => {
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
  
  const renderVolumeTab = () => (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
      <Show when={selectedMarket()}>
        <text content="Volume Analysis" fg={theme.textBright} />
        <text content="" />
        
        <box flexDirection="row" gap={4}>
          <box flexDirection="column">
            <text content="Volume Profile:" fg={theme.textMuted} />
            <text content={volumeProfile()?.level || "N/A"} fg={volumeProfile()?.level === "Very High" || volumeProfile()?.level === "High" ? theme.success : theme.warning} />
            <text content={`Score: ${volumeProfile()?.score || 0}/100`} fg={theme.textMuted} />
          </box>
          
          <box flexDirection="column">
            <text content="24h Volume:" fg={theme.textMuted} />
            <text content={`$${(selectedMarket()!.volume24h / 1000).toFixed(1)}K`} fg={theme.text} />
            <text content={`Total: $${(selectedMarket()!.volume / 1000000).toFixed(2)}M`} fg={theme.textMuted} />
          </box>
        </box>
        
        <text content="" />
        
        <box flexDirection="column">
          <text content="Activity:" fg={theme.textMuted} />
          <text 
            content={unusualVolume().message} 
            fg={unusualVolume().alert ? theme.warning : theme.text} 
          />
        </box>
        
        <text content="" />
        
        <box flexDirection="column">
          <text content="Trend Sparkline:" fg={theme.textMuted} />
          <text content={sparkline()} fg={trendStrength().direction === "up" ? theme.success : trendStrength().direction === "down" ? theme.error : theme.textMuted} />
        </box>
        
        <text content="" />
        <text content="[1] Volume  [2] Liquidity  [3] Momentum  [4] Correlation" fg={theme.textMuted} />
      </Show>
      
      <Show when={!selectedMarket()}>
        <text content="Select a market to view analytics" fg={theme.textMuted} />
      </Show>
    </box>
  );
  
  const renderLiquidityTab = () => (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
      <Show when={selectedMarket()}>
        <text content="Liquidity Analysis" fg={theme.textBright} />
        <text content="" />
        
        <box flexDirection="row" gap={4}>
          <box flexDirection="column">
            <text content="Bid-Ask Spread:" fg={theme.textMuted} />
            <text content={`${spreadScore().spread.toFixed(2)}%`} fg={spreadScore().spread < 3 ? theme.success : spreadScore().spread < 5 ? theme.warning : theme.error} />
            <text content={`Rating: ${spreadScore().label}`} fg={theme.textMuted} />
          </box>
          
          <box flexDirection="column">
            <text content="Depth Score:" fg={theme.textMuted} />
            <text content={`${depthScore().score}/100`} fg={depthScore().score > 60 ? theme.success : depthScore().score > 40 ? theme.warning : theme.error} />
            <text content={depthScore().label} fg={theme.textMuted} />
          </box>
        </box>
        
        <text content="" />
        
        <box flexDirection="column">
          <text content="Market Liquidity:" fg={theme.textMuted} />
          <text content={`$${(selectedMarket()!.liquidity / 1000).toFixed(1)}K`} fg={theme.text} />
          <text content={`Liquidity/Volume Ratio: ${(selectedMarket()!.liquidity / (selectedMarket()!.volume24h || 1)).toFixed(2)}x`} fg={theme.textMuted} />
        </box>
        
        <text content="" />
        
        <box flexDirection="column">
          <text content="Volatility:" fg={theme.textMuted} />
          <text content={`${volatility().value.toFixed(2)}%`} fg={volatility().value > 5 ? theme.error : volatility().value > 2 ? theme.warning : theme.success} />
          <text content={`Level: ${volatility().label}`} fg={theme.textMuted} />
        </box>
        
        <text content="" />
        <text content="[1] Volume  [2] Liquidity  [3] Momentum  [4] Correlation" fg={theme.textMuted} />
      </Show>
      
      <Show when={!selectedMarket()}>
        <text content="Select a market to view analytics" fg={theme.textMuted} />
      </Show>
    </box>
  );
  
  const renderMomentumTab = () => (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
      <Show when={selectedMarket()}>
        <text content="Momentum Indicators" fg={theme.textBright} />
        <text content="" />
        
        <box flexDirection="row" gap={4}>
          <box flexDirection="column">
            <text content="Trend Strength:" fg={theme.textMuted} />
            <text 
              content={trendStrength().label} 
              fg={trendStrength().strength > 50 ? theme.success : trendStrength().strength > 25 ? theme.warning : theme.error} 
            />
            <text content={`Score: ${trendStrength().strength}/100`} fg={theme.textMuted} />
          </box>
          
          <box flexDirection="column">
            <text content="Momentum:" fg={theme.textMuted} />
            <text 
              content={`${momentumScore().signal} ${momentumScore().label}`} 
              fg={momentumScore().score > 60 ? theme.success : momentumScore().score < 40 ? theme.error : theme.warning} 
            />
            <text content={`Score: ${momentumScore().score}/100`} fg={theme.textMuted} />
          </box>
        </box>
        
        <text content="" />
        
        <box flexDirection="column">
          <text content="24h Change:" fg={theme.textMuted} />
          <text 
            content={`${selectedMarket()!.change24h >= 0 ? "+" : ""}${selectedMarket()!.change24h.toFixed(2)}%`} 
            fg={selectedMarket()!.change24h >= 0 ? theme.success : theme.error} 
          />
        </box>
        
        <text content="" />
        
        <box flexDirection="column">
          <text content="Direction:" fg={theme.textMuted} />
          <text 
            content={trendStrength().direction === "up" ? "▲ Bullish" : trendStrength().direction === "down" ? "▼ Bearish" : "─ Neutral"} 
            fg={trendStrength().direction === "up" ? theme.success : trendStrength().direction === "down" ? theme.error : theme.textMuted} 
          />
        </box>
        
        <text content="" />
        <text content="[1] Volume  [2] Liquidity  [3] Momentum  [4] Correlation" fg={theme.textMuted} />
      </Show>
      
      <Show when={!selectedMarket()}>
        <text content="Select a market to view analytics" fg={theme.textMuted} />
      </Show>
    </box>
  );
  
  const renderCorrelationTab = () => (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
      <text content="Market Correlation" fg={theme.textBright} />
      <text content="" />
      
      <Show when={selectedMarket()}>
        <box flexDirection="column">
          <text content="Primary Market:" fg={theme.textMuted} />
          <text content={selectedMarket()!.title.slice(0, 40)} fg={theme.text} />
        </box>
        
        <text content="" />
        
        <box flexDirection="column">
          <text content="Compare with:" fg={theme.textMuted} />
          <Show when={!compareMarketId()}>
            <text content="Press [C] to select market" fg={theme.warning} />
          </Show>
          <Show when={compareMarketId()}>
            <text content={markets().find(m => m.id === compareMarketId())?.title.slice(0, 40) || "N/A"} fg={theme.text} />
          </Show>
        </box>
        
        <text content="" />
        
        <Show when={compareMarketId()}>
          <box flexDirection="column">
            <text content="Correlation:" fg={theme.textMuted} />
            <text 
              content={`${correlation().value.toFixed(3)} (${correlation().label})`}
              fg={correlation().value > 0.5 ? theme.success : correlation().value < -0.5 ? theme.error : theme.textMuted}
            />
          </box>
          
          <text content="" />
          
          <box flexDirection="column">
            <text content="Interpretation:" fg={theme.textMuted} />
            <Show when={correlation().value > 0.7}>
              <text content="Strong positive correlation - markets move together" fg={theme.text} />
            </Show>
            <Show when={correlation().value > 0.3 && correlation().value <= 0.7}>
              <text content="Moderate positive correlation" fg={theme.text} />
            </Show>
            <Show when={correlation().value > -0.3 && correlation().value <= 0.3}>
              <text content="Weak or no correlation - independent movement" fg={theme.text} />
            </Show>
            <Show when={correlation().value > -0.7 && correlation().value <= -0.3}>
              <text content="Moderate negative correlation" fg={theme.text} />
            </Show>
            <Show when={correlation().value <= -0.7}>
              <text content="Strong negative correlation - inverse movement" fg={theme.text} />
            </Show>
          </box>
        </Show>
        
        <text content="" />
        <text content="[C] Select market  [ESC] Close" fg={theme.textMuted} />
      </Show>
      
      <Show when={!selectedMarket()}>
        <text content="Select a market to view analytics" fg={theme.textMuted} />
      </Show>
    </box>
  );
  
  return (
    <box
      position="absolute"
      top={2}
      left="5%"
      width="35%"
      height={18}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={150}
    >
      <box height={1} width="100%" backgroundColor={theme.accent} flexDirection="row">
        <text content=" ◈ MARKET ANALYTICS " fg={theme.highlightText} />
        <box flexGrow={1} />
        <box onMouseDown={() => setAnalyticsPanelOpen(false)}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>
      
      <box height={1} width="100%" backgroundColor={theme.accentMuted} />
      
      <box height={1} width="100%" flexDirection="row" paddingLeft={2}>
        <For each={ANALYTICS_TABS}>
          {(tab) => (
            <box 
              paddingLeft={1} 
              paddingRight={1}
              onMouseDown={() => setActiveTab(tab.id)}
            >
              <text 
                content={activeTab() === tab.id ? `[${tab.label}]` : ` ${tab.label} `}
                fg={activeTab() === tab.id ? theme.accent : theme.textMuted}
              />
            </box>
          )}
        </For>
      </box>
      
      <box height={1} width="100%" backgroundColor={theme.borderSubtle} />
      
      <Show when={loading()}>
        <box padding={1}>
          <text content="Loading analytics..." fg={theme.warning} />
        </box>
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
