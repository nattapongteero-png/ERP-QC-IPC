/**
 * Thai Citizen ID (บัตรประชาชน) Validation Utility
 *
 * Format: X-XXXX-XXXXX-XX-X (13 digits)
 * - First digit: Region code (1-8)
 * - Digits 2-5: Province, district
 * - Digits 6-10: Person number
 * - Digits 11-12: Year of registration
 * - Digit 13: Checksum
 */

/**
 * Check if Thai CID format is valid (13 digits)
 */
export function isValidThaiCidFormat(cid: string): boolean {
  if (!cid) return false;
  const cleaned = cid.replace(/\D/g, '');
  return /^\d{13}$/.test(cleaned);
}

/**
 * Calculate checksum for Thai CID
 * Algorithm: Sum of (digit × (14-position)) mod 11
 * Checksum = (11 - sum) mod 10
 */
function calculateChecksum(digits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * (13 - i);
  }
  const remainder = sum % 11;
  return (11 - remainder) % 10;
}

/**
 * Validate Thai CID with checksum verification
 */
export function validateThaiCid(cid: string): boolean {
  if (!cid) return false;

  const cleaned = cid.replace(/\D/g, '');

  if (!isValidThaiCidFormat(cleaned)) {
    return false;
  }

  const providedChecksum = parseInt(cleaned[12]);
  const calculatedChecksum = calculateChecksum(cleaned);

  return providedChecksum === calculatedChecksum;
}

/**
 * Format Thai CID as X-XXXX-XXXXX-XX-X
 */
export function formatThaiCid(cid: string): string {
  if (!cid) return '';

  const cleaned = cid.replace(/\D/g, '');

  if (cleaned.length !== 13) {
    return cid; // Return as-is if invalid length
  }

  return `${cleaned[0]}-${cleaned.slice(1, 5)}-${cleaned.slice(5, 10)}-${cleaned.slice(10, 12)}-${cleaned[12]}`;
}

/**
 * Remove formatting from Thai CID
 */
export function cleanThaiCid(cid: string): string {
  return cid.replace(/\D/g, '');
}

/**
 * Generate a valid test Thai CID (for testing only)
 */
export function generateTestThaiCid(): string {
  // Generate random 12 digits (first digit must be 1-8)
  const firstDigit = Math.floor(Math.random() * 8) + 1;
  const middleDigits = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
  const partialCid = `${firstDigit}${middleDigits}`;

  // Calculate checksum
  const checksum = calculateChecksum(partialCid);

  return `${partialCid}${checksum}`;
}
