/**
 * Fixed Assets API Route
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 */

import { NextRequest, NextResponse } from 'next/server';
import { listFixedAssets, createFixedAsset, getAssetSummary } from '@/lib/services/accounting-assets.service';
import { fixedAssetCreateSchema, fixedAssetQuerySchema } from '@/lib/validation/accounting';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Check if requesting summary
    if (searchParams.get('summary') === 'true') {
      const summary = await getAssetSummary();
      return NextResponse.json({ success: true, data: summary });
    }

    // Parse query filters
    const filters: Record<string, unknown> = {};
    if (searchParams.has('categoryId')) {
      filters.categoryId = parseInt(searchParams.get('categoryId')!, 10);
    }
    if (searchParams.has('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.has('departmentId')) {
      filters.departmentId = parseInt(searchParams.get('departmentId')!, 10);
    }
    if (searchParams.has('acquisitionDateFrom')) {
      filters.acquisitionDateFrom = searchParams.get('acquisitionDateFrom');
    }
    if (searchParams.has('acquisitionDateTo')) {
      filters.acquisitionDateTo = searchParams.get('acquisitionDateTo');
    }

    const validation = fixedAssetQuerySchema.safeParse(filters);
    const queryFilters = validation.success ? validation.data : undefined;

    const assets = await listFixedAssets(queryFilters);
    return NextResponse.json({ success: true, data: assets });
  } catch (error) {
    console.error('Error fetching fixed assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fixed assets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = fixedAssetCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // TODO: Get createdBy from session
    const result = await createFixedAsset(validation.data);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating fixed asset:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create fixed asset' },
      { status: 500 }
    );
  }
}
