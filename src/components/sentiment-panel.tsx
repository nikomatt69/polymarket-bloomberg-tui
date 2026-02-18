import { Show, For, createSignal, createEffect } from "solid-js";
import { useTheme } from "../context/theme";
import { appState, setSentimentPanelOpen } from "../state";
import { analyzeMarketSentiment, SentimentAnalysis } from "../api/sentiment";

const [sentimentData, setSentimentData] = createSignal<SentimentAnalysis | null>(null);
const [isLoading, setIsLoading] = createSignal(false);
const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
const [loadedMarketId, setLoadedMarketId] = createSignal<string | null>(null);

async function loadSentiment(marketId: string) {
  const market = appState.markets.find((item) => item.id === marketId);
  if (!market) {
    setErrorMessage("Selected market not found");
    setSentimentData(null);
    return;
  }

  setIsLoading(true);
  setErrorMessage(null);
  setLoadedMarketId(marketId);

  try {
    const analysis = await analyzeMarketSentiment(market);
    if (!analysis) {
      setErrorMessage("Set ANTHROPIC_API_KEY to enable sentiment analysis");
      setSentimentData(null);
      return;
    }

    setSentimentData(analysis);
  } catch (error) {
    setErrorMessage(error instanceof Error ? error.message : "Sentiment analysis unavailable");
    setSentimentData(null);
  } finally {
    setIsLoading(false);
  }
}

export function SentimentPanel() {
  const { theme } = useTheme();

  const selectedMarket = () => appState.markets.find((m) => m.id === appState.selectedMarketId);

  createEffect(() => {
    const market = selectedMarket();
    if (!market) {
      setSentimentData(null);
      setErrorMessage(null);
      setLoadedMarketId(null);
      return;
    }

    if (loadedMarketId() !== market.id) {
      void loadSentiment(market.id);
    }
  });

  const sentimentColor = (sentiment: "bullish" | "bearish" | "neutral") => {
    switch (sentiment) {
      case "bullish":
        return theme.success;
      case "bearish":
        return theme.error;
      default:
        return theme.textMuted;
    }
  };

  return (
    <box
      position="absolute"
      top={2}
      left="8%"
      width="40%"
      height={20}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={150}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ AI SENTIMENT " fg={theme.highlightText} />
        <box flexGrow={1} />
        <box onMouseDown={() => setSentimentPanelOpen(false)}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.primaryMuted} />

      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
        <Show when={selectedMarket()}>
          <text content={selectedMarket()!.title.slice(0, 44)} fg={theme.textBright} />
          <text content="" />

          <Show when={isLoading()}>
            <text content="Analyzing market narrative..." fg={theme.warning} />
          </Show>

          <Show when={!isLoading() && errorMessage()}>
            <text content={errorMessage()!} fg={theme.error} />
          </Show>

          <Show when={!isLoading() && !errorMessage() && sentimentData()}>
            <box flexDirection="row" width="100%">
              <text content="SENTIMENT: " fg={theme.textMuted} />
              <text
                content={sentimentData()!.sentiment.toUpperCase()}
                fg={sentimentColor(sentimentData()!.sentiment)}
              />
              <text content={`  (${sentimentData()!.confidence.toFixed(0)}%)`} fg={theme.textMuted} />
            </box>

            <text content="" />
            <text content="SUMMARY" fg={theme.primary} />
            <text content={sentimentData()!.summary} fg={theme.textMuted} width="96%" />

            <text content="" />
            <text content="KEY FACTORS" fg={theme.primary} />
            <For each={sentimentData()!.keyFactors.slice(0, 4)}>
              {(factor) => <text content={`• ${factor}`} fg={theme.text} />}
            </For>
          </Show>

          <text content="" />
          <box flexDirection="row" gap={3}>
            <box onMouseDown={() => { const m = selectedMarket(); if (m) loadSentiment(m.id); }}>
              <text content="[R] Refresh" fg={theme.textMuted} />
            </box>
            <box onMouseDown={() => setSentimentPanelOpen(false)}>
              <text content="[ESC] Close" fg={theme.textMuted} />
            </box>
          </box>
        </Show>

        <Show when={!selectedMarket()}>
          <text content="Select a market to analyze" fg={theme.textMuted} />
        </Show>
      </box>
    </box>
  );
}

export { loadSentiment };
