# BOM Confidentiality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Protect confidential BOM items from unauthorized users with flexible access control.

**Architecture:** Add confidentiality flags to items and BOM lines, create access groups system, filter BOM responses at service layer based on user's access rights (bypass roles, ownership, explicit grants).

**Tech Stack:** Next.js 16, Drizzle ORM (MySQL/SQLite), React, DevExtreme, TanStack Query, Zod validation

**Design Reference:** `docs/plans/2026-01-15-bom-confidentiality-design.md`

---

## Phase 1: Database Schema

### Task 1: Add confidentiality columns to items table

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/types/inventory.ts`

**Step 1: Add columns to SQLite items table**

In `src/lib/db/schema.ts`, find `sqliteItems` and add after `isActive`:

```typescript
  confidentialityLevel: text('confidentiality_level').$type<'public' | 'internal' | 'confidential'>().default('public'),
  defaultConfidential: integer('default_confidential', { mode: 'boolean' }).default(false),
```

**Step 2: Add columns to MySQL items table**

Find `mysqlItems` and add after `isActive`:

```typescript
  confidentialityLevel: mysqlEnum('confidentiality_level', ['public', 'internal', 'confidential']).default('public'),
  defaultConfidential: boolean('default_confidential').default(false),
```

**Step 3: Update Item type**

In `src/types/inventory.ts`, add to `Item` interface:

```typescript
  confidentialityLevel?: 'public' | 'internal' | 'confidential';
  defaultConfidential?: boolean;
```

**Step 4: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/db/schema.ts src/types/inventory.ts
git commit -m "feat(schema): add confidentiality columns to items table"
```

---

### Task 2: Add confidentiality columns to bom_lines table

**Files:**
- Modify: `src/lib/db/schema.ts`

**Step 1: Add columns to SQLite bom_lines table**

Find `sqliteBOMLines` and add after `notes`:

```typescript
  isConfidential: integer('is_confidential', { mode: 'boolean' }),
  confidentialityOverride: text('confidentiality_override').$type<'inherit' | 'public' | 'confidential'>().default('inherit'),
```

**Step 2: Add columns to MySQL bom_lines table**

Find `mysqlBOMLines` and add after `notes`:

```typescript
  isConfidential: boolean('is_confidential'),
  confidentialityOverride: mysqlEnum('confidentiality_override', ['inherit', 'public', 'confidential']).default('inherit'),
```

**Step 3: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(schema): add confidentiality columns to bom_lines table"
```

---

### Task 3: Create confidential_access_groups table

**Files:**
- Modify: `src/lib/db/schema.ts`

**Step 1: Add SQLite table after existing tables**

```typescript
// Confidential Access Groups
export const sqliteConfidentialAccessGroups = sqliteTable('confidential_access_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});
```

**Step 2: Add MySQL table**

```typescript
export const mysqlConfidentialAccessGroups = mysqlTable('confidential_access_groups', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});
```

**Step 3: Add exports to schema index**

Find the exports section and add:

```typescript
export {
  sqliteConfidentialAccessGroups,
  mysqlConfidentialAccessGroups,
};
```

**Step 4: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

**Step 5: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(schema): add confidential_access_groups table"
```

---

### Task 4: Create confidential_access_group_members table

**Files:**
- Modify: `src/lib/db/schema.ts`

**Step 1: Add SQLite table**

```typescript
// Confidential Access Group Members
export const sqliteConfidentialAccessGroupMembers = sqliteTable('confidential_access_group_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull().references(() => sqliteConfidentialAccessGroups.id),
  userId: integer('user_id').notNull().references(() => sqliteUsers.id),
  addedAt: text('added_at').default(sql`CURRENT_TIMESTAMP`),
  addedBy: integer('added_by').references(() => sqliteUsers.id),
});
```

**Step 2: Add MySQL table**

```typescript
export const mysqlConfidentialAccessGroupMembers = mysqlTable('confidential_access_group_members', {
  id: int('id').primaryKey().autoincrement(),
  groupId: int('group_id').notNull().references(() => mysqlConfidentialAccessGroups.id),
  userId: int('user_id').notNull().references(() => mysqlUsers.id),
  addedAt: datetime('added_at').default(sql`CURRENT_TIMESTAMP`),
  addedBy: int('added_by').references(() => mysqlUsers.id),
});
```

**Step 3: Add exports**

**Step 4: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

**Step 5: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(schema): add confidential_access_group_members table"
```

---

### Task 5: Create bom_confidential_access table

**Files:**
- Modify: `src/lib/db/schema.ts`

**Step 1: Add SQLite table**

```typescript
// BOM Confidential Access Grants
export const sqliteBOMConfidentialAccess = sqliteTable('bom_confidential_access', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bomId: integer('bom_id').notNull().references(() => sqliteBOM.id),
  userId: integer('user_id').references(() => sqliteUsers.id),
  groupId: integer('group_id').references(() => sqliteConfidentialAccessGroups.id),
  grantedBy: integer('granted_by').notNull().references(() => sqliteUsers.id),
  grantedAt: text('granted_at').default(sql`CURRENT_TIMESTAMP`),
});
```

**Step 2: Add MySQL table**

```typescript
export const mysqlBOMConfidentialAccess = mysqlTable('bom_confidential_access', {
  id: int('id').primaryKey().autoincrement(),
  bomId: int('bom_id').notNull().references(() => mysqlBOM.id),
  userId: int('user_id').references(() => mysqlUsers.id),
  groupId: int('group_id').references(() => mysqlConfidentialAccessGroups.id),
  grantedBy: int('granted_by').notNull().references(() => mysqlUsers.id),
  grantedAt: datetime('granted_at').default(sql`CURRENT_TIMESTAMP`),
});
```

**Step 3: Add exports**

**Step 4: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

**Step 5: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(schema): add bom_confidential_access table"
```

