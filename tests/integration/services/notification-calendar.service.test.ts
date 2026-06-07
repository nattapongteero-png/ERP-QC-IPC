/**
 * Integration Tests: getCalendarItems month-range query
 * Feature: 022-equipment-notifications
 *
 * Regression guard for the empty-calendar bug: the month range filter compared
 * a datetime column against ISO 'T'/'Z' strings (never matched on MySQL).
 * These tests verify items inside the month are returned (incl. last-day
 * boundary) and items in adjacent months are excluded.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as schema from '@/lib/db/schema';
import Database from 'better-sqlite3';

const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: unknown = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: unknown) => {
      _testDb = db;
    },
  };
});

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  markSchemaSynced: () => {},
  schema,
}));

import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../helpers/test-db';
import {
  createNotification,
  getCalendarItems,
} from '@/lib/services/equipment-notification.service';

describe('getCalendarItems (month range)', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    const setup = setupTestDatabase([schema.sqliteEquipmentNotifications]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(() => {
    cleanTables(sqlite, ['equipment_notifications']);
  });

  async function seed(entityId: number, dueAt: string) {
    return createNotification({
      entityType: 'equipment',
      entityId,
      type: 'maintenance_due',
      title: `cal-${entityId}`,
      dueAt,
    });
  }

  it('returns items within the month, including the last-day boundary', async () => {
    await seed(1, '2026-06-15T08:00:00.000Z');
    await seed(2, '2026-06-30T23:00:00.000Z'); // last day, late time
    const items = await getCalendarItems('2026-06');
    const ids = items.map((i) => i.title).sort();
    expect(ids).toEqual(['cal-1', 'cal-2']);
    // date is YYYY-MM-DD for calendar cell matching
    expect(items.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date))).toBe(true);
  });

  it('excludes items from adjacent months', async () => {
    await seed(3, '2026-05-31T23:00:00.000Z'); // previous month
    await seed(4, '2026-07-01T00:00:00.000Z'); // next month
    await seed(5, '2026-06-10T00:00:00.000Z'); // in month
    const items = await getCalendarItems('2026-06');
    expect(items.map((i) => i.title)).toEqual(['cal-5']);
  });

  it('handles the December → January boundary', async () => {
    await seed(6, '2026-12-25T00:00:00.000Z');
    await seed(7, '2027-01-01T00:00:00.000Z');
    const items = await getCalendarItems('2026-12');
    expect(items.map((i) => i.title)).toEqual(['cal-6']);
  });

  it('returns empty when no items fall in the month', async () => {
    await seed(8, '2026-03-15T00:00:00.000Z');
    const items = await getCalendarItems('2026-06');
    expect(items).toEqual([]);
  });
});
