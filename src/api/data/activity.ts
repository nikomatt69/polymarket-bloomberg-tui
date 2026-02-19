/**
 * Polymarket Data API - Activity
 * User activity and transaction history
 * Base: https://data-api.polymarket.com
 */

const DATA_API_BASE = "https://data-api.polymarket.com";

export interface ActivityItem {
  id: string;
  type: "trade" | "deposit" | "withdrawal" | "transfer" | "redeem";
  asset?: string;
  outcome?: string;
  marketTitle?: string;
  side?: "buy" | "sell";
  size?: number;
  price?: number;
  value?: number;
  timestamp: number;
  status: "pending" | "completed" | "failed";
  txHash?: string;
}

interface DataApiActivity {
  id?: string;
  type?: string;
  asset?: string;
  outcome?: string;
  title?: string;
  side?: string;
  size?: number;
  price?: number;
  value?: number;
  timestamp?: number;
  status?: string;
  transactionHash?: string;
}

function parseActivityItem(raw: DataApiActivity): ActivityItem {
  const type = (raw.type ?? "trade") as ActivityItem["type"];
  const status = (raw.status ?? "completed") as ActivityItem["status"];

  return {
    id: raw.id ?? `activity-${Date.now()}-${Math.random()}`,
    type,
    asset: raw.asset,
    outcome: raw.outcome,
    marketTitle: raw.title,
    side: raw.side === "sell" ? "sell" : "buy",
    size: raw.size,
    price: raw.price,
    value: raw.value,
    timestamp: raw.timestamp ?? Date.now(),
    status,
    txHash: raw.transactionHash,
  };
}

export async function fetchActivity(address: string, limit: number = 50): Promise<ActivityItem[]> {
  try {
    const response = await fetch(
      `${DATA_API_BASE}/activity?user=${encodeURIComponent(address)}&limit=${limit}`
    );

    if (!response.ok) {
      console.error(`Activity API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    return (data as DataApiActivity[]).map(parseActivityItem);
  } catch (error) {
    console.error("Failed to fetch activity:", error);
    return [];
  }
}

export async function fetchRecentActivity(address: string, hours: number = 24): Promise<ActivityItem[]> {
  const allActivity = await fetchActivity(address, 100);
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  return allActivity.filter(a => a.timestamp >= cutoff);
}