---

## Phase 2: Types and Validation

### Task 6: Create confidentiality types

**Files:**
- Create: `src/types/confidentiality.ts`

**Step 1: Create the types file**

```typescript
/**
 * BOM Confidentiality Types
 * Feature: BOM Confidentiality Protection
 */

export type ConfidentialityLevel = 'public' | 'internal' | 'confidential';
export type ConfidentialityOverride = 'inherit' | 'public' | 'confidential';

// Confidential Access Group
export interface ConfidentialAccessGroup {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  memberCount?: number;
}

export interface ConfidentialAccessGroupCreate {
  code: string;
  name: string;
  description?: string;
}

export interface ConfidentialAccessGroupUpdate {
  code?: string;
  name?: string;
  description?: string;
}

// Group Member
export interface ConfidentialAccessGroupMember {
  id: number;
  groupId: number;
  userId: number;
  addedAt?: string | Date;
  addedBy?: number;
  // Joined fields
  userName?: string;
  userEmail?: string;
}

// BOM Access Grant
export interface BOMConfidentialAccess {
  id: number;
  bomId: number;
  userId?: number | null;
  groupId?: number | null;
  grantedBy: number;
  grantedAt?: string | Date;
  // Joined fields
  userName?: string;
  userEmail?: string;
  groupName?: string;
  groupCode?: string;
  grantedByName?: string;
}

export interface BOMConfidentialAccessCreate {
  bomId: number;
  userId?: number;
  groupId?: number;
}

// Filtered BOM Line (for API response)
export interface FilteredBOMLine {
  id: number;
  sequence: number;
  isConfidential: boolean;
  isHidden: boolean;
  placeholder?: string;
  // Original fields (undefined if hidden)
  itemId?: number;
  itemCode?: string;
  itemName?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  totalCost?: number;
  isOptional?: boolean;
  notes?: string;
  confidentialityOverride?: ConfidentialityOverride;
}

// BOM Confidentiality Info (metadata in response)
export interface BOMConfidentialityInfo {
  hasConfidentialItems: boolean;
  visibleLineCount: number;
  totalLineCount: number;
  userHasFullAccess: boolean;
}

// System setting for bypass roles
export interface ConfidentialBypassRolesSetting {
  roles: string[];
}
```

**Step 2: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/types/confidentiality.ts
git commit -m "feat(types): add confidentiality types"
```

---

### Task 7: Create confidentiality validation schemas

**Files:**
- Create: `src/lib/validation/confidentiality.ts`

**Step 1: Create the validation file**

```typescript
/**
 * BOM Confidentiality Validation Schemas
 * Feature: BOM Confidentiality Protection
 */

import { z } from 'zod';

// Confidentiality levels
export const confidentialityLevelSchema = z.enum(['public', 'internal', 'confidential']);
export const confidentialityOverrideSchema = z.enum(['inherit', 'public', 'confidential']);

// Confidential Access Group
export const confidentialAccessGroupCreateSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const confidentialAccessGroupUpdateSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

// Group Member
export const addGroupMemberSchema = z.object({
  userId: z.number().int().positive(),
});

// BOM Access Grant
export const bomAccessGrantSchema = z.object({
  userId: z.number().int().positive().optional(),
  groupId: z.number().int().positive().optional(),
}).refine(
  (data) => (data.userId !== undefined) !== (data.groupId !== undefined),
  { message: 'Exactly one of userId or groupId must be provided' }
);

// Bypass Roles Setting
export const bypassRolesSettingSchema = z.object({
  roles: z.array(z.string().min(1)),
});

// Item confidentiality update
export const itemConfidentialityUpdateSchema = z.object({
  confidentialityLevel: confidentialityLevelSchema.optional(),
  defaultConfidential: z.boolean().optional(),
});

// BOM line confidentiality update
export const bomLineConfidentialityUpdateSchema = z.object({
  confidentialityOverride: confidentialityOverrideSchema,
});
```

**Step 2: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/lib/validation/confidentiality.ts
git commit -m "feat(validation): add confidentiality validation schemas"
```

---

## Phase 3: Service Layer

### Task 8: Create confidentiality service - Group CRUD

**Files:**
- Create: `src/lib/services/confidentiality.service.ts`
- Create: `tests/unit/services/confidentiality.service.test.ts`

**Step 1: Write failing tests for group CRUD**

