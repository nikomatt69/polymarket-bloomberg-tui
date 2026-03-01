/**
 * Skills API — loadable AI assistant skill definitions
 * Skills extend what the AI assistant can do by injecting context into system prompt.
 * Persisted at ~/.polymarket-tui/skills.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  systemPrompt: string;
  author?: string;
  version?: string;
  createdAt: number;
}

const DEFAULT_SKILLS: Skill[] = [
  {
    id: "news-analyst",
    name: "News Analyst",
    description: "Analyze recent news headlines and their potential impact on prediction market prices",
    enabled: false,
    systemPrompt: `## News Analysis Skill
You can now analyze news impact on prediction markets. When relevant:
- Correlate news headlines with market price movements
- Identify how news events shift probability estimates
- Suggest markets that may be mispriced due to recent news
- Explain how a news story should theoretically affect a given outcome price`,
    author: "built-in",
    version: "1.0",
    createdAt: 0,
  },
  {
    id: "technical-analyst",
    name: "Technical Analyst",
    description: "Perform technical analysis on market price history — support/resistance, trends, momentum",
    enabled: false,
    systemPrompt: `## Technical Analysis Skill
You can now perform technical analysis. When analyzing markets:
- Identify support and resistance levels from price history
- Detect trending vs ranging market behavior
- Calculate and interpret RSI, SMA momentum signals
- Flag overextended moves that may revert
- Suggest entry/exit levels based on technical patterns`,
    author: "built-in",
    version: "1.0",
    createdAt: 0,
  },
  {
    id: "risk-manager",
    name: "Risk Manager",
    description: "Enforce position sizing discipline and portfolio risk limits before trades",
    enabled: false,
    systemPrompt: `## Risk Management Skill
You now enforce strict risk management. For every potential trade:
- Calculate maximum position size (never risk more than 5% of portfolio per trade)
- Check if the market is liquid enough for the desired size
- Warn if the portfolio is overexposed to correlated outcomes
- Suggest stop-loss or hedging strategies
- Always state the maximum downside in dollar terms before placing any order`,
    author: "built-in",
    version: "1.0",
    createdAt: 0,
  },
  {
    id: "arbitrage-scanner",
    name: "Arbitrage Scanner",
    description: "Identify arbitrage opportunities across correlated markets and outcomes",
    enabled: false,
    systemPrompt: `## Arbitrage Scanning Skill
You can now detect arbitrage opportunities:
- Identify YES + NO prices that don't sum to ~$1.00 (implied arb)
- Find correlated markets trading at inconsistent relative prices
- Calculate expected value of arb trades net of fees
- Rank opportunities by expected profit and liquidity
- Execute arb trades when the spread justifies the gas/fee costs`,
    author: "built-in",
    version: "1.0",
    createdAt: 0,
  },
  {
    id: "portfolio-balancer",
    name: "Portfolio Balancer",
    description: "Proactively suggest rebalancing trades to maintain target allocations",
    enabled: false,
    systemPrompt: `## Portfolio Balancing Skill
You actively manage portfolio balance:
- Track current allocation percentages by category (politics, crypto, sports, etc.)
- Flag positions that have grown too large relative to portfolio
- Suggest partial sells to lock in profits and reduce concentration
- Identify underweight sectors that match user's risk profile
- Generate a weekly rebalancing report when asked`,
    author: "built-in",
    version: "1.0",
    createdAt: 0,
  },
];

function getSkillsPath(): string {
  const dir = join(homedir(), ".polymarket-tui");
  try { mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
  return join(dir, "skills.json");
}

export function loadSkills(): Skill[] {
  try {
    const data = readFileSync(getSkillsPath(), "utf-8");
    const parsed = JSON.parse(data) as unknown[];
    if (!Array.isArray(parsed)) return mergeWithDefaults([]);
    const stored = parsed.filter((s): s is Skill =>
      s !== null && typeof s === "object" && typeof (s as Record<string, unknown>).id === "string"
    );
    return mergeWithDefaults(stored);
  } catch {
    return mergeWithDefaults([]);
  }
}

function mergeWithDefaults(stored: Skill[]): Skill[] {
  const storedMap = new Map(stored.map((s) => [s.id, s]));
  const result: Skill[] = DEFAULT_SKILLS.map((def) => {
    const s = storedMap.get(def.id);
    return s ? { ...def, ...s, systemPrompt: s.systemPrompt || def.systemPrompt } : { ...def };
  });
  // Append any custom skills not in defaults
  for (const s of stored) {
    if (!DEFAULT_SKILLS.some((d) => d.id === s.id)) {
      result.push(s);
    }
  }
  return result;
}

export function saveSkills(skills: Skill[]): void {
  try {
    writeFileSync(getSkillsPath(), JSON.stringify(skills, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error("Failed to save skills:", e);
  }
}

export function getEnabledSkillsSystemPrompt(skills: Skill[]): string {
  const enabled = skills.filter((s) => s.enabled);
  if (enabled.length === 0) return "";
  return "\n\n---\n\n## Active Skills\n\n" + enabled.map((s) => s.systemPrompt).join("\n\n");
}

export function createCustomSkill(
  name: string,
  description: string,
  systemPrompt: string
): Skill {
  return {
    id: `custom-${Date.now()}`,
    name,
    description,
    enabled: true,
    systemPrompt,
    author: "user",
    version: "1.0",
    createdAt: Date.now(),
  };
}
