/**
 * Confidentiality Service Tests
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 *
 * Tests for Confidential Access Group CRUD operations:
 * - createConfidentialAccessGroup
 * - getConfidentialAccessGroup
 * - listConfidentialAccessGroups
 * - updateConfidentialAccessGroup
 * - deleteConfidentialAccessGroup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

// Hoisted test database getter/setter
const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: any = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: any) => { _testDb = db; },
  };
});

let testSqlite: Database.Database;
let testDb: any;

// Mock the database module
vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  schema,
}));

// Mock audit module
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import after mocks are set up
import {
  createConfidentialAccessGroup,
  getConfidentialAccessGroup,
  listConfidentialAccessGroups,
  updateConfidentialAccessGroup,
  deleteConfidentialAccessGroup,
} from '@/lib/services/confidentiality.service';

describe('Confidentiality Service - Groups', () => {
  beforeEach(() => {
    // Create in-memory SQLite database
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });
    setTestDb(testDb);

    // Create required tables for confidentiality testing
    const tables = [
      schema.sqliteUsers,
      schema.sqliteConfidentialAccessGroups,
      schema.sqliteConfidentialAccessGroupMembers,
    ];

    for (const table of tables) {
      try {
        const createSql = generateCreateTableSql(table);
        testSqlite.exec(createSql);
      } catch (err) {
        console.log(`Table creation note: ${err}`);
      }
    }

    // Seed test user (using actual schema column names)
    testSqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES (1, 'test@example.com', 'hashed_password', 'Test User', 'admin', 1)
    `);
  });

  afterEach(() => {
    if (testSqlite) {
      testSqlite.close();
    }
  });

  describe('createConfidentialAccessGroup', () => {
    it('should create a new group with all fields', async () => {
      const result = await createConfidentialAccessGroup({
        code: 'RND_TEAM_A',
        name: 'R&D Team A',
        description: 'Research and development team for formulation',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.code).toBe('RND_TEAM_A');
    });

    it('should create a group with minimal fields', async () => {
      const result = await createConfidentialAccessGroup({
        code: 'SIMPLE_GROUP',
        name: 'Simple Group',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.code).toBe('SIMPLE_GROUP');
    });
  });

  describe('getConfidentialAccessGroup', () => {
    it('should return group with member count of 0 when no members', async () => {
      const created = await createConfidentialAccessGroup({
        code: 'TEST_GROUP',
        name: 'Test Group',
      });

      const result = await getConfidentialAccessGroup(created.id);

      expect(result).toBeDefined();
      expect(result?.code).toBe('TEST_GROUP');
      expect(result?.name).toBe('Test Group');
      expect(result?.memberCount).toBe(0);
    });

    it('should return null for non-existent group', async () => {
      const result = await getConfidentialAccessGroup(99999);
      expect(result).toBeNull();
    });

    it('should return correct member count when members exist', async () => {
      const created = await createConfidentialAccessGroup({
        code: 'TEAM_WITH_MEMBERS',
        name: 'Team With Members',
      });

      // Add members directly to the table
      testSqlite.exec(`
        INSERT INTO confidential_access_group_members (group_id, user_id, added_at)
        VALUES (${created.id}, 1, '2025-01-01T00:00:00.000Z')
      `);

      const result = await getConfidentialAccessGroup(created.id);

      expect(result?.memberCount).toBe(1);
    });
  });

  describe('listConfidentialAccessGroups', () => {
    it('should return empty array when no groups exist', async () => {
      const result = await listConfidentialAccessGroups();
      expect(result).toEqual([]);
    });

    it('should return all groups ordered by name', async () => {
      await createConfidentialAccessGroup({ code: 'GROUP_B', name: 'Beta Group' });
      await createConfidentialAccessGroup({ code: 'GROUP_A', name: 'Alpha Group' });
      await createConfidentialAccessGroup({ code: 'GROUP_C', name: 'Charlie Group' });

      const result = await listConfidentialAccessGroups();

      expect(result.length).toBe(3);
      expect(result[0].name).toBe('Alpha Group');
      expect(result[1].name).toBe('Beta Group');
      expect(result[2].name).toBe('Charlie Group');
    });

    it('should include member counts for each group', async () => {
      const group1 = await createConfidentialAccessGroup({ code: 'GROUP_1', name: 'Group One' });
      await createConfidentialAccessGroup({ code: 'GROUP_2', name: 'Group Two' });

      // Add member to group 1 only
      testSqlite.exec(`
        INSERT INTO confidential_access_group_members (group_id, user_id, added_at)
        VALUES (${group1.id}, 1, '2025-01-01T00:00:00.000Z')
      `);

      const result = await listConfidentialAccessGroups();

      expect(result.length).toBe(2);
      const groupOne = result.find(g => g.code === 'GROUP_1');
      const groupTwo = result.find(g => g.code === 'GROUP_2');
      expect(groupOne?.memberCount).toBe(1);
      expect(groupTwo?.memberCount).toBe(0);
    });
  });

  describe('updateConfidentialAccessGroup', () => {
    it('should update group name', async () => {
      const created = await createConfidentialAccessGroup({
        code: 'UPDATE_TEST',
        name: 'Original Name',
      });

      await updateConfidentialAccessGroup(created.id, { name: 'Updated Name' });

      const updated = await getConfidentialAccessGroup(created.id);
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.code).toBe('UPDATE_TEST'); // code unchanged
    });

    it('should update group code', async () => {
      const created = await createConfidentialAccessGroup({
        code: 'OLD_CODE',
        name: 'Test Group',
      });

      await updateConfidentialAccessGroup(created.id, { code: 'NEW_CODE' });

      const updated = await getConfidentialAccessGroup(created.id);
      expect(updated?.code).toBe('NEW_CODE');
    });

    it('should update description', async () => {
      const created = await createConfidentialAccessGroup({
        code: 'DESC_TEST',
        name: 'Test Group',
        description: 'Original description',
      });

      await updateConfidentialAccessGroup(created.id, { description: 'Updated description' });

      const updated = await getConfidentialAccessGroup(created.id);
      expect(updated?.description).toBe('Updated description');
    });

    it('should update multiple fields at once', async () => {
      const created = await createConfidentialAccessGroup({
        code: 'MULTI_UPDATE',
        name: 'Original',
      });

      await updateConfidentialAccessGroup(created.id, {
        name: 'New Name',
        description: 'New Description',
      });

      const updated = await getConfidentialAccessGroup(created.id);
      expect(updated?.name).toBe('New Name');
      expect(updated?.description).toBe('New Description');
    });
  });

  describe('deleteConfidentialAccessGroup', () => {
    it('should delete group and return true', async () => {
      const created = await createConfidentialAccessGroup({
        code: 'DELETE_TEST',
        name: 'To Delete',
      });

      await deleteConfidentialAccessGroup(created.id);

      const result = await getConfidentialAccessGroup(created.id);
      expect(result).toBeNull();
    });

    it('should also delete associated members', async () => {
      const created = await createConfidentialAccessGroup({
        code: 'DELETE_WITH_MEMBERS',
        name: 'To Delete With Members',
      });

      // Add member
      testSqlite.exec(`
        INSERT INTO confidential_access_group_members (group_id, user_id, added_at)
        VALUES (${created.id}, 1, '2025-01-01T00:00:00.000Z')
      `);

      await deleteConfidentialAccessGroup(created.id);

      // Verify both group and members are deleted
      const group = await getConfidentialAccessGroup(created.id);
      expect(group).toBeNull();

      const memberCount = testSqlite
        .prepare('SELECT COUNT(*) as count FROM confidential_access_group_members WHERE group_id = ?')
        .get(created.id) as { count: number };
      expect(memberCount.count).toBe(0);
    });

    it('should not affect other groups', async () => {
      const group1 = await createConfidentialAccessGroup({
        code: 'KEEP_THIS',
        name: 'Keep This',
      });
      const group2 = await createConfidentialAccessGroup({
        code: 'DELETE_THIS',
        name: 'Delete This',
      });

      await deleteConfidentialAccessGroup(group2.id);

      const result = await getConfidentialAccessGroup(group1.id);
      expect(result).toBeDefined();
      expect(result?.code).toBe('KEEP_THIS');
    });
  });
});
