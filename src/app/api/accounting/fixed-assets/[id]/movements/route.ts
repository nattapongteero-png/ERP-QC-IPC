/**
 * Asset Movements API Route
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { transferAsset, getAssetMovementHistory, getFixedAssetById } from '@/lib/services/accounting-assets.service';
import { z } from 'zod';

const transferAssetSchema = z.object({
  transferDate: z.string().min(10).describe('วันที่โอนย้าย'),
  fromLocation: z.string().optional().describe('สถานที่เดิม'),
  toLocation: z.string().min(1).describe('สถานที่ใหม่'),
  fromDepartmentId: z.number().positive().optional().describe('แผนกเดิม'),
  toDepartmentId: z.number().positive().optional().describe('แผนกใหม่'),
  reason: z.string().optional().describe('เหตุผลการโอนย้าย'),
});

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

      const movements = await getAssetMovementHistory(assetId);
      return NextResponse.json({ success: true, data: movements });
    } catch (error) {
      console.error('Error fetching asset movements:', error);
      return NextResponse.json(
        { error: 'Failed to fetch asset movements' },
        { status: 500 }
      );
    }

  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

      if (asset.status === 'disposed') {
        return NextResponse.json({ error: 'Cannot transfer a disposed asset' }, { status: 400 });
      }

      const body = await request.json();
      const validation = transferAssetSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.flatten() },
          { status: 400 }
        );
      }

      // TODO: Get createdBy from session
      const result = await transferAsset(assetId, validation.data);
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      console.error('Error transferring asset:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to transfer asset' },
        { status: 500 }
      );
    }

  });
}
