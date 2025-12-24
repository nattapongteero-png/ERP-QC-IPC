/**
 * Electronic Signatures API
 *
 * GET /api/signatures?entityType=...&entityId=...
 * Returns signatures for a specific entity (line_clearance, label_verification, disposition, etc.)
 *
 * FR-074: System MUST display signature details including: full name, title, timestamp, meaning, signature ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSignaturesForEntity, verifySignatureIntegrity } from '@/lib/services/electronic-signature-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const verifyIntegrity = searchParams.get('verify') === 'true';

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      );
    }

    const signatures = await getSignaturesForEntity(entityType, parseInt(entityId, 10));

    // Optionally verify signature integrity
    if (verifyIntegrity) {
      const signaturesWithVerification = await Promise.all(
        signatures.map(async (sig) => {
          const integrity = await verifySignatureIntegrity(sig.id);
          return {
            ...sig,
            integrityValid: integrity.valid,
            integrityError: integrity.error,
          };
        })
      );

      return NextResponse.json({
        signatures: signaturesWithVerification,
        count: signaturesWithVerification.length,
      });
    }

    return NextResponse.json({
      signatures,
      count: signatures.length,
    });
  } catch (error) {
    console.error('Error fetching signatures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signatures' },
      { status: 500 }
    );
  }
}
