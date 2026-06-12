/**
 * Smoke tests for the auth service.
 *
 * These tests exercise the core happy-paths without a real database.
 * Run with: npx vitest run   (after adding vitest as a devDependency)
 *
 * NOTE: The service currently uses an in-memory Map as the user store.
 * Each test module gets a fresh module instance via dynamic imports so
 * state does not leak between test files.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Provide a deterministic JWT secret for tests
process.env.JWT_SECRET = 'test-secret-for-unit-tests-only';

const authModule = await import('../services/authService');

describe('authService', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'SecureP@ss1234';
  const testName = 'Test User';

  describe('createUser', () => {
    it('creates a user and returns token', async () => {
      const result = await authModule.createUser(testEmail, testPassword, testName);
      expect(result).not.toBeNull();
      expect(result!.user.email).toBe(testEmail);
      expect(result!.user.name).toBe(testName);
      expect(typeof result!.token).toBe('string');
      expect(result!.token.length).toBeGreaterThan(0);
    });

    it('throws on duplicate email', async () => {
      await expect(
        authModule.createUser(testEmail, testPassword, testName)
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('authenticateUser', () => {
    it('returns token for valid credentials', async () => {
      const result = await authModule.authenticateUser(testEmail, testPassword);
      expect(result).not.toBeNull();
      expect(result!.user.email).toBe(testEmail);
      expect(typeof result!.token).toBe('string');
    });

    it('throws for wrong password', async () => {
      await expect(
        authModule.authenticateUser(testEmail, 'wrong-password')
      ).rejects.toThrow('Invalid password');
    });

    it('throws for unknown email', async () => {
      await expect(
        authModule.authenticateUser('nobody@example.com', testPassword)
      ).rejects.toThrow('User not found');
    });
  });

  describe('generateToken / verifyToken', () => {
    it('generates and verifies a token round-trip', () => {
      const userId = 'user_test_123';
      const token = authModule.generateToken(userId);
      const decoded = authModule.verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded.userId).toBe(userId);
    });

    it('returns null for an invalid token', () => {
      expect(authModule.verifyToken('not.a.valid.jwt')).toBeNull();
    });
  });

  describe('getUserStats', () => {
    it('returns stats for an existing user', async () => {
      const created = await authModule.createUser(
        `stats-${Date.now()}@example.com`,
        testPassword,
        'Stats User'
      );
      const stats = authModule.getUserStats(created!.user.id);
      expect(stats).not.toBeNull();
      expect(stats!.email).toBeDefined();
    });
  });
});
