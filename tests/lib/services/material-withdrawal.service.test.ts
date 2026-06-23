/**
 * Unit tests for Material Withdrawal Service (feature 018)
 *
 * Strategy: mock the Drizzle DB layer via `executeDbOperation` and
 * stub each table access. Focuses on the validation and business-rule
 * branches (the hot path is also exercised end-to-end with a single
 * happy-path test). Heavier integration tests (SQLite in-memory schema)
 * are covered in tests/integration/services/.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// In-memory state used by mocked db
type DbRow = Record<string, unknown>;
const memDb: {
  requests: DbRow[];
  requestItems: DbRow[];
  approvals: DbRow[];
  attachments: DbRow[];
  rules: DbRow[];
  workOrders: DbRow[];
  workOrderMaterials: DbRow[];
  items: DbRow[];
  users: DbRow[];
  deviations: DbRow[];
  lots: DbRow[];
  transactions: DbRow[];
  signatures: DbRow[];
  nextId: Record<string, number>;
} = {
  requests: [],
  requestItems: [],
  approvals: [],
  attachments: [],
  rules: [],
  workOrders: [],
  workOrderMaterials: [],
  items: [],
  users: [],
  deviations: [],
  lots: [],
  transactions: [],
  signatures: [],
  nextId: {},
};

function nextId(table: string): number {
  memDb.nextId[table] = (memDb.nextId[table] ?? 0) + 1;
  return memDb.nextId[table];
}

// Hoisted helpers so vi.mock factories below can reference them
const { tableNames, refs } = vi.hoisted(() => {
  const _tableNames = new WeakMap<object, string>();
  function _makeTableRef(name: string): Record<string, { name: string }> {
    const ref: Record<string, { name: string }> = {
      id: { name: 'id' },
      workOrderId: { name: 'workOrderId' },
      factoryCode: { name: 'factoryCode' },
      requestedByUserId: { name: 'requestedByUserId' },
      requestedAt: { name: 'requestedAt' },
      status: { name: 'status' },
      reasonType: { name: 'reasonType' },
      reasonDetail: { name: 'reasonDetail' },
      machinePhase: { name: 'machinePhase' },
      roomId: { name: 'roomId' },
      payloadHash: { name: 'payloadHash' },
      createdAt: { name: 'createdAt' },
      updatedAt: { name: 'updatedAt' },
      requestId: { name: 'requestId' },
      materialId: { name: 'materialId' },
      itemId: { name: 'itemId' },
      quantityRequested: { name: 'quantityRequested' },
      quantityApproved: { name: 'quantityApproved' },
      unit: { name: 'unit' },
      bomPlannedQuantity: { name: 'bomPlannedQuantity' },
      additionalQtyViaWithdrawalRequest: { name: 'additionalQtyViaWithdrawalRequest' },
      cumulativeExtraAfterApprove: { name: 'cumulativeExtraAfterApprove' },
      approverUserId: { name: 'approverUserId' },
      action: { name: 'action' },
      actionAt: { name: 'actionAt' },
      reason: { name: 'reason' },
      comment: { name: 'comment' },
      signatureId: { name: 'signatureId' },
      isActive: { name: 'isActive' },
      softCapPercent: { name: 'softCapPercent' },
      hardCapPercent: { name: 'hardCapPercent' },
      materialCategory: { name: 'materialCategory' },
      quantity: { name: 'quantity' },
      name: { name: 'name' },
      role: { name: 'role' },
      email: { name: 'email' },
      password: { name: 'password' },
      referenceType: { name: 'referenceType' },
      referenceId: { name: 'referenceId' },
      fileUrl: { name: 'fileUrl' },
    };
    _tableNames.set(ref, name);
    return ref;
  }
  const _refs = {
    requests: _makeTableRef('requests'),
    requestItems: _makeTableRef('requestItems'),
    approvals: _makeTableRef('approvals'),
    attachments: _makeTableRef('attachments'),
    rules: _makeTableRef('rules'),
    workOrders: _makeTableRef('workOrders'),
    workOrderMaterials: _makeTableRef('workOrderMaterials'),
    items: _makeTableRef('items'),
    users: _makeTableRef('users'),
    deviations: _makeTableRef('deviations'),
    lots: _makeTableRef('lots'),
    transactions: _makeTableRef('transactions'),
    signatures: _makeTableRef('signatures'),
  };
  return { tableNames: _tableNames, refs: _refs };
});
function makeTableRef(name: string): Record<string, { name: string }> {
  const r: Record<string, { name: string }> = { id: { name: 'id' } };
  tableNames.set(r, name);
  return r;
}

vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  executeDbOperation: (op: any) => op(mockDb),
  getInsertId: (r: any) => Number(r?.lastInsertRowid ?? 0),
  getAffectedRows: (r: any) => Number(r?.changes ?? r?.rowsAffected ?? 1),
  getTableRef: (n: string) => (refs as any)[n] ?? makeTableRef(n),
}));

// Warehouse release reuses the inventory service for FEFO + deduction. Mock it
// so unit tests stay at the withdrawal-service layer: allocate everything from
// lot 1 and decrement memDb.lots so we can assert deduction happens at RELEASE.
vi.mock('@/lib/services/inventory.service', () => ({
  getLotsForPicking: vi.fn(async (_itemId: number, qty: number) => ({
    allocated: [{ lotId: 1, quantity: qty }],
    remaining: 0,
  })),
  issueMaterial: vi.fn(async (lotId: number, qty: number) => {
    const lot = memDb.lots.find((l) => Number(l.id) === lotId) ?? memDb.lots[0];
    if (lot) lot.quantity = Number(lot.quantity) - qty;
    memDb.transactions.push({ id: memDb.transactions.length + 1, lotId, quantity: -qty, transactionType: 'issue' });
    return memDb.transactions.length;
  }),
}));

// We bypass real schema imports; the service references the table CONSTs
// directly via `import { sqliteX } from '../db/schema'`. We map those imports
// onto our `refs` so any field-access works.
vi.mock('@/lib/db/schema', () => ({
  sqliteMaterialWithdrawalRequests: refs.requests,
  sqliteMaterialWithdrawalRequestItems: refs.requestItems,
  sqliteMaterialWithdrawalApprovals: refs.approvals,
  sqliteMaterialWithdrawalAttachments: refs.attachments,
  sqliteMaterialWithdrawalRules: refs.rules,
  sqliteWorkOrders: refs.workOrders,
  sqliteWorkOrderMaterials: refs.workOrderMaterials,
  sqliteItems: refs.items,
  sqliteUsers: refs.users,
  sqliteDeviations: refs.deviations,
  sqliteInventoryLots: refs.lots,
  sqliteInventoryTransactions: refs.transactions,
  sqliteElectronicSignatures: refs.signatures,
  // MySQL aliases — same references; isSqlite() returns true so MySQL paths
  // never execute, but the imports must resolve.
  mysqlMaterialWithdrawalRequests: refs.requests,
  mysqlMaterialWithdrawalRequestItems: refs.requestItems,
  mysqlMaterialWithdrawalApprovals: refs.approvals,
  mysqlMaterialWithdrawalAttachments: refs.attachments,
  mysqlMaterialWithdrawalRules: refs.rules,
  mysqlWorkOrders: refs.workOrders,
  mysqlWorkOrderMaterials: refs.workOrderMaterials,
  mysqlItems: refs.items,
  mysqlUsers: refs.users,
  mysqlDeviations: refs.deviations,
  mysqlInventoryLots: refs.lots,
  mysqlInventoryTransactions: refs.transactions,
  mysqlElectronicSignatures: refs.signatures,
}));

vi.mock('@/lib/db/date-utils', () => ({
  // Return the current instant so the idempotency window logic compares
  // correctly against `Date.now() - WINDOW`.
  getNow: () => new Date().toISOString(),
}));

// Verify password mock — accept 'correct-password', reject everything else
vi.mock('@/lib/auth', () => ({
  verifyPassword: vi.fn((pw: string) => Promise.resolve(pw === 'correct-password')),
}));

// Minimal drizzle-orm shim — the service uses these to build queries
vi.mock('drizzle-orm', () => {
  const make = (type: string) => (...args: any[]) => ({ __op: type, args });
  return {
    eq: make('eq'),
    and: (...c: any[]) => ({ __op: 'and', conditions: c }),
    or: (...c: any[]) => ({ __op: 'or', conditions: c }),
    gte: make('gte'),
    lte: make('lte'),
    inArray: make('inArray'),
    asc: make('asc'),
    desc: make('desc'),
    count: () => ({ __op: 'count' }),
    sql: ((strings: TemplateStringsArray, ...values: any[]) => ({ __op: 'sql', strings, values })) as any,
  };
});

// ---------------------------------------------------------------------------
// Mock DB query engine
// ---------------------------------------------------------------------------

function tableName(t: any): string {
  return tableNames.get(t) ?? 'unknown';
}
function backing(tName: string): DbRow[] {
  const map: Record<string, DbRow[]> = {
    requests: memDb.requests,
    requestItems: memDb.requestItems,
    approvals: memDb.approvals,
    attachments: memDb.attachments,
    rules: memDb.rules,
    workOrders: memDb.workOrders,
    workOrderMaterials: memDb.workOrderMaterials,
    items: memDb.items,
    users: memDb.users,
    deviations: memDb.deviations,
    lots: memDb.lots,
    transactions: memDb.transactions,
    signatures: memDb.signatures,
  };
  return map[tName];
}

function matchesWhere(row: DbRow, cond: any): boolean {
  if (!cond) return true;
  if (cond.__op === 'and') return cond.conditions.every((c: any) => matchesWhere(row, c));
  if (cond.__op === 'or') return cond.conditions.some((c: any) => matchesWhere(row, c));
  if (cond.__op === 'eq') {
    const [col, val] = cond.args;
    return row[col.name] === val;
  }
  if (cond.__op === 'inArray') {
    const [col, vals] = cond.args;
    return (vals as unknown[]).includes(row[col.name]);
  }
  if (cond.__op === 'gte') {
    const [col, val] = cond.args;
    return String(row[col.name] ?? '') >= String(val);
  }
  if (cond.__op === 'lte') {
    const [col, val] = cond.args;
    return String(row[col.name] ?? '') <= String(val);
  }
  return true;
}

const mockDb: any = {
  select(cols?: any) {
    let from: DbRow[] = [];
    const state: any = {
      from(t: any) {
        from = backing(tableName(t));
        return state;
      },
      where(cond: any) {
        from = from.filter((r) => matchesWhere(r, cond));
        return state;
      },
      orderBy() {
        return state;
      },
      groupBy() {
        return state;
      },
      limit(n: number) {
        from = from.slice(0, n);
        return Promise.resolve(from);
      },
      offset() {
        return state;
      },
      then(resolve: any) {
        // For COUNT-shaped queries (cols passed in select) emulate
        if (cols && cols.value && cols.value.__op === 'count') {
          return resolve([{ value: from.length }]);
        }
        return resolve(from);
      },
    };
    return state;
  },
  insert(t: any) {
    return {
      values(v: any) {
        const tName = tableName(t);
        const id = nextId(tName);
        backing(tName).push({ id, ...v });
        return Promise.resolve({ lastInsertRowid: id });
      },
    };
  },
  update(t: any) {
    return {
      set(patch: any) {
        return {
          where(cond: any) {
            const rows = backing(tableName(t));
            for (const row of rows) {
              if (matchesWhere(row, cond)) Object.assign(row, patch);
            }
            return Promise.resolve({ changes: 1 });
          },
        };
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Test setup helper
// ---------------------------------------------------------------------------

function seed() {
  // Reset all memory
  memDb.requests.length = 0;
  memDb.requestItems.length = 0;
  memDb.approvals.length = 0;
  memDb.attachments.length = 0;
  memDb.rules.length = 0;
  memDb.workOrders.length = 0;
  memDb.workOrderMaterials.length = 0;
  memDb.items.length = 0;
  memDb.users.length = 0;
  memDb.deviations.length = 0;
  memDb.lots.length = 0;
  memDb.transactions.length = 0;
  memDb.signatures.length = 0;
  memDb.nextId = {};

  // Default global rule: 10% soft / 50% hard
  memDb.rules.push({
    id: nextId('rules'),
    factoryCode: null,
    materialCategory: null,
    softCapPercent: 10,
    hardCapPercent: 50,
    isActive: true,
    createdByUserId: 1,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  });

  // Users: operator (id=10), supervisor (id=20)
  memDb.users.push({
    id: 10,
    name: 'Operator A',
    role: 'PROD_OPERATOR',
    password: 'hashed-operator',
    email: 'op@x',
  });
  memDb.users.push({
    id: 20,
    name: 'Supervisor B',
    role: 'PROD_MANAGER',
    password: 'hashed-supervisor',
    email: 'sup@x',
  });

  // WO 100 active, with planned material item 50 = 100 kg
  memDb.workOrders.push({ id: 100, status: 'in_progress' });
  memDb.items.push({ id: 50, name: 'Turmeric Powder', categoryCode: 'active' });
  memDb.workOrderMaterials.push({
    id: 1,
    workOrderId: 100,
    itemId: 50,
    plannedQuantity: 100,
    additionalQtyViaWithdrawalRequest: 0,
    unit: 'kg',
  });

  // Stock: 50 kg available across one lot
  memDb.lots.push({ id: 1, itemId: 50, quantity: 50 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import {
  createRequest,
  approveRequest,
  releaseRequest,
  rejectRequest,
  cancelRequest,
  getPendingMaterialIdsForWorkOrder,
  resolveCapRule,
} from '@/lib/services/material-withdrawal.service';

describe('material-withdrawal.service', () => {
  beforeEach(() => {
    seed();
  });

  describe('resolveCapRule', () => {
    it('returns the default global rule when no specific rule exists', async () => {
      const rule = await resolveCapRule(null, 'active_ingredient');
      expect(rule.softCapPercent).toBe(10);
      expect(rule.hardCapPercent).toBe(50);
    });

    it('prefers a (factory, category) rule over global', async () => {
      memDb.rules.push({
        id: nextId('rules'),
        factoryCode: 'PNS',
        materialCategory: 'active_ingredient',
        softCapPercent: 5,
        hardCapPercent: 30,
        isActive: true,
        createdByUserId: 1,
        createdAt: '',
        updatedAt: '',
      });
      const rule = await resolveCapRule('PNS', 'active_ingredient');
      expect(rule.softCapPercent).toBe(5);
      expect(rule.hardCapPercent).toBe(30);
      expect(rule.resolutionPath[0]).toContain('factory=PNS');
    });
  });

  describe('createRequest', () => {
    it('creates a pending request when input is valid', async () => {
      const detail = await createRequest(
        {
          workOrderId: 100,
          items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
          reasonType: 'machine_setup_loss',
          machinePhase: 'auto-trim',
          roomId: 1,
        },
        10,
      );
      expect(detail.status).toBe('pending');
      expect(detail.items).toHaveLength(1);
      expect(detail.items[0].quantityRequested).toBe(5);
      expect(memDb.requests).toHaveLength(1);
    });

    it('rejects a material that is not in the BOM of the WO', async () => {
      await expect(
        createRequest(
          {
            workOrderId: 100,
            items: [{ materialId: 999, quantityRequested: 1, unit: 'kg' }],
            reasonType: 'machine_setup_loss',
            machinePhase: 'auto-trim',
            roomId: 1,
          },
          10,
        ),
      ).rejects.toMatchObject({ code: 'MATERIAL_NOT_IN_BOM' });
    });

    it('rejects when projected cumulative exceeds the hard cap', async () => {
      // BOM planned = 100 kg, hard cap = 50% → max 50 kg extra cumulative.
      // Request 60 kg should be rejected.
      await expect(
        createRequest(
          {
            workOrderId: 100,
            items: [{ materialId: 50, quantityRequested: 60, unit: 'kg' }],
            reasonType: 'machine_setup_loss',
            machinePhase: 'auto-trim',
            roomId: 1,
          },
          10,
        ),
      ).rejects.toMatchObject({ code: 'EXCEEDS_HARD_CAP' });
    });

    it('detects duplicate submission within 30 seconds', async () => {
      const input = {
        workOrderId: 100,
        items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
        reasonType: 'machine_setup_loss' as const,
        machinePhase: 'auto-trim',
        roomId: 1,
      };
      await createRequest(input, 10);
      await expect(createRequest(input, 10)).rejects.toMatchObject({
        code: 'DUPLICATE_SUBMISSION',
      });
    });

    it('rejects when the work order is not in an active state', async () => {
      memDb.workOrders[0].status = 'completed';
      await expect(
        createRequest(
          {
            workOrderId: 100,
            items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
            reasonType: 'machine_setup_loss',
            machinePhase: 'auto-trim',
            roomId: 1,
          },
          10,
        ),
      ).rejects.toMatchObject({ code: 'WORK_ORDER_NOT_ACTIVE' });
    });
  });

  describe('approveRequest (Dual Control + E-sig + atomicity)', () => {
    it('rejects when approver equals requester (Dual Control)', async () => {
      const created = await createRequest(
        {
          workOrderId: 100,
          items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
          reasonType: 'machine_setup_loss',
          machinePhase: 'auto-trim',
          roomId: 1,
        },
        10,
      );
      await expect(
        approveRequest(created.id, { password: 'correct-password' }, 10),
      ).rejects.toMatchObject({ code: 'DUAL_CONTROL_VIOLATION' });
    });

    it('rejects when password is invalid', async () => {
      const created = await createRequest(
        {
          workOrderId: 100,
          items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
          reasonType: 'machine_setup_loss',
          machinePhase: 'auto-trim',
          roomId: 1,
        },
        10,
      );
      await expect(
        approveRequest(created.id, { password: 'wrong' }, 20),
      ).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
    });

    it('rejects when stock is insufficient at approve-time', async () => {
      memDb.lots[0].quantity = 2; // only 2 kg on hand
      const created = await createRequest(
        {
          workOrderId: 100,
          items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
          reasonType: 'machine_setup_loss',
          machinePhase: 'auto-trim',
          roomId: 1,
        },
        10,
      );
      await expect(
        approveRequest(created.id, { password: 'correct-password' }, 20),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    });

    it('happy path: approve AUTHORIZES only (no stock deduction yet) + deviation + consumption', async () => {
      const stockBefore = Number(memDb.lots[0].quantity);
      const txBefore = memDb.transactions.length;
      const created = await createRequest(
        {
          workOrderId: 100,
          items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
          reasonType: 'machine_setup_loss',
          machinePhase: 'auto-trim',
          roomId: 1,
        },
        10,
      );
      const result = await approveRequest(
        created.id,
        { password: 'correct-password' },
        20,
      );
      expect(result.request.status).toBe('approved');
      // Stock NOT moved at approve — that happens at warehouse release.
      expect(result.inventoryTransactionIds).toEqual([]);
      expect(memDb.lots[0].quantity).toBe(stockBefore);
      expect(memDb.transactions.length).toBe(txBefore);
      // But authorization is recorded: deviation + cumulative cap + signature.
      expect(result.deviationId).toBeGreaterThan(0);
      expect(memDb.workOrderMaterials[0].additionalQtyViaWithdrawalRequest).toBe(5);
      expect(memDb.deviations[0].withdrawalRequestId).toBe(created.id);
      expect(memDb.signatures).toHaveLength(1);
      expect(memDb.signatures[0].action).toBe('approve');
    });
  });

  describe('releaseRequest (warehouse 2nd step — deducts stock)', () => {
    async function approvedRequest() {
      const created = await createRequest(
        {
          workOrderId: 100,
          items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
          reasonType: 'machine_setup_loss',
          machinePhase: 'auto-trim',
          roomId: 1,
        },
        10,
      );
      await approveRequest(created.id, { password: 'correct-password' }, 20);
      return created;
    }

    it('happy path: approved → released, deducts stock + posts issue txn', async () => {
      memDb.lots[0].status = 'released';
      const stockBefore = Number(memDb.lots[0].quantity);
      const created = await approvedRequest();

      const result = await releaseRequest(created.id, {}, 30);

      expect(result.request.status).toBe('released');
      expect(result.inventoryTransactionIds.length).toBeGreaterThan(0);
      // Stock deducted by the approved qty (5).
      expect(memDb.lots[0].quantity).toBe(stockBefore - 5);
      // Release audit captured on the request row.
      expect(memDb.requests[0].releasedByUserId).toBe(30);
      expect(memDb.requests[0].releasedAt).toBeTruthy();
    });

    it('rejects releasing a request that is not approved', async () => {
      const created = await createRequest(
        {
          workOrderId: 100,
          items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
          reasonType: 'machine_setup_loss',
          machinePhase: 'auto-trim',
          roomId: 1,
        },
        10,
      );
      // Still pending — not approved.
      await expect(releaseRequest(created.id, {}, 30)).rejects.toMatchObject({
        code: 'REQUEST_NOT_APPROVED',
      });
    });

    it('rejects when stock fell short between approve and release', async () => {
      memDb.lots[0].status = 'released';
      const created = await approvedRequest();
      // Stock dropped below the approved 5 after approve.
      memDb.lots[0].quantity = 2;
      await expect(releaseRequest(created.id, {}, 30)).rejects.toMatchObject({
        code: 'INSUFFICIENT_STOCK',
      });
    });

    it('does not double-deduct: approve leaves stock, release deducts exactly once', async () => {
      memDb.lots[0].status = 'released';
      const stockBefore = Number(memDb.lots[0].quantity);
      const created = await approvedRequest();
      expect(memDb.lots[0].quantity).toBe(stockBefore); // approve didn't move it
      await releaseRequest(created.id, {}, 30);
      expect(memDb.lots[0].quantity).toBe(stockBefore - 5); // released once
    });
  });

  describe('rejectRequest', () => {
    it('happy path: creates a record-only deviation without inventory impact', async () => {
      const created = await createRequest(
        {
          workOrderId: 100,
          items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
          reasonType: 'machine_setup_loss',
          machinePhase: 'auto-trim',
          roomId: 1,
        },
        10,
      );
      const lotQtyBefore = memDb.lots[0].quantity;
      const result = await rejectRequest(
        created.id,
        { reason: 'Setup loss within tolerance — no extra needed.', password: 'correct-password' },
        20,
      );
      expect(result.request.status).toBe('rejected');
      expect(result.deviationId).toBeGreaterThan(0);
      // No inventory impact
      expect(memDb.lots[0].quantity).toBe(lotQtyBefore);
      expect(memDb.transactions).toHaveLength(0);
    });
  });

  describe('cancelRequest', () => {
    it('owner can cancel a pending request', async () => {
      const created = await createRequest(
        {
          workOrderId: 100,
          items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
          reasonType: 'machine_setup_loss',
          machinePhase: 'auto-trim',
          roomId: 1,
        },
        10,
      );
      const detail = await cancelRequest(created.id, 10, 'no longer needed');
      expect(detail.status).toBe('cancelled');
    });

    it('non-owner cannot cancel another user\'s request', async () => {
      const created = await createRequest(
        {
          workOrderId: 100,
          items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
          reasonType: 'machine_setup_loss',
          machinePhase: 'auto-trim',
          roomId: 1,
        },
        10,
      );
      await expect(cancelRequest(created.id, 20)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });
  });

  describe('getPendingMaterialIdsForWorkOrder (selective phase block input)', () => {
    it('returns the affected material ids for each pending request on a WO', async () => {
      await createRequest(
        {
          workOrderId: 100,
          items: [{ materialId: 50, quantityRequested: 5, unit: 'kg' }],
          reasonType: 'machine_setup_loss',
          machinePhase: 'auto-trim',
          roomId: 1,
        },
        10,
      );
      const result = await getPendingMaterialIdsForWorkOrder(100);
      expect(result.materialIds).toContain(50);
      expect(result.pendingRequestIds).toHaveLength(1);
    });

    it('returns empty when no pending requests exist for the WO', async () => {
      const result = await getPendingMaterialIdsForWorkOrder(100);
      expect(result.materialIds).toEqual([]);
      expect(result.pendingRequestIds).toEqual([]);
    });
  });
});
