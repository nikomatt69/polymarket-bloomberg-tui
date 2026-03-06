/**
 * Search Panel — full overlay market search with category tabs and sort filters.
 * Opens when user clicks the search bar or presses [/].
 * Keyboard: ESC close, ↑↓ navigate, Enter select, Tab cycle category.
 *
 * IMPORTANT: This panel searches the LIVE Polymarket API, not just locally loaded markets.
 * When user types a query, it calls gamma-api.polymarket.com to find ALL matching markets.
 */

import { createSignal, createMemo, For, Show, createEffect } from "solid-js";
import { useTheme } from "../context/theme";
import {
  appState,
  updateSearchQuery,
  getFilteredMarkets,
  selectMarket,
  navigateToIndex,
  searchPanelCategory,
  setSearchPanelCategory,
  searchPanelResultIdx,
  setSearchPanelResultIdx,
  setSearchPanelOpen,
  setMarkets,
} from "../state";
import { formatVolume } from "../utils/format";
import { isWatched } from "../hooks/useWatchlist";
import { searchMarketsByQuery } from "../api/gamma/search";
import { getMarketDetails } from "../api/gamma/markets";
import { Market } from "../types/market";

// ─── Panel category definitions ───────────────────────────────────────────────

const PANEL_CATEGORIES = [
  { id: "all",           label: "All",      match: ""           },
  { id: "sports",        label: "Sports",   match: "sport"      },
  { id: "politics",      label: "Politics", match: "polit"      },
  { id: "crypto",        label: "Crypto",   match: "crypto"     },
  { id: "business",      label: "Biz",      match: "business"   },
  { id: "ai",            label: "AI",       match: "ai"         },
  { id: "tech",          label: "Tech",     match: "tech"       },
  { id: "science",       label: "Sci",      match: "science"    },
  { id: "entertainment", label: "Ent",      match: "entertain"  },
] as const;

