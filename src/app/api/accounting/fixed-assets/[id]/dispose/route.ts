/**
 * Asset Disposal API Route
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 */

import { NextRequest, NextResponse } from 'next/server';
import { disposeAsset, getFixedAssetById } from '@/lib/services/accounting-assets.service';
import { z } from 'zod';

const disposeAssetSchema = z.object({
  disposalDate: z.string().min(10).describe('วันที่จำหน่าย'),
  disposalType: z.enum(['sale', 'scrap', 'write_off', 'donation']).describe('ประเภทการจำหน่าย'),
  salePrice: z.number().min(0).optional().describe('ราคาขาย'),
  notes: z.string().optional().describe('หมายเหตุ'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    if (asset.status === 'disposed') {
      return NextResponse.json({ error: 'Asset is already disposed' }, { status: 400 });
    }

    const body = await request.json();
    const validation = disposeAssetSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // TODO: Get createdBy from session
    const result = await disposeAsset(assetId, validation.data);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error disposing asset:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to dispose asset' },
      { status: 500 }
    );
  }
}
