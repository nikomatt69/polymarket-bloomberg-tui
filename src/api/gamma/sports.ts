/**
 * Polymarket Gamma API - Sports Metadata
 * Base: https://gamma-api.polymarket.com
 */

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export interface SportsTeam {
  id: string;
  name: string;
  abbreviation: string;
  league: string;
  imageUrl?: string;
}

export interface SportsMarketType {
  type: string;
  description: string;
}

export interface SportsMetadata {
  leagues: string[];
  marketTypes: SportsMarketType[];
}

// Cache for sports metadata
let metadataCache: SportsMetadata | null = null;
let metadataCacheTime = 0;
const METADATA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function parseTeam(item: Record<string, unknown>): SportsTeam {
  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    abbreviation: String(item.abbreviation || ""),
    league: String(item.league || ""),
    imageUrl: item.imageUrl ? String(item.imageUrl) : undefined,
  };
}

function parseMarketType(item: Record<string, unknown>): SportsMarketType {
  return {
    type: String(item.type || item.sportsMarketType || ""),
    description: String(item.description || ""),
  };
}

export async function getTeams(league?: string, limit: number = 100): Promise<SportsTeam[]> {
  try {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (league) params.set("league", league);

    const response = await fetch(`${GAMMA_API_BASE}/teams?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Teams API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item) => parseTeam(item as Record<string, unknown>));
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    return [];
  }
}

export async function getTeamById(teamId: string): Promise<SportsTeam | null> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/teams?id=${encodeURIComponent(teamId)}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return parseTeam(data[0] as Record<string, unknown>);
  } catch (error) {
    console.error("Failed to fetch team:", error);
    return null;
  }
}

export async function getTeamByAbbreviation(abbreviation: string): Promise<SportsTeam | null> {
  try {
    const teams = await getTeams();
    return teams.find(
      (t) => t.abbreviation.toLowerCase() === abbreviation.toLowerCase()
    ) || null;
  } catch (error) {
    console.error("Failed to find team by abbreviation:", error);
    return null;
  }
}

export async function getValidSportsMarketTypes(): Promise<SportsMarketType[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/sports-market-types`);

    if (!response.ok) {
      throw new Error(`Sports market types API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item) => parseMarketType(item as Record<string, unknown>));
  } catch (error) {
    console.error("Failed to fetch sports market types:", error);
    return [];
  }
}

export async function getSportsMetadata(forceRefresh = false): Promise<SportsMetadata> {
  const now = Date.now();

  if (!forceRefresh && metadataCache && now - metadataCacheTime < METADATA_CACHE_TTL) {
    return metadataCache;
  }

  try {
    const [marketTypes, teams] = await Promise.all([
      getValidSportsMarketTypes(),
      getTeams(),
    ]);

    // Extract unique leagues from teams
    const leaguesSet = new Set<string>();
    for (const team of teams) {
      if (team.league) {
        leaguesSet.add(team.league);
      }
    }

    const metadata: SportsMetadata = {
      leagues: Array.from(leaguesSet).sort(),
      marketTypes,
    };

    metadataCache = metadata;
    metadataCacheTime = now;

    return metadata;
  } catch (error) {
    console.error("Failed to fetch sports metadata:", error);
    return {
      leagues: [],
      marketTypes: [],
    };
  }
}

export async function getTeamsByLeague(league: string): Promise<SportsTeam[]> {
  return getTeams(league);
}

export async function searchTeams(query: string, limit: number = 20): Promise<SportsTeam[]> {
  try {
    const teams = await getTeams();
    const queryLower = query.toLowerCase();

    return teams
      .filter(
        (team) =>
          team.name.toLowerCase().includes(queryLower) ||
          team.abbreviation.toLowerCase().includes(queryLower) ||
          team.league.toLowerCase().includes(queryLower)
      )
      .slice(0, limit);
  } catch (error) {
    console.error("Failed to search teams:", error);
    return [];
  }
}
