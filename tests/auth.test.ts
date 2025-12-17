import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  hasPermission,
  ROLES,
} from '../src/lib/auth';

describe('Authentication', () => {
  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123';
      const hashed = await hashPassword(password);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(0);
    });

    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hashed = await hashPassword(password);

      const isValid = await verifyPassword(password, hashed);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const hashed = await hashPassword(password);

      const isValid = await verifyPassword('wrongPassword', hashed);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT Tokens', () => {
    const payload = {
      userId: 1,
      email: 'test@example.com',
      role: 'admin',
      name: 'Test User',
    };

    it('should generate a token', () => {
      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should verify a valid token', () => {
      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.email).toBe(payload.email);
      expect(decoded?.role).toBe(payload.role);
    });

    it('should return null for invalid token', () => {
      const decoded = verifyToken('invalid.token.here');

      expect(decoded).toBeNull();
    });

    it('should return null for tampered token', () => {
      const token = generateToken(payload);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      const decoded = verifyToken(tamperedToken);
      expect(decoded).toBeNull();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow admin to read users', () => {
      expect(hasPermission(ROLES.ADMIN, 'users:read')).toBe(true);
    });

    it('should allow admin to write users', () => {
      expect(hasPermission(ROLES.ADMIN, 'users:write')).toBe(true);
    });

    it('should allow manager to read users', () => {
      expect(hasPermission(ROLES.MANAGER, 'users:read')).toBe(true);
    });

    it('should not allow manager to write users', () => {
      expect(hasPermission(ROLES.MANAGER, 'users:write')).toBe(false);
    });

    it('should allow production role to read production', () => {
      expect(hasPermission(ROLES.PRODUCTION, 'production:read')).toBe(true);
    });

    it('should allow production role to write production', () => {
      expect(hasPermission(ROLES.PRODUCTION, 'production:write')).toBe(true);
    });

    it('should not allow production role to approve production', () => {
      expect(hasPermission(ROLES.PRODUCTION, 'production:approve')).toBe(false);
    });

    it('should allow QC role to read quality', () => {
      expect(hasPermission(ROLES.QC, 'quality:read')).toBe(true);
    });

    it('should allow QC role to approve quality', () => {
      expect(hasPermission(ROLES.QC, 'quality:approve')).toBe(true);
    });

    it('should allow warehouse role to read inventory', () => {
      expect(hasPermission(ROLES.WAREHOUSE, 'inventory:read')).toBe(true);
    });

    it('should allow warehouse role to write inventory', () => {
      expect(hasPermission(ROLES.WAREHOUSE, 'inventory:write')).toBe(true);
    });

    it('should not allow warehouse role to adjust inventory', () => {
      expect(hasPermission(ROLES.WAREHOUSE, 'inventory:adjust')).toBe(false);
    });

    it('should not allow user role to read reports', () => {
      expect(hasPermission(ROLES.USER, 'reports:read')).toBe(false);
    });
  });
});
