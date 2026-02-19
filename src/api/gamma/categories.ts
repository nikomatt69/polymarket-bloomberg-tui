/**
 * Polymarket Gamma API - Categories
 * Base: https://gamma-api.polymarket.com
 */

import { Category } from "../../types/market";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export async function getCategories(): Promise<Category[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/categories`);

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: { category?: string; slug?: string; count?: number }) => ({
      slug: item.category || item.slug || "",
      name: item.category || item.slug || "",
      marketsCount: item.count || 0,
    }));
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const categories = await getCategories();
    return categories.find(c => c.slug.toLowerCase() === slug.toLowerCase()) || null;
  } catch (error) {
    console.error("Failed to fetch category:", error);
    return null;
  }
}

// Predefined category list matching Polymarket's case-sensitive categories
export const POLYMARKET_CATEGORIES = [
  { id: "Sports", label: "Sports", emoji: "⚽" },
  { id: "Politics", label: "Politics", emoji: "🏛️" },
  { id: "Crypto", label: "Crypto", emoji: "₿" },
  { id: "Business", label: "Business", emoji: "📊" },
  { id: "Entertainment", label: "Entertainment", emoji: "🎬" },
  { id: "Science", label: "Science", emoji: "🔬" },
  { id: "AI", label: "AI", emoji: "🤖" },
  { id: "NFTs", label: "NFTs", emoji: "🖼️" },
  { id: "Coronavirus", label: "Coronavirus", emoji: "🦠" },
] as const;

export type PolymarketCategoryId = typeof POLYMARKET_CATEGORIES[number]["id"];
