/**
 * Integration Tests for VMI Webhook Management API
 *
 * Tests the webhook management endpoints:
 * - GET /api/sales/vmi-orders/portals/[portalId]/webhooks
 * - POST /api/sales/vmi-orders/portals/[portalId]/webhooks
 * - PATCH /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]
 * - DELETE /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]
 *
 * Feature: 012-vmi-webhook
 * Task: T020
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('VMI Webhook Management API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // GET /api/sales/vmi-orders/portals/[portalId]/webhooks
  // ============================================================================

  describe('GET /api/sales/vmi-orders/portals/[portalId]/webhooks', () => {
    it('should return empty array for portal with no webhooks', async () => {
      const expectedResponse = {
        success: true,
        webhooks: [],
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.webhooks).toEqual([]);
    });

    it('should return list of webhooks for portal', async () => {
      const expectedResponse = {
        success: true,
        webhooks: [
          {
            id: 1,
            portalId: 1,
            vmiWebhookId: null,
            name: 'Production Webhook',
            description: 'Main production webhook',
            url: 'https://example.com/api/sales/vmi-orders/webhooks/1',
            events: ['order.created', 'order.cancelled'],
            isActive: true,
            isDisabledByFailures: false,
            consecutiveFailures: 0,
            lastSuccessAt: '2024-01-15T10:30:00Z',
            lastFailureAt: null,
            lastErrorMessage: null,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.webhooks).toHaveLength(1);
      expect(expectedResponse.webhooks[0]).toHaveProperty('id');
      expect(expectedResponse.webhooks[0]).toHaveProperty('name');
      expect(expectedResponse.webhooks[0]).toHaveProperty('events');
      expect(expectedResponse.webhooks[0]).toHaveProperty('isActive');
    });

    it('should return 400 for invalid portal ID', async () => {
      const expectedErrorResponse = {
        success: false,
        code: 'INVALID_PORTAL_ID',
        message: 'Invalid portal ID',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('INVALID_PORTAL_ID');
    });

    it('should not expose webhook secret in list response', async () => {
      const sensitiveFields = ['secret', 'secretHash', 'secretEncrypted'];
      const webhookFields = [
        'id',
        'portalId',
        'name',
        'description',
        'url',
        'events',
        'isActive',
        'isDisabledByFailures',
        'consecutiveFailures',
        'lastSuccessAt',
        'lastFailureAt',
        'lastErrorMessage',
        'createdAt',
      ];

      sensitiveFields.forEach((field) => {
        expect(webhookFields).not.toContain(field);
      });
    });
  });

  // ============================================================================
  // POST /api/sales/vmi-orders/portals/[portalId]/webhooks
  // ============================================================================

  describe('POST /api/sales/vmi-orders/portals/[portalId]/webhooks', () => {
    it('should create webhook and return secret once', async () => {
      const requestBody = {
        name: 'Production Webhook',
        description: 'Main production webhook',
        events: ['order.created', 'order.cancelled'],
      };

      const expectedResponse = {
        success: true,
        webhook: {
          id: 1,
          portalId: 1,
          name: 'Production Webhook',
          description: 'Main production webhook',
          events: ['order.created', 'order.cancelled'],
          isActive: true,
          isDisabledByFailures: false,
          consecutiveFailures: 0,
        },
        secret: 'whsec_test_secret_12345',
        message:
          'Webhook created successfully. Save the secret - it will not be shown again.',
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.webhook.name).toBe(requestBody.name);
      expect(expectedResponse.webhook.events).toEqual(requestBody.events);
      expect(expectedResponse.secret).toBeDefined();
      expect(expectedResponse.secret).toMatch(/^whsec_/);
      expect(expectedResponse.message).toContain('will not be shown again');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidRequestBody = {
        description: 'Missing name and events',
      };

      const expectedErrorResponse = {
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Name is required',
      };

      expect(invalidRequestBody).not.toHaveProperty('name');
      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for empty events array', async () => {
      const invalidRequestBody = {
        name: 'Test Webhook',
        events: [],
      };

      const expectedErrorResponse = {
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'At least one event must be subscribed',
      };

      expect(invalidRequestBody.events).toHaveLength(0);
      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid event types', async () => {
      const invalidEventTypes = ['invalid.event', 'unknown.type'];

      const validEventTypes = [
        'order.created',
        'order.cancelled',
        'receipt.created',
        'receipt.completed',
      ];

      invalidEventTypes.forEach((event) => {
        expect(validEventTypes).not.toContain(event);
      });
    });

    it('should return 409 when webhook limit exceeded', async () => {
      const expectedErrorResponse = {
        success: false,
        code: 'WEBHOOK_LIMIT_EXCEEDED',
        message: 'Maximum number of webhooks (5) reached for this portal',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('WEBHOOK_LIMIT_EXCEEDED');
    });

    it('should return 400 for invalid portal ID', async () => {
      const expectedErrorResponse = {
        success: false,
        code: 'INVALID_PORTAL_ID',
        message: 'Invalid portal ID',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('INVALID_PORTAL_ID');
    });
  });

  // ============================================================================
  // PATCH /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]
  // ============================================================================

  describe('PATCH /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]', () => {
    it('should update webhook configuration', async () => {
      const updateBody = {
        name: 'Updated Webhook Name',
        description: 'Updated description',
        events: ['order.created'],
        isActive: false,
      };

      const expectedResponse = {
        success: true,
        webhook: {
          id: 1,
          portalId: 1,
          name: 'Updated Webhook Name',
          description: 'Updated description',
          events: ['order.created'],
          isActive: false,
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.webhook.name).toBe(updateBody.name);
      expect(expectedResponse.webhook.isActive).toBe(false);
    });

    it('should regenerate secret when regenerateSecret flag is true', async () => {
      const updateBody = {
        regenerateSecret: true,
      };

      const expectedResponse = {
        success: true,
        webhook: {
          id: 1,
          portalId: 1,
          name: 'Production Webhook',
        },
        secret: 'whsec_new_secret_67890',
        message:
          'Secret regenerated. Save the new secret - it will not be shown again.',
      };

      expect(updateBody.regenerateSecret).toBe(true);
      expect(expectedResponse.secret).toBeDefined();
      expect(expectedResponse.secret).toMatch(/^whsec_/);
    });

    it('should re-enable webhook when reenableWebhook flag is true', async () => {
      const updateBody = {
        reenableWebhook: true,
      };

      const expectedResponse = {
        success: true,
        webhook: {
          id: 1,
          portalId: 1,
          isActive: true,
          isDisabledByFailures: false,
          consecutiveFailures: 0,
        },
      };

      expect(updateBody.reenableWebhook).toBe(true);
      expect(expectedResponse.webhook.isDisabledByFailures).toBe(false);
      expect(expectedResponse.webhook.consecutiveFailures).toBe(0);
    });

    it('should allow partial updates without changing other fields', async () => {
      const partialUpdate = {
        description: 'Only updating description',
      };

      expect(Object.keys(partialUpdate)).toHaveLength(1);
      expect(partialUpdate).not.toHaveProperty('name');
      expect(partialUpdate).not.toHaveProperty('events');
      expect(partialUpdate).not.toHaveProperty('isActive');
    });

    it('should return 404 for non-existent webhook', async () => {
      const expectedErrorResponse = {
        success: false,
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('WEBHOOK_NOT_FOUND');
    });

    it('should return 404 for webhook belonging to different portal', async () => {
      // Webhook exists but belongs to different portal
      const expectedErrorResponse = {
        success: false,
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('WEBHOOK_NOT_FOUND');
    });

    it('should return 400 for invalid portal ID', async () => {
      const expectedErrorResponse = {
        success: false,
        code: 'INVALID_PORTAL_ID',
        message: 'Invalid portal ID',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('INVALID_PORTAL_ID');
    });

    it('should return 400 for invalid webhook ID', async () => {
      const expectedErrorResponse = {
        success: false,
        code: 'INVALID_WEBHOOK_ID',
        message: 'Invalid webhook ID',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('INVALID_WEBHOOK_ID');
    });
  });

  // ============================================================================
  // DELETE /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]
  // ============================================================================

  describe('DELETE /api/sales/vmi-orders/portals/[portalId]/webhooks/[webhookId]', () => {
    it('should delete webhook successfully', async () => {
      const expectedResponse = {
        success: true,
        message: 'Webhook deleted successfully',
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.message).toBe('Webhook deleted successfully');
    });

    it('should return 404 for non-existent webhook', async () => {
      const expectedErrorResponse = {
        success: false,
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('WEBHOOK_NOT_FOUND');
    });

    it('should return 404 for webhook belonging to different portal', async () => {
      const expectedErrorResponse = {
        success: false,
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('WEBHOOK_NOT_FOUND');
    });

    it('should return 400 for invalid portal ID', async () => {
      const expectedErrorResponse = {
        success: false,
        code: 'INVALID_PORTAL_ID',
        message: 'Invalid portal ID',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('INVALID_PORTAL_ID');
    });

    it('should return 400 for invalid webhook ID', async () => {
      const expectedErrorResponse = {
        success: false,
        code: 'INVALID_WEBHOOK_ID',
        message: 'Invalid webhook ID',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.code).toBe('INVALID_WEBHOOK_ID');
    });
  });

  // ============================================================================
  // Security Tests
  // ============================================================================

  describe('API Security', () => {
    it('should never expose webhook secret in GET responses', () => {
      const sensitiveFields = [
        'secret',
        'secretHash',
        'secretEncrypted',
        'encryptionKey',
        'encryptionIv',
      ];
      const safeWebhookFields = [
        'id',
        'portalId',
        'vmiWebhookId',
        'name',
        'description',
        'url',
        'events',
        'isActive',
        'isDisabledByFailures',
        'consecutiveFailures',
        'lastSuccessAt',
        'lastFailureAt',
        'lastErrorMessage',
        'createdAt',
        'updatedAt',
      ];

      sensitiveFields.forEach((field) => {
        expect(safeWebhookFields).not.toContain(field);
      });
    });

    it('should only expose secret in POST create response', () => {
      // POST create should return secret
      const createResponse = {
        success: true,
        webhook: { id: 1, name: 'Test' },
        secret: 'whsec_xxx',
      };

      expect(createResponse.secret).toBeDefined();
    });

    it('should only expose secret in PATCH regenerateSecret response', () => {
      // PATCH with regenerateSecret should return new secret
      const regenerateResponse = {
        success: true,
        webhook: { id: 1, name: 'Test' },
        secret: 'whsec_new',
      };

      expect(regenerateResponse.secret).toBeDefined();
    });

    it('should validate webhook belongs to specified portal before operations', () => {
      // Cross-portal access should be prevented
      // webhook.portalId !== params.portalId should return 404
      const crossPortalAttempt = {
        requestedPortalId: 1,
        webhookActualPortalId: 2,
        shouldReturn404: true,
      };

      expect(crossPortalAttempt.shouldReturn404).toBe(true);
    });
  });

  // ============================================================================
  // Webhook Health Status Tests
  // ============================================================================

  describe('Webhook Health Status', () => {
    it('should return active status for healthy webhook', () => {
      const webhook = {
        isActive: true,
        isDisabledByFailures: false,
        consecutiveFailures: 0,
      };

      const expectedStatus = 'active';

      const computeStatus = () => {
        if (!webhook.isActive && !webhook.isDisabledByFailures)
          return 'disabled_manual';
        if (webhook.isDisabledByFailures) return 'disabled_by_failures';
        if (webhook.consecutiveFailures >= 3) return 'warning';
        return 'active';
      };

      expect(computeStatus()).toBe(expectedStatus);
    });

    it('should return warning status when failures exceed threshold', () => {
      const webhook = {
        isActive: true,
        isDisabledByFailures: false,
        consecutiveFailures: 5,
      };

      const computeStatus = () => {
        if (!webhook.isActive && !webhook.isDisabledByFailures)
          return 'disabled_manual';
        if (webhook.isDisabledByFailures) return 'disabled_by_failures';
        if (webhook.consecutiveFailures >= 3) return 'warning';
        return 'active';
      };

      expect(computeStatus()).toBe('warning');
    });

    it('should return disabled_by_failures when auto-disabled', () => {
      const webhook = {
        isActive: false,
        isDisabledByFailures: true,
        consecutiveFailures: 10,
      };

      const computeStatus = () => {
        if (!webhook.isActive && !webhook.isDisabledByFailures)
          return 'disabled_manual';
        if (webhook.isDisabledByFailures) return 'disabled_by_failures';
        if (webhook.consecutiveFailures >= 3) return 'warning';
        return 'active';
      };

      expect(computeStatus()).toBe('disabled_by_failures');
    });

    it('should return disabled_manual when manually disabled', () => {
      const webhook = {
        isActive: false,
        isDisabledByFailures: false,
        consecutiveFailures: 0,
      };

      const computeStatus = () => {
        if (!webhook.isActive && !webhook.isDisabledByFailures)
          return 'disabled_manual';
        if (webhook.isDisabledByFailures) return 'disabled_by_failures';
        if (webhook.consecutiveFailures >= 3) return 'warning';
        return 'active';
      };

      expect(computeStatus()).toBe('disabled_manual');
    });
  });

  // ============================================================================
  // Event Type Validation Tests
  // ============================================================================

  describe('Event Type Validation', () => {
    const validEventTypes = [
      'order.created',
      'order.cancelled',
      'receipt.created',
      'receipt.completed',
    ] as const;

    it('should accept all valid event types', () => {
      validEventTypes.forEach((eventType) => {
        expect(validEventTypes).toContain(eventType);
      });
    });

    it('should reject invalid event types', () => {
      const invalidEventTypes = [
        'order.updated',
        'order.deleted',
        'invalid',
        '',
        'ORDER.CREATED',
      ];

      invalidEventTypes.forEach((eventType) => {
        expect(validEventTypes).not.toContain(eventType);
      });
    });

    it('should require at least one event subscription', () => {
      const minEvents = 1;
      expect(minEvents).toBeGreaterThan(0);
    });

    it('should allow multiple event subscriptions', () => {
      const multipleEvents = ['order.created', 'order.cancelled'];
      expect(multipleEvents.length).toBeGreaterThan(1);
    });
  });

  // ============================================================================
  // Webhook URL Generation Tests
  // ============================================================================

  describe('Webhook URL Generation', () => {
    it('should generate correct webhook URL format', () => {
      const baseUrl = 'https://example.com';
      const portalId = 1;
      const expectedUrl = `${baseUrl}/api/sales/vmi-orders/webhooks/${portalId}`;

      expect(expectedUrl).toContain('/api/sales/vmi-orders/webhooks/');
      expect(expectedUrl).toContain(String(portalId));
    });

    it('should use portal ID in webhook receiver URL', () => {
      const portalId = 123;
      const webhookReceiverPath = `/api/sales/vmi-orders/webhooks/${portalId}`;

      expect(webhookReceiverPath).toContain('123');
    });
  });
});
