import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';
import { vmiPortalConfigService } from '@/lib/services/vmi-portal-config.service';

export interface TppItem {
  tppCode: string;
  tppName: string;
}

export interface TppLookupResponse {
  success: boolean;
  data: TppItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    // Get the first enabled portal configuration
    const portals = await vmiPortalConfigService.getEnabledWithApiKeys();
    if (portals.length === 0) {
      return errorResponse('No VMI Portal configured. Please configure a VMI Portal in Settings.');
    }

    const portal = portals[0];
    const baseUrl = portal.portalUrl.replace(/\/$/, ''); // Remove trailing slash

    const params = new URLSearchParams({
      limit,
      offset,
    });
    if (search) {
      params.set('search', search);
    }

    const response = await fetch(
      `${baseUrl}/api/external/vendor/lookup/tpp?${params}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': portal.decryptedApiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VMI Portal TPP lookup failed:', response.status, errorText);
      return errorResponse(`VMI Portal error: ${response.status}`);
    }

    const data: TppLookupResponse = await response.json();

    return successResponse({
      items: data.data || [],
      pagination: data.pagination || { total: 0, limit: 50, offset: 0, hasMore: false },
    });
  } catch (error) {
    console.error('TPP lookup error:', error);
    return serverErrorResponse(error);
  }
}
