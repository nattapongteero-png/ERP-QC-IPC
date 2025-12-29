/**
 * Approval Workflow Service Unit Tests (T030)
 * Part of 011-accounting-spec-gap
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock data storage
let mockFlows: Record<number, any> = {};
let mockRules: Record<number, any[]> = {};
let mockSteps: Record<number, any[]> = {};
let mockRequests: Record<number, any> = {};
let mockRequestSteps: Record<number, any[]> = {};
let mockDelegations: any[] = [];
let nextFlowId = 1;
let nextRuleId = 1;
let nextStepId = 1;
let nextRequestId = 1;
let nextDelegationId = 1;

// Create chainable mock DB
const createMockDb = () => {
  const mockDb: any = {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
  };

  // Insert chain
  mockDb.insert.mockImplementation((table: any) => ({
    values: vi.fn().mockImplementation((data: any) => {
      const tableName = table?.name || 'unknown';
      if (tableName === 'approvalFlows') {
        const id = nextFlowId++;
        mockFlows[id] = { ...data, id };
        mockRules[id] = [];
        mockSteps[id] = [];
        return Promise.resolve({ lastInsertRowid: id, insertId: id });
      }
      if (tableName === 'approvalRules') {
        const id = nextRuleId++;
        const flowId = data.flowId;
        if (!mockRules[flowId]) mockRules[flowId] = [];
        mockRules[flowId].push({ ...data, id });
        return Promise.resolve({ lastInsertRowid: id, insertId: id });
      }
      if (tableName === 'approvalSteps') {
        const id = nextStepId++;
        const flowId = data.flowId;
        if (!mockSteps[flowId]) mockSteps[flowId] = [];
        mockSteps[flowId].push({ ...data, id });
        return Promise.resolve({ lastInsertRowid: id, insertId: id });
      }
      if (tableName === 'approvalRequests') {
        const id = nextRequestId++;
        mockRequests[id] = { ...data, id };
        mockRequestSteps[id] = [];
        return Promise.resolve({ lastInsertRowid: id, insertId: id });
      }
      if (tableName === 'approvalRequestSteps') {
        const reqId = data.requestId;
        if (!mockRequestSteps[reqId]) mockRequestSteps[reqId] = [];
        mockRequestSteps[reqId].push(data);
        return Promise.resolve({ lastInsertRowid: 1, insertId: 1 });
      }
      if (tableName === 'approvalDelegations') {
        const id = nextDelegationId++;
        mockDelegations.push({ ...data, id });
        return Promise.resolve({ lastInsertRowid: id, insertId: id });
      }
      return Promise.resolve({ lastInsertRowid: 1, insertId: 1 });
    }),
  }));

  // Update chain
  mockDb.update.mockImplementation((table: any) => ({
    set: vi.fn().mockImplementation((data: any) => ({
      where: vi.fn().mockImplementation(() => {
        const tableName = table?.name || 'unknown';
        if (tableName === 'approvalFlows') {
          // Find and update flow
          for (const id in mockFlows) {
            Object.assign(mockFlows[id], data);
            break;
          }
        }
        if (tableName === 'approvalRequests') {
          for (const id in mockRequests) {
            Object.assign(mockRequests[id], data);
            break;
          }
        }
        return Promise.resolve();
      }),
    })),
  }));

  // Delete chain
  mockDb.delete.mockImplementation((table: any) => ({
    where: vi.fn().mockImplementation(() => {
      const tableName = table?.name || 'unknown';
      if (tableName === 'approvalFlows') {
        mockFlows = {};
        mockRules = {};
        mockSteps = {};
      }
      if (tableName === 'approvalRules') {
        // Clear rules for the flow
        for (const id in mockRules) {
          mockRules[id] = [];
        }
      }
      if (tableName === 'approvalSteps') {
        // Clear steps for the flow
        for (const id in mockSteps) {
          mockSteps[id] = [];
        }
      }
      return Promise.resolve();
    }),
  }));

  // Select chain
  mockDb.select.mockImplementation(() => ({
    from: vi.fn().mockImplementation((table: any) => {
      const tableName = table?.name || 'unknown';
      return {
        where: vi.fn().mockImplementation(() => {
          if (tableName === 'approvalFlows') {
            const flows = Object.values(mockFlows);
            return {
              limit: vi.fn().mockResolvedValue(flows.slice(0, 1)),
              orderBy: vi.fn().mockResolvedValue(flows),
            };
          }
          if (tableName === 'approvalRules') {
            const allRules = Object.values(mockRules).flat();
            return Promise.resolve(allRules);
          }
          if (tableName === 'approvalSteps') {
            const allSteps = Object.values(mockSteps).flat();
            return {
              orderBy: vi.fn().mockResolvedValue(allSteps),
            };
          }
          if (tableName === 'approvalRequests') {
            const requests = Object.values(mockRequests);
            return {
              limit: vi.fn().mockResolvedValue(requests.slice(0, 1)),
              orderBy: vi.fn().mockResolvedValue(requests),
            };
          }
          if (tableName === 'approvalDelegations') {
            return {
              orderBy: vi.fn().mockResolvedValue(mockDelegations),
            };
          }
          return Promise.resolve([]);
        }),
        orderBy: vi.fn().mockImplementation(() => {
          if (tableName === 'approvalFlows') {
            return Promise.resolve(Object.values(mockFlows));
          }
          return Promise.resolve([]);
        }),
        limit: vi.fn().mockResolvedValue([]),
      };
    }),
  }));

  return mockDb;
};

// Mock dependencies
vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: vi.fn((table: string) => ({ name: table })),
  getInsertId: vi.fn((result: any) => result.lastInsertRowid || result.insertId || 1),
  executeDbOperation: vi.fn(async (operation: any) => {
    const mockDb = createMockDb();
    return operation(mockDb);
  }),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2024-12-28T10:00:00Z')),
}));

// Import after mocks
import {
  createApprovalFlow,
  getApprovalFlowById,
  updateApprovalFlow,
  addApprovalRules,
  addApprovalSteps,
} from '@/lib/services/approval-workflow.service';

describe('Approval Workflow Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock data
    mockFlows = {};
    mockRules = {};
    mockSteps = {};
    mockRequests = {};
    mockRequestSteps = {};
    mockDelegations = [];
    nextFlowId = 1;
    nextRuleId = 1;
    nextStepId = 1;
    nextRequestId = 1;
    nextDelegationId = 1;
  });

  describe('Approval Flow CRUD', () => {
    it('should create an approval flow', async () => {
      const flowId = await createApprovalFlow(
        {
          name: 'High-Value PR Approval',
          description: 'Approval for PRs over 100,000 THB',
          documentType: 'purchase_requisition',
          priority: 50,
          isActive: true,
        },
        1
      );

      expect(flowId).toBeGreaterThan(0);
    });

    it('should create flow with default values', async () => {
      const flowId = await createApprovalFlow(
        {
          name: 'Simple Flow',
          documentType: 'purchase_order',
        },
        1
      );

      expect(flowId).toBe(1);
    });
  });

  describe('Rules and Steps', () => {
    it('should add rules to a flow', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Flow with Rules', documentType: 'purchase_requisition' },
        1
      );

      const ruleIds = await addApprovalRules(
        [
          { ruleOrder: 1, fieldName: 'total_amount', operator: 'gte', value: '50000', logicOperator: 'and' },
          { ruleOrder: 2, fieldName: 'priority', operator: 'eq', value: 'urgent', logicOperator: 'and' },
        ],
        flowId
      );

      expect(ruleIds.length).toBe(2);
    });

    it('should add steps to a flow', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Flow with Steps', documentType: 'purchase_requisition' },
        1
      );

      const stepIds = await addApprovalSteps(
        [
          { stepOrder: 1, stepName: 'Manager Approval', approverType: 'user', approverId: 1, canDelegate: true, timeoutDays: 3 },
          { stepOrder: 2, stepName: 'Director Approval', approverType: 'department_head', timeoutDays: 5 },
        ],
        flowId
      );

      expect(stepIds.length).toBe(2);
    });

    it('should add step with minimal data', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Minimal Flow', documentType: 'payment' },
        1
      );

      const stepIds = await addApprovalSteps(
        [{ stepOrder: 1, stepName: 'Single Approval', approverType: 'user', approverId: 1 }],
        flowId
      );

      expect(stepIds.length).toBe(1);
    });
  });

  describe('Rule Operators', () => {
    it('should support eq operator', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Eq Rule Flow', documentType: 'ap_invoice' },
        1
      );

      const ruleIds = await addApprovalRules(
        [{ ruleOrder: 1, fieldName: 'status', operator: 'eq', value: 'urgent' }],
        flowId
      );

      expect(ruleIds.length).toBe(1);
    });

    it('should support gte and lte operators', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Range Rule Flow', documentType: 'credit_note' },
        1
      );

      const ruleIds = await addApprovalRules(
        [
          { ruleOrder: 1, fieldName: 'amount', operator: 'gte', value: '1000' },
          { ruleOrder: 2, fieldName: 'amount', operator: 'lte', value: '10000' },
        ],
        flowId
      );

      expect(ruleIds.length).toBe(2);
    });

    it('should support in operator', async () => {
      const flowId = await createApprovalFlow(
        { name: 'In Rule Flow', documentType: 'debit_note' },
        1
      );

      const ruleIds = await addApprovalRules(
        [{ ruleOrder: 1, fieldName: 'category', operator: 'in', value: 'A,B,C' }],
        flowId
      );

      expect(ruleIds.length).toBe(1);
    });

    it('should support between operator', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Between Rule Flow', documentType: 'ar_invoice' },
        1
      );

      const ruleIds = await addApprovalRules(
        [{ ruleOrder: 1, fieldName: 'totalAmount', operator: 'between', value: '5000,50000' }],
        flowId
      );

      expect(ruleIds.length).toBe(1);
    });
  });

  describe('Approver Types', () => {
    it('should support user approver type', async () => {
      const flowId = await createApprovalFlow(
        { name: 'User Approver Flow', documentType: 'purchase_requisition' },
        1
      );

      const stepIds = await addApprovalSteps(
        [{ stepOrder: 1, stepName: 'Specific User', approverType: 'user', approverId: 10 }],
        flowId
      );

      expect(stepIds.length).toBe(1);
    });

    it('should support department_head approver type', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Dept Head Flow', documentType: 'purchase_order' },
        1
      );

      const stepIds = await addApprovalSteps(
        [{ stepOrder: 1, stepName: 'Dept Head Approval', approverType: 'department_head' }],
        flowId
      );

      expect(stepIds.length).toBe(1);
    });

    it('should support role approver type', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Role Flow', documentType: 'payment' },
        1
      );

      const stepIds = await addApprovalSteps(
        [{ stepOrder: 1, stepName: 'Finance Role', approverType: 'role', approverId: 5 }],
        flowId
      );

      expect(stepIds.length).toBe(1);
    });
  });

  describe('Document Types', () => {
    it('should create flow for purchase_requisition', async () => {
      const flowId = await createApprovalFlow(
        { name: 'PR Flow', documentType: 'purchase_requisition' },
        1
      );
      expect(flowId).toBeGreaterThan(0);
    });

    it('should create flow for purchase_order', async () => {
      const flowId = await createApprovalFlow(
        { name: 'PO Flow', documentType: 'purchase_order' },
        1
      );
      expect(flowId).toBeGreaterThan(0);
    });

    it('should create flow for ap_invoice', async () => {
      const flowId = await createApprovalFlow(
        { name: 'AP Invoice Flow', documentType: 'ap_invoice' },
        1
      );
      expect(flowId).toBeGreaterThan(0);
    });

    it('should create flow for ar_invoice', async () => {
      const flowId = await createApprovalFlow(
        { name: 'AR Invoice Flow', documentType: 'ar_invoice' },
        1
      );
      expect(flowId).toBeGreaterThan(0);
    });

    it('should create flow for payment', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Payment Flow', documentType: 'payment' },
        1
      );
      expect(flowId).toBeGreaterThan(0);
    });

    it('should create flow for credit_note', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Credit Note Flow', documentType: 'credit_note' },
        1
      );
      expect(flowId).toBeGreaterThan(0);
    });

    it('should create flow for debit_note', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Debit Note Flow', documentType: 'debit_note' },
        1
      );
      expect(flowId).toBeGreaterThan(0);
    });
  });

  describe('Multi-Step Workflows', () => {
    it('should create flow with multiple steps in order', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Multi-Step Flow', documentType: 'purchase_requisition', priority: 10 },
        1
      );

      const stepIds = await addApprovalSteps(
        [
          { stepOrder: 1, stepName: 'Manager', approverType: 'user', approverId: 1 },
          { stepOrder: 2, stepName: 'Director', approverType: 'user', approverId: 2 },
          { stepOrder: 3, stepName: 'CFO', approverType: 'user', approverId: 3 },
        ],
        flowId
      );

      expect(stepIds.length).toBe(3);
    });

    it('should create flow with rules and steps', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Complete Flow', documentType: 'payment', priority: 5 },
        1
      );

      const ruleIds = await addApprovalRules(
        [
          { ruleOrder: 1, fieldName: 'amount', operator: 'gte', value: '100000' },
          { ruleOrder: 2, fieldName: 'vendorType', operator: 'eq', value: 'new' },
        ],
        flowId
      );

      const stepIds = await addApprovalSteps(
        [
          { stepOrder: 1, stepName: 'Finance Manager', approverType: 'role', approverId: 10 },
          { stepOrder: 2, stepName: 'CFO', approverType: 'user', approverId: 5 },
        ],
        flowId
      );

      expect(ruleIds.length).toBe(2);
      expect(stepIds.length).toBe(2);
    });
  });

  describe('Delegation Settings', () => {
    it('should create step with delegation enabled', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Delegatable Flow', documentType: 'purchase_requisition' },
        1
      );

      const stepIds = await addApprovalSteps(
        [{ stepOrder: 1, stepName: 'Delegatable Step', approverType: 'user', approverId: 1, canDelegate: true }],
        flowId
      );

      expect(stepIds.length).toBe(1);
    });

    it('should create step with timeout', async () => {
      const flowId = await createApprovalFlow(
        { name: 'Timeout Flow', documentType: 'ap_invoice' },
        1
      );

      const stepIds = await addApprovalSteps(
        [{ stepOrder: 1, stepName: 'Timeout Step', approverType: 'user', approverId: 1, timeoutDays: 7 }],
        flowId
      );

      expect(stepIds.length).toBe(1);
    });
  });
});
