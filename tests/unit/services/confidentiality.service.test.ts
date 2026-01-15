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
  addGroupMember,
  removeGroupMember,
  getGroupMembers,
  getUserGroups,
  getUserGroupIds,
  grantBOMAccess,
  revokeBOMAccess,
  getBOMAccessList,
  userHasBOMAccess,
  isLineConfidential,
  getBypassRoles,
  setBypassRoles,
  canViewConfidentialItems,
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

describe('Confidentiality Service - Group Members', () => {
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

  it('should add user to group', async () => {
    // Create a test group
    const group = await createConfidentialAccessGroup({
      code: 'MEMBER_TEST',
      name: 'Member Test Group',
    });

    // Create a test user in the database
    testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('member@test.com', 'hash', 'Test Member', 'USER', 1)`);
    const userIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const userId = userIdResult.id;

    await addGroupMember(group.id, userId, userId);

    const members = await getGroupMembers(group.id);
    expect(members.length).toBe(1);
    expect(members[0].userId).toBe(userId);
  });

  it('should remove user from group', async () => {
    // Similar setup
    const group = await createConfidentialAccessGroup({
      code: 'REMOVE_TEST',
      name: 'Remove Test Group',
    });

    testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('remove@test.com', 'hash', 'Remove Test', 'USER', 1)`);
    const userIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const userId = userIdResult.id;

    await addGroupMember(group.id, userId, userId);
    await removeGroupMember(group.id, userId);

    const members = await getGroupMembers(group.id);
    expect(members.length).toBe(0);
  });

  it('should get user groups', async () => {
    const group = await createConfidentialAccessGroup({
      code: 'USER_GROUPS_TEST',
      name: 'User Groups Test',
    });

    testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('groups@test.com', 'hash', 'Groups Test', 'USER', 1)`);
    const userIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const userId = userIdResult.id;

    await addGroupMember(group.id, userId, userId);

    const groups = await getUserGroups(userId);
    expect(groups.length).toBe(1);
    expect(groups[0].id).toBe(group.id);
  });

  it('should get user group IDs', async () => {
    const group = await createConfidentialAccessGroup({
      code: 'GROUP_IDS_TEST',
      name: 'Group IDs Test',
    });

    testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('ids@test.com', 'hash', 'IDs Test', 'USER', 1)`);
    const userIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const userId = userIdResult.id;

    await addGroupMember(group.id, userId, userId);

    const ids = await getUserGroupIds(userId);
    expect(ids).toContain(group.id);
  });
});

