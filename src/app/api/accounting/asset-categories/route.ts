/**
 * Asset Categories API Route
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { listAssetCategories, createAssetCategory } from '@/lib/services/accounting-assets.service';
import { assetCategoryCreateSchema } from '@/lib/validation/accounting';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const categories = await listAssetCategories();
      return NextResponse.json({ success: true, data: categories });
    } catch (error) {
      console.error('Error fetching asset categories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch asset categories' },
        { status: 500 }
      );
    }

  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();

      const validation = assetCategoryCreateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.flatten() },
          { status: 400 }
        );
      }

      const result = await createAssetCategory(validation.data);
      return NextResponse.json({ success: true, data: result }, { status: 201 });
    } catch (error) {
      console.error('Error creating asset category:', error);
      return NextResponse.json(
        { error: 'Failed to create asset category' },
        { status: 500 }
      );
    }

  });
}
