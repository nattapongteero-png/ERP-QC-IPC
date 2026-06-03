/**
 * Lot Pattern master API.
 *
 * GET  /api/master-data/lot-patterns  — list both rows (system + vendor)
 * POST /api/master-data/lot-patterns  — upsert one pattern
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listPatterns,
  savePattern,
  previewSystemLot,
} from '@/lib/services/lot-pattern.service';
import { lotPatternSchema, PATTERN_TYPES } from '@/lib/validation/lot-pattern';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const rows = await listPatterns();
      const enriched = rows.map((p) => {
        if (p.patternType !== 'system') return p;
        return {
          ...p,
          previewSample: previewSystemLot({
            patternType: 'system',
            prefix: p.prefix,
            separator: p.separator,
            includeDate: p.includeDate,
            dateFormat: p.dateFormat,
            sequenceType: p.sequenceType,
            sequenceLength: p.sequenceLength,
            sequenceStart: p.sequenceStart,
            regexPattern: p.regexPattern,
            hintTh: p.hintTh,
            hintEn: p.hintEn,
            isActive: p.isActive,
            notes: p.notes,
          }, p.sequenceStart || 1),
        };
      });
      return successResponse(enriched);
    } catch (err) {
      return serverErrorResponse(err);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const data = await request.json();
      const parsed = lotPatternSchema.safeParse(data);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues.map((i) => i.message).join('; '));
      }
      if (!(PATTERN_TYPES as readonly string[]).includes(parsed.data.patternType)) {
        return errorResponse(`patternType must be one of: ${PATTERN_TYPES.join(', ')}`);
      }
      // Validate regex compiles, if provided
      if (parsed.data.regexPattern) {
        try { new RegExp(parsed.data.regexPattern); }
        catch { return errorResponse('regexPattern is not a valid regular expression'); }
      }
      const row = await savePattern(parsed.data, session.userId);
      return successResponse(row, `Lot pattern '${row.patternType}' saved`);
    } catch (err) {
      return serverErrorResponse(err);
    }
  }, ['inventory:write']);
}
