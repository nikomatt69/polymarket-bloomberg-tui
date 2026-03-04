/**
 * SocialPanel — Twitter/X social sentiment panel using CryptoPanic + Nitter RSS
 */

import { Show, For, createMemo, onMount, createSignal } from "solid-js";
import { useTheme } from "../context/theme";
import {
  socialItems,
  setSocialItems,
  socialSentiment,
  setSocialSentiment,
  setSocialPanelOpen,
  appState,
  SocialItem,
  SocialSentiment,
} from "../state";
import type { Market } from "../types/market";
import { PanelHeader, Separator, LoadingState } from "./ui/panel-components";

const BULLISH_WORDS = ["bull", "pump", "moon", "buy", "long", "up", "surge", "rally", "gain", "winner", "profit", "rise", "soar", "explode"];
const BEARISH_WORDS = ["bear", "dump", "crash", "sell", "short", "down", "drop", "fall", "loss", "red", "rekt", "plunge", "decline", "collapse"];

function scoreSentiment(text: string): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  const b = BULLISH_WORDS.filter((w) => lower.includes(w)).length;
  const s = BEARISH_WORDS.filter((w) => lower.includes(w)).length;
  if (b > s) return "bullish";
  if (s > b) return "bearish";
  return "neutral";
}

function calcSentiment(items: SocialItem[]): SocialSentiment {
  const total = items.length;
  if (total === 0) return { bullish: 0, bearish: 0, neutral: 0, total: 0 };
  const bullish = items.filter((i) => i.sentiment === "bullish").length;
  const bearish = items.filter((i) => i.sentiment === "bearish").length;
  const neutral = total - bullish - bearish;
  return { bullish, bearish, neutral, total };
}

function fmtAge(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function sentimentBar(sent: SocialSentiment): string {
  if (sent.total === 0) return "No data";
  const bullPct = Math.round((sent.bullish / sent.total) * 100);
  const bearPct = Math.round((sent.bearish / sent.total) * 100);
  const neuPct = 100 - bullPct - bearPct;
  const bullBars = Math.round(bullPct / 5);
  const bearBars = Math.round(bearPct / 5);
  const neuBars = Math.round(neuPct / 5);
  return `BULL ${bullPct}% ${"■".repeat(bullBars)} | NEU ${neuPct}% ${"■".repeat(neuBars)} | BEAR ${bearPct}% ${"■".repeat(bearBars)}`;
}

async function fetchCryptoPanic(query: string): Promise<SocialItem[]> {
  try {
    const url = `https://cryptopanic.com/api/v1/posts/?kind=news&filter=hot${query ? `&currencies=${encodeURIComponent(query)}` : ""}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = await res.json() as { results?: { id: number; title: string; published_at: string; url: string }[] };
    return (data.results ?? []).slice(0, 20).map((post) => {
      const sentiment = scoreSentiment(post.title);
      return {
        id: `cp-${post.id}`,
        text: post.title,
        source: "cryptopanic" as const,
        sentiment,
        timestamp: new Date(post.published_at).getTime(),
        url: post.url,
      };
    });
  } catch {
    return [];
  }
}

async function fetchNitterRss(query: string): Promise<SocialItem[]> {
  const instances = [
    "https://nitter.net",
    "https://nitter.privacydev.net",
    "https://nitter.poast.org",
  ];

  for (const instance of instances) {
    try {
      const url = `${instance}/search/rss?f=tweets&q=${encodeURIComponent(query || "polymarket predict")}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const text = await res.text();
      const items: SocialItem[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let m: RegExpExecArray | null;
      while ((m = itemRegex.exec(text)) !== null) {
        const titleMatch = m[1].match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/);
        const linkMatch = m[1].match(/<link>([\s\S]*?)<\/link>/);
        const dateMatch = m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        const title = titleMatch ? titleMatch[1].trim() : "";
        const link = linkMatch ? linkMatch[1].trim() : "";
        const ts = dateMatch ? new Date(dateMatch[1]).getTime() : Date.now();
        if (!title) continue;
        items.push({
          id: `nitter-${ts}-${Math.random().toString(36).slice(2, 6)}`,
          text: title,
          source: "nitter" as const,
          sentiment: scoreSentiment(title),
          timestamp: isNaN(ts) ? Date.now() : ts,
          url: link,
        });
        if (items.length >= 20) break;
      }
      if (items.length > 0) return items;
    } catch {
      continue;
    }
  }
  return [];
}