describe('Confidentiality Service - BOM Access', () => {
  beforeEach(() => {
    // Create in-memory SQLite database
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });
    setTestDb(testDb);

    // Create required tables for BOM access testing
    const tables = [
      schema.sqliteUsers,
      schema.sqliteItems,
      schema.sqliteBOM,
      schema.sqliteConfidentialAccessGroups,
      schema.sqliteConfidentialAccessGroupMembers,
      schema.sqliteBOMConfidentialAccess,
    ];

    for (const table of tables) {
      try {
        const createSql = generateCreateTableSql(table);
        testSqlite.exec(createSql);
      } catch (err) {
        console.log(`Table creation note: ${err}`);
      }
    }

    // Seed test user
    testSqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES (1, 'test@example.com', 'hashed_password', 'Test User', 'admin', 1)
    `);

    // Seed test item (required for BOM foreign key)
    testSqlite.exec(`
      INSERT INTO items (id, code, name_th, type, primary_unit, is_active)
      VALUES (1, 'ITEM001', 'Test Item', 'finished_goods', 'unit', 1)
    `);
  });

  afterEach(() => {
    if (testSqlite) {
      testSqlite.close();
    }
  });

  it('should grant user access to BOM', async () => {
    // Create a BOM record first
    testSqlite.exec(`INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit) VALUES ('BOM001', 'Test BOM', 1, '1.0', 'draft', 100, 'kg')`);
    const bomIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const bomId = bomIdResult.id;

    // Create test user
    testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('access@test.com', 'hash', 'Access Test', 'USER', 1)`);
    const userIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const userId = userIdResult.id;

    const result = await grantBOMAccess({ bomId, userId }, userId);
    expect(result.id).toBeGreaterThan(0);
  });

  it('should grant group access to BOM', async () => {
    // Create test data
    testSqlite.exec(`INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit) VALUES ('BOM002', 'Test BOM 2', 1, '1.0', 'draft', 100, 'kg')`);
    const bomIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const bomId = bomIdResult.id;

    testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('granter@test.com', 'hash', 'Granter', 'USER', 1)`);
    const userIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const granterId = userIdResult.id;

    const group = await createConfidentialAccessGroup({ code: 'BOM_ACCESS_GROUP', name: 'BOM Access Group' });

    const result = await grantBOMAccess({ bomId, groupId: group.id }, granterId);
    expect(result.id).toBeGreaterThan(0);
  });

  it('should return BOM access list', async () => {
    testSqlite.exec(`INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit) VALUES ('BOM003', 'Test BOM 3', 1, '1.0', 'draft', 100, 'kg')`);
    const bomIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const bomId = bomIdResult.id;

    testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('list@test.com', 'hash', 'List Test', 'USER', 1)`);
    const userIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const userId = userIdResult.id;

    await grantBOMAccess({ bomId, userId }, userId);

    const grants = await getBOMAccessList(bomId);
    expect(grants.length).toBe(1);
  });

  it('should revoke BOM access', async () => {
    testSqlite.exec(`INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit) VALUES ('BOM004', 'Test BOM 4', 1, '1.0', 'draft', 100, 'kg')`);
    const bomIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const bomId = bomIdResult.id;

    testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('revoke@test.com', 'hash', 'Revoke Test', 'USER', 1)`);
    const userIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const userId = userIdResult.id;

    const grant = await grantBOMAccess({ bomId, userId }, userId);
    await revokeBOMAccess(grant.id);

    const grants = await getBOMAccessList(bomId);
    expect(grants.length).toBe(0);
  });

  it('should check user has direct BOM access', async () => {
    testSqlite.exec(`INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit) VALUES ('BOM005', 'Test BOM 5', 1, '1.0', 'draft', 100, 'kg')`);
    const bomIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const bomId = bomIdResult.id;

    testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('direct@test.com', 'hash', 'Direct Test', 'USER', 1)`);
    const userIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const userId = userIdResult.id;

    await grantBOMAccess({ bomId, userId }, userId);

    const hasAccess = await userHasBOMAccess(userId, bomId);
    expect(hasAccess).toBe(true);
  });

  it('should check user has group-based BOM access', async () => {
    testSqlite.exec(`INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit) VALUES ('BOM006', 'Test BOM 6', 1, '1.0', 'draft', 100, 'kg')`);
    const bomIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const bomId = bomIdResult.id;

    testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('group-access@test.com', 'hash', 'Group Access', 'USER', 1)`);
    const userIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const userId = userIdResult.id;

    const group = await createConfidentialAccessGroup({ code: 'GROUP_ACCESS', name: 'Group Access' });
    await addGroupMember(group.id, userId, userId);
    await grantBOMAccess({ bomId, groupId: group.id }, userId);

    const hasAccess = await userHasBOMAccess(userId, bomId);
    expect(hasAccess).toBe(true);
  });

  it('should return false for user without BOM access', async () => {
    testSqlite.exec(`INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit) VALUES ('BOM007', 'Test BOM 7', 1, '1.0', 'draft', 100, 'kg')`);
    const bomIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const bomId = bomIdResult.id;

    testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('no-access@test.com', 'hash', 'No Access', 'USER', 1)`);
    const userIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    const userId = userIdResult.id;

    const hasAccess = await userHasBOMAccess(userId, bomId);
    expect(hasAccess).toBe(false);
  });
});

