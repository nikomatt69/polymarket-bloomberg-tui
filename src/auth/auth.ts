import { createHmac, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const ITERATIONS = 100000;

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
}

export interface AuthSession {
  userId: string;
  username: string;
  email: string;
  token: string;
  createdAt: number;
  expiresAt: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
}

const ENCRYPTION_KEY_BYTES = 32;

function getConfigDir(): string {
  const dir = join(homedir(), ".polymarket-tui");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function getAuthPath(): string {
  return join(getConfigDir(), "auth.json");
}

function getEncryptionKey(): Buffer {
  const keyPath = join(getConfigDir(), ".auth.key");
  if (existsSync(keyPath)) {
    return readFileSync(keyPath);
  }
  const key = randomBytes(ENCRYPTION_KEY_BYTES);
  writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function generateSalt(): string {
  return randomBytes(SALT_LENGTH).toString("hex");
}

function hashPassword(password: string, salt: string): string {
  const saltBuffer = Buffer.from(salt, "hex");
  const passwordBuffer = Buffer.from(password);
  const combined = Buffer.concat([saltBuffer, passwordBuffer]);
  
  let hash = combined;
  for (let i = 0; i < ITERATIONS; i++) {
    hash = createHmac("sha512", hash).update(saltBuffer).digest();
  }
  
  return hash.toString("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function generateUserId(): string {
  return randomBytes(16).toString("hex");
}

interface StoredAuthData {
  users: AuthUser[];
  encryptedSession: string | null;
}

function loadAuthData(): StoredAuthData {
  try {
    const path = getAuthPath();
    if (!existsSync(path)) {
      return { users: [], encryptedSession: null };
    }
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as StoredAuthData;
    return {
      users: Array.isArray(data.users) ? data.users : [],
      encryptedSession: data.encryptedSession || null,
    };
  } catch {
    return { users: [], encryptedSession: null };
  }
}

function saveAuthData(data: StoredAuthData): void {
  writeFileSync(getAuthPath(), JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function registerUser(username: string, email: string, password: string): { ok: true } | { ok: false; error: string } {
  if (!username || username.trim().length < 3) {
    return { ok: false, error: "Username must be at least 3 characters" };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email format" };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }

  const authData = loadAuthData();
  
  if (authData.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: "Username already exists" };
  }
  
  if (authData.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: "Email already exists" };
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  
  const newUser: AuthUser = {
    id: generateUserId(),
    username: username.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    salt,
    createdAt: Date.now(),
  };

  authData.users.push(newUser);
  saveAuthData(authData);

  return { ok: true };
}

export function loginUser(username: string, password: string): { ok: true; session: AuthSession } | { ok: false; error: string } {
  if (!username || !password) {
    return { ok: false, error: "Username and password are required" };
  }

  const authData = loadAuthData();
  const user = authData.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    return { ok: false, error: "Invalid username or password" };
  }

  const passwordHash = hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) {
    return { ok: false, error: "Invalid username or password" };
  }

  const token = generateToken();
  const now = Date.now();
  const session: AuthSession = {
    userId: user.id,
    username: user.username,
    email: user.email,
    token,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
  };

  const encryptedSession = encrypt(JSON.stringify(session));
  authData.encryptedSession = encryptedSession;
  saveAuthData(authData);

  return { ok: true, session };
}

export function logoutUser(): void {
  const authData = loadAuthData();
  authData.encryptedSession = null;
  saveAuthData(authData);
}

export function getCurrentSession(): AuthSession | null {
  try {
    const authData = loadAuthData();
    if (!authData.encryptedSession) {
      return null;
    }
    
    const session = JSON.parse(decrypt(authData.encryptedSession)) as AuthSession;
    
    if (Date.now() > session.expiresAt) {
      logoutUser();
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

export function getUserById(userId: string): AuthUser | null {
  const authData = loadAuthData();
  return authData.users.find(u => u.id === userId) || null;
}

export function validateToken(token: string): AuthSession | null {
  const session = getCurrentSession();
  if (!session || session.token !== token) {
    return null;
  }
  return session;
}
