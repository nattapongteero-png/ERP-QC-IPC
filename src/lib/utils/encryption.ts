import crypto from 'crypto';

// Use environment variable for encryption key
const ENCRYPTION_KEY = process.env.EMPLOYEE_DATA_ENCRYPTION_KEY || 'default-dev-key-32-characters!!';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Encrypt sensitive data (Thai CID, bank accounts, etc.)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0')),
    iv
  );

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData (all in hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';

  try {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

    if (!ivHex || !authTagHex || !encrypted) {
      return encryptedData; // Return as-is if not in expected format
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0')),
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return ''; // Return empty on decryption failure
  }
}

/**
 * Create SHA-256 hash for duplicate checking (e.g., Thai CID uniqueness)
 */
export function hashForLookup(value: string): string {
  if (!value) return '';

  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

/**
 * Mask sensitive data for display (e.g., X-XXXX-XXXXX-XX-3)
 */
export function maskThaiCid(cid: string): string {
  if (!cid || cid.length !== 13) return cid;
  return `${cid[0]}-XXXX-XXXXX-XX-${cid[12]}`;
}

/**
 * Mask bank account number for display
 */
export function maskBankAccount(account: string): string {
  if (!account || account.length < 4) return account;
  const lastFour = account.slice(-4);
  return `XXX-X-${lastFour}`;
}
