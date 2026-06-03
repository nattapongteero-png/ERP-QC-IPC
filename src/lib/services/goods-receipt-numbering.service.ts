/**
 * GRN Number Generator
 * Format: GRN-YYYY-NNNNN (per-year, 5-digit zero-pad, gap-free)
 * Feature: 020-goods-receipt
 */
import { eq } from 'drizzle-orm';
import { executeDbOperation, getTableRef } from '../db/db-helper';
import { dbDate } from '../db/db-helper';

export async function generateGrnNumber(year?: number): Promise<string> {
  const targetYear = year ?? new Date().getFullYear();

  return executeDbOperation(async (db) => {
    const sequences = getTableRef('goodsReceiptSequences');

    // Lookup or create row for this year
    const existing = await db
      .select()
      .from(sequences)
      .where(eq(sequences.year, targetYear))
      .limit(1);

    let nextValue: number;
    if (existing.length === 0) {
      // First GRN of this year — insert row with next_value=2 (we'll use 1 for this GRN)
      nextValue = 1;
      await db.insert(sequences).values({
        year: targetYear,
        nextValue: 2,
        updatedAt: dbDate(),
      });
    } else {
      nextValue = Number(existing[0].nextValue);
      await db
        .update(sequences)
        .set({ nextValue: nextValue + 1, updatedAt: dbDate() })
        .where(eq(sequences.year, targetYear));
    }

    const padded = String(nextValue).padStart(5, '0');
    return `GRN-${targetYear}-${padded}`;
  });
}
