import { Show, For, createSignal } from "solid-js";
import { useTheme } from "../context/theme";
import { appState } from "../state";
import { 
  calculateSMA, 
  calculateRSI, 
  calculateMACD, 
  calculateBollingerBands,
  OHLCV 
} from "../utils/indicators";

type IndicatorType = "sma" | "rsi" | "macd" | "bollinger";

const [selectedIndicator, setSelectedIndicator] = createSignal<IndicatorType>("sma");
const [smaPeriod, setSmaPeriod] = createSignal(20);
const [rsiPeriod, setRsiPeriod] = createSignal(14);

export function IndicatorsPanel() {
  const { theme } = useTheme();

  const selectedMarket = () => 
    appState.markets.find(m => m.id === appState.selectedMarketId);

  const mockPriceData = (): number[] => {
    const base = selectedMarket()?.outcomes?.[0]?.price || 0.5;
    return Array.from({ length: 30 }, (_, i) => 
      base + (Math.sin(i * 0.3) * 0.1) + (Math.random() * 0.05 - 0.025)
    );
  };

  const indicatorValues = () => {
    const data = mockPriceData();
    switch (selectedIndicator()) {
      case "sma":
        return { 
          name: "SMA", 
          values: calculateSMA(data, smaPeriod()).slice(-10),
          current: data[data.length - 1],
          prev: data[data.length - 2],
        };
      case "rsi":
        return { 
          name: "RSI", 
          values: calculateRSI(data, rsiPeriod()).slice(-10),
          current: calculateRSI(data, rsiPeriod())[data.length - 1] || 50,
          prev: calculateRSI(data, rsiPeriod())[data.length - 2] || 50,
        };
      case "macd":
        const macd = calculateMACD(data);
        return {
          name: "MACD",
          values: macd.histogram.slice(-10),
          current: macd.histogram[data.length - 1] || 0,
          prev: macd.histogram[data.length - 2] || 0,
        };
      case "bollinger":
        const bb = calculateBollingerBands(data, smaPeriod());
        return {
          name: "BBANDS",
          values: bb.middle.slice(-10),
          current: bb.middle[data.length - 1] || 0,
          prev: bb.middle[data.length - 2] || 0,
        };
    }
  };

  const getIndicatorColor = (indicator: IndicatorType) => {
    switch (indicator) {
      case "sma": return theme.success;
      case "rsi": return theme.warning;
      case "macd": return theme.accent;
      case "bollinger": return theme.primary;
    }
  };

  return (
    <box
      position="absolute"
      top={2}
      left="35%"
      width="30%"
      height={16}
      backgroundColor={theme.backgroundPanel}
      flexDirection="column"
      zIndex={150}
    >
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" TECHNICAL INDICATORS " fg={theme.highlightText} width={22} />
        <box flexGrow={1} />
        <text content=" [ESC] Close " fg={theme.highlightText} width={14} />
      </box>

      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingTop={1}>
        <Show when={selectedMarket()}>
          <text content={selectedMarket()!.title.slice(0, 45)} fg={theme.textBright} />
          <text content="" />

          <box flexDirection="row" gap={2}>
            <text 
              content={selectedIndicator() === "sma" ? "[SMA]" : " SMA "} 
              fg={selectedIndicator() === "sma" ? theme.success : theme.textMuted}
            />
            <text 
              content={selectedIndicator() === "rsi" ? "[RSI]" : " RSI "} 
              fg={selectedIndicator() === "rsi" ? theme.warning : theme.textMuted}
            />
            <text 
              content={selectedIndicator() === "macd" ? "[MACD]" : " MACD "} 
              fg={selectedIndicator() === "macd" ? theme.accent : theme.textMuted}
            />
            <text 
              content={selectedIndicator() === "bollinger" ? "[BB]" : " BB "} 
              fg={selectedIndicator() === "bollinger" ? theme.primary : theme.textMuted}
            />
          </box>

          <text content="" />
          
          <Show when={indicatorValues()}>
            <box flexDirection="row" gap={4}>
              <text content={`Current: ${indicatorValues()!.current.toFixed(4)}`} fg={getIndicatorColor(selectedIndicator())} />
              <text 
                content={`${indicatorValues()!.current >= indicatorValues()!.prev ? "↑" : "↓"}`} 
                fg={indicatorValues()!.current >= indicatorValues()!.prev ? theme.success : theme.error} 
              />
            </box>
            
            <text content="" />
            <text content={`Last 10 values:`} fg={theme.textMuted} />
            <text content={indicatorValues()!.values.map(v => v.toFixed(3)).join(" ")} fg={theme.text} width="95%" />
          </Show>

          <text content="" />
          <text content=" [1-4] Select Indicator  [+/=] Period " fg={theme.textMuted} />
        </Show>

        <Show when={!selectedMarket()}>
          <text content="Select a market to view indicators" fg={theme.textMuted} />
        </Show>
      </box>
    </box>
  );
}

export { selectedIndicator, setSelectedIndicator, smaPeriod, rsiPeriod };