```typescript
/**
 * Confidentiality Service Tests
 * Feature: BOM Confidentiality Protection
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestDb, closeTestDb } from '../../setup/test-db';
import * as schema from '@/lib/db/schema';
import {
  createConfidentialAccessGroup,
  getConfidentialAccessGroup,
  listConfidentialAccessGroups,
  updateConfidentialAccessGroup,
  deleteConfidentialAccessGroup,
} from '@/lib/services/confidentiality.service';

describe('Confidentiality Service - Groups', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeAll(async () => {
    db = getTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    // Clean up tables
    await db.delete(schema.sqliteConfidentialAccessGroupMembers);
    await db.delete(schema.sqliteConfidentialAccessGroups);
  });

  describe('createConfidentialAccessGroup', () => {
    it('should create a new group', async () => {
      const result = await createConfidentialAccessGroup({
        code: 'RND_TEAM_A',
        name: 'R&D Team A',
        description: 'Research and development team',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.code).toBe('RND_TEAM_A');
    });

    it('should reject duplicate code', async () => {
      await createConfidentialAccessGroup({
        code: 'TEAM_X',
        name: 'Team X',
      });

      await expect(
        createConfidentialAccessGroup({
          code: 'TEAM_X',
          name: 'Another Team',
        })
      ).rejects.toThrow();
    });
  });

  describe('getConfidentialAccessGroup', () => {
    it('should return group with member count', async () => {
      const created = await createConfidentialAccessGroup({
        code: 'TEST_GROUP',
        name: 'Test Group',
      });

      const result = await getConfidentialAccessGroup(created.id);

      expect(result).toBeDefined();
      expect(result?.code).toBe('TEST_GROUP');
      expect(result?.memberCount).toBe(0);
    });

    it('should return null for non-existent group', async () => {
      const result = await getConfidentialAccessGroup(99999);
      expect(result).toBeNull();
    });
  });

  describe('listConfidentialAccessGroups', () => {
    it('should return all groups', async () => {
      await createConfidentialAccessGroup({ code: 'GROUP_A', name: 'Group A' });
      await createConfidentialAccessGroup({ code: 'GROUP_B', name: 'Group B' });

      const result = await listConfidentialAccessGroups();

      expect(result.length).toBe(2);
    });
  });

  describe('updateConfidentialAccessGroup', () => {
    it('should update group name', async () => {
      const created = await createConfidentialAccessGroup({
        code: 'UPDATE_TEST',
        name: 'Original Name',
      });

      await updateConfidentialAccessGroup(created.id, { name: 'New Name' });

      const updated = await getConfidentialAccessGroup(created.id);
      expect(updated?.name).toBe('New Name');
    });
  });

  describe('deleteConfidentialAccessGroup', () => {
    it('should delete group', async () => {
      const created = await createConfidentialAccessGroup({
        code: 'DELETE_TEST',
        name: 'To Delete',
      });

      await deleteConfidentialAccessGroup(created.id);

      const result = await getConfidentialAccessGroup(created.id);
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/services/confidentiality.service.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement the service**

```typescript
/**
 * Confidentiality Service
 * Feature: BOM Confidentiality Protection
 */

import { eq, and, sql, inArray, count } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import type {
  ConfidentialAccessGroup,
  ConfidentialAccessGroupCreate,
  ConfidentialAccessGroupUpdate,
  ConfidentialAccessGroupMember,
  BOMConfidentialAccess,
  BOMConfidentialAccessCreate,
} from '@/types/confidentiality';

function getTables() {
  return {
    groups: getTableRef('confidentialAccessGroups'),
    groupMembers: getTableRef('confidentialAccessGroupMembers'),
    bomAccess: getTableRef('bomConfidentialAccess'),
    users: getTableRef('users'),
    bom: getTableRef('bom'),
    systemSettings: getTableRef('systemSettings'),
  };
}

// ============ Confidential Access Groups ============

export async function createConfidentialAccessGroup(
  data: ConfidentialAccessGroupCreate
): Promise<{ id: number; code: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db.insert(tables.groups).values({
      code: data.code,
      name: data.name,
      description: data.description || null,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const id = getInsertId(result);
    return { id, code: data.code };
  });
}

export async function getConfidentialAccessGroup(
  id: number
): Promise<ConfidentialAccessGroup | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const rows = await db
      .select({
        id: tables.groups.id,
        code: tables.groups.code,
        name: tables.groups.name,
        description: tables.groups.description,
        createdAt: tables.groups.createdAt,
        updatedAt: tables.groups.updatedAt,
      })
      .from(tables.groups)
      .where(eq(tables.groups.id, id));

    if (rows.length === 0) return null;

    // Get member count
    const countResult = await db
      .select({ count: count() })
      .from(tables.groupMembers)
      .where(eq(tables.groupMembers.groupId, id));

    return {
      ...rows[0],
      memberCount: countResult[0]?.count || 0,
    };
  });
}

export async function listConfidentialAccessGroups(): Promise<ConfidentialAccessGroup[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const rows = await db
      .select({
        id: tables.groups.id,
        code: tables.groups.code,
        name: tables.groups.name,
        description: tables.groups.description,
        createdAt: tables.groups.createdAt,
        updatedAt: tables.groups.updatedAt,
      })
      .from(tables.groups)
      .orderBy(tables.groups.name);

    // Get member counts
    const counts = await db
      .select({
        groupId: tables.groupMembers.groupId,
        count: count(),
      })
      .from(tables.groupMembers)
      .groupBy(tables.groupMembers.groupId);

    const countMap = new Map(counts.map(c => [c.groupId, c.count]));

    return rows.map(row => ({
      ...row,
      memberCount: countMap.get(row.id) || 0,
    }));
  });
}