export function SocialPanel() {
  const { theme } = useTheme();
  const [loading, setLoading] = createSignal(false);

  const selectedMarket = createMemo(
    () => appState.markets.find((m) => m.id === appState.selectedMarketId) ?? null
  );

  const query = createMemo(() => {
    const m = selectedMarket();
    if (!m) return "polymarket";
    const words = m.title.split(/\s+/).filter((w) => w.length > 3).slice(0, 3);
    return words.join(" ") || "polymarket";
  });

  onMount(async () => {
    if (socialItems().length === 0) {
      setLoading(true);
      try {
        const [cpItems, nitterItems] = await Promise.allSettled([
          fetchCryptoPanic(query()),
          fetchNitterRss(query()),
        ]);
        const all: SocialItem[] = [
          ...(cpItems.status === "fulfilled" ? cpItems.value : []),
          ...(nitterItems.status === "fulfilled" ? nitterItems.value : []),
        ].sort((a, b) => b.timestamp - a.timestamp);
        setSocialItems(all);
        setSocialSentiment(calcSentiment(all));
      } finally {
        setLoading(false);
      }
    }
  });

  const sent = createMemo(() => socialSentiment());

  function sentColor(s: "bullish" | "bearish" | "neutral") {
    if (s === "bullish") return theme.success;
    if (s === "bearish") return theme.error;
    return theme.textMuted;
  }

  function sentLabel(s: "bullish" | "bearish" | "neutral") {
    if (s === "bullish") return "▲BULL";
    if (s === "bearish") return "▼BEAR";
    return "─NEU ";
  }

  const bullPct = () => sent().total > 0 ? Math.round((sent().bullish / sent().total) * 100) : 0;
  const bearPct = () => sent().total > 0 ? Math.round((sent().bearish / sent().total) * 100) : 0;
  const neuPct = () => 100 - bullPct() - bearPct();

  const sentMeter = (pct: number, _color: "bull" | "bear" | "neu") => {
    const width = 10;
    const filled = Math.max(0, Math.round(pct / 100 * width));
    return "█".repeat(filled) + "░".repeat(width - filled);
  };

  return (
    <box
      position="absolute"
      top={2}
      left="8%"
      width="84%"
      height={24}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={160}
    >
      {/* Header */}
      <PanelHeader
        title="SOCIAL SENTIMENT"
        icon="◈"
        subtitle={selectedMarket() ? truncate((selectedMarket() as unknown as Market).title, 32) : `${socialItems().length} posts`}
        onClose={() => setSocialPanelOpen(false)}
      />

      {/* Sentiment gauge row */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} flexDirection="row" paddingLeft={2}>
        <Show
          when={sent().total > 0}
          fallback={<text content="Awaiting data…" fg={theme.textMuted} />}
        >
          <text content="BULL " fg={theme.textMuted} />
          <text content={`${bullPct()}%`} fg={theme.success} />
          <text content=" " />
          <text content={sentMeter(bullPct(), "bull")} fg={theme.success} />
          <text content="  NEU " fg={theme.textMuted} />
          <text content={`${neuPct()}%`} fg={theme.textMuted} />
          <text content=" " />
          <text content={sentMeter(neuPct(), "neu")} fg={theme.textMuted} />
          <text content="  BEAR " fg={theme.textMuted} />
          <text content={`${bearPct()}%`} fg={theme.error} />
          <text content=" " />
          <text content={sentMeter(bearPct(), "bear")} fg={theme.error} />
          <box flexGrow={1} />
          <text content={`${sent().total} posts  `} fg={theme.textMuted} />
        </Show>
      </box>

      <Separator type="heavy" />

      <Show when={loading()}>
        <box flexGrow={1} paddingTop={1}>
          <LoadingState message="Fetching social feeds (CryptoPanic + Nitter)…" />
        </box>
      </Show>

      <Show when={!loading()}>
        {/* Column headers */}
        <box flexDirection="row" width="100%" paddingLeft={1} backgroundColor={theme.backgroundPanel}>
          <text content={"SOURCE".padEnd(12)} fg={theme.textMuted} width={12} />
          <text content={"AGE".padEnd(6)} fg={theme.textMuted} width={6} />
          <text content={"SENT".padEnd(6)} fg={theme.textMuted} width={6} />
          <text content="POST" fg={theme.textMuted} />
        </box>

        <Show
          when={socialItems().length > 0}
          fallback={
            <box flexGrow={1} paddingLeft={2} paddingTop={1}>
              <text content="No social data available." fg={theme.textMuted} />
              <text content="CryptoPanic or Nitter RSS may be unavailable." fg={theme.textMuted} />
            </box>
          }
        >
          <scrollbox height={19} width="100%" paddingLeft={1}>
            <For each={socialItems()}>
              {(item, i) => {
                const prevItem = () => socialItems()[i() - 1];
                const showSep = () => i() > 0 && prevItem()?.source !== item.source;
                return (
                  <>
                    <Show when={showSep()}>
                      <text
                        content={`─── ${item.source === "cryptopanic" ? "CRYPTOPANIC" : "NITTER"} ────────────────────────────────────`}
                        fg={theme.borderSubtle}
                      />
                    </Show>
                    <box flexDirection="row" width="100%">
                      <text
                        content={(item.source === "cryptopanic" ? "CryptoPanic" : "Nitter     ").slice(0, 11).padEnd(11, " ")}
                        fg={item.source === "cryptopanic" ? theme.accent : theme.primary}
                        width={12}
                      />
                      <text content={fmtAge(item.timestamp).padEnd(5, " ")} fg={theme.textMuted} width={6} />
                      <text
                        content={sentLabel(item.sentiment).padEnd(6, " ")}
                        fg={sentColor(item.sentiment)}
                        width={7}
                      />
                      <text content={truncate(item.text, 80)} fg={theme.text} />
                    </box>
                  </>
                );
              }}
            </For>
          </scrollbox>
        </Show>
      </Show>

      {/* Footer */}
      <Separator type="light" />
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} paddingLeft={2} flexDirection="row">
        <text content="[↑↓] Scroll   " fg={theme.textMuted} />
        <text content="[T] Close   " fg={theme.textMuted} />
        <text content="Source: CryptoPanic + Nitter RSS  " fg={theme.textMuted} />
        <box flexGrow={1} />
        <text content={`● = BULL  ○ = BEAR  ${sent().total} posts  `} fg={theme.textMuted} />
      </box>
    </box>
  );
}
