/**
 * Encryption Utility for VMI Portal API Keys
 *
 * Uses AES-256-GCM for authenticated encryption of sensitive data at rest.
 * Format: iv:authTag:ciphertext (all base64 encoded)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Get the encryption key from environment variable
 * @throws Error if VMI_ENCRYPTION_KEY is not configured
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.VMI_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('VMI_ENCRYPTION_KEY environment variable is not configured');
  }

  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `VMI_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`
    );
  }

  return key;
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (base64)
 * @throws Error if encryption fails or key is not configured
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty or null value');
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param ciphertext - Encrypted string in format: iv:authTag:ciphertext (base64)
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails, format is invalid, or key is not configured
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    throw new Error('Cannot decrypt empty or null value');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format: expected iv:authTag:encrypted');
  }

  const [ivB64, authTagB64, encryptedB64] = parts;

  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (error) {
    // GCM authentication failed - data was tampered with or wrong key
    throw new Error('Decryption failed: authentication tag mismatch');
  }
}

/**
 * Validate that a ciphertext string is properly formatted
 *
 * @param ciphertext - String to validate
 * @returns true if format is valid, false otherwise
 */
export function isValidCiphertext(ciphertext: string): boolean {
  if (!ciphertext || typeof ciphertext !== 'string') {
    return false;
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    return false;
  }

  try {
    const [ivB64, authTagB64, encryptedB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    return (
      iv.length === IV_LENGTH &&
      authTag.length === AUTH_TAG_LENGTH &&
      encrypted.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Generate a new random encryption key
 * Use this to generate VMI_ENCRYPTION_KEY for .env
 *
 * @returns 32-byte key as hex string (64 characters)
 */
export function generateKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex');
}
