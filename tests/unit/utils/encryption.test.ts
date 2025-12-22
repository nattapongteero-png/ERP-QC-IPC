import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, hashForLookup } from '@/lib/utils/encryption';

describe('Encryption Utility', () => {
  const testData = '1234567890123'; // Thai CID format

  it('should encrypt and decrypt data correctly', () => {
    const encrypted = encrypt(testData);
    expect(encrypted).not.toBe(testData);
    expect(encrypted).toBeTruthy();

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(testData);
  });

  it('should generate consistent hash for same input', () => {
    const hash1 = hashForLookup(testData);
    const hash2 = hashForLookup(testData);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('should generate different hashes for different inputs', () => {
    const hash1 = hashForLookup('1234567890123');
    const hash2 = hashForLookup('9876543210123');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty values gracefully', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
    expect(hashForLookup('')).toBe('');
  });
});
