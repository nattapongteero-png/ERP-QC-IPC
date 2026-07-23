/**
 * Unit tests for VMI PO cancellation (CANCEL-PO-VENDOR-GUIDE).
 *
 * These lock down the wire contract with the portal, because getting it wrong
 * fails silently in production: the old implementation sent
 * `PATCH /orders/{id}` with `{action:'reject'}`, which the portal never
 * accepted, and the failure was swallowed by a catch block.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VmiPortalService, VmiPortalError, isRetryableError } from '@/lib/services/vmi-portal.service';
import { VMI_CANCEL_REASON_CODES, VMI_CANCEL_REASON_LABELS } from '@/types/vmi';

const BASE_URL = 'https://vmi-portal.example.com/api/external/vendor';
const API_KEY = 'vmi_vend_TEST_secret';

function makeService() {
  return new VmiPortalService({
    vendorId: 7,
    apiKeyEncrypted: API_KEY,
    baseUrl: BASE_URL,
  });
}

function mockJson(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  });
}

const SUCCESS_BODY = {
  success: true,
  vendorId: 54,
  orderId: 3402,
  poNumber: '6900041',
  previousStatus: 'confirmed',
  newStatus: 'cancelled',
  cancelledAt: '2026-07-22T15:39:20.000Z',
  message: 'Order cancelled successfully',
};

describe('VmiPortalService.cancelOrder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs to /orders/{id}/cancel with the portal snake_case body', async () => {
    const fetchMock = mockJson(200, SUCCESS_BODY);
    global.fetch = fetchMock;

    const result = await makeService().cancelOrder(3402, {
      reason_code: 'OUT_OF_STOCK',
      reason_text: 'สินค้าหมดสต็อก ขอยกเลิก PO',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];

    // The endpoint shape is the whole point of this change.
    expect(url).toBe(`${BASE_URL}/orders/3402/cancel`);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      reason_code: 'OUT_OF_STOCK',
      reason_text: 'สินค้าหมดสต็อก ขอยกเลิก PO',
    });
    expect(result.newStatus).toBe('cancelled');
    expect(result.poNumber).toBe('6900041');
  });

  it('sends the vendor API key and JSON content type', async () => {
    const fetchMock = mockJson(200, SUCCESS_BODY);
    global.fetch = fetchMock;

    await makeService().cancelOrder(3402, {
      reason_code: 'VENDOR_ERROR',
      reason_text: 'ออกใบผิด',
    });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-API-Key']).toBe(API_KEY);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('forwards Idempotency-Key when supplied so retries replay safely', async () => {
    const fetchMock = mockJson(200, SUCCESS_BODY);
    global.fetch = fetchMock;

    await makeService().cancelOrder(
      3402,
      { reason_code: 'OTHER', reason_text: 'ยกเลิก' },
      'herb-cancel-1-3402-OTHER',
    );

    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe(
      'herb-cancel-1-3402-OTHER',
    );
  });

  it('omits Idempotency-Key entirely when not supplied', async () => {
    const fetchMock = mockJson(200, SUCCESS_BODY);
    global.fetch = fetchMock;

    await makeService().cancelOrder(3402, { reason_code: 'OTHER', reason_text: 'ยกเลิก' });

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Idempotency-Key');
  });

  it('passes vendor_reference through when provided', async () => {
    const fetchMock = mockJson(200, SUCCESS_BODY);
    global.fetch = fetchMock;

    await makeService().cancelOrder(3402, {
      reason_code: 'PRICE_CHANGED',
      reason_text: 'ราคาเปลี่ยน',
      vendor_reference: 'HERB-CANCEL-2026-001',
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).vendor_reference).toBe(
      'HERB-CANCEL-2026-001',
    );
  });
});

describe('VmiPortalService.cancelOrder error mapping', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // The cancel endpoint returns a FLAT {success:false, code, message}, unlike the
  // older sync endpoints that nest under `error`. Parsing only the nested shape
  // would relabel every cancel failure as INTERNAL_ERROR.
  it('reads the flat {code,message} error shape the cancel endpoint returns', async () => {
    global.fetch = mockJson(409, {
      success: false,
      code: 'PO_ALREADY_SHIPPED',
      message: 'Cannot cancel a shipped PO — use the Return API',
    });

    await expect(
      makeService().cancelOrder(3402, { reason_code: 'OTHER', reason_text: 'x' }),
    ).rejects.toMatchObject({ code: 'PO_ALREADY_SHIPPED', httpStatus: 409 });
  });

  it('still reads the legacy nested {error:{code}} shape', async () => {
    global.fetch = mockJson(401, {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'bad key' },
    });

    await expect(
      makeService().cancelOrder(1, { reason_code: 'OTHER', reason_text: 'x' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', httpStatus: 401 });
  });

  it.each([
    ['PO_ALREADY_SHIPPED', 409],
    ['IDEMPOTENCY_MISMATCH', 409],
    ['RATE_LIMIT_EXCEEDED', 429],
    ['FORBIDDEN', 403],
    ['ORDER_NOT_FOUND', 404],
    ['VALIDATION_ERROR', 400],
  ])('surfaces %s with a Thai operator message', async (code, status) => {
    global.fetch = mockJson(status, { success: false, code, message: 'portal said no' });

    try {
      await makeService().cancelOrder(1, { reason_code: 'OTHER', reason_text: 'x' });
      expect.unreachable('cancelOrder should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(VmiPortalError);
      const thai = (err as VmiPortalError).getUserMessage('th');
      // Every mapped code must produce real Thai text, not the raw English.
      expect(thai).not.toBe('portal said no');
      expect(thai).toMatch(/[฀-๿]/);
    }
  });

  it('treats a shipped PO as non-retryable but rate limiting as retryable', () => {
    expect(isRetryableError(new VmiPortalError('PO_ALREADY_SHIPPED', 'x', 409))).toBe(false);
    expect(isRetryableError(new VmiPortalError('VALIDATION_ERROR', 'x', 400))).toBe(false);
    // 429 comes with Retry-After — backing off is the documented response.
    expect(isRetryableError(new VmiPortalError('RATE_LIMIT_EXCEEDED', 'x', 429))).toBe(true);
    expect(isRetryableError(new VmiPortalError('INTERNAL_ERROR', 'x', 500))).toBe(true);
    expect(isRetryableError(new VmiPortalError('IDEMPOTENCY_UNAVAILABLE', 'x', 503))).toBe(true);
  });

  it('wraps network failure as INTERNAL_ERROR rather than resolving', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

    await expect(
      makeService().cancelOrder(1, { reason_code: 'OTHER', reason_text: 'x' }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('VMI cancel reason codes', () => {
  it('matches the portal enum exactly', () => {
    expect([...VMI_CANCEL_REASON_CODES]).toEqual([
      'OUT_OF_STOCK',
      'DISCONTINUED',
      'SUPPLIER_UNAVAILABLE',
      'PRICE_CHANGED',
      'VENDOR_ERROR',
      'OTHER',
    ]);
  });

  it('has a Thai label for every code so the dropdown never shows a raw enum', () => {
    for (const code of VMI_CANCEL_REASON_CODES) {
      expect(VMI_CANCEL_REASON_LABELS[code]).toBeTruthy();
      expect(VMI_CANCEL_REASON_LABELS[code]).toMatch(/[฀-๿]/);
    }
  });
});