type SortKey = "volume" | "change" | "liquidity" | "name";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "volume",    label: "Vol" },
  { key: "change",    label: "Chg" },
  { key: "liquidity", label: "Liq" },
  { key: "name",      label: "ABC" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryBadge(category: string | undefined): string {
  const cat = (category ?? "").toLowerCase();
  if (cat.includes("sport"))   return "SPO";
  if (cat.includes("polit"))   return "POL";
  if (cat.includes("crypto"))  return "CRY";
  if (cat.includes("business") || cat.includes("econ")) return "BIZ";
  if (cat.includes("ai"))      return " AI";
  if (cat.includes("tech"))    return "TEC";
  if (cat.includes("science")) return "SCI";
  if (cat.includes("entertain")) return "ENT";
  return "GEN";
}

function formatExpiry(resolutionDate: Date | undefined): { text: string; level: "ok" | "warn" | "critical" } {
  if (!resolutionDate) return { text: " ---", level: "ok" };
  const diffMs = resolutionDate.getTime() - Date.now();
  if (diffMs <= 0) return { text: "RES!", level: "critical" };
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return { text: "tod!", level: "critical" };
  if (days <= 2)  return { text: `${days}d⚠ `, level: "warn" };
  if (days <= 7)  return { text: `  ${days}d `, level: "warn" };
  if (days > 30)  return { text: `${Math.floor(days / 30)}mo `, level: "ok" };
  return { text: `${days.toString().padStart(2, " ")}d  `, level: "ok" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchPanel() {
  const { theme } = useTheme();
  const [sort, setSort] = createSignal<SortKey>("volume");
  const [apiResults, setApiResults] = createSignal<Market[]>([]);
  const [searching, setSearching] = createSignal(false);

  // Debounced search - call Polymarket API when user types
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  createEffect(() => {
    const query = appState.searchQuery;

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }

    // If no query, use local markets
    if (!query || query.trim().length === 0) {
      setApiResults([]);
      setSearching(false);
      return;
    }

    // Debounce API calls (300ms)
    setSearching(true);
    searchTimeout = setTimeout(async () => {
      try {
        // Call Polymarket's live API search
        const results = await searchMarketsByQuery(query.trim(), 50, 0);
        setApiResults(results);
      } catch (error) {
        console.error("API search error:", error);
        setApiResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  });

  const results = createMemo(() => {
    // If we have API results (user typed a query), use those
    const api = apiResults();
    if (api.length > 0) {
      const s = sort();
      let sorted = [...api];
      if (s === "volume") {
        sorted = sorted.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      } else if (s === "change") {
        sorted = sorted.sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0));
      } else if (s === "liquidity") {
        sorted = sorted.sort((a, b) => (b.liquidity ?? 0) - (a.liquidity ?? 0));
      } else if (s === "name") {
        sorted = sorted.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
      }
      return sorted;
    }

    // Otherwise, fall back to local filtered markets
    const all = getFilteredMarkets();
    const catId = searchPanelCategory();
    const catDef = PANEL_CATEGORIES.find((c) => c.id === catId);
    const matchStr = catDef?.match ?? "";

    let filtered = matchStr === ""
      ? all
      : all.filter((m) => (m.category ?? "").toLowerCase().includes(matchStr));

    const s = sort();
    if (s === "volume") {
      filtered = [...filtered].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    } else if (s === "change") {
      filtered = [...filtered].sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0));
    } else if (s === "liquidity") {
      filtered = [...filtered].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
    } else if (s === "name") {
      filtered = [...filtered].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    }

    return filtered;
  });

  const categoryCounts = createMemo(() => {
    const all = getFilteredMarkets();
    const counts: Record<string, number> = { all: all.length };
    for (const cat of PANEL_CATEGORIES) {
      if (cat.match === "") continue;
      counts[cat.id] = all.filter((m) =>
        (m.category ?? "").toLowerCase().includes(cat.match)
      ).length;
    }
    return counts;
  });

  async function selectResult(idx: number) {
    const market = results()[idx];
    if (!market) return;

    // Check if market is already in local state
    const allFiltered = getFilteredMarkets();
    const listIdx = allFiltered.findIndex((m) => m.id === market.id);

    if (listIdx >= 0) {
      // Market is in local list - just navigate to it
      selectMarket(market.id);
      navigateToIndex(listIdx);
    } else {
      // Market not in local list - fetch details and add it
      try {
        const details = await getMarketDetails(market.id);
        if (details) {
          // Add to local markets
          setMarkets([details, ...appState.markets]);
          selectMarket(details.id);
          navigateToIndex(0);
        } else {
          // Fallback: just select by ID (may lack full details)
          selectMarket(market.id);
        }
      } catch (error) {
        console.error("Failed to fetch market details:", error);
        selectMarket(market.id);
      }
    }
    setSearchPanelOpen(false);
  }

  return (
    <box
      position="absolute"
      top={1}
      left="5%"
      width="90%"
      height={32}
      backgroundColor={theme.panelModal}
      flexDirection="column"
      zIndex={200}
    >
      {/* ── Header ── */}
      <box height={1} width="100%" backgroundColor={theme.primary} flexDirection="row">
        <text content=" ◈ MARKET SEARCH " fg={theme.highlightText} />
        <text content="│ " fg={theme.primaryMuted} />
        <text
          content={appState.searchQuery ? `"${appState.searchQuery}"` : "type to filter markets"}
          fg={theme.primaryMuted}
        />
        <box flexGrow={1} />
        <Show when={searching()}>
          <text content="⟳ " fg={theme.warning} />
        </Show>
        <text content={`${results().length} results `} fg={theme.primaryMuted} />
        <Show when={apiResults().length > 0}>
          <text content="(API) " fg={theme.accent} />
        </Show>
        <box onMouseDown={() => setSearchPanelOpen(false)}>
          <text content=" [ESC] ✕ " fg={theme.highlightText} />
        </box>
      </box>

      {/* ── Search Input ── */}
      <box height={1} width="100%" flexDirection="row" paddingLeft={1} backgroundColor={theme.background}>
        <text content="▶ " fg={theme.accent} />
        <input
          width="80%"
          value={appState.searchQuery}
          focused={true}
          onInput={(value: string) => {
            updateSearchQuery(value);
            setSearchPanelResultIdx(0);
          }}
        />
        <box flexGrow={1} />
        <text content="↑↓ nav  Enter select " fg={theme.textMuted} />
      </box>

      {/* ── Category Tabs ── */}
      <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel}>
        <text content=" " fg={theme.textMuted} />
        <For each={PANEL_CATEGORIES}>
          {(cat) => {
            const count = () => categoryCounts()[cat.id] ?? 0;
            const active = () => searchPanelCategory() === cat.id;
            const label = () => count() > 0 ? `${cat.label}(${count()})` : cat.label;
            return (
              <box
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={active() ? theme.accent : undefined}
                onMouseDown={() => {
                  setSearchPanelCategory(cat.id);
                  setSearchPanelResultIdx(0);
                }}
              >
                <text
                  content={label()}
                  fg={active() ? theme.background : theme.textMuted}
                />
              </box>
            );
          }}
        </For>
      </box>

      {/* ── Sort + Hint Row ── */}
      <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel} paddingLeft={1}>
        <text content="Sort: " fg={theme.textMuted} />
        <For each={SORT_OPTIONS}>
          {(opt) => (
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={sort() === opt.key ? theme.primary : undefined}
              onMouseDown={() => setSort(opt.key)}
            >
              <text
                content={opt.label}
                fg={sort() === opt.key ? theme.highlightText : theme.textMuted}
              />
            </box>
          )}
        </For>
        <text content="  │  " fg={theme.borderSubtle} />
        <text content="[Tab] category  [/] refocus search" fg={theme.textMuted} />
      </box>

      {/* ── Column Headers ── */}
      <box height={1} width="100%" flexDirection="row" backgroundColor={theme.backgroundPanel} paddingLeft={1}>
        <text content={"  #"} fg={theme.textMuted} width={4} />
        <text content={"★"} fg={theme.textMuted} width={2} />
        <text content={"TITLE".padEnd(33)} fg={theme.textMuted} width={34} />
        <text content={"CAT"} fg={theme.textMuted} width={4} />
        <text content={"PROB".padStart(6)} fg={theme.textMuted} width={7} />
        <text content={"VOLUME".padStart(9)} fg={theme.textMuted} width={10} />
        <text content={"EXP"} fg={theme.textMuted} width={5} />
      </box>

      {/* ── Results list ── */}
      <Show when={results().length === 0}>
        <box flexGrow={1} paddingLeft={2} paddingTop={1} flexDirection="column">
          <Show when={searching()}>
            <text content="⟳ Searching Polymarket..." fg={theme.warning} />
            <text content="" />
          </Show>
          <Show when={!searching()}>
            <text
              content={appState.searchQuery
                ? `✗ No markets found on Polymarket for "${appState.searchQuery}".`
                : "○ No markets in this category."}
              fg={theme.textMuted}
            />
            <text content="" />
            <text
              content={appState.searchQuery
                ? "Try different keywords or check spelling."
                : "Switch category or wait for markets to load."}
              fg={theme.textMuted}
            />
          </Show>
        </box>
      </Show>

      <Show when={results().length > 0}>
        <scrollbox flexGrow={1} width="100%">
          <For each={results()}>
            {(market, idx) => {
              const isSelected = () => searchPanelResultIdx() === idx();
              const watched = () => isWatched(market.id);
              const bestProb = () => {
                const prices = (market.outcomes ?? []).map((o) => o.price ?? 0);
                return prices.length > 0 ? Math.max(...prices) : 0;
              };
              const expiry = () => formatExpiry(market.resolutionDate);
              const catBadge = () => getCategoryBadge(market.category);

              return (
                <box
                  flexDirection="row"
                  width="100%"
                  paddingLeft={1}
                  backgroundColor={isSelected() ? theme.highlight : undefined}
                  onMouseDown={() => selectResult(idx())}
                >
                  <text
                    content={(idx() + 1).toString().padStart(3)}
                    fg={isSelected() ? theme.highlightText : theme.textMuted}
                    width={4}
                  />
                  <text
                    content={watched() ? "★" : "○"}
                    fg={watched() ? theme.warning : theme.textMuted}
                    width={2}
                  />
                  <text
                    content={(market.title ?? "—").slice(0, 32).padEnd(33)}
                    fg={isSelected() ? theme.highlightText : theme.text}
                    width={34}
                  />
                  <text
                    content={catBadge()}
                    fg={isSelected() ? theme.highlightText : theme.accent}
                    width={4}
                  />
                  <text
                    content={((bestProb() * 100).toFixed(0) + "%").padStart(6)}
                    fg={
                      isSelected()
                        ? theme.highlightText
                        : bestProb() > 0.6
                        ? theme.success
                        : bestProb() < 0.4
                        ? theme.error
                        : theme.warning
                    }
                    width={7}
                  />
                  <text
                    content={formatVolume(market.volume ?? 0).padStart(9)}
                    fg={isSelected() ? theme.highlightText : theme.textMuted}
                    width={10}
                  />
                  <text
                    content={expiry().text}
                    fg={
                      isSelected()
                        ? theme.highlightText
                        : expiry().level === "critical"
                        ? theme.error
                        : expiry().level === "warn"
                        ? theme.warning
                        : theme.textMuted
                    }
                    width={5}
                  />
                </box>
              );
            }}
          </For>
        </scrollbox>
      </Show>

      {/* ── Footer ── */}
      <box height={1} width="100%" backgroundColor={theme.backgroundPanel} paddingLeft={1} flexDirection="row">
        <text content="[↑↓] Navigate  " fg={theme.textMuted} />
        <text content="[Enter] Open market  " fg={theme.textMuted} />
        <text content="[Tab] Next category  " fg={theme.textMuted} />
        <text content="[Shift+Tab] Prev  " fg={theme.textMuted} />
        <text content="[ESC] Close" fg={theme.textMuted} />
      </box>
    </box>
  );
}