export async function updateConfidentialAccessGroup(
  id: number,
  data: ConfidentialAccessGroupUpdate
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    await db
      .update(tables.groups)
      .set({
        ...data,
        updatedAt: getNow(),
      })
      .where(eq(tables.groups.id, id));
  });
}

export async function deleteConfidentialAccessGroup(id: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    // Delete members first
    await db.delete(tables.groupMembers).where(eq(tables.groupMembers.groupId, id));
    // Delete group
    await db.delete(tables.groups).where(eq(tables.groups.id, id));
  });
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/services/confidentiality.service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/services/confidentiality.service.ts tests/unit/services/confidentiality.service.test.ts
git commit -m "feat(service): add confidentiality service - group CRUD"
```

---

### Task 9: Add group member management to service

**Files:**
- Modify: `src/lib/services/confidentiality.service.ts`
- Modify: `tests/unit/services/confidentiality.service.test.ts`

**Step 1: Add tests for member management**

Add to test file:

```typescript
describe('Confidentiality Service - Group Members', () => {
  let testGroupId: number;
  let testUserId: number;

  beforeAll(async () => {
    // Create test user
    const userResult = await db.insert(schema.sqliteUsers).values({
      email: 'test-member@example.com',
      passwordHash: 'hash',
      name: 'Test Member',
      role: 'USER',
      isActive: true,
    });
    testUserId = userResult.lastInsertRowid as number;
  });

  beforeEach(async () => {
    await db.delete(schema.sqliteConfidentialAccessGroupMembers);
    await db.delete(schema.sqliteConfidentialAccessGroups);

    const group = await createConfidentialAccessGroup({
      code: 'MEMBER_TEST',
      name: 'Member Test Group',
    });
    testGroupId = group.id;
  });

  describe('addGroupMember', () => {
    it('should add user to group', async () => {
      await addGroupMember(testGroupId, testUserId, testUserId);

      const members = await getGroupMembers(testGroupId);
      expect(members.length).toBe(1);
      expect(members[0].userId).toBe(testUserId);
    });

    it('should reject duplicate member', async () => {
      await addGroupMember(testGroupId, testUserId, testUserId);

      await expect(
        addGroupMember(testGroupId, testUserId, testUserId)
      ).rejects.toThrow();
    });
  });

  describe('removeGroupMember', () => {
    it('should remove user from group', async () => {
      await addGroupMember(testGroupId, testUserId, testUserId);
      await removeGroupMember(testGroupId, testUserId);

      const members = await getGroupMembers(testGroupId);
      expect(members.length).toBe(0);
    });
  });

  describe('getUserGroups', () => {
    it('should return groups user belongs to', async () => {
      await addGroupMember(testGroupId, testUserId, testUserId);

      const groups = await getUserGroups(testUserId);
      expect(groups.length).toBe(1);
      expect(groups[0].id).toBe(testGroupId);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/services/confidentiality.service.test.ts
```

**Step 3: Add member management functions to service**

```typescript
// ============ Group Members ============

export async function addGroupMember(
  groupId: number,
  userId: number,
  addedBy: number
): Promise<{ id: number }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db.insert(tables.groupMembers).values({
      groupId,
      userId,
      addedBy,
      addedAt: getNow(),
    });
    return { id: getInsertId(result) };
  });
}

export async function removeGroupMember(
  groupId: number,
  userId: number
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    await db
      .delete(tables.groupMembers)
      .where(
        and(
          eq(tables.groupMembers.groupId, groupId),
          eq(tables.groupMembers.userId, userId)
        )
      );
  });
}

export async function getGroupMembers(
  groupId: number
): Promise<ConfidentialAccessGroupMember[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    return db
      .select({
        id: tables.groupMembers.id,
        groupId: tables.groupMembers.groupId,
        userId: tables.groupMembers.userId,
        addedAt: tables.groupMembers.addedAt,
        addedBy: tables.groupMembers.addedBy,
        userName: tables.users.name,
        userEmail: tables.users.email,
      })
      .from(tables.groupMembers)
      .leftJoin(tables.users, eq(tables.groupMembers.userId, tables.users.id))
      .where(eq(tables.groupMembers.groupId, groupId));
  });
}

export async function getUserGroups(
  userId: number
): Promise<ConfidentialAccessGroup[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    return db
      .select({
        id: tables.groups.id,
        code: tables.groups.code,
        name: tables.groups.name,
        description: tables.groups.description,
      })
      .from(tables.groupMembers)
      .innerJoin(tables.groups, eq(tables.groupMembers.groupId, tables.groups.id))
      .where(eq(tables.groupMembers.userId, userId));
  });
}

