import { For, Show } from "solid-js";
import { Market } from "../types/market";
import { formatPrice, formatVolume, formatChange, padLeft } from "../utils/format";
import { useTheme } from "../context/theme";

interface OutcomeTableProps {
  market: Market | undefined;
}

export function OutcomeTable(props: OutcomeTableProps) {
  const { theme } = useTheme();

  return (
    <box flexDirection="column" width="100%">
      <Show
        when={props.market}
        fallback={
          <text content="Select a market to view outcomes" fg={theme.textMuted} />
        }
      >
        {(market: () => Market) => (
          <>
            <text content="OUTCOMES" fg={theme.primary} />
            <text content="" />
            <text 
              content={`${"Outcome".padEnd(18)} ${"Price".padEnd(10)} ${"24h%".padEnd(8)} ${"Volume".padEnd(10)}`}
              fg={theme.textMuted}
            />
            <text content="────────────────────────────────────────────" fg={theme.borderSubtle} />
            <For each={market().outcomes}>
              {(outcome, idx) => {
                const row = `${outcome.title.padEnd(18)} ${padLeft(formatPrice(outcome.price), 10)} ${padLeft(formatChange(outcome.change24h), 8)} ${padLeft(formatVolume(outcome.volume), 10)}`;
                return (
                  <text 
                    content={row}
                    fg={idx() === 0 ? theme.success : theme.error}
                  />
                );
              }}
            </For>
          </>
        )}
      </Show>
    </box>
  );
}