describe('Confidentiality Service - Access Checks', () => {
  beforeEach(() => {
    // Create in-memory SQLite database
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });
    setTestDb(testDb);

    // Create required tables for access check testing
    const tables = [
      schema.sqliteUsers,
      schema.sqliteItems,
      schema.sqliteBOM,
      schema.sqliteConfidentialAccessGroups,
      schema.sqliteConfidentialAccessGroupMembers,
      schema.sqliteBOMConfidentialAccess,
      schema.sqliteSettings,
    ];

    for (const table of tables) {
      try {
        const createSql = generateCreateTableSql(table);
        testSqlite.exec(createSql);
      } catch (err) {
        console.log(`Table creation note: ${err}`);
      }
    }

    // Seed test user
    testSqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES (1, 'test@example.com', 'hashed_password', 'Test User', 'ADMIN', 1)
    `);

    // Seed test item (required for BOM foreign key)
    testSqlite.exec(`
      INSERT INTO items (id, code, name_th, type, primary_unit, is_active, confidentiality_level, default_confidential)
      VALUES (1, 'ITEM001', 'Test Item', 'finished_goods', 'unit', 1, 'public', 0)
    `);
  });

  afterEach(() => {
    if (testSqlite) {
      testSqlite.close();
    }
  });

  describe('isLineConfidential', () => {
    it('should return false for public override', () => {
      const result = isLineConfidential(
        { confidentialityOverride: 'public' },
        { defaultConfidential: true }
      );
      expect(result).toBe(false);
    });

    it('should return true for confidential override', () => {
      const result = isLineConfidential(
        { confidentialityOverride: 'confidential' },
        { defaultConfidential: false }
      );
      expect(result).toBe(true);
    });

    it('should inherit from item when override is inherit', () => {
      const result = isLineConfidential(
        { confidentialityOverride: 'inherit' },
        { defaultConfidential: true }
      );
      expect(result).toBe(true);
    });

    it('should return false when inherit and item is not confidential', () => {
      const result = isLineConfidential(
        { confidentialityOverride: 'inherit' },
        { defaultConfidential: false }
      );
      expect(result).toBe(false);
    });

    it('should return true when confidentialityLevel is confidential', () => {
      const result = isLineConfidential(
        { confidentialityOverride: 'inherit' },
        { confidentialityLevel: 'confidential' }
      );
      expect(result).toBe(true);
    });
  });

  describe('getBypassRoles', () => {
    it('should return default ADMIN role when no setting exists', async () => {
      const roles = await getBypassRoles();
      expect(roles).toContain('ADMIN');
    });
  });

  describe('setBypassRoles', () => {
    it('should save and retrieve bypass roles', async () => {
      await setBypassRoles(['ADMIN', 'MANAGER']);
      const roles = await getBypassRoles();
      expect(roles).toEqual(['ADMIN', 'MANAGER']);
    });

    it('should update existing bypass roles setting', async () => {
      await setBypassRoles(['ADMIN']);
      await setBypassRoles(['ADMIN', 'MANAGER', 'SUPERVISOR']);
      const roles = await getBypassRoles();
      expect(roles).toEqual(['ADMIN', 'MANAGER', 'SUPERVISOR']);
    });
  });

  describe('canViewConfidentialItems', () => {
    it('should return true for bypass role user', async () => {
      // Create user with ADMIN role
      testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('admin@test.com', 'hash', 'Admin', 'ADMIN', 1)`);
      const adminIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
      const adminId = adminIdResult.id;

      // Create a BOM
      testSqlite.exec(`INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit) VALUES ('BOM_ADMIN', 'Test BOM', 1, '1.0', 'draft', 100, 'kg')`);
      const bomIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
      const bomId = bomIdResult.id;

      const result = await canViewConfidentialItems(adminId, bomId, 'ADMIN');
      expect(result).toBe(true);
    });

    it('should return true for BOM approver', async () => {
      // Create user
      testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('approver@test.com', 'hash', 'Approver', 'USER', 1)`);
      const approverId = (testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

      // Create BOM approved by user
      testSqlite.exec(`INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit, approved_by) VALUES ('BOM_APPROVER', 'Test BOM', 1, '1.0', 'approved', 100, 'kg', ${approverId})`);
      const bomIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
      const bomId = bomIdResult.id;

      const result = await canViewConfidentialItems(approverId, bomId, 'USER');
      expect(result).toBe(true);
    });

    it('should return true for user with explicit access', async () => {
      // Create two users
      testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('owner3@test.com', 'hash', 'Owner', 'USER', 1)`);
      const ownerId = (testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

      testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('granted@test.com', 'hash', 'Granted', 'USER', 1)`);
      const grantedId = (testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

      // Create BOM
      testSqlite.exec(`INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit) VALUES ('BOM_GRANTED', 'Test BOM', 1, '1.0', 'draft', 100, 'kg')`);
      const bomIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
      const bomId = bomIdResult.id;

      // Grant explicit access
      await grantBOMAccess({ bomId, userId: grantedId }, ownerId);

      const result = await canViewConfidentialItems(grantedId, bomId, 'USER');
      expect(result).toBe(true);
    });

    it('should return false for user without access', async () => {
      // Create two users
      testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('owner4@test.com', 'hash', 'Owner', 'USER', 1)`);
      const ownerId = (testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

      testSqlite.exec(`INSERT INTO users (email, password, name, role, is_active) VALUES ('random2@test.com', 'hash', 'Random', 'USER', 1)`);
      const randomId = (testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

      // Create BOM approved by first user
      testSqlite.exec(`INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit, approved_by) VALUES ('BOM_NO_ACCESS', 'Test BOM', 1, '1.0', 'draft', 100, 'kg', ${ownerId})`);
      const bomIdResult = testSqlite.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
      const bomId = bomIdResult.id;

      const result = await canViewConfidentialItems(randomId, bomId, 'USER');
      expect(result).toBe(false);
    });
  });
});
