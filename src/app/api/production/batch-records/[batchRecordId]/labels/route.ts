/**
 * Label Verifications API for Batch Records
 * Feature: 009-gmp-compliance-gap-analysis Phase 6 (US14 - T078)
 *
 * GET: Get all label verifications for a batch record
 * POST: Create a new label verification record
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import {
  createLabelVerification,
  getLabelVerificationsForBatchRecord,
  getLabelVerificationDetails,
  type CreateLabelInput,
  type LabelType,
} from '@/lib/services/label-verification.service';

interface RouteContext {
  params: Promise<{ batchRecordId: string }>;
}

/**
 * GET /api/production/batch-records/[batchRecordId]/labels
 * Get all label verifications for a batch record
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { batchRecordId } = await context.params;
    const batchRecordIdNum = parseInt(batchRecordId, 10);

    if (isNaN(batchRecordIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Invalid batch record ID' },
        { status: 400 }
      );
    }

    const labels = await getLabelVerificationsForBatchRecord(batchRecordIdNum);

    // Get details for each label
    const labelsWithDetails = await Promise.all(
      labels.map(async (label) => {
        const details = await getLabelVerificationDetails(label.id);
        return details;
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        batchRecordId: batchRecordIdNum,
        labels: labelsWithDetails.filter(Boolean),
        count: labels.length,
      },
    });
  } catch (error) {
    console.error('Error fetching label verifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch label verifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/production/batch-records/[batchRecordId]/labels
 * Create a new label verification record
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { batchRecordId } = await context.params;
    const batchRecordIdNum = parseInt(batchRecordId, 10);

    if (isNaN(batchRecordIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Invalid batch record ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { workOrderId, labelType, imageAttachmentId, productName, batchNumber, expiryDate } = body;

    // Validate required fields
    if (!workOrderId) {
      return NextResponse.json(
        { success: false, error: 'Work order ID is required' },
        { status: 400 }
      );
    }

    if (!labelType) {
      return NextResponse.json(
        { success: false, error: 'Label type is required' },
        { status: 400 }
      );
    }

    // Validate label type
    const validLabelTypes: LabelType[] = ['product_label', 'batch_label', 'carton_label', 'shipper_label'];
    if (!validLabelTypes.includes(labelType)) {
      return NextResponse.json(
        { success: false, error: `Invalid label type. Must be one of: ${validLabelTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const input: CreateLabelInput = {
      workOrderId: parseInt(workOrderId, 10),
      batchRecordId: batchRecordIdNum,
      labelType,
      imageAttachmentId: imageAttachmentId ? parseInt(imageAttachmentId, 10) : undefined,
      productName,
      batchNumber,
      expiryDate,
    };

    const result = await createLabelVerification(input);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Get full details
    const details = await getLabelVerificationDetails(result.labelId!);

    return NextResponse.json({
      success: true,
      data: details,
    });
  } catch (error) {
    console.error('Error creating label verification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create label verification' },
      { status: 500 }
    );
  }
}