export async function getUserGroupIds(userId: number): Promise<number[]> {
  const groups = await getUserGroups(userId);
  return groups.map(g => g.id);
}
```

**Step 4: Run tests**

```bash
npm test -- tests/unit/services/confidentiality.service.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/services/confidentiality.service.ts tests/unit/services/confidentiality.service.test.ts
git commit -m "feat(service): add group member management"
```

---

### Task 10: Add BOM access grant management

**Files:**
- Modify: `src/lib/services/confidentiality.service.ts`
- Modify: `tests/unit/services/confidentiality.service.test.ts`

**Step 1: Add tests for BOM access grants**

```typescript
describe('Confidentiality Service - BOM Access', () => {
  let testBomId: number;
  let testUserId: number;
  let testGroupId: number;

  beforeAll(async () => {
    // Setup test data (BOM, user, group)
  });

  describe('grantBOMAccess', () => {
    it('should grant user access to BOM', async () => {
      const result = await grantBOMAccess({
        bomId: testBomId,
        userId: testUserId,
      }, testUserId);

      expect(result.id).toBeGreaterThan(0);
    });

    it('should grant group access to BOM', async () => {
      const result = await grantBOMAccess({
        bomId: testBomId,
        groupId: testGroupId,
      }, testUserId);

      expect(result.id).toBeGreaterThan(0);
    });
  });

  describe('getBOMAccessList', () => {
    it('should return all access grants for BOM', async () => {
      await grantBOMAccess({ bomId: testBomId, userId: testUserId }, testUserId);

      const grants = await getBOMAccessList(testBomId);
      expect(grants.length).toBe(1);
    });
  });

  describe('revokeBOMAccess', () => {
    it('should remove access grant', async () => {
      const grant = await grantBOMAccess({ bomId: testBomId, userId: testUserId }, testUserId);
      await revokeBOMAccess(grant.id);

      const grants = await getBOMAccessList(testBomId);
      expect(grants.length).toBe(0);
    });
  });

  describe('userHasBOMAccess', () => {
    it('should return true for user with direct grant', async () => {
      await grantBOMAccess({ bomId: testBomId, userId: testUserId }, testUserId);

      const result = await userHasBOMAccess(testUserId, testBomId);
      expect(result).toBe(true);
    });

    it('should return true for user in granted group', async () => {
      await addGroupMember(testGroupId, testUserId, testUserId);
      await grantBOMAccess({ bomId: testBomId, groupId: testGroupId }, testUserId);

      const result = await userHasBOMAccess(testUserId, testBomId);
      expect(result).toBe(true);
    });

    it('should return false for user without access', async () => {
      const result = await userHasBOMAccess(testUserId, testBomId);
      expect(result).toBe(false);
    });
  });
});
```

**Step 2: Implement BOM access functions**

```typescript
// ============ BOM Access Grants ============

export async function grantBOMAccess(
  data: BOMConfidentialAccessCreate,
  grantedBy: number
): Promise<{ id: number }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db.insert(tables.bomAccess).values({
      bomId: data.bomId,
      userId: data.userId || null,
      groupId: data.groupId || null,
      grantedBy,
      grantedAt: getNow(),
    });
    return { id: getInsertId(result) };
  });
}

export async function revokeBOMAccess(grantId: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    await db.delete(tables.bomAccess).where(eq(tables.bomAccess.id, grantId));
  });
}

export async function getBOMAccessList(bomId: number): Promise<BOMConfidentialAccess[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Get all grants with user/group details
    const grants = await db
      .select({
        id: tables.bomAccess.id,
        bomId: tables.bomAccess.bomId,
        userId: tables.bomAccess.userId,
        groupId: tables.bomAccess.groupId,
        grantedBy: tables.bomAccess.grantedBy,
        grantedAt: tables.bomAccess.grantedAt,
      })
      .from(tables.bomAccess)
      .where(eq(tables.bomAccess.bomId, bomId));

    // Enrich with names (simplified - in production join properly)
    return grants;
  });
}

export async function userHasBOMAccess(
  userId: number,
  bomId: number
): Promise<boolean> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Check direct user grant
    const userGrant = await db
      .select({ id: tables.bomAccess.id })
      .from(tables.bomAccess)
      .where(
        and(
          eq(tables.bomAccess.bomId, bomId),
          eq(tables.bomAccess.userId, userId)
        )
      )
      .limit(1);

    if (userGrant.length > 0) return true;

    // Check group grants
    const userGroupIds = await getUserGroupIds(userId);
    if (userGroupIds.length === 0) return false;

    const groupGrant = await db
      .select({ id: tables.bomAccess.id })
      .from(tables.bomAccess)
      .where(
        and(
          eq(tables.bomAccess.bomId, bomId),
          inArray(tables.bomAccess.groupId, userGroupIds)
        )
      )
      .limit(1);

    return groupGrant.length > 0;
  });
}
```

**Step 3: Run tests**

```bash
npm test -- tests/unit/services/confidentiality.service.test.ts
```

**Step 4: Commit**

```bash
git add src/lib/services/confidentiality.service.ts tests/unit/services/confidentiality.service.test.ts
git commit -m "feat(service): add BOM access grant management"
```

---

### Task 11: Add confidentiality check logic

**Files:**
- Modify: `src/lib/services/confidentiality.service.ts`
- Modify: `tests/unit/services/confidentiality.service.test.ts`

**Step 1: Add tests for confidentiality checks**

```typescript
describe('Confidentiality Service - Access Checks', () => {
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
        { defaultConfidential: true, confidentialityLevel: 'confidential' }
      );
      expect(result).toBe(true);
    });
  });

  describe('canViewConfidentialItems', () => {
    it('should return true for bypass role user', async () => {
      // Mock user with ADMIN role
      const result = await canViewConfidentialItems(adminUserId, testBomId);
      expect(result).toBe(true);
    });

    it('should return true for BOM owner', async () => {
      const result = await canViewConfidentialItems(bomOwnerId, testBomId);
      expect(result).toBe(true);
    });

    it('should return true for user with explicit grant', async () => {
      await grantBOMAccess({ bomId: testBomId, userId: testUserId }, adminUserId);
      const result = await canViewConfidentialItems(testUserId, testBomId);
      expect(result).toBe(true);
    });

    it('should return false for user without access', async () => {
      const result = await canViewConfidentialItems(randomUserId, testBomId);
      expect(result).toBe(false);
    });
  });
});
```

**Step 2: Implement access check functions**

```typescript
// ============ Confidentiality Checks ============

