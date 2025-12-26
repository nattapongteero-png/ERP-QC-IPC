import { NextResponse } from 'next/server';
import { db, getTableRef } from '@/lib/db';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const templateItems = getTableRef('templateItems');

    // Get the latest item to determine the next code
    const [latestItem] = await db
      .select({ code: templateItems.code })
      .from(templateItems)
      .orderBy(desc(templateItems.id))
      .limit(1);

    let nextNumber = 1;

    if (latestItem?.code) {
      // Try to extract number from code like "ITEM-001" or "ITEM-123"
      const match = latestItem.code.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      } else {
        // If no number found, use timestamp-based
        nextNumber = Date.now() % 100000;
      }
    }

    // Format code with zero-padded number
    const code = `ITEM-${String(nextNumber).padStart(4, '0')}`;

    return NextResponse.json({
      success: true,
      data: { code },
    });
  } catch (error) {
    console.error('Error generating code:', error);

    // Fallback to timestamp-based code
    const fallbackCode = `ITEM-${Date.now().toString(36).toUpperCase()}`;

    return NextResponse.json({
      success: true,
      data: { code: fallbackCode },
    });
  }
}
