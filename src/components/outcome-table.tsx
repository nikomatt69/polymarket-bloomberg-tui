import { For, Show } from "solid-js";
import { Market } from "../types/market";
import { formatVolume, formatChange, padLeft } from "../utils/format";
import { useTheme } from "../context/theme";
import { OrderBookSummary } from "../api/polymarket";

interface OutcomeTableProps {
  market: Market | undefined;
  orderBooks?: Record<string, OrderBookSummary>;
}

function formatCents(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return `${(value * 100).toFixed(2)}¢`;
}

function formatSpread(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return `${(value * 100).toFixed(2)}¢`;
}

function formatBps(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return `${value.toFixed(0)}bp`;
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
              content={`${"Outcome".padEnd(15)} ${"Last".padEnd(8)} ${"Bid".padEnd(8)} ${"Ask".padEnd(8)} ${"Sprd".padEnd(8)} ${"24h%".padEnd(8)} ${"Vol".padEnd(10)}`}
              fg={theme.textMuted}
            />
            <text content="────────────────────────────────────────────────────────────────────────────" fg={theme.borderSubtle} />
            <For each={market().outcomes}>
              {(outcome, idx) => {
                const book = props.orderBooks?.[outcome.id];
                const row = `${outcome.title.padEnd(15)} ${padLeft(formatCents(outcome.price), 8)} ${padLeft(formatCents(book?.bestBid), 8)} ${padLeft(formatCents(book?.bestAsk), 8)} ${padLeft(formatSpread(book?.spread), 8)} ${padLeft(formatChange(outcome.change24h), 8)} ${padLeft(formatVolume(outcome.volume), 10)}`;
                return (
                  <text
                    content={row}
                    fg={idx() === 0 ? theme.success : theme.error}
                  />
                );
              }}
            </For>
            <text content="" />
            <For each={market().outcomes.slice(0, 2)}>
              {(outcome) => {
                const book = props.orderBooks?.[outcome.id];
                if (!book) {
                  return (
                    <text content={`${outcome.title.toUpperCase()} BOOK  Bid: --  Ask: --  Spread: --  Depth(B/A): -- / --`} fg={theme.textMuted} />
                  );
                }

                return (
                  <text
                    content={`${outcome.title.toUpperCase()} BOOK  Mid: ${formatCents(book.midpoint)}  Spread: ${formatBps(book.spreadBps)}  Depth(B/A): ${book.bidDepth.toFixed(1)} / ${book.askDepth.toFixed(1)}`}
                    fg={theme.textMuted}
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
