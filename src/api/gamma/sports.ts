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
  alias?: string;
  record?: string;
}

export interface SportsMarketType {
  type: string;
  description: string;
}

export interface SportMetadataItem {
  sport: string;
  image?: string;
  resolution?: string;
  ordering?: string;
  tags: string[];
  series?: string;
}

export interface SportsMetadata {
  sports: SportMetadataItem[];
  leagues: string[];
  marketTypes: SportsMarketType[];
}

interface GammaTeam {
  id?: string | number;
  name?: string | null;
  league?: string | null;
  record?: string | null;
  logo?: string | null;
  imageUrl?: string | null;
  abbreviation?: string | null;
  alias?: string | null;
}

interface GammaSportsMetadataItem {
  sport?: string | null;
  image?: string | null;
  resolution?: string | null;
  ordering?: string | null;
  tags?: string | null;
  series?: string | null;
}

let metadataCache: SportsMetadata | null = null;
let metadataCacheTime = 0;
const METADATA_CACHE_TTL = 5 * 60 * 1000;

function parseTeam(item: GammaTeam): SportsTeam {
  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? ""),
    abbreviation: String(item.abbreviation ?? ""),
    league: String(item.league ?? ""),
    imageUrl: item.logo ? String(item.logo) : item.imageUrl ? String(item.imageUrl) : undefined,
    alias: item.alias ? String(item.alias) : undefined,
    record: item.record ? String(item.record) : undefined,
  };
}

function parseMarketType(type: string): SportsMarketType {
  return {
    type,
    description: type,
  };
}

function parseCommaSeparated(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseSportsMetadataItem(item: GammaSportsMetadataItem): SportMetadataItem {
  return {
    sport: String(item.sport ?? ""),
    image: item.image ? String(item.image) : undefined,
    resolution: item.resolution ? String(item.resolution) : undefined,
    ordering: item.ordering ? String(item.ordering) : undefined,
    tags: parseCommaSeparated(item.tags),
    series: item.series ? String(item.series) : undefined,
  };
}

async function fetchSportsCatalog(): Promise<SportMetadataItem[]> {
  const response = await fetch(`${GAMMA_API_BASE}/sports`);
  if (!response.ok) {
    throw new Error(`Sports metadata API error: ${response.status}`);
  }

  const data = (await response.json()) as GammaSportsMetadataItem[];
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(parseSportsMetadataItem).filter((item) => item.sport.length > 0);
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

    const data = (await response.json()) as GammaTeam[];
    return Array.isArray(data) ? data.map(parseTeam) : [];
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    return [];
  }
}

export async function getTeamById(teamId: string): Promise<SportsTeam | null> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/teams/${encodeURIComponent(teamId)}`);
    if (response.ok) {
      const data = (await response.json()) as GammaTeam;
      return data && typeof data === "object" ? parseTeam(data) : null;
    }

    const fallback = await fetch(`${GAMMA_API_BASE}/teams?id=${encodeURIComponent(teamId)}&limit=1`);
    if (!fallback.ok) return null;

    const data = (await fallback.json()) as GammaTeam[];
    return Array.isArray(data) && data.length > 0 ? parseTeam(data[0]) : null;
  } catch (error) {
    console.error("Failed to fetch team:", error);
    return null;
  }
}

export async function getTeamByAbbreviation(abbreviation: string): Promise<SportsTeam | null> {
  try {
    const params = new URLSearchParams();
    params.set("abbreviation", abbreviation);
    params.set("limit", "1");

    const response = await fetch(`${GAMMA_API_BASE}/teams?${params.toString()}`);
    if (response.ok) {
      const data = (await response.json()) as GammaTeam[];
      if (Array.isArray(data) && data.length > 0) {
        return parseTeam(data[0]);
      }
    }

    const teams = await getTeams();
    return teams.find((team) => team.abbreviation.toLowerCase() === abbreviation.toLowerCase()) || null;
  } catch (error) {
    console.error("Failed to find team by abbreviation:", error);
    return null;
  }
}

export async function getValidSportsMarketTypes(): Promise<SportsMarketType[]> {
  try {
    const response = await fetch(`${GAMMA_API_BASE}/sports/market-types`);
    if (!response.ok) {
      throw new Error(`Sports market types API error: ${response.status}`);
    }

    const data = (await response.json()) as { marketTypes?: string[] } | string[];
    const marketTypes = Array.isArray(data)
      ? data
      : Array.isArray(data.marketTypes)
        ? data.marketTypes
        : [];

    return marketTypes.map((type) => parseMarketType(String(type)));
  } catch (error) {
    console.error("Failed to fetch sports market types:", error);
    return [];
  }
}

export async function getSportById(sportId: string): Promise<Record<string, unknown> | null> {
  try {
    const sports = await fetchSportsCatalog();
    const match = sports.find((sport) => sport.sport.toLowerCase() === sportId.toLowerCase());
    return match ? ({ ...match } as Record<string, unknown>) : null;
  } catch (error) {
    console.error("Failed to fetch sport by ID:", error);
    return null;
  }
}

export async function getSportLeagues(): Promise<Array<{ id: string; name: string; leagues: string[] }>> {
  try {
    const [sports, teams] = await Promise.all([fetchSportsCatalog(), getTeams(undefined, 500)]);
    return sports.map((sport) => {
      const normalizedSport = sport.sport.toLowerCase();
      const leagues = Array.from(
        new Set(
          teams
            .map((team) => team.league)
            .filter((league) => league.length > 0 && league.toLowerCase() === normalizedSport),
        ),
      );

      return {
        id: sport.sport,
        name: sport.sport.toUpperCase(),
        leagues: leagues.length > 0 ? leagues : [sport.sport.toUpperCase()],
      };
    });
  } catch (error) {
    console.error("Failed to fetch sport leagues:", error);
    return [];
  }
}

export async function getSportsMetadata(forceRefresh = false): Promise<SportsMetadata> {
  const now = Date.now();
  if (!forceRefresh && metadataCache && now - metadataCacheTime < METADATA_CACHE_TTL) {
    return metadataCache;
  }

  try {
    const [sports, marketTypes, teams] = await Promise.all([
      fetchSportsCatalog(),
      getValidSportsMarketTypes(),
      getTeams(undefined, 500),
    ]);

    const metadata: SportsMetadata = {
      sports,
      leagues: Array.from(new Set(teams.map((team) => team.league).filter((league) => league.length > 0))).sort(),
      marketTypes,
    };

    metadataCache = metadata;
    metadataCacheTime = now;
    return metadata;
  } catch (error) {
    console.error("Failed to fetch sports metadata:", error);
    return {
      sports: [],
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
    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery.length === 0) return [];

    const teams = await getTeams(undefined, 500);
    return teams
      .filter((team) =>
        team.name.toLowerCase().includes(trimmedQuery)
        || team.abbreviation.toLowerCase().includes(trimmedQuery)
        || team.league.toLowerCase().includes(trimmedQuery)
        || (team.alias ?? "").toLowerCase().includes(trimmedQuery),
      )
      .slice(0, limit);
  } catch (error) {
    console.error("Failed to search teams:", error);
    return [];
  }
}
