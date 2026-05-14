/**
 * Single Fixed Asset API Route
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getFixedAssetById, updateFixedAsset, deleteFixedAsset } from '@/lib/services/accounting-assets.service';
import { fixedAssetUpdateSchema } from '@/lib/validation/accounting';

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

      const asset = await getFixedAssetById(assetId);
      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: asset });
    } catch (error) {
      console.error('Error fetching fixed asset:', error);
      return NextResponse.json(
        { error: 'Failed to fetch fixed asset' },
        { status: 500 }
      );
    }

  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const assetId = parseInt(id, 10);

      if (isNaN(assetId)) {
        return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
      }

      const body = await request.json();
      const validation = fixedAssetUpdateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.flatten() },
          { status: 400 }
        );
      }

      // Check if asset exists
      const existing = await getFixedAssetById(assetId);
      if (!existing) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      await updateFixedAsset(assetId, validation.data);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error updating fixed asset:', error);
      return NextResponse.json(
        { error: 'Failed to update fixed asset' },
        { status: 500 }
      );
    }

  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const assetId = parseInt(id, 10);

      if (isNaN(assetId)) {
        return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
      }

      // TODO: Get userId from session when auth is implemented
      const userId = session.userId;

      await deleteFixedAsset(assetId, userId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting fixed asset:', error);

      // Return appropriate status codes based on error message
      if (error instanceof Error) {
        if (error.message === 'Fixed asset not found') {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message === 'Cannot delete asset with disposal records') {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(
        { error: 'Failed to delete fixed asset' },
        { status: 500 }
      );
    }

  });
}
