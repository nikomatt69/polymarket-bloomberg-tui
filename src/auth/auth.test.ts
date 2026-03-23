import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const TEST_DIR = join(homedir(), ".polymarket-tui-test");

beforeEach(() => {
  try {
    const authFile = join(TEST_DIR, "auth.json");
    const keyFile = join(TEST_DIR, ".auth.key");
    if (existsSync(authFile)) unlinkSync(authFile);
    if (existsSync(keyFile)) unlinkSync(keyFile);
  } catch { /* ignore */ }
});

afterEach(() => {
  try {
    const authFile = join(TEST_DIR, "auth.json");
    const keyFile = join(TEST_DIR, ".auth.key");
    if (existsSync(authFile)) unlinkSync(authFile);
    if (existsSync(keyFile)) unlinkSync(keyFile);
  } catch { /* ignore */ }
});

import { registerUser, loginUser, logoutUser, getCurrentSession } from "./auth";

describe("Auth Module", () => {
  describe("registerUser", () => {
    it("should require username with at least 3 characters", () => {
      const result = registerUser("ab", "test@test.com", "password123");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("3 characters");
    });

    it("should require valid email format", () => {
      const result = registerUser("validuser", "invalid-email", "password123");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("email");
    });

    it("should require password with at least 6 characters", () => {
      const result = registerUser("validuser", "test@test.com", "12345");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("6 characters");
    });

    it("should successfully register a valid user", () => {
      const uniqueId = `testuser_${Date.now()}`;
      const result = registerUser(uniqueId, `${uniqueId}@example.com`, "password123");
      expect(result.ok).toBe(true);
    });

    it("should reject duplicate username", () => {
      registerUser("duplicateuser", "test1@example.com", "password123");
      const result = registerUser("duplicateuser", "test2@example.com", "password123");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("already exists");
    });
  });

  describe("loginUser", () => {
    it("should require both username and password", () => {
      const result = loginUser("", "password123");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("required");
    });

    it("should reject invalid username", () => {
      const result = loginUser("nonexistent", "password123");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Invalid");
    });

    it("should reject invalid password", () => {
      registerUser("logintest", "login@test.com", "correctpassword");
      const result = loginUser("logintest", "wrongpassword");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Invalid");
    });

    it("should successfully login with valid credentials", () => {
      registerUser("validlogin", "valid@test.com", "mypassword");
      const result = loginUser("validlogin", "mypassword");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.session).toBeDefined();
        expect(result.session?.username).toBe("validlogin");
      }
    });
  });

  describe("session management", () => {
    it("should return null for non-existent session", () => {
      logoutUser();
      const session = getCurrentSession();
      expect(session).toBeNull();
    });

    it("should persist session after login", () => {
      registerUser("sessiontest", "session@test.com", "password123");
      loginUser("sessiontest", "password123");
      const session = getCurrentSession();
      expect(session).not.toBeNull();
      expect(session?.userId).toBeDefined();
    });

    it("should clear session after logout", () => {
      registerUser("logouttest", "logout@test.com", "password123");
      loginUser("logouttest", "password123");
      logoutUser();
      const session = getCurrentSession();
      expect(session).toBeNull();
    });
  });
});
