/**
 * Polymarket Gamma API - Categories
 * Uses /tags endpoint (the real Polymarket category system)
 */

import { Category } from "../../types/market";
import { getTags, getTagId } from "./tags";

export async function getCategories(): Promise<Category[]> {
  try {
    const tags = await getTags();
    return tags.map((tag) => ({
      slug: tag.slug,
      name: tag.name,
      marketsCount: 0,
    }));
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return POLYMARKET_CATEGORIES.map((c) => ({
      slug: c.tagSlug,
      name: c.label,
      marketsCount: 0,
    }));
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const tags = await getTags();
    const found = tags.find(
      (t) => t.slug.toLowerCase() === slug.toLowerCase() || t.name.toLowerCase() === slug.toLowerCase()
    );
    if (!found) return null;
    return { slug: found.slug, name: found.name, marketsCount: 0 };
  } catch (error) {
    console.error("Failed to fetch category:", error);
    return null;
  }
}

/**
 * Resolve a display category ID (e.g. "Sports") to its numeric tag_id.
 * Falls back to slug-based lookup if the static mapping doesn't match.
 */
export async function getCategoryTagId(categoryId: string): Promise<number | null> {
  const cat = POLYMARKET_CATEGORIES.find(
    (c) => c.id === categoryId || c.label === categoryId
  );
  const slug = cat?.tagSlug ?? categoryId.toLowerCase();
  return getTagId(slug);
}

// Static display list — enriched with live tag IDs at runtime via getCategoryTagId()
export const POLYMARKET_CATEGORIES = [
  { id: "Sports",         label: "Sports",         emoji: "⚽", tagSlug: "sports" },
  { id: "Politics",       label: "Politics",       emoji: "🏛️", tagSlug: "politics" },
  { id: "Crypto",         label: "Crypto",         emoji: "₿",  tagSlug: "cryptocurrency" },
  { id: "Business",       label: "Business",       emoji: "📊", tagSlug: "economics" },
  { id: "Entertainment",  label: "Entertainment",  emoji: "🎬", tagSlug: "pop-culture" },
  { id: "Science",        label: "Science",        emoji: "🔬", tagSlug: "science" },
  { id: "AI",             label: "AI",             emoji: "🤖", tagSlug: "artificial-intelligence" },
  { id: "World",          label: "World",          emoji: "🌍", tagSlug: "world" },
  { id: "Tech",           label: "Tech",           emoji: "💻", tagSlug: "technology" },
  { id: "Climate",        label: "Climate",        emoji: "🌿", tagSlug: "climate-and-environment" },
  { id: "Health",         label: "Health",         emoji: "🏥", tagSlug: "health" },
] as const;

export type PolymarketCategoryId = typeof POLYMARKET_CATEGORIES[number]["id"];
