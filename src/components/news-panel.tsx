/**
 * NewsPanel — Bloomberg-style RSS news reader panel
 */

import { Show, For, createMemo, onMount } from "solid-js";
import { useTheme } from "../context/theme";
import {
  newsItems,
  setNewsItems,
  loadingNews,
  setLoadingNews,
  selectedNewsIndex,
  setNewsPanelOpen,
  appState,
  NewsItem,
} from "../state";
import { fetchAllNews, filterNewsForMarket } from "../api/news";
import type { Market } from "../types/market";

function fmtAge(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

export function NewsPanel() {
  const { theme } = useTheme();

  const selectedMarket = createMemo(
    () => appState.markets.find((m) => m.id === appState.selectedMarketId) ?? null
  );

  const relevantIds = createMemo(() => {
    const market = selectedMarket();
    if (!market) return new Set<string>();
    const relevant = filterNewsForMarket(newsItems(), market.title);
    return new Set(relevant.map((n) => n.id));
  });

  onMount(async () => {
    if (newsItems().length === 0) {
      setLoadingNews(true);
      try {
        const items = await fetchAllNews();
        setNewsItems(items);
      } finally {
        setLoadingNews(false);
      }
    }
  });

  const selected = createMemo(() => newsItems()[selectedNewsIndex()] ?? null);

  return (
    <box
      position="absolute"
      top={1}
      left="5%"
      width="90%"
      height={30}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={160}
    >
      {/* Header */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ BLOOMBERG NEWS " fg={theme.highlightText} />
        <Show when={selectedMarket()}>
          {(m: () => Market) => <text content={`| ${truncate(m().title, 40)} `} fg={theme.primaryMuted} />}
        </Show>
        <box flexGrow={1} />
        <text content={`${newsItems().length} articles `} fg={theme.primaryMuted} />
        <box onMouseDown={() => setNewsPanelOpen(false)}>
          <text content=" [N] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* Separator */}
      <box height={1} width="100%" backgroundColor={theme.borderSubtle} />

      <Show when={loadingNews()}>
        <box flexGrow={1} flexDirection="column" paddingLeft={2} paddingTop={1}>
          <text content="Loading news feeds…" fg={theme.textMuted} />
        </box>
      </Show>

      <Show when={!loadingNews()}>
        {/* News list — top 70% */}
        <box height={18} width="100%" flexDirection="column" paddingLeft={1}>
          {/* Column headers */}
          <box flexDirection="row" width="100%" paddingTop={0}>
            <text content="  SOURCE    " fg={theme.textMuted} width={12} />
            <text content="TIME     " fg={theme.textMuted} width={9} />
            <text content="HEADLINE" fg={theme.textMuted} />
          </box>

          <Show
            when={newsItems().length > 0}
            fallback={<text content="No news available — check network connection" fg={theme.textMuted} />}
          >
            <scrollbox height={16} width="100%">
              <For each={newsItems()}>
                {(item, i) => {
                  const isSelected = () => selectedNewsIndex() === i();
                  const isRelevant = () => relevantIds().has(item.id);
                  return (
                    <box
                      flexDirection="row"
                      width="100%"
                      backgroundColor={isSelected() ? theme.highlight : undefined}
                      onMouseDown={() => {
                        const { setSelectedNewsIndex } = require("../state") as typeof import("../state");
                        setSelectedNewsIndex(i());
                      }}
                    >
                      <text content={isSelected() ? " ▶ " : "   "} fg={theme.primary} width={3} />
                      <text
                        content={item.source.padEnd(9, " ")}
                        fg={isSelected() ? theme.highlightText : theme.accent}
                        width={10}
                      />
                      <text
                        content={fmtAge(item.publishedAt).padEnd(8, " ")}
                        fg={theme.textMuted}
                        width={9}
                      />
                      <text
                        content={truncate(item.title, 90)}
                        fg={
                          isSelected()
                            ? theme.highlightText
                            : isRelevant()
                            ? theme.success
                            : theme.text
                        }
                      />
                    </box>
                  );
                }}
              </For>
            </scrollbox>
          </Show>
        </box>

        {/* Separator */}
        <box height={1} width="100%" backgroundColor={theme.borderSubtle} />

        {/* Detail view — bottom 30% */}
        <box flexGrow={1} flexDirection="column" paddingLeft={2} paddingTop={1} paddingRight={2}>
          <Show when={selected()} fallback={<text content="Select an article with ↑/↓" fg={theme.textMuted} />}>
            {(item: () => NewsItem) => (
              <>
                <text content={item().title} fg={theme.text} />
                <box height={1} />
                <text content={item().summary || "(no summary)"} fg={theme.textMuted} />
                <box height={1} />
                <text content={`URL: ${item().url}`} fg={theme.primary} />
              </>
            )}
          </Show>
        </box>
      </Show>

      {/* Footer */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row" paddingLeft={2}>
        <text content="↑/↓ navigate  " fg={theme.textMuted} />
        <text content="[N] close" fg={theme.textMuted} />
        <box flexGrow={1} />
        <text content="Green = related to current market  " fg={theme.textMuted} />
      </box>
    </box>
  );
}