export function isLineConfidential(
  line: { confidentialityOverride?: string | null },
  item: { defaultConfidential?: boolean; confidentialityLevel?: string }
): boolean {
  // BOM line override takes precedence
  if (line.confidentialityOverride === 'public') return false;
  if (line.confidentialityOverride === 'confidential') return true;

  // Fall back to item default
  return item.defaultConfidential === true ||
         item.confidentialityLevel === 'confidential';
}

export async function getBypassRoles(): Promise<string[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db
      .select({ value: tables.systemSettings.value })
      .from(tables.systemSettings)
      .where(eq(tables.systemSettings.key, 'confidential_bypass_roles'))
      .limit(1);

    if (result.length === 0) return ['ADMIN']; // Default

    try {
      return JSON.parse(result[0].value);
    } catch {
      return ['ADMIN'];
    }
  });
}

export async function setBypassRoles(roles: string[]): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const value = JSON.stringify(roles);

    // Upsert
    const existing = await db
      .select({ id: tables.systemSettings.id })
      .from(tables.systemSettings)
      .where(eq(tables.systemSettings.key, 'confidential_bypass_roles'))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(tables.systemSettings)
        .set({ value, updatedAt: getNow() })
        .where(eq(tables.systemSettings.key, 'confidential_bypass_roles'));
    } else {
      await db.insert(tables.systemSettings).values({
        key: 'confidential_bypass_roles',
        value,
        createdAt: getNow(),
        updatedAt: getNow(),
      });
    }
  });
}

export async function canViewConfidentialItems(
  userId: number,
  bomId: number,
  userRole?: string
): Promise<boolean> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Check bypass roles
    if (userRole) {
      const bypassRoles = await getBypassRoles();
      if (bypassRoles.includes(userRole)) return true;
    }

    // 2. Check if user is BOM owner
    const bom = await db
      .select({ createdBy: tables.bom.createdBy })
      .from(tables.bom)
      .where(eq(tables.bom.id, bomId))
      .limit(1);

    if (bom.length > 0 && bom[0].createdBy === userId) return true;

    // 3. Check explicit access
    return userHasBOMAccess(userId, bomId);
  });
}
```

**Step 3: Run tests**

```bash
npm test -- tests/unit/services/confidentiality.service.test.ts
```

**Step 4: Commit**

```bash
git add src/lib/services/confidentiality.service.ts tests/unit/services/confidentiality.service.test.ts
git commit -m "feat(service): add confidentiality check logic"
```

---

### Task 12: Add BOM line filtering function

**Files:**
- Modify: `src/lib/services/confidentiality.service.ts`

**Step 1: Add filterBOMLines function**

```typescript
import type { FilteredBOMLine, BOMConfidentialityInfo } from '@/types/confidentiality';

export interface BOMLineWithItem {
  id: number;
  sequence: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  quantity: number;
  unit?: string;
  unitCost?: number;
  totalCost?: number;
  isOptional?: boolean;
  notes?: string;
  confidentialityOverride?: string | null;
  item?: {
    defaultConfidential?: boolean;
    confidentialityLevel?: string;
  };
}

export function filterBOMLines(
  lines: BOMLineWithItem[],
  canViewConfidential: boolean
): { lines: FilteredBOMLine[]; info: BOMConfidentialityInfo } {
  let visibleCount = 0;
  let hasConfidential = false;

  const filteredLines = lines.map((line) => {
    const item = line.item || {};
    const confidential = isLineConfidential(line, item);

    if (confidential) hasConfidential = true;

    if (!confidential || canViewConfidential) {
      visibleCount++;
      return {
        id: line.id,
        sequence: line.sequence,
        isConfidential: confidential,
        isHidden: false,
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        quantity: line.quantity,
        unit: line.unit,
        unitCost: line.unitCost,
        totalCost: line.totalCost,
        isOptional: line.isOptional,
        notes: line.notes,
        confidentialityOverride: line.confidentialityOverride as any,
      };
    }

    // Return placeholder for hidden confidential items
    return {
      id: line.id,
      sequence: line.sequence,
      isConfidential: true,
      isHidden: true,
      placeholder: '[Confidential Item]',
    };
  });

  return {
    lines: filteredLines,
    info: {
      hasConfidentialItems: hasConfidential,
      visibleLineCount: visibleCount,
      totalLineCount: lines.length,
      userHasFullAccess: canViewConfidential,
    },
  };
}
```

**Step 2: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/lib/services/confidentiality.service.ts
git commit -m "feat(service): add BOM line filtering function"
```

