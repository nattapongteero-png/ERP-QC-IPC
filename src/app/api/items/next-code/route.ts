import { NextRequest, NextResponse } from 'next/server';
import { generateNextCode } from '@/lib/services/item-code-pattern.service';
import { ITEM_TYPES, type ItemTypeCode } from '@/lib/validation/item-code-pattern';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') ?? 'raw_material') as string;
    const safeType: ItemTypeCode = (ITEM_TYPES as readonly string[]).includes(type)
      ? (type as ItemTypeCode)
      : 'raw_material';

    const nextCode = await generateNextCode(safeType);
    return NextResponse.json({ success: true, data: { code: nextCode } });
  } catch (error) {
    console.error('Error generating item code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate item code' },
      { status: 500 }
    );
  }
}
