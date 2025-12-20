/**
 * Unit Tests for VMI Portal Service
 *
 * Tests the VmiPortalService class for VMI Portal API integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { VmiPortalService, VmiPortalError } from '@/lib/services/vmi-portal.service';
import { encrypt } from '@/lib/crypto/encrypt';

describe('VmiPortalService', () => {
  const originalEnv = {
    VMI_ENCRYPTION_KEY: process.env.VMI_ENCRYPTION_KEY,
    VMI_PORTAL_BASE_URL: process.env.VMI_PORTAL_BASE_URL,
  };

  const testApiKey = 'test-api-key-12345';
  let encryptedApiKey: string;

  beforeAll(() => {
    // Set up encryption key
    process.env.VMI_ENCRYPTION_KEY = 'a'.repeat(64);
    encryptedApiKey = encrypt(testApiKey);
  });

  afterAll(() => {
    // Restore original env
    if (originalEnv.VMI_ENCRYPTION_KEY) {
      process.env.VMI_ENCRYPTION_KEY = originalEnv.VMI_ENCRYPTION_KEY;
    } else {
      delete process.env.VMI_ENCRYPTION_KEY;
    }
    if (originalEnv.VMI_PORTAL_BASE_URL) {
      process.env.VMI_PORTAL_BASE_URL = originalEnv.VMI_PORTAL_BASE_URL;
    } else {
      delete process.env.VMI_PORTAL_BASE_URL;
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create service with valid config', () => {
      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: encryptedApiKey,
      });

      expect(service).toBeDefined();
    });

    it('should use custom baseUrl if provided', () => {
      const customUrl = 'https://custom-vmi-portal.example.com/api';
      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: encryptedApiKey,
        baseUrl: customUrl,
      });

      expect(service).toBeDefined();
    });

    it('should use environment baseUrl if not provided', () => {
      process.env.VMI_PORTAL_BASE_URL = 'https://env-vmi-portal.example.com/api';
      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: encryptedApiKey,
      });

      expect(service).toBeDefined();
      delete process.env.VMI_PORTAL_BASE_URL;
    });
  });

  describe('testConnection', () => {
    it('should return true when connection is successful', async () => {
      // Mock successful response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }),
      });

      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: encryptedApiKey,
        baseUrl: 'https://test-vmi-portal.example.com/api',
      });

      const result = await service.testConnection();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': testApiKey,
          }),
        })
      );
    });

    it('should throw VmiPortalError for authentication errors', async () => {
      // Mock 401 response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          error: { code: 'UNAUTHORIZED', message: 'Invalid API Key' },
        }),
      });

      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: encryptedApiKey,
        baseUrl: 'https://test-vmi-portal.example.com/api',
      });

      await expect(service.testConnection()).rejects.toThrow(VmiPortalError);
    });

    it('should return false for network errors', async () => {
      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: encryptedApiKey,
        baseUrl: 'https://test-vmi-portal.example.com/api',
      });

      const result = await service.testConnection();
      expect(result).toBe(false);
    });
  });
});

describe('VmiPortalError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new VmiPortalError('UNAUTHORIZED', 'Invalid API Key', 401);

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Invalid API Key');
      expect(error.httpStatus).toBe(401);
      expect(error.name).toBe('VmiPortalError');
    });

    it('should create error with details', () => {
      const details = { field: 'apiKey', reason: 'expired' };
      const error = new VmiPortalError('API_KEY_EXPIRED', 'Key expired', 401, details);

      expect(error.details).toEqual(details);
    });
  });

  describe('getUserMessage', () => {
    it('should return Thai message for UNAUTHORIZED', () => {
      const error = new VmiPortalError('UNAUTHORIZED', 'Invalid API Key');
      expect(error.getUserMessage('th')).toBe('API Key ไม่ถูกต้อง');
    });

    it('should return English message for UNAUTHORIZED', () => {
      const error = new VmiPortalError('UNAUTHORIZED', 'Invalid API Key');
      expect(error.getUserMessage('en')).toBe('Invalid API Key');
    });

    it('should return Thai message for VALIDATION_ERROR', () => {
      const error = new VmiPortalError('VALIDATION_ERROR', 'Invalid data');
      expect(error.getUserMessage('th')).toBe('ข้อมูลไม่ถูกต้อง');
    });

    it('should return Thai message for ORDER_NOT_FOUND', () => {
      const error = new VmiPortalError('ORDER_NOT_FOUND', 'Order not found');
      expect(error.getUserMessage('th')).toBe('ไม่พบคำสั่งซื้อ');
    });

    it('should return Thai message for INVALID_STATUS_TRANSITION', () => {
      const error = new VmiPortalError('INVALID_STATUS_TRANSITION', 'Cannot change status');
      expect(error.getUserMessage('th')).toBe('ไม่สามารถเปลี่ยนสถานะได้');
    });

    it('should default to English', () => {
      const error = new VmiPortalError('UNAUTHORIZED', 'Invalid API Key');
      expect(error.getUserMessage()).toBe('Invalid API Key');
    });
  });
});
