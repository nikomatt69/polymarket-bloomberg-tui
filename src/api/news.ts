/**
 * News API — RSS feed fetcher for Bloomberg-style news panel.
 * All feeds are public, no API key required.
 */

import type { NewsItem } from "../state";

interface FeedDef {
  url: string;
  source: string;
  category: string;
}

const RSS_FEEDS: FeedDef[] = [
  { url: "https://feeds.reuters.com/reuters/businessNews", source: "Reuters", category: "business" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk", category: "crypto" },
  { url: "https://decrypt.co/feed", source: "Decrypt", category: "crypto" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", source: "BBC", category: "business" },
  { url: "https://rsshub.app/apnews/topics/business", source: "AP News", category: "business" },
];

function extractCdata(text: string): string {
  const m = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1].trim() : text.replace(/<[^>]+>/g, "").trim();
}

function parseRssItem(xml: string, source: string, category: string): NewsItem | null {
  try {
    const titleMatch = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const linkMatch = xml.match(/<link[^>]*>([\s\S]*?)<\/link>/) || xml.match(/<link\s+href="([^"]+)"/);
    const pubDateMatch = xml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || xml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/);
    const descMatch = xml.match(/<description[^>]*>([\s\S]*?)<\/description>/) || xml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);

    const title = titleMatch ? extractCdata(titleMatch[1]) : null;
    const url = linkMatch ? extractCdata(linkMatch[1]).trim() : "";
    const summary = descMatch ? extractCdata(descMatch[1]).slice(0, 300) : "";
    const pubDateStr = pubDateMatch ? extractCdata(pubDateMatch[1]) : "";
    const publishedAt = pubDateStr ? new Date(pubDateStr).getTime() : Date.now();

    if (!title || title.length < 5) return null;

    return {
      id: `${source}-${publishedAt}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      source,
      url,
      publishedAt: isNaN(publishedAt) ? Date.now() : publishedAt,
      category,
      summary,
    };
  } catch {
    return null;
  }
}

async function fetchFeedNews(feed: FeedDef): Promise<NewsItem[]> {
  const response = await fetch(feed.url, {
    signal: AbortSignal.timeout(8000),
    headers: { "Accept": "application/rss+xml, application/xml, text/xml, */*" },
  });
  if (!response.ok) return [];
  const text = await response.text();

  const items: NewsItem[] = [];
  // Split on <item> or <entry> tags (Atom feeds use <entry>)
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(text)) !== null) {
    const item = parseRssItem(match[1], feed.source, feed.category);
    if (item) items.push(item);
    if (items.length >= 20) break;
  }
  return items;
}

export async function fetchAllNews(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map((feed) => fetchFeedNews(feed))
  );

  const all: NewsItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      all.push(...result.value);
    }
  }

  // Sort by newest first
  return all.sort((a, b) => b.publishedAt - a.publishedAt);
}

export async function fetchNewsForQuery(query: string, limit = 10): Promise<NewsItem[]> {
  const all = await fetchAllNews();
  if (!query.trim()) return all.slice(0, limit);

  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const scored = all.map((item) => {
    const text = `${item.title} ${item.summary} ${item.category}`.toLowerCase();
    const score = words.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.item.publishedAt - a.item.publishedAt)
    .slice(0, limit)
    .map((s) => s.item);
}

export function filterNewsForMarket(news: NewsItem[], marketTitle: string): NewsItem[] {
  const words = marketTitle
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  return news.filter((item) => {
    const text = `${item.title} ${item.summary}`.toLowerCase();
    return words.some((w) => text.includes(w));
  });
}
