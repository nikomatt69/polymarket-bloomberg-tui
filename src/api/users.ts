/**
 * User API functions for profile management
 */

import { UserProfile } from "../types/user";

const MOCK_USER_API = true;

let mockUsers: Map<string, UserProfile> = new Map();
let currentUser: UserProfile | null = null;

function generateMockUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function generateMockUser(username: string): UserProfile {
  const now = new Date();
  const createdAt = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);
  
  return {
    id: generateMockUserId(),
    username,
    email: `${username.toLowerCase()}@example.com`,
    bio: `Trader and prediction market enthusiast. ${username}'s profile.`,
    avatar: undefined,
    createdAt: createdAt.toISOString(),
    lastSeen: now.toISOString(),
  };
}

function initializeMockUsers(): void {
  if (mockUsers.size > 0) return;
  
  const defaultMockUsers: UserProfile[] = [
    generateMockUser("CryptoKing"),
    generateMockUser("MarketMaven"),
    generateMockUser("PolymarketPro"),
    generateMockUser("PredictionMaster"),
    generateMockUser("TradingWizard"),
    generateMockUser("AlphaSeeker"),
    generateMockUser("BullishBob"),
    generateMockUser("BearishBetty"),
    generateMockUser("DataDriven"),
    generateMockUser("VolatilityViking"),
  ];

  defaultMockUsers.forEach((u) => mockUsers.set(u.id, u));
  defaultMockUsers.forEach((u) => mockUsers.set(u.username.toLowerCase(), u));
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  if (MOCK_USER_API) {
    initializeMockUsers();
    if (currentUser) return currentUser;
    
    currentUser = {
      id: generateMockUserId(),
      username: "You",
      email: "you@example.com",
      bio: "Polymarket trader",
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };
    return currentUser;
  }
  
  try {
    const response = await fetch("/api/user/me", {
      credentials: "include",
    });
    if (!response.ok) return null;
    return await response.json() as UserProfile;
  } catch {
    return null;
  }
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
  if (MOCK_USER_API) {
    const current = await getCurrentUser();
    if (!current) return null;
    
    currentUser = {
      ...current,
      ...updates,
      lastSeen: new Date().toISOString(),
    };
    
    return currentUser;
  }
  
  try {
    const response = await fetch("/api/user/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updates),
    });
    if (!response.ok) return null;
    return await response.json() as UserProfile;
  } catch {
    return null;
  }
}

export async function searchUsers(query: string): Promise<UserProfile[]> {
  if (!query || query.length < 2) return [];
  
  if (MOCK_USER_API) {
    initializeMockUsers();
    const q = query.toLowerCase();
    const results = Array.from(mockUsers.values()).filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.bio && u.bio.toLowerCase().includes(q))
    );
    
    if (results.length === 0 && query.length >= 2) {
      const newUser = generateMockUser(query);
      mockUsers.set(newUser.id, newUser);
      mockUsers.set(newUser.username.toLowerCase(), newUser);
      return [newUser];
    }
    
    return results.slice(0, 10);
  }
  
  try {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
      credentials: "include",
    });
    if (!response.ok) return [];
    return await response.json() as UserProfile[];
  } catch {
    return [];
  }
}

export async function getUserById(userId: string): Promise<UserProfile | null> {
  if (MOCK_USER_API) {
    initializeMockUsers();
    const user = mockUsers.get(userId);
    return user || null;
  }
  
  try {
    const response = await fetch(`/api/users/${userId}`, {
      credentials: "include",
    });
    if (!response.ok) return null;
    return await response.json() as UserProfile;
  } catch {
    return null;
  }
}

export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  if (MOCK_USER_API) {
    initializeMockUsers();
    const user = mockUsers.get(username.toLowerCase());
    return user || null;
  }
  
  try {
    const response = await fetch(`/api/users/username/${encodeURIComponent(username)}`, {
      credentials: "include",
    });
    if (!response.ok) return null;
    return await response.json() as UserProfile;
  } catch {
    return null;
  }
}
