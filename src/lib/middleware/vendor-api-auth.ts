/**
 * Vendor API Authentication Middleware
 * Validates X-API-Key header for external vendor API calls
 * Provides both TPP and TTMT codes for data filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { vendorApiKeyService, type ValidatedVendor, type VendorProductCodes } from '@/lib/services/vendor-api-key.service';

export interface VendorApiContext {
  vendor: ValidatedVendor;
  productCodes: VendorProductCodes; // Contains both tppCodes and ttmtCodes
}

export type VendorApiHandler = (
  request: NextRequest,
  context: VendorApiContext
) => Promise<NextResponse>;

/**
 * Wrap API route handler with vendor authentication
 */
export function withVendorAuth(handler: VendorApiHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const apiKey = request.headers.get('X-API-Key');

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          code: 'UNAUTHORIZED',
          message: 'API Key is required',
        },
        { status: 401 }
      );
    }

    const vendor = await vendorApiKeyService.validateApiKey(apiKey);

    if (!vendor) {
      return NextResponse.json(
        {
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired API Key',
        },
        { status: 401 }
      );
    }

    // Get vendor's product codes (both TPP and TTMT) for data filtering
    const productCodes = await vendorApiKeyService.getVendorProductCodes(vendor.vendorId);

    if (productCodes.tppCodes.length === 0 && productCodes.ttmtCodes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'NO_PRODUCTS',
          message: 'No products associated with this vendor',
        },
        { status: 403 }
      );
    }

    return handler(request, { vendor, productCodes });
  };
}

/**
 * Standard error response format
 */
export function vendorApiError(
  code: string,
  message: string,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      code,
      message,
    },
    { status }
  );
}

/**
 * Standard success response format
 */
export function vendorApiSuccess<T>(
  data: T,
  message: string = 'Success'
): NextResponse {
  return NextResponse.json({
    success: true,
    code: 'SUCCESS',
    message,
    data,
  });
}
