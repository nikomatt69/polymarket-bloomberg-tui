/**
 * User API functions for profile management
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  getCurrentSession,
  getUserById as getAuthUserById,
  listUsers,
  type AuthPublicUser,
} from "../auth/auth";
import { UserProfile } from "../types/user";

interface StoredProfileEntry {
  username?: string;
  bio?: string;
  avatar?: string;
  lastSeen?: string;
  updatedAt?: string;
}

interface StoredProfileData {
  profiles: Record<string, StoredProfileEntry>;
}

function getProfilesPath(): string {
  const configDir = join(homedir(), ".polymarket-tui");
  try {
    mkdirSync(configDir, { recursive: true });
  } catch {
    // directory may already exist
  }
  return join(configDir, "user-profiles.json");
}

function loadProfileData(): StoredProfileData {
  try {
    const raw = readFileSync(getProfilesPath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoredProfileData>;
    if (parsed && typeof parsed === "object" && parsed.profiles && typeof parsed.profiles === "object") {
      return { profiles: parsed.profiles as Record<string, StoredProfileEntry> };
    }
  } catch {
    // file missing or invalid
  }
  return { profiles: {} };
}

function saveProfileData(data: StoredProfileData): void {
  try {
    writeFileSync(getProfilesPath(), JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (error) {
    console.error("Failed to save user profiles:", error);
  }
}

function toUserProfile(user: AuthPublicUser, entry?: StoredProfileEntry): UserProfile {
  const now = new Date().toISOString();
  return {
    id: user.id,
    username: entry?.username || user.username,
    email: user.email,
    bio: entry?.bio || "",
    avatar: entry?.avatar,
    createdAt: new Date(user.createdAt).toISOString(),
    lastSeen: entry?.lastSeen || now,
  };
}

function upsertProfileEntry(userId: string, updates: Partial<StoredProfileEntry>): StoredProfileEntry {
  const data = loadProfileData();
  const previous = data.profiles[userId] ?? {};
  const next: StoredProfileEntry = {
    ...previous,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  data.profiles[userId] = next;
  saveProfileData(data);
  return next;
}

function getAllUserProfiles(): UserProfile[] {
  const users = listUsers();
  const data = loadProfileData();

  return users.map((user) => toUserProfile(user, data.profiles[user.id]));
}

function touchLastSeen(userId: string): void {
  upsertProfileEntry(userId, { lastSeen: new Date().toISOString() });
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const session = getCurrentSession();
  if (!session) return null;

  const authUser = getAuthUserById(session.userId);
  if (!authUser) return null;

  touchLastSeen(authUser.id);
  const data = loadProfileData();
  return toUserProfile(
    {
      id: authUser.id,
      username: authUser.username,
      email: authUser.email,
      createdAt: authUser.createdAt,
    },
    data.profiles[authUser.id],
  );
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
  const session = getCurrentSession();
  if (!session) return null;

  const authUser = getAuthUserById(session.userId);
  if (!authUser) return null;

  const entryUpdates: Partial<StoredProfileEntry> = {
    lastSeen: new Date().toISOString(),
  };

  if (typeof updates.username === "string") entryUpdates.username = updates.username.trim();
  if (typeof updates.bio === "string") entryUpdates.bio = updates.bio.trim();
  if (typeof updates.avatar === "string") entryUpdates.avatar = updates.avatar.trim();

  const entry = upsertProfileEntry(authUser.id, entryUpdates);
  return toUserProfile(
    {
      id: authUser.id,
      username: authUser.username,
      email: authUser.email,
      createdAt: authUser.createdAt,
    },
    entry,
  );
}

export async function searchUsers(query: string): Promise<UserProfile[]> {
  if (!query || query.trim().length < 2) return [];

  const normalized = query.trim().toLowerCase();
  const allProfiles = getAllUserProfiles();

  const matches = allProfiles.filter((profile) =>
    profile.username.toLowerCase().includes(normalized)
    || (profile.email || "").toLowerCase().includes(normalized)
    || (profile.bio || "").toLowerCase().includes(normalized),
  );

  matches.sort((a, b) => {
    const aStarts = a.username.toLowerCase().startsWith(normalized) ? 0 : 1;
    const bStarts = b.username.toLowerCase().startsWith(normalized) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.username.localeCompare(b.username);
  });

  return matches.slice(0, 20);
}

export async function getUserById(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;

  const allProfiles = getAllUserProfiles();
  const profile = allProfiles.find((entry) => entry.id === userId);
  if (profile) return profile;

  const authUser = getAuthUserById(userId);
  if (!authUser) return null;

  const data = loadProfileData();
  return toUserProfile(
    {
      id: authUser.id,
      username: authUser.username,
      email: authUser.email,
      createdAt: authUser.createdAt,
    },
    data.profiles[authUser.id],
  );
}

export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  if (!username) return null;

  const normalized = username.trim().toLowerCase();
  const allProfiles = getAllUserProfiles();
  return allProfiles.find((profile) => profile.username.toLowerCase() === normalized) ?? null;
}
