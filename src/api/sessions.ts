/**
 * Session persistence layer — mirrors how alerts.json / rules.json work.
 * Sessions are stored in ~/.polymarket-tui/sessions/<id>.json
 */

import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import type { ChatMessage } from "../state";

export interface SessionRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    marketContext?: string;
  };
}

export function generateSessionId(): string {
  return `sess-${Date.now().toString(36)}`;
}

export function getSessionsDir(): string {
  const dir = join(homedir(), ".polymarket-tui", "sessions");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // directory already exists
  }
  return dir;
}

export function saveSession(record: SessionRecord): void {
  const dir = getSessionsDir();
  const path = join(dir, `${record.id}.json`);
  try {
    // ChatMessage.timestamp is a Date — serialize properly
    const serializable = {
      ...record,
      messages: record.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      })),
    };
    writeFileSync(path, JSON.stringify(serializable, null, 2), { mode: 0o600 });
  } catch (error) {
    console.error("Failed to save session:", error);
  }
}

export function loadSession(id: string): SessionRecord | null {
  const dir = getSessionsDir();
  const path = join(dir, `${id}.json`);
  try {
    const data = readFileSync(path, "utf-8");
    const parsed = JSON.parse(data) as SessionRecord;
    // Rehydrate Date objects
    return {
      ...parsed,
      messages: parsed.messages.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp as unknown as string),
      })),
    };
  } catch {
    return null;
  }
}

export function listSessions(): SessionRecord[] {
  const dir = getSessionsDir();
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    const sessions: SessionRecord[] = [];
    for (const file of files) {
      try {
        const data = readFileSync(join(dir, file), "utf-8");
        const parsed = JSON.parse(data) as SessionRecord;
        sessions.push(parsed);
      } catch {
        // skip invalid files
      }
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function deleteSession(id: string): void {
  const dir = getSessionsDir();
  const path = join(dir, `${id}.json`);
  try {
    unlinkSync(path);
  } catch {
    // ignore
  }
}

export function initSession(): SessionRecord {
  const record: SessionRecord = {
    id: generateSessionId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    metadata: {
      provider: "",
      model: "",
      tokensUsed: 0,
    },
  };
  saveSession(record);
  return record;
}