---

## Phase 4: API Routes

### Task 13: Create confidential groups API routes

**Files:**
- Create: `src/app/api/admin/confidential-groups/route.ts`
- Create: `src/app/api/admin/confidential-groups/[id]/route.ts`
- Create: `src/app/api/admin/confidential-groups/[id]/members/route.ts`

**Step 1: Create list/create route**

```typescript
/**
 * Confidential Access Groups API
 * GET /api/admin/confidential-groups - List all groups
 * POST /api/admin/confidential-groups - Create group
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listConfidentialAccessGroups,
  createConfidentialAccessGroup,
} from '@/lib/services/confidentiality.service';
import { confidentialAccessGroupCreateSchema } from '@/lib/validation/confidentiality';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const groups = await listConfidentialAccessGroups();
      return successResponse(groups);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:read']);
}

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const body = await request.json();
      const validation = confidentialAccessGroupCreateSchema.safeParse(body);

      if (!validation.success) {
        return errorResponse(validation.error.errors[0].message);
      }

      const result = await createConfidentialAccessGroup(validation.data);
      return successResponse(result, 201);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:write']);
}
```

**Step 2: Create single group route**

```typescript
/**
 * Single Confidential Access Group API
 * GET /api/admin/confidential-groups/[id] - Get group
 * PUT /api/admin/confidential-groups/[id] - Update group
 * DELETE /api/admin/confidential-groups/[id] - Delete group
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getConfidentialAccessGroup,
  updateConfidentialAccessGroup,
  deleteConfidentialAccessGroup,
} from '@/lib/services/confidentiality.service';
import { confidentialAccessGroupUpdateSchema } from '@/lib/validation/confidentiality';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const groupId = parseInt(id);

      if (isNaN(groupId)) {
        return errorResponse('Invalid group ID');
      }

      const group = await getConfidentialAccessGroup(groupId);

      if (!group) {
        return errorResponse('Group not found', 404);
      }

      return successResponse(group);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:read']);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const groupId = parseInt(id);

      if (isNaN(groupId)) {
        return errorResponse('Invalid group ID');
      }

      const body = await request.json();
      const validation = confidentialAccessGroupUpdateSchema.safeParse(body);

      if (!validation.success) {
        return errorResponse(validation.error.errors[0].message);
      }

      await updateConfidentialAccessGroup(groupId, validation.data);
      return successResponse({ success: true });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:write']);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const groupId = parseInt(id);

      if (isNaN(groupId)) {
        return errorResponse('Invalid group ID');
      }

      await deleteConfidentialAccessGroup(groupId);
      return successResponse({ success: true });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:write']);
}
```

**Step 3: Create members route**

```typescript
/**
 * Confidential Access Group Members API
 * GET /api/admin/confidential-groups/[id]/members - List members
 * POST /api/admin/confidential-groups/[id]/members - Add member
 * DELETE /api/admin/confidential-groups/[id]/members?userId=X - Remove member
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
} from '@/lib/services/confidentiality.service';
import { addGroupMemberSchema } from '@/lib/validation/confidentiality';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const groupId = parseInt(id);

      if (isNaN(groupId)) {
        return errorResponse('Invalid group ID');
      }

      const members = await getGroupMembers(groupId);
      return successResponse(members);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:read']);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const groupId = parseInt(id);

      if (isNaN(groupId)) {
        return errorResponse('Invalid group ID');
      }

      const body = await request.json();
      const validation = addGroupMemberSchema.safeParse(body);

      if (!validation.success) {
        return errorResponse(validation.error.errors[0].message);
      }

      const result = await addGroupMember(
        groupId,
        validation.data.userId,
        session.userId
      );
      return successResponse(result, 201);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:write']);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const groupId = parseInt(id);

      const url = new URL(request.url);
      const userId = parseInt(url.searchParams.get('userId') || '');

      if (isNaN(groupId) || isNaN(userId)) {
        return errorResponse('Invalid group ID or user ID');
      }

      await removeGroupMember(groupId, userId);
      return successResponse({ success: true });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:write']);
}
```

**Step 4: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

**Step 5: Commit**

```bash
git add src/app/api/admin/confidential-groups/
git commit -m "feat(api): add confidential access groups endpoints"
```

---

### Task 14: Create BOM access API routes

**Files:**
- Create: `src/app/api/bom/[id]/access/route.ts`

**Step 1: Create BOM access route**

