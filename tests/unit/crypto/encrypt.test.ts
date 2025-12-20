/**
 * Unit Tests for Encryption Utility
 *
 * Tests the AES-256-GCM encryption used for VMI Portal API keys
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { encrypt, decrypt, isValidCiphertext, generateKey } from '@/lib/crypto/encrypt';

describe('Encryption Utility', () => {
  const originalEnv = process.env.VMI_ENCRYPTION_KEY;

  beforeAll(() => {
    // Set a valid 32-byte hex key for testing
    process.env.VMI_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex
  });

  afterAll(() => {
    // Restore original env
    if (originalEnv) {
      process.env.VMI_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.VMI_ENCRYPTION_KEY;
    }
  });

  describe('encrypt', () => {
    it('should encrypt a plaintext string', () => {
      const plaintext = 'my-secret-api-key';
      const ciphertext = encrypt(plaintext);

      expect(ciphertext).toBeDefined();
      expect(ciphertext).not.toBe(plaintext);
      expect(typeof ciphertext).toBe('string');
    });

    it('should produce different ciphertext for the same plaintext (random IV)', () => {
      const plaintext = 'my-secret-api-key';
      const ciphertext1 = encrypt(plaintext);
      const ciphertext2 = encrypt(plaintext);

      expect(ciphertext1).not.toBe(ciphertext2);
    });

    it('should produce ciphertext in correct format (iv:authTag:encrypted)', () => {
      const plaintext = 'test-value';
      const ciphertext = encrypt(plaintext);

      const parts = ciphertext.split(':');
      expect(parts.length).toBe(3);

      // All parts should be valid base64
      parts.forEach(part => {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      });
    });

    it('should throw error for empty input', () => {
      expect(() => encrypt('')).toThrow('Cannot encrypt empty or null value');
    });

    it('should handle long plaintext', () => {
      const longPlaintext = 'a'.repeat(10000);
      const ciphertext = encrypt(longPlaintext);

      expect(ciphertext).toBeDefined();
      expect(decrypt(ciphertext)).toBe(longPlaintext);
    });

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      const ciphertext = encrypt(specialChars);

      expect(decrypt(ciphertext)).toBe(specialChars);
    });

    it('should handle unicode characters', () => {
      const unicode = 'สวัสดี 你好 🎉';
      const ciphertext = encrypt(unicode);

      expect(decrypt(ciphertext)).toBe(unicode);
    });
  });

  describe('decrypt', () => {
    it('should decrypt ciphertext back to original plaintext', () => {
      const plaintext = 'my-secret-api-key-12345';
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for empty input', () => {
      expect(() => decrypt('')).toThrow('Cannot decrypt empty or null value');
    });

    it('should throw error for invalid format', () => {
      expect(() => decrypt('invalid-ciphertext')).toThrow('Invalid ciphertext format');
      expect(() => decrypt('only:two:parts:here')).toThrow('Invalid ciphertext format');
    });

    it('should throw error for tampered ciphertext', () => {
      const plaintext = 'my-secret';
      const ciphertext = encrypt(plaintext);

      // Tamper with the encrypted data (last part)
      const parts = ciphertext.split(':');
      const tamperedEncrypted = Buffer.from(parts[2], 'base64');
      tamperedEncrypted[0] ^= 0xff; // Flip bits
      parts[2] = tamperedEncrypted.toString('base64');

      expect(() => decrypt(parts.join(':'))).toThrow('authentication tag mismatch');
    });

    it('should throw error for tampered auth tag', () => {
      const plaintext = 'my-secret';
      const ciphertext = encrypt(plaintext);

      // Tamper with the auth tag (second part)
      const parts = ciphertext.split(':');
      const tamperedAuthTag = Buffer.from(parts[1], 'base64');
      tamperedAuthTag[0] ^= 0xff;
      parts[1] = tamperedAuthTag.toString('base64');

      expect(() => decrypt(parts.join(':'))).toThrow('authentication tag mismatch');
    });
  });

  describe('isValidCiphertext', () => {
    it('should return true for valid ciphertext', () => {
      const ciphertext = encrypt('test');
      expect(isValidCiphertext(ciphertext)).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isValidCiphertext('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isValidCiphertext(null as unknown as string)).toBe(false);
      expect(isValidCiphertext(undefined as unknown as string)).toBe(false);
    });

    it('should return false for wrong format', () => {
      expect(isValidCiphertext('not:valid')).toBe(false);
      expect(isValidCiphertext('one')).toBe(false);
      expect(isValidCiphertext('a:b:c:d')).toBe(false);
    });

    it('should return false for invalid base64', () => {
      expect(isValidCiphertext('!!!:@@@:###')).toBe(false);
    });
  });

  describe('generateKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = generateKey();

      expect(key).toBeDefined();
      expect(key.length).toBe(64);
      expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
    });

    it('should generate different keys each time', () => {
      const key1 = generateKey();
      const key2 = generateKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate a key that works for encryption', () => {
      const key = generateKey();
      const originalKey = process.env.VMI_ENCRYPTION_KEY;

      try {
        process.env.VMI_ENCRYPTION_KEY = key;
        const plaintext = 'test-with-generated-key';
        const ciphertext = encrypt(plaintext);
        const decrypted = decrypt(ciphertext);

        expect(decrypted).toBe(plaintext);
      } finally {
        process.env.VMI_ENCRYPTION_KEY = originalKey;
      }
    });
  });

  describe('error handling', () => {
    it('should throw error when VMI_ENCRYPTION_KEY is not set', () => {
      const originalKey = process.env.VMI_ENCRYPTION_KEY;
      delete process.env.VMI_ENCRYPTION_KEY;

      try {
        expect(() => encrypt('test')).toThrow('VMI_ENCRYPTION_KEY environment variable is not configured');
      } finally {
        process.env.VMI_ENCRYPTION_KEY = originalKey;
      }
    });

    it('should throw error when VMI_ENCRYPTION_KEY has wrong length', () => {
      const originalKey = process.env.VMI_ENCRYPTION_KEY;
      process.env.VMI_ENCRYPTION_KEY = 'tooshort';

      try {
        expect(() => encrypt('test')).toThrow('VMI_ENCRYPTION_KEY must be 64 hex characters');
      } finally {
        process.env.VMI_ENCRYPTION_KEY = originalKey;
      }
    });
  });
});
