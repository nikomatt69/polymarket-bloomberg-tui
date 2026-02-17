import { Show, For, createSignal } from "solid-js";
import { useTheme } from "../context/theme";
import { appState } from "../state";

interface SentimentData {
  marketId: string;
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  keyFactors: string[];
}

const [sentimentData, setSentimentData] = createSignal<SentimentData | null>(null);
const [isLoading, setIsLoading] = createSignal(false);

async function loadSentiment(marketId: string) {
  setIsLoading(true);
  
  const mockSentiments: Record<string, SentimentData> = {
    "default": {
      marketId: "default",
      sentiment: "neutral",
      confidence: 50,
      summary: "Market shows balanced odds between outcomes. No clear directional bias based on current data.",
      keyFactors: ["Volume stability", "Recent price action", "News sentiment"],
    }
  };
  
  const data = mockSentiments[marketId] || mockSentiments["default"];
  setSentimentData(data);
  setIsLoading(false);
}

export function SentimentPanel() {
  const { theme } = useTheme();

  const sentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "bullish": return theme.success;
      case "bearish": return theme.error;
      default: return theme.textMuted;
    }
  };

  const selectedMarket = () => 
    appState.markets.find(m => m.id === appState.selectedMarketId);

  return (
    <box
      position="absolute"
      top={2}
      left="10%"
      width="30%"
      height={18}
      backgroundColor={theme.backgroundPanel}
      flexDirection="column"
      zIndex={150}
    >
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" AI SENTIMENT " fg={theme.highlightText} width={15} />
        <box flexGrow={1} />
        <text content=" [ESC] Close " fg={theme.highlightText} width={14} />
      </box>

      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingTop={1}>
        <Show when={selectedMarket()}>
          <text content={selectedMarket()!.title.slice(0, 40)} fg={theme.textBright} />
          <text content="" />
          
          <Show when={!isLoading()} fallback={<text content="Analyzing..." fg={theme.textMuted} />}>
            <Show when={sentimentData()}>
              <box flexDirection="row" width="100%">
                <text content="SENTIMENT: " fg={theme.textMuted} />
                <text 
                  content={sentimentData()!.sentiment.toUpperCase()} 
                  fg={sentimentColor(sentimentData()!.sentiment)} 
                />
              </box>
              
              <text content="" />
              <text content={`Confidence: ${sentimentData()!.confidence}%`} fg={theme.text} />
              
              <text content="" />
              <text content="SUMMARY" fg={theme.primary} />
              <text content={sentimentData()!.summary} fg={theme.textMuted} width="95%" />
              
              <text content="" />
              <text content="KEY FACTORS" fg={theme.primary} />
              <For each={sentimentData()!.keyFactors}>
                {(factor) => (
                  <text content={`• ${factor}`} fg={theme.text} />
                )}
              </For>
            </Show>
          </Show>
          
          <text content="" />
          <text content=" [R] Refresh Analysis " fg={theme.textMuted} />
        </Show>

        <Show when={!selectedMarket()}>
          <text content="Select a market to analyze" fg={theme.textMuted} />
        </Show>
      </box>
    </box>
  );
}

export { loadSentiment };
