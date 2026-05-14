/**
 * Asset Depreciation History API Route
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getAssetDepreciationHistory, getFixedAssetById } from '@/lib/services/accounting-assets.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const assetId = parseInt(id, 10);

      if (isNaN(assetId)) {
        return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
      }

      // Check if asset exists
      const asset = await getFixedAssetById(assetId);
      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      const history = await getAssetDepreciationHistory(assetId);
      return NextResponse.json({
        success: true,
        data: {
          asset: {
            id: asset.id,
            assetCode: asset.assetCode,
            nameTh: asset.nameTh,
            nameEn: asset.nameEn,
            acquisitionCost: asset.acquisitionCost,
            accumulatedDepreciation: asset.accumulatedDepreciation,
            netBookValue: asset.netBookValue,
          },
          history,
        },
      });
    } catch (error) {
      console.error('Error fetching depreciation history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch depreciation history' },
        { status: 500 }
      );
    }

  });
}
