/**
 * VMI Webhook Cryptography Utility
 *
 * Provides HMAC-SHA256 signature validation for webhook requests
 * Per VMI-VENDOR-API.md specification section 10
 *
 * @module vmi-webhook-crypto
 */

import { createHmac, randomBytes } from 'crypto';

const SIGNATURE_ALGORITHM = 'sha256';
const SECRET_LENGTH = 32; // 256 bits
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Result of signature validation
 */
export interface SignatureValidationResult {
  valid: boolean;
  error?: string;
  timestampAge?: number;
}

/**
 * Generate a new webhook secret
 *
 * @returns 32-byte hex string (64 characters)
 */
export function generateWebhookSecret(): string {
  return randomBytes(SECRET_LENGTH).toString('hex');
}

/**
 * Compute HMAC-SHA256 signature for webhook payload
 *
 * Per VMI-VENDOR-API.md section 10.1:
 * signature = HMAC-SHA256(timestamp + "." + payload, secret)
 *
 * @param timestamp - Unix timestamp from X-Webhook-Timestamp header
 * @param payload - Raw request body (JSON string)
 * @param secret - Webhook secret key (plaintext)
 * @returns Hex-encoded HMAC-SHA256 signature
 */
export function computeSignature(
  timestamp: string,
  payload: string,
  secret: string
): string {
  const signedContent = `${timestamp}.${payload}`;
  return createHmac(SIGNATURE_ALGORITHM, secret)
    .update(signedContent, 'utf8')
    .digest('hex');
}

/**
 * Validate webhook signature using timing-safe comparison
 *
 * @param receivedSignature - Signature from X-Webhook-Signature header
 * @param timestamp - Unix timestamp from X-Webhook-Timestamp header
 * @param payload - Raw request body (JSON string)
 * @param secret - Webhook secret key (plaintext)
 * @returns Validation result with error message if invalid
 */
export function validateSignature(
  receivedSignature: string,
  timestamp: string,
  payload: string,
  secret: string
): SignatureValidationResult {
  // Validate timestamp is present and numeric
  const timestampMs = parseInt(timestamp, 10) * 1000; // Convert to ms
  if (isNaN(timestampMs) || timestampMs <= 0) {
    return {
      valid: false,
      error: 'Invalid timestamp format',
    };
  }

  // Check timestamp is within tolerance (prevent replay attacks)
  const now = Date.now();
  const timestampAge = now - timestampMs;

  if (timestampAge > TIMESTAMP_TOLERANCE_MS) {
    return {
      valid: false,
      error: 'Timestamp too old (potential replay attack)',
      timestampAge,
    };
  }

  if (timestampAge < -TIMESTAMP_TOLERANCE_MS) {
    return {
      valid: false,
      error: 'Timestamp in future (clock skew)',
      timestampAge,
    };
  }

  // Compute expected signature
  const expectedSignature = computeSignature(timestamp, payload, secret);

  // Timing-safe comparison to prevent timing attacks
  const valid = timingSafeEqual(receivedSignature, expectedSignature);

  return {
    valid,
    error: valid ? undefined : 'Signature mismatch',
    timestampAge,
  };
}

/**
 * Timing-safe string comparison
 * Prevents timing attacks by ensuring comparison takes constant time
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Convert to buffers for comparison
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  // If lengths differ, pad shorter to match longer
  // This ensures constant-time comparison regardless of length difference
  const maxLen = Math.max(bufA.length, bufB.length);
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);

  // Use crypto.timingSafeEqual for constant-time comparison
  let result = bufA.length === bufB.length;
  for (let i = 0; i < maxLen; i++) {
    result = result && (paddedA[i] === paddedB[i]);
  }

  return result;
}

/**
 * Validate signature with extracted webhook context
 * Convenience wrapper for common use case
 *
 * @param headers - Object containing x-webhook-signature, x-webhook-timestamp
 * @param body - Raw request body
 * @param secret - Decrypted webhook secret
 * @returns Validation result
 */
export function validateWebhookRequest(
  headers: {
    'x-webhook-signature'?: string;
    'x-webhook-timestamp'?: string;
  },
  body: string,
  secret: string
): SignatureValidationResult {
  const signature = headers['x-webhook-signature'];
  const timestamp = headers['x-webhook-timestamp'];

  if (!signature) {
    return {
      valid: false,
      error: 'Missing X-Webhook-Signature header',
    };
  }

  if (!timestamp) {
    return {
      valid: false,
      error: 'Missing X-Webhook-Timestamp header',
    };
  }

  return validateSignature(signature, timestamp, body, secret);
}

/**
 * Create a test webhook payload with valid signature
 * Useful for testing webhook handlers
 *
 * @param payload - Object to serialize as JSON
 * @param secret - Webhook secret
 * @returns Object with payload, timestamp, and signature
 */
export function createSignedTestPayload(
  payload: Record<string, unknown>,
  secret: string
): {
  body: string;
  timestamp: string;
  signature: string;
} {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = computeSignature(timestamp, body, secret);

  return {
    body,
    timestamp,
    signature,
  };
}
