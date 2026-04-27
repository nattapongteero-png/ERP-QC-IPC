import { NextRequest, NextResponse } from 'next/server';
import { like } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';

const PREFIX_MAP: Record<string, string> = {
  raw_material: 'RM',
  packaging: 'PK',
  wip: 'WIP',
  finished_goods: 'FG',
  extract: 'EX',
  consumable: 'CN',
};

function prefixForType(type: string | null): string {
  if (!type) return 'ITM';
  return PREFIX_MAP[type] || 'ITM';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const prefix = prefixForType(type);

    const nextCode = await executeDbOperation(async (db) => {
      const items = getTableRef('items');

      // Pull every existing code that starts with our prefix
      const existing = await db
        .select({ code: items.code })
        .from(items)
        .where(like(items.code, `${prefix}-%`));

      // Extract numeric part from each code, keep only well-formed entries
      const pattern = new RegExp(`^${prefix}-(\\d+)$`);
      const usedNumbers = new Set<number>();
      for (const row of existing) {
        const match = row.code?.match(pattern);
        if (match) {
          usedNumbers.add(parseInt(match[1], 10));
        }
      }

      // Scan sequentially from 1 upward, return the first free slot
      // (this fills gaps from deleted items while keeping ascending order).
      let candidate = 1;
      while (usedNumbers.has(candidate)) {
        candidate += 1;
      }

      return `${prefix}-${String(candidate).padStart(4, '0')}`;
    });

    return NextResponse.json({ success: true, data: { code: nextCode } });
  } catch (error) {
    console.error('Error generating item code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate item code' },
      { status: 500 }
    );
  }
}
