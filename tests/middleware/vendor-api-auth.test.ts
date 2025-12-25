import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withVendorAuth } from '@/lib/middleware/vendor-api-auth';
import { vendorApiKeyService } from '@/lib/services/vendor-api-key.service';

// Mock the vendor API key service
vi.mock('@/lib/services/vendor-api-key.service', () => ({
  vendorApiKeyService: {
    validateApiKey: vi.fn(),
    getVendorProductCodes: vi.fn(),
  },
}));

describe('withVendorAuth middleware', () => {
  const mockHandler = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no API key header is provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/external/vendor/plans');
    const wrappedHandler = withVendorAuth(mockHandler);

    const response = await wrappedHandler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.code).toBe('UNAUTHORIZED');
    expect(data.message).toBe('API Key is required');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('returns 401 when API key is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/external/vendor/plans', {
      headers: { 'X-API-Key': 'invalid_key' },
    });

    vi.mocked(vendorApiKeyService.validateApiKey).mockResolvedValue(null);

    const wrappedHandler = withVendorAuth(mockHandler);
    const response = await wrappedHandler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.code).toBe('UNAUTHORIZED');
    expect(data.message).toBe('Invalid or expired API Key');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('returns 403 when vendor has no products', async () => {
    const request = new NextRequest('http://localhost:3000/api/external/vendor/plans', {
      headers: { 'X-API-Key': 'vmi_erp_valid_key' },
    });

    const mockVendor = {
      vendorId: 1,
      vendorCode: 'V001',
      vendorName: 'Test Vendor',
      keyId: 1,
      permissions: 'read',
    };

    vi.mocked(vendorApiKeyService.validateApiKey).mockResolvedValue(mockVendor);
    vi.mocked(vendorApiKeyService.getVendorProductCodes).mockResolvedValue({
      tppCodes: [],
      ttmtCodes: [],
    });

    const wrappedHandler = withVendorAuth(mockHandler);
    const response = await wrappedHandler(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.code).toBe('NO_PRODUCTS');
    expect(data.message).toBe('No products associated with this vendor');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('calls handler with context when valid API key is provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/external/vendor/plans', {
      headers: { 'X-API-Key': 'vmi_erp_valid_key' },
    });

    const mockVendor = {
      vendorId: 1,
      vendorCode: 'V001',
      vendorName: 'Test Vendor',
      keyId: 1,
      permissions: 'read',
    };

    const mockProductCodes = {
      tppCodes: ['1100010001000', '1100010002000'],
      ttmtCodes: ['A01234567', 'A01234568'],
    };

    vi.mocked(vendorApiKeyService.validateApiKey).mockResolvedValue(mockVendor);
    vi.mocked(vendorApiKeyService.getVendorProductCodes).mockResolvedValue(mockProductCodes);

    const mockResponse = NextResponse.json({ success: true });
    mockHandler.mockResolvedValue(mockResponse);

    const wrappedHandler = withVendorAuth(mockHandler);
    const response = await wrappedHandler(request);

    expect(mockHandler).toHaveBeenCalledWith(request, {
      vendor: mockVendor,
      productCodes: mockProductCodes,
    });
    expect(response).toBe(mockResponse);
  });

  it('calls handler when vendor has only TPP codes', async () => {
    const request = new NextRequest('http://localhost:3000/api/external/vendor/plans', {
      headers: { 'X-API-Key': 'vmi_erp_valid_key' },
    });

    const mockVendor = {
      vendorId: 1,
      vendorCode: 'V001',
      vendorName: 'Test Vendor',
      keyId: 1,
      permissions: 'read',
    };

    const mockProductCodes = {
      tppCodes: ['1100010001000'],
      ttmtCodes: [],
    };

    vi.mocked(vendorApiKeyService.validateApiKey).mockResolvedValue(mockVendor);
    vi.mocked(vendorApiKeyService.getVendorProductCodes).mockResolvedValue(mockProductCodes);

    const mockResponse = NextResponse.json({ success: true });
    mockHandler.mockResolvedValue(mockResponse);

    const wrappedHandler = withVendorAuth(mockHandler);
    await wrappedHandler(request);

    expect(mockHandler).toHaveBeenCalledWith(request, {
      vendor: mockVendor,
      productCodes: mockProductCodes,
    });
  });

  it('calls handler when vendor has only TTMT codes', async () => {
    const request = new NextRequest('http://localhost:3000/api/external/vendor/plans', {
      headers: { 'X-API-Key': 'vmi_erp_valid_key' },
    });

    const mockVendor = {
      vendorId: 1,
      vendorCode: 'V001',
      vendorName: 'Herbal Vendor',
      keyId: 1,
      permissions: 'read',
    };

    const mockProductCodes = {
      tppCodes: [],
      ttmtCodes: ['A01234567', 'A01234568'],
    };

    vi.mocked(vendorApiKeyService.validateApiKey).mockResolvedValue(mockVendor);
    vi.mocked(vendorApiKeyService.getVendorProductCodes).mockResolvedValue(mockProductCodes);

    const mockResponse = NextResponse.json({ success: true });
    mockHandler.mockResolvedValue(mockResponse);

    const wrappedHandler = withVendorAuth(mockHandler);
    await wrappedHandler(request);

    expect(mockHandler).toHaveBeenCalledWith(request, {
      vendor: mockVendor,
      productCodes: mockProductCodes,
    });
  });
});
