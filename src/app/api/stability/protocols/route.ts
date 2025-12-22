/**
 * Stability Protocols API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * GET /api/stability/protocols - List protocols
 * POST /api/stability/protocols - Create new protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  createProtocol,
  listProtocols,
} from '@/lib/services/stability-service';
import {
  protocolCreateSchema,
  protocolListParamsSchema,
} from '@/lib/validation/stability';

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

    const validatedParams = protocolListParamsSchema.safeParse(params);
    if (!validatedParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: validatedParams.error.format() },
        { status: 400 }
      );
    }

    const protocols = await listProtocols(validatedParams.data);

    return NextResponse.json({
      success: true,
      data: protocols,
    });
  } catch (error) {
    console.error('Error fetching protocols:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch protocols' },
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
    const validated = protocolCreateSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validated.error.format() },
        { status: 400 }
      );
    }

    const protocol = await createProtocol(validated.data, session.userId);

    return NextResponse.json(
      { success: true, data: protocol },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating protocol:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create protocol',
      },
      { status: 500 }
    );
  }
}
