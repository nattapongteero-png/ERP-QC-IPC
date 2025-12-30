/**
 * Unit Tests for VMI Webhook Cryptography Utility
 *
 * Tests HMAC-SHA256 signature validation for webhook requests
 * Per VMI-VENDOR-API.md specification section 10
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateWebhookSecret,
  computeSignature,
  validateSignature,
  validateWebhookRequest,
  createSignedTestPayload,
} from '@/lib/services/vmi-webhook-crypto';

describe('VmiWebhookCrypto', () => {
  const testSecret = 'a'.repeat(64); // 32-byte hex secret
  const testPayload = JSON.stringify({ orderId: 123, poNumber: 'PO-001' });
  const testTimestamp = '1704067200'; // 2024-01-01 00:00:00 UTC

  beforeEach(() => {
    // Mock Date.now to return a fixed timestamp
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateWebhookSecret', () => {
    it('should generate a 64-character hex string', () => {
      const secret = generateWebhookSecret();

      expect(secret).toHaveLength(64);
      expect(/^[a-f0-9]+$/i.test(secret)).toBe(true);
    });

    it('should generate unique secrets on each call', () => {
      const secret1 = generateWebhookSecret();
      const secret2 = generateWebhookSecret();

      expect(secret1).not.toBe(secret2);
    });
  });

  describe('computeSignature', () => {
    it('should compute consistent signature for same inputs', () => {
      const sig1 = computeSignature(testTimestamp, testPayload, testSecret);
      const sig2 = computeSignature(testTimestamp, testPayload, testSecret);

      expect(sig1).toBe(sig2);
    });

    it('should compute different signatures for different payloads', () => {
      const sig1 = computeSignature(testTimestamp, testPayload, testSecret);
      const sig2 = computeSignature(testTimestamp, '{"different":"payload"}', testSecret);

      expect(sig1).not.toBe(sig2);
    });

    it('should compute different signatures for different timestamps', () => {
      const sig1 = computeSignature('1704067200', testPayload, testSecret);
      const sig2 = computeSignature('1704067201', testPayload, testSecret);

      expect(sig1).not.toBe(sig2);
    });

    it('should compute different signatures for different secrets', () => {
      const sig1 = computeSignature(testTimestamp, testPayload, testSecret);
      const sig2 = computeSignature(testTimestamp, testPayload, 'b'.repeat(64));

      expect(sig1).not.toBe(sig2);
    });

    it('should return hex-encoded string', () => {
      const signature = computeSignature(testTimestamp, testPayload, testSecret);

      expect(/^[a-f0-9]+$/i.test(signature)).toBe(true);
      expect(signature.length).toBe(64); // SHA-256 = 32 bytes = 64 hex chars
    });
  });

  describe('validateSignature', () => {
    it('should validate correct signature', () => {
      const signature = computeSignature(testTimestamp, testPayload, testSecret);

      const result = validateSignature(signature, testTimestamp, testPayload, testSecret);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid signature', () => {
      const invalidSignature = 'invalid_signature_here';

      const result = validateSignature(invalidSignature, testTimestamp, testPayload, testSecret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature mismatch');
    });

    it('should reject tampered payload', () => {
      const signature = computeSignature(testTimestamp, testPayload, testSecret);
      const tamperedPayload = JSON.stringify({ orderId: 456, poNumber: 'PO-002' });

      const result = validateSignature(signature, testTimestamp, tamperedPayload, testSecret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature mismatch');
    });

    it('should reject invalid timestamp format', () => {
      const signature = computeSignature(testTimestamp, testPayload, testSecret);

      const result = validateSignature(signature, 'not-a-number', testPayload, testSecret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid timestamp format');
    });

    it('should reject empty timestamp', () => {
      const signature = computeSignature(testTimestamp, testPayload, testSecret);

      const result = validateSignature(signature, '', testPayload, testSecret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid timestamp format');
    });

    it('should reject timestamps older than 5 minutes', () => {
      // Set time 6 minutes into the future
      vi.setSystemTime(new Date('2024-01-01T00:06:00Z'));

      const signature = computeSignature(testTimestamp, testPayload, testSecret);
      const result = validateSignature(signature, testTimestamp, testPayload, testSecret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Timestamp too old (potential replay attack)');
    });

    it('should reject timestamps more than 5 minutes in future', () => {
      // Use a timestamp 6 minutes in the future
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 360).toString();
      const signature = computeSignature(futureTimestamp, testPayload, testSecret);

      const result = validateSignature(signature, futureTimestamp, testPayload, testSecret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Timestamp in future (clock skew)');
    });

    it('should accept timestamps within 5-minute window', () => {
      // Set time 4 minutes into the future (within tolerance)
      vi.setSystemTime(new Date('2024-01-01T00:04:00Z'));

      const signature = computeSignature(testTimestamp, testPayload, testSecret);
      const result = validateSignature(signature, testTimestamp, testPayload, testSecret);

      expect(result.valid).toBe(true);
    });

    it('should return timestamp age in result', () => {
      const signature = computeSignature(testTimestamp, testPayload, testSecret);
      const result = validateSignature(signature, testTimestamp, testPayload, testSecret);

      expect(result.timestampAge).toBeDefined();
      expect(typeof result.timestampAge).toBe('number');
    });
  });

  describe('validateWebhookRequest', () => {
    it('should validate request with correct headers', () => {
      const signature = computeSignature(testTimestamp, testPayload, testSecret);
      const headers = {
        'x-webhook-signature': signature,
        'x-webhook-timestamp': testTimestamp,
      };

      const result = validateWebhookRequest(headers, testPayload, testSecret);

      expect(result.valid).toBe(true);
    });

    it('should reject missing signature header', () => {
      const headers = {
        'x-webhook-timestamp': testTimestamp,
      };

      const result = validateWebhookRequest(headers, testPayload, testSecret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing X-Webhook-Signature header');
    });

    it('should reject missing timestamp header', () => {
      const signature = computeSignature(testTimestamp, testPayload, testSecret);
      const headers = {
        'x-webhook-signature': signature,
      };

      const result = validateWebhookRequest(headers, testPayload, testSecret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing X-Webhook-Timestamp header');
    });

    it('should reject empty headers', () => {
      const result = validateWebhookRequest({}, testPayload, testSecret);

      expect(result.valid).toBe(false);
    });
  });

  describe('createSignedTestPayload', () => {
    it('should create valid signed payload', () => {
      const payload = { orderId: 123, poNumber: 'PO-001' };

      const signed = createSignedTestPayload(payload, testSecret);

      expect(signed.body).toBe(JSON.stringify(payload));
      expect(signed.timestamp).toBeDefined();
      expect(signed.signature).toBeDefined();

      // Verify signature is valid
      const validationResult = validateSignature(
        signed.signature,
        signed.timestamp,
        signed.body,
        testSecret
      );
      expect(validationResult.valid).toBe(true);
    });

    it('should create different signatures for different payloads', () => {
      const payload1 = { orderId: 1 };
      const payload2 = { orderId: 2 };

      const signed1 = createSignedTestPayload(payload1, testSecret);
      const signed2 = createSignedTestPayload(payload2, testSecret);

      expect(signed1.signature).not.toBe(signed2.signature);
    });

    it('should be useful for testing webhook handlers', () => {
      // Example: Testing a webhook handler
      const orderCreatedPayload = {
        orderId: 999,
        poNumber: 'PO-TEST-001',
        hospitalCode: 'HOSP01',
        hospitalName: 'Test Hospital',
        orderDate: '2024-01-01',
        totalValue: '1000.00',
        itemCount: 1,
        items: [
          {
            localCode: 'ITEM01',
            name: 'Test Item',
            quantity: 10,
            unitPrice: '100.00',
          },
        ],
      };

      const signed = createSignedTestPayload(orderCreatedPayload, testSecret);

      // Headers for mock request
      const headers = {
        'x-webhook-signature': signed.signature,
        'x-webhook-timestamp': signed.timestamp,
        'x-webhook-event': 'order.created',
        'x-webhook-delivery-id': 'test-delivery-123',
      };

      // Validate as if received
      const validationResult = validateWebhookRequest(
        {
          'x-webhook-signature': headers['x-webhook-signature'],
          'x-webhook-timestamp': headers['x-webhook-timestamp'],
        },
        signed.body,
        testSecret
      );

      expect(validationResult.valid).toBe(true);
    });
  });

  describe('Security', () => {
    it('should prevent timing attacks with constant-time comparison', () => {
      // This test ensures the comparison doesn't short-circuit on first mismatch
      // We can't directly test timing, but we verify the function accepts/rejects correctly
      const signature = computeSignature(testTimestamp, testPayload, testSecret);

      // Test with various invalid signatures of same length
      const invalidSigs = [
        'a'.repeat(64),
        '0'.repeat(64),
        signature.substring(0, 63) + 'x', // One char different at end
        'x' + signature.substring(1), // One char different at start
      ];

      for (const invalidSig of invalidSigs) {
        const result = validateSignature(invalidSig, testTimestamp, testPayload, testSecret);
        expect(result.valid).toBe(false);
      }
    });

    it('should use standard HMAC-SHA256', () => {
      // Verify we're using standard crypto
      const signature = computeSignature(testTimestamp, testPayload, testSecret);

      // Compute expected signature manually
      const crypto = require('crypto');
      const signedContent = `${testTimestamp}.${testPayload}`;
      const expectedSignature = crypto
        .createHmac('sha256', testSecret)
        .update(signedContent, 'utf8')
        .digest('hex');

      expect(signature).toBe(expectedSignature);
    });
  });
});
