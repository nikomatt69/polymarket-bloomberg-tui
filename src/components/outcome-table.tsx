import { For, Show } from "solid-js";
import { RGBA } from "@opentui/core";
import { Market } from "../types/market";
import { formatVolume, formatChange, padLeft } from "../utils/format";
import { useTheme } from "../context/theme";
import { OrderBookSummary } from "../api/polymarket";

interface OutcomeTableProps {
  market: Market | undefined;
  orderBooks?: Record<string, OrderBookSummary>;
}

function formatCents(value: number | null | undefined): string {
  if (value === null || value === undefined) return "  -- ";
  return `${(value * 100).toFixed(2)}¢`;
}

function formatSpread(value: number | null | undefined): string {
  if (value === null || value === undefined) return " -- ";
  return `${(value * 100).toFixed(2)}¢`;
}

function formatBps(value: number | null | undefined): string {
  if (value === null || value === undefined) return " -- ";
  return `${value.toFixed(0)}bp`;
}

/** Returns a fixed-width probability bar string: filled + unfilled chars. */
function probBar(price: number, width: number, fillChar = "█", emptyChar = "░"): string {
  const filled = Math.max(0, Math.min(width, Math.round(price * width)));
  return fillChar.repeat(filled) + emptyChar.repeat(width - filled);
}

/** Maps an outcome index to a consistent colour token from theme. */
function outcomeColor(
  idx: number,
  price: number,
  theme: { success: RGBA; warning: RGBA; error: RGBA },
): RGBA {
  // First outcome: green if confident, yellow if uncertain
  if (idx === 0) {
    return price >= 0.6 ? theme.success : price >= 0.4 ? theme.warning : theme.error;
  }
  // Second+ outcome: red if low probability, yellow if close
  return price >= 0.6 ? theme.success : price >= 0.4 ? theme.warning : theme.error;
}

const BAR_WIDTH = 16;

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
            {/* ── Section header ─────────────────────────────────────────── */}
            <text content="OUTCOMES" fg={theme.primary} />
            <text content="" />

            {/* ── Probability bars ───────────────────────────────────────── */}
            <For each={market().outcomes}>
              {(outcome, idx) => {
                const color = () => outcomeColor(idx(), outcome.price, theme);
                const bar = probBar(outcome.price, BAR_WIDTH);
                const pct = `${(outcome.price * 100).toFixed(1)}%`;
                const label = outcome.title.length > 12
                  ? outcome.title.slice(0, 11) + "…"
                  : outcome.title;

                return (
                  <box flexDirection="row" height={1} width="100%">
                    <text
                      content={label.padEnd(12)}
                      fg={color()}
                      width={12}
                    />
                    <text content=" " width={1} />
                    <text
                      content={bar}
                      fg={color()}
                      width={BAR_WIDTH}
                    />
                    <text content=" " width={1} />
                    <text
                      content={pct.padStart(6)}
                      fg={color()}
                      width={6}
                    />
                  </box>
                );
              }}
            </For>

            <text content="" />

            {/* ── Columnar table header ──────────────────────────────────── */}
            <text
              content={`${"Outcome".padEnd(12)} ${"Last".padEnd(8)} ${"Bid".padEnd(8)} ${"Ask".padEnd(8)} ${"Sprd".padEnd(8)} ${"24h%".padEnd(8)} ${"Vol".padEnd(10)}`}
              fg={theme.textMuted}
            />
            <text
              content="──────────────────────────────────────────────────────────────────────"
              fg={theme.borderSubtle}
            />

            <For each={market().outcomes}>
              {(outcome, idx) => {
                const book = props.orderBooks?.[outcome.id];
                const row = [
                  outcome.title.padEnd(12),
                  padLeft(formatCents(outcome.price), 8),
                  padLeft(formatCents(book?.bestBid), 8),
                  padLeft(formatCents(book?.bestAsk), 8),
                  padLeft(formatSpread(book?.spread), 8),
                  padLeft(formatChange(outcome.change24h), 8),
                  padLeft(formatVolume(outcome.volume), 10),
                ].join(" ");

                return (
                  <text
                    content={row}
                    fg={outcomeColor(idx(), outcome.price, theme)}
                  />
                );
              }}
            </For>

            <text content="" />

            {/* ── Order book depth summary ───────────────────────────────── */}
            <text content="ORDER BOOK" fg={theme.primary} />
            <text content="" />

            <For each={market().outcomes.slice(0, 3)}>
              {(outcome) => {
                const book = props.orderBooks?.[outcome.id];
                if (!book) {
                  return (
                    <text
                      content={`${outcome.title.padEnd(10)}  Bid: --   Ask: --   Spread: --   Depth: -- / --`}
                      fg={theme.textMuted}
                    />
                  );
                }

                const totalDepth = book.bidDepth + book.askDepth;
                const bidFrac = totalDepth > 0 ? book.bidDepth / totalDepth : 0.5;
                const bidBar = probBar(bidFrac, 10, "▓", "░");
                const askBar = probBar(1 - bidFrac, 10, "▓", "░");

                return (
                  <box flexDirection="row" height={1} width="100%">
                    <text
                      content={outcome.title.padEnd(10)}
                      fg={theme.textMuted}
                      width={10}
                    />
                    <text content="  Bid " fg={theme.textMuted} width={6} />
                    <text content={formatCents(book.bestBid)} fg={theme.success} width={7} />
                    <text content=" " width={1} />
                    <text content={bidBar} fg={theme.successMuted} width={10} />
                    <text content=" │ " fg={theme.borderSubtle} width={3} />
                    <text content={askBar} fg={theme.errorMuted} width={10} />
                    <text content=" " width={1} />
                    <text content={formatCents(book.bestAsk)} fg={theme.error} width={7} />
                    <text content="  Ask " fg={theme.textMuted} width={6} />
                    <text content={`Sprd:${formatBps(book.spreadBps)}`} fg={theme.textMuted} />
                  </box>
                );
              }}
            </For>
          </>
        )}
      </Show>
    </box>
  );
}
