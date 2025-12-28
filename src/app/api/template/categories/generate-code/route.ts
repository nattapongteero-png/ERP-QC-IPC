import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';

export async function GET() {
  try {
    const code = await executeDbOperation(async (db) => {
      const templateCategories = getTableRef('templateCategories');

      // Get the latest category to determine the next code
      const [latestCategory] = await db
        .select({ code: templateCategories.code })
        .from(templateCategories)
        .orderBy(desc(templateCategories.id))
        .limit(1);

      let nextNumber = 1;

      if (latestCategory?.code) {
        // Try to extract number from code like "CAT-001" or "CAT-123"
        const match = latestCategory.code.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        } else {
          // If no number found, use timestamp-based
          nextNumber = Date.now() % 100000;
        }
      }

      // Format code with zero-padded number
      return `CAT-${String(nextNumber).padStart(3, '0')}`;
    });

    return NextResponse.json({
      success: true,
      data: { code },
    });
  } catch (error) {
    console.error('Error generating code:', error);

    // Fallback to timestamp-based code
    const fallbackCode = `CAT-${Date.now().toString(36).toUpperCase()}`;

    return NextResponse.json({
      success: true,
      data: { code: fallbackCode },
    });
  }
}
