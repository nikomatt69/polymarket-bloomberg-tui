import { Show, For, createSignal, createEffect } from "solid-js";
import { useTheme } from "../context/theme";
import { appState, setSentimentPanelOpen } from "../state";
import { analyzeMarketSentiment, getSentimentProviderError, SentimentAnalysis } from "../api/sentiment";
import { PanelHeader, Separator, LoadingState } from "./ui/panel-components";

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
      setErrorMessage(getSentimentProviderError() ?? "Sentiment analysis unavailable");
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

  const sentimentBar = (confidence: number, sentiment: "bullish" | "bearish" | "neutral") => {
    const barWidth = 20;
    const filled = Math.round((confidence / 100) * barWidth);
    const color = sentimentColor(sentiment);
    return { bar: "█".repeat(filled) + "░".repeat(barWidth - filled), color };
  };

  return (
    <box
      position="absolute"
      top={2}
      left="8%"
      width="44%"
      height={22}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={150}
    >
      {/* Header */}
      <PanelHeader
        title="AI MARKET SENTIMENT"
        icon="◈"
        subtitle={selectedMarket() ? selectedMarket()!.title.slice(0, 18) : undefined}
        onClose={() => setSentimentPanelOpen(false)}
      />

      <Separator type="heavy" />

      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingTop={1}>
        <Show when={selectedMarket()}>
          <text content={selectedMarket()!.title.slice(0, 50)} fg={theme.text} />
          <text content="" />

          <Show when={isLoading()}>
            <LoadingState message="Analyzing market narrative with AI…" />
          </Show>

          <Show when={!isLoading() && errorMessage()}>
            <text content={`✗ ${errorMessage()!}`} fg={theme.error} />
            <text content="" />
            <text content="Ensure an AI provider is configured in Settings [E]." fg={theme.textMuted} />
          </Show>

          <Show when={!isLoading() && !errorMessage() && sentimentData()}>
            <text content="─── SENTIMENT SIGNAL ────────────────────────" fg={theme.borderSubtle} />

            {/* Sentiment badge + bar */}
            <box flexDirection="row" paddingTop={0}>
              <text content="Signal : " fg={theme.textMuted} />
              <text
                content={sentimentData()!.sentiment.toUpperCase()}
                fg={sentimentColor(sentimentData()!.sentiment)}
              />
              <text content="  " fg={theme.textMuted} />
              <text
                content={sentimentBar(sentimentData()!.confidence, sentimentData()!.sentiment).bar}
                fg={sentimentBar(sentimentData()!.confidence, sentimentData()!.sentiment).color}
              />
              <text content={`  ${sentimentData()!.confidence.toFixed(0)}%`} fg={theme.textMuted} />
            </box>

            <text content="" />
            <text content="─── SUMMARY ─────────────────────────────────" fg={theme.borderSubtle} />
            <text content={sentimentData()!.summary} fg={theme.textMuted} width="96%" />

            <text content="" />
            <text content="─── KEY FACTORS ─────────────────────────────" fg={theme.borderSubtle} />
            <For each={sentimentData()!.keyFactors.slice(0, 4)}>
              {(factor) => (
                <box flexDirection="row">
                  <text content="▸ " fg={theme.accent} />
                  <text content={factor} fg={theme.text} />
                </box>
              )}
            </For>
          </Show>

          <Separator type="light" />
          <box flexDirection="row" gap={3}>
            <box onMouseDown={() => { const m = selectedMarket(); if (m) loadSentiment(m.id); }}>
              <text content="[R] Refresh Analysis" fg={theme.accent} />
            </box>
            <box onMouseDown={() => setSentimentPanelOpen(false)}>
              <text content="[ESC] Close" fg={theme.textMuted} />
            </box>
          </box>
        </Show>

        <Show when={!selectedMarket()}>
          <text content="Select a market from the list to run AI sentiment analysis." fg={theme.textMuted} />
          <text content="" />
          <text content="Requires an AI provider configured in Settings [E]." fg={theme.textMuted} />
        </Show>
      </box>
    </box>
  );
}

export { loadSentiment };
