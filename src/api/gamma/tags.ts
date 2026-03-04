/**
 * Polymarket Gamma API - Tags
 * Base: https://gamma-api.polymarket.com
 */

import { Market, Tag } from "../../types/market";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

interface GammaMarket {
  id: string;
  question: string | null;
  conditionId: string;
  slug: string | null;
  endDate: string | null;
  category: string | null;
  liquidity: string | null;
  description: string | null;
  outcomes: string | null;
  outcomePrices: string | null;
  volume: string | null;
  active: boolean | null;
  closed: boolean | null;
  volumeNum: number | null;
  liquidityNum: number | null;
  volume24hr: number | null;
  oneDayPriceChange: number | null;
  clobTokenIds: string | null;
  groupItemTitle?: string | null;
  tags?: string[] | null;
}

interface GammaTag {
  id: number | string;
  slug: string;
  label: string;
  forceActive?: boolean;
  count?: number;
}

// ── Tag cache (5-min TTL) ──────────────────────────────────────────────────

interface CachedTag {
  id: number;
  slug: string;
  label: string;
  forceActive: boolean;
  count: number;
}

let tagCache: CachedTag[] | null = null;
let tagCacheTtl = 0;
const TAG_CACHE_TTL_MS = 5 * 60 * 1000;

async function loadTags(): Promise<CachedTag[]> {
  const now = Date.now();
  if (tagCache && now < tagCacheTtl) return tagCache;

  try {
    const response = await fetch(`${GAMMA_API_BASE}/tags?limit=200`);
    if (!response.ok) throw new Error(`Tags API error: ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) return tagCache ?? [];

    tagCache = (data as GammaTag[]).map((item) => ({
      id: typeof item.id === "number" ? item.id : parseInt(String(item.id), 10),
      slug: item.slug,
      label: item.label,
      forceActive: item.forceActive ?? false,
      count: item.count ?? 0,
    }));
    tagCacheTtl = now + TAG_CACHE_TTL_MS;
    return tagCache;
  } catch (error) {
    console.error("Failed to load tags:", error);
    return tagCache ?? [];
  }
}

/**
 * Resolve a tag slug to its numeric ID. Returns null if not found.
 */
export async function getTagId(slug: string): Promise<number | null> {
  const tags = await loadTags();
  const found = tags.find((t) => t.slug.toLowerCase() === slug.toLowerCase());
  return found ? found.id : null;
}

/**
 * Get all tags (cached, with numeric IDs).
 */
export async function getTags(): Promise<Tag[]> {
  const tags = await loadTags();
  return tags.map((t) => ({
    id: String(t.id),
    slug: t.slug,
    name: t.label,
  }));
}

export async function getTagBySlug(tagSlug: string): Promise<Tag | null> {
  const tags = await loadTags();
  const found = tags.find((t) => t.slug.toLowerCase() === tagSlug.toLowerCase());
  if (!found) return null;
  return { id: String(found.id), slug: found.slug, name: found.label };
}

// ── Helper parsers (duplicated to avoid circular deps) ───────────────────

function parseNumeric(value: unknown, fallback: number = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseGammaMarket(market: GammaMarket): Market {
  const outcomes = parseJsonArray(market.outcomes);
  const outcomePrices = parseJsonArray(market.outcomePrices).map((v) => parseNumeric(v, 0.5));
  const clobTokenIds = parseJsonArray(market.clobTokenIds);
  const normalizedOutcomes = outcomes.length > 0 ? outcomes : ["Yes", "No"];

  return {
    id: market.id,
    title: market.question || "Unknown Market",
    description: market.description || "",
    outcomes: normalizedOutcomes.map((title: string, i: number) => ({
      id: clobTokenIds[i] || `outcome_${i}`,
      title,
      price: parseNumeric(outcomePrices[i], 0.5),
      volume24h: 0,
      volume: 0,
      liquidity: 0,
      change24h: 0,
    })),
    volume24h: parseNumeric(market.volume24hr, 0),
    volume: parseNumeric(market.volume, 0),
    liquidity: parseNumeric(market.liquidity, parseNumeric(market.liquidityNum, 0)),
    change24h: parseNumeric(market.oneDayPriceChange, 0),
    openInterest: 0,
    resolutionDate: market.endDate ? new Date(market.endDate) : undefined,
    totalTrades: 0,
    category: market.category || "general",
    closed: market.closed || false,
    resolved: false,
  };
}

/**
 * Fetch markets by numeric tag_id (preferred) or tag slug.
 */
export async function getMarketsByTag(
  tagIdOrSlug: string | number,
  limit: number = 50,
  offset: number = 0
): Promise<Market[]> {
  try {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("closed", "false");
    params.set("active", "true");
    params.set("order", "volumeNum");
    params.set("ascending", "false");

    if (typeof tagIdOrSlug === "number") {
      params.set("tag_id", String(tagIdOrSlug));
    } else {
      const numericId = parseInt(tagIdOrSlug, 10);
      if (!Number.isNaN(numericId)) {
        params.set("tag_id", String(numericId));
      } else {
        // Try to resolve slug to ID
        const id = await getTagId(tagIdOrSlug);
        if (id !== null) {
          params.set("tag_id", String(id));
        } else {
          params.set("tag", tagIdOrSlug);
        }
      }
    }

    const response = await fetch(`${GAMMA_API_BASE}/markets?${params.toString()}`);
    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data
      .map((item) => parseGammaMarket(item as GammaMarket))
      .filter((market) => market.outcomes.length > 0);
  } catch (error) {
    console.error("Failed to fetch markets by tag:", error);
    return [];
  }
}
