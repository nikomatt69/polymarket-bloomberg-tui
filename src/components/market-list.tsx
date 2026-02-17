import { For, Show, createMemo } from "solid-js";
import { appState, highlightedIndex, getFilteredMarkets } from "../state";
import { formatVolume, formatChange, truncateString } from "../utils/format";
import { useTheme } from "../context/theme";

export function MarketList() {
  const { theme } = useTheme();
  const filtered = createMemo(() => getFilteredMarkets());

  return (
    <scrollbox flexGrow={1} width="100%" paddingLeft={1}>
      <Show
        when={!appState.loading}
        fallback={
          <box padding={1}>
            <text content="Loading markets..." fg={theme.textMuted} />
          </box>
        }
      >
        <Show
          when={filtered().length > 0}
          fallback={
            <box padding={1}>
              <text content="No markets found" fg={theme.textMuted} />
            </box>
          }
        >
          <For each={filtered().slice(0, 18)}>
            {(market, index) => {
              const isHighlighted = () => index() === highlightedIndex();
              const changeStr = formatChange(market.change24h);
              const title = truncateString(market.title, 32);
              const volStr = formatVolume(market.volume24h);
              
              return (
                <box 
                  width="100%" 
                  backgroundColor={isHighlighted() ? theme.highlight : undefined}
                >
                  <text 
                    content={
                      isHighlighted() ? "▶" : " "
                    }
                    fg={isHighlighted() ? theme.highlightText : theme.textMuted}
                    width={2}
                  />
                  <text 
                    content={(index() + 1).toString().padStart(2, " ")}
                    fg={isHighlighted() ? theme.highlightText : theme.textMuted}
                    width={3}
                  />
                  <text 
                    content={title}
                    fg={isHighlighted() ? theme.highlightText : theme.text}
                    width={34}
                  />
                  <text 
                    content={volStr}
                    fg={isHighlighted() ? theme.highlightText : theme.textMuted}
                    width={10}
                  />
                  <text 
                    content={changeStr}
                    fg={
                      isHighlighted() 
                        ? theme.highlightText 
                        : market.change24h >= 0 
                          ? theme.success 
                          : theme.error
                    }
                    width={8}
                  />
                </box>
              );
            }}
          </For>
        </Show>
      </Show>
    </scrollbox>
  );
}
