/**
 * Simple KV Storage using Bun's file API
 * Persists data to ~/.polymarket-tui/storage/
 */

import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const STORAGE_DIR = join(homedir(), ".polymarket-tui", "storage");

// Ensure storage directory exists
function ensureStorageDir(): void {
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function getFilePath(key: string): string {
  return join(STORAGE_DIR, `${key}.json`);
}

export interface StorageEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number; // milliseconds, 0 = no expiry
}

export const Storage = {
  /**
   * Read a value from storage
   */
  get<T>(key: string): T | null {
    try {
      ensureStorageDir();
      const filePath = getFilePath(key);
      if (!existsSync(filePath)) return null;

      const content = readFileSync(filePath, "utf-8");
      const entry: StorageEntry<T> = JSON.parse(content);

      // Check TTL if present
      if (entry.ttl && entry.ttl > 0) {
        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
          // Expired, delete and return null
          this.delete(key);
          return null;
        }
      }

      return entry.data;
    } catch {
      return null;
    }
  },

  /**
   * Write a value to storage
   */
  set<T>(key: string, data: T, ttlMs: number = 0): void {
    try {
      ensureStorageDir();
      const entry: StorageEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
      };
      const filePath = getFilePath(key);
      writeFileSync(filePath, JSON.stringify(entry, null, 2));
    } catch (e) {
      console.error("Storage.set error:", e);
    }
  },

  /**
   * Delete a key from storage
   */
  delete(key: string): void {
    try {
      const filePath = getFilePath(key);
      if (existsSync(filePath)) {
        const { unlinkSync } = require("fs");
        unlinkSync(filePath);
      }
    } catch (e) {
      console.error("Storage.delete error:", e);
    }
  },

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const value = this.get(key);
    return value !== null;
  },

  /**
   * Clear all storage
   */
  clear(): void {
    try {
      ensureStorageDir();
      const { readdirSync, unlinkSync } = require("fs");
      const files = readdirSync(STORAGE_DIR);
      for (const file of files) {
        if (file.endsWith(".json")) {
          unlinkSync(join(STORAGE_DIR, file));
        }
      }
    } catch (e) {
      console.error("Storage.clear error:", e);
    }
  },

  /**
   * Get storage directory path (for debugging)
   */
  getPath(): string {
    return STORAGE_DIR;
  },
};
