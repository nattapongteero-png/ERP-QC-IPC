/**
 * Variance posting is disabled on purpose.
 *
 * postVariances() used to insert a journal_entries HEADER with
 * totalDebit/totalCredit and status:'posted' while never inserting a single
 * journal_lines row, and never choosing a Dr/Cr account. That produces a
 * "posted" entry the trial balance cannot see — the header count and the line
 * sum disagree and the amount is untraceable.
 *
 * These tests pin the disable in place so it cannot be silently re-enabled
 * before the underlying work (real variance amounts + account mapping + lines
 * written in the same transaction) is actually done.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initializeDatabase, getDb } from '@/lib/db';
import { getTableRef } from '@/lib/db/db-helper';
import { postVariances } from '@/lib/services/variance-analysis.service';

describe('postVariances (disabled)', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  it('throws instead of posting', async () => {
    await expect(postVariances([1], undefined, 1)).rejects.toThrow(
      'VARIANCE_POSTING_DISABLED',
    );
  });

  it('throws even with no variance ids, so nothing slips through', async () => {
    await expect(postVariances(undefined, undefined, 1)).rejects.toThrow(
      'VARIANCE_POSTING_DISABLED',
    );
  });

  it('creates no journal entry when called', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- getDb()
    // returns a SQLite|MySQL union whose builders don't unify.
    const db = (await getDb()) as any;
    const je = getTableRef('journalEntries');

    const before = await db.select().from(je);
    await postVariances([1, 2, 3], undefined, 1).catch(() => undefined);
    const after = await db.select().from(je);

    // The point of the disable: not one header may be written.
    expect(after.length).toBe(before.length);
  });

  it('leaves no journal entry without lines anywhere in the ledger', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await getDb()) as any;
    const je = getTableRef('journalEntries');
    const jl = getTableRef('journalLines');

    const entries = await db.select().from(je);
    const lines = await db.select().from(jl);

    const withLines = new Set(lines.map((l: { journalEntryId: number }) => l.journalEntryId));
    const orphans = entries.filter((e: { id: number }) => !withLines.has(e.id));

    // A header with no lines is the exact corruption this guards against: it
    // claims Dr=Cr=X while the trial balance, which reads lines, sees nothing.
    expect(orphans).toEqual([]);
  });
});