```typescript
/**
 * BOM Confidential Access API
 * GET /api/bom/[id]/access - List access grants
 * POST /api/bom/[id]/access - Grant access
 * DELETE /api/bom/[id]/access?grantId=X - Revoke access
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getBOMAccessList,
  grantBOMAccess,
  revokeBOMAccess,
  canViewConfidentialItems,
} from '@/lib/services/confidentiality.service';
import { bomAccessGrantSchema } from '@/lib/validation/confidentiality';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const bomId = parseInt(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      // Check if user can manage access
      const canManage = await canViewConfidentialItems(
        session.userId,
        bomId,
        session.role
      );

      if (!canManage) {
        return errorResponse('Access denied', 403);
      }

      const grants = await getBOMAccessList(bomId);
      return successResponse(grants);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const bomId = parseInt(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      // Check if user can manage access
      const canManage = await canViewConfidentialItems(
        session.userId,
        bomId,
        session.role
      );

      if (!canManage) {
        return errorResponse('Access denied', 403);
      }

      const body = await request.json();
      const validation = bomAccessGrantSchema.safeParse(body);

      if (!validation.success) {
        return errorResponse(validation.error.errors[0].message);
      }

      const result = await grantBOMAccess(
        { bomId, ...validation.data },
        session.userId
      );
      return successResponse(result, 201);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const bomId = parseInt(id);

      const url = new URL(request.url);
      const grantId = parseInt(url.searchParams.get('grantId') || '');

      if (isNaN(bomId) || isNaN(grantId)) {
        return errorResponse('Invalid BOM ID or grant ID');
      }

      // Check if user can manage access
      const canManage = await canViewConfidentialItems(
        session.userId,
        bomId,
        session.role
      );

      if (!canManage) {
        return errorResponse('Access denied', 403);
      }

      await revokeBOMAccess(grantId);
      return successResponse({ success: true });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
```

**Step 2: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/app/api/bom/[id]/access/
git commit -m "feat(api): add BOM access management endpoints"
```

---

### Task 15: Create bypass roles settings API

**Files:**
- Create: `src/app/api/admin/settings/confidential-bypass-roles/route.ts`

**Step 1: Create the route**

```typescript
/**
 * Confidential Bypass Roles Setting API
 * GET /api/admin/settings/confidential-bypass-roles - Get bypass roles
 * PUT /api/admin/settings/confidential-bypass-roles - Update bypass roles
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getBypassRoles,
  setBypassRoles,
} from '@/lib/services/confidentiality.service';
import { bypassRolesSettingSchema } from '@/lib/validation/confidentiality';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const roles = await getBypassRoles();
      return successResponse({ roles });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:read']);
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const body = await request.json();
      const validation = bypassRolesSettingSchema.safeParse(body);

      if (!validation.success) {
        return errorResponse(validation.error.errors[0].message);
      }

      await setBypassRoles(validation.data.roles);
      return successResponse({ success: true });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:write']);
}
```

**Step 2: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/app/api/admin/settings/confidential-bypass-roles/
git commit -m "feat(api): add bypass roles settings endpoint"
```

---

### Task 16: Modify BOM detail API to filter confidential items

**Files:**
- Modify: `src/app/api/bom/[id]/route.ts`

**Step 1: Import confidentiality functions**

Add to imports:

```typescript
import {
  canViewConfidentialItems,
  filterBOMLines,
} from '@/lib/services/confidentiality.service';
```

**Step 2: Modify GET handler to filter lines**

In the GET handler, after fetching lines, add filtering:

```typescript
// After fetching bom and lines...

// Check confidentiality access
const canViewConfidential = await canViewConfidentialItems(
  session.userId,
  bomId,
  session.role
);

// Filter lines based on access
const { lines: filteredLines, info: confidentialityInfo } = filterBOMLines(
  lines,
  canViewConfidential
);

return successResponse({
  ...bom,
  lines: filteredLines,
  confidentialityInfo,
});
```

**Step 3: Run type check**

```bash
npx tsc --noEmit --skipLibCheck
```

**Step 4: Commit**

```bash
git add src/app/api/bom/[id]/route.ts
git commit -m "feat(api): filter confidential BOM lines in detail endpoint"
```

---

## Phase 5: UI Components (Summary)

### Tasks 17-25: UI Implementation

Due to the length of the plan, UI tasks are summarized:

**Task 17:** Create ConfidentialAccessGroupsPage at `/admin/confidential-groups`
- DataGrid with groups list
- Create/edit/delete dialogs
- Member count column

**Task 18:** Create GroupMembersDialog component
- List members with remove button
- Add member with user search

**Task 19:** Add confidentiality fields to ItemForm
- ConfidentialityLevel dropdown
- DefaultConfidential checkbox

**Task 20:** Add BOMAccessControlTab component
- List access grants (users + groups)
- Add user/group dialogs
- Revoke button

**Task 21:** Modify BOM detail page
- Add Access Control tab (visible to authorized users)
- Show lock icon on confidential lines
- Show placeholder for hidden lines

**Task 22:** Add warning banner component
- "This BOM contains X confidential items you cannot view"

**Task 23:** Add bypass roles section to admin settings
- Multi-select checkbox for roles

**Task 24:** Create UI tests for confidentiality components

**Task 25:** Final integration testing and polish

---

## Execution Checklist

- [ ] Phase 1: Database Schema (Tasks 1-5)
- [ ] Phase 2: Types and Validation (Tasks 6-7)
- [ ] Phase 3: Service Layer (Tasks 8-12)
- [ ] Phase 4: API Routes (Tasks 13-16)
- [ ] Phase 5: UI Components (Tasks 17-25)

---

## Testing Commands

```bash
# Run all confidentiality tests
npm test -- tests/unit/services/confidentiality.service.test.ts

# Run type check
npx tsc --noEmit --skipLibCheck

# Run lint
npm run lint
```
