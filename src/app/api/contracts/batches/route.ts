/**
 * Contract Batches API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * GET /api/contracts/batches - List contract batches
 * POST /api/contracts/batches - Create new batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createContractBatch, listContractBatches } from '@/lib/services/contracts-service';
import { batchCreateSchema, batchListParamsSchema } from '@/lib/validation/contracts';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validatedParams = batchListParamsSchema.safeParse(params);
    if (!validatedParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: validatedParams.error.format() },
        { status: 400 }
      );
    }

    const result = await listContractBatches(validatedParams.data);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching contract batches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch batches' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = batchCreateSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validated.error.format() },
        { status: 400 }
      );
    }

    const batch = await createContractBatch(validated.data, session.userId);

    return NextResponse.json(
      { success: true, data: batch },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating contract batch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create batch',
      },
      { status: 500 }
    );
  }
}
