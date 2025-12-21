import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';

const VMI_PORTAL_BASE_URL = 'https://vmi-portal.bmscloud.in.th';
const VMI_API_KEY = process.env.VMI_PORTAL_API_KEY || '';

export interface TtmtItem {
  ttmtCode: string;
  activeIngredient: string;
  strength: string;
  dosageForm: string;
  dispensingUnit: string;
  tradeName: string;
  manufacturer: string;
  fsn: string; // Full Specified Name - this will be used as ttmtName
  tmtType: string;
}

export interface TtmtLookupResponse {
  success: boolean;
  data: TtmtItem[];
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

    if (!VMI_API_KEY) {
      return errorResponse('VMI Portal API key not configured');
    }

    const params = new URLSearchParams({
      limit,
      offset,
    });
    if (search) {
      params.set('search', search);
    }

    const response = await fetch(
      `${VMI_PORTAL_BASE_URL}/api/external/vendor/lookup/ttmt?${params}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': VMI_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VMI Portal TTMT lookup failed:', response.status, errorText);
      return errorResponse(`VMI Portal error: ${response.status}`);
    }

    const data: TtmtLookupResponse = await response.json();

    return successResponse({
      items: data.data || [],
      pagination: data.pagination || { total: 0, limit: 50, offset: 0, hasMore: false },
    });
  } catch (error) {
    console.error('TTMT lookup error:', error);
    return serverErrorResponse(error);
  }
}
