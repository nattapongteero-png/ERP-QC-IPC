/**
 * Item Code Pattern master API.
 *
 * GET    /api/master-data/item-code-patterns       — list one row per item type
 * POST   /api/master-data/item-code-patterns       — upsert pattern for a type
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
  previewCode,
} from '@/lib/services/item-code-pattern.service';
import {
  itemCodePatternSchema,
  ITEM_TYPES,
} from '@/lib/validation/item-code-pattern';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const rows = await listPatterns();
      const enriched = rows.map((p) => ({
        ...p,
        previewSample: previewCode({
          itemType: p.itemType,
          prefix: p.prefix,
          separator: p.separator,
          padding: p.padding,
          includeYear: p.includeYear,
          yearFormat: p.yearFormat,
          yearPosition: p.yearPosition,
          sequenceStart: p.sequenceStart,
          isActive: p.isActive,
          notes: p.notes ?? null,
        }, p.sequenceStart || 1),
      }));
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
      const parsed = itemCodePatternSchema.safeParse(data);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues.map((i) => i.message).join('; '));
      }
      if (!(ITEM_TYPES as readonly string[]).includes(parsed.data.itemType)) {
        return errorResponse(`itemType must be one of: ${ITEM_TYPES.join(', ')}`);
      }
      const row = await savePattern(parsed.data, session.userId);
      return successResponse(row, `Pattern saved for ${row.itemType}`);
    } catch (err) {
      return serverErrorResponse(err);
    }
  }, ['inventory:write']);
}
