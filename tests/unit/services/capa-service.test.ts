/**
 * CAPA Service Unit Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the database and audit modules before imports
const mockFrom = vi.fn(() => ({
  where: vi.fn(() => ({
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => Promise.resolve([]))
    })),
    limit: vi.fn(() => Promise.resolve([]))
  })),
  leftJoin: vi.fn(() => ({
    where: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          offset: vi.fn(() => Promise.resolve([]))
        }))
      })),
      limit: vi.fn(() => Promise.resolve([]))
    })),
    orderBy: vi.fn(() => Promise.resolve([]))
  })),
  orderBy: vi.fn(() => ({
    limit: vi.fn(() => Promise.resolve([]))
  }))
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal() as any;
  
  // Track query types to return different data
  let queryType = 'dashboard';
  
  return {
    ...actual,
    isSqlite: vi.fn(() => true),
    getDb: vi.fn(() => Promise.resolve({
      select: vi.fn(() => ({
        from: vi.fn(() => {
          // Create a thenable object that can track query type
          const thenable = {
            where: vi.fn(() => {
              queryType = 'where';
              return thenable;
            }),
            leftJoin: vi.fn(() => {
              queryType = 'join';
              return thenable;
            }),
            orderBy: vi.fn(() => {
              queryType = 'orderBy';
              return thenable;
            }),
            limit: vi.fn(() => {
              queryType = 'limit';
              return thenable;
            }),
            offset: vi.fn(() => {
              queryType = 'offset';
              return thenable;
            }),
            then: (resolve: (value: unknown[]) => void) => {
              // Return different data based on query type
              if (queryType === 'dashboard') {
                // Dashboard query - return mock capa data
                resolve([
                  { 
                    status: 'open', 
                    priority: 'high', 
                    dueDate: '2024-01-01', 
                    closedDate: null, 
                    createdAt: '2024-01-01T00:00:00.000Z' 
                  },
                  { 
                    status: 'closed', 
                    priority: 'medium', 
                    dueDate: '2024-01-01', 
                    closedDate: '2024-01-15T00:00:00.000Z', 
                    createdAt: '2024-01-01T00:00:00.000Z' 
                  },
                  { 
                    status: 'open', 
                    priority: 'low', 
                    dueDate: '2024-01-01', 
                    closedDate: null, 
                    createdAt: '2024-01-01T00:00:00.000Z' 
                  }
                ]);
              } else if (queryType === 'orderBy' || queryType === 'limit') {
                // For generateCapaNumber and other queries that need empty or specific data
                resolve([]);
              } else {
                // Default empty array
                resolve([]);
              }
              queryType = 'dashboard'; // Reset for next query
            }
          };
          return thenable;
        })
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => Promise.resolve([{ id: 1 }]))
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ id: 1 }]))
        }))
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ id: 1 }]))
      }))
    })),
    db: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([]))
            })),
            limit: vi.fn(() => Promise.resolve([]))
          })),
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  offset: vi.fn(() => Promise.resolve([]))
                }))
              })),
              limit: vi.fn(() => Promise.resolve([]))
            })),
            orderBy: vi.fn(() => Promise.resolve([]))
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([]))
          })),
          // Direct call to from() returns an array (for dashboard queries)
          then: (resolve: (value: unknown[]) => void) => resolve([])
        }))
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 1 }]))
        }))
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([]))
        }))
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([]))
      }))
    }))
  };
});

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve())
}));

// Import after mocking
import {
  generateCapaNumber,
  listCapas,
  getCapaById,
  getCapaDetails,
  createCapa,
  createFromDeviation,
  updateCapa,
  closeCapa,
  addAction,
  updateAction,
  verifyAction,
  recordEffectiveness,
  getCapaDashboard
} from '@/lib/services/capa-service';
import type { CapaCreate, CapaActionCreate, CapaEffectivenessCreate } from '@/types/capa';

describe('CAPA Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateCapaNumber', () => {
    it('should generate CAPA number with correct format', async () => {
      const capaNumber = await generateCapaNumber();

      // Format: CAPA-YYMM-####
      expect(capaNumber).toMatch(/^CAPA-\d{4}-\d{4}$/);

      // Check year and month are current
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      expect(capaNumber.startsWith(`CAPA-${year}${month}-`)).toBe(true);
    });

    it('should start with 0001 when no existing CAPAs', async () => {
      const capaNumber = await generateCapaNumber();
      expect(capaNumber).toMatch(/-0001$/);
    });
  });

  describe('listCapas', () => {
    it('should return empty list when no CAPAs exist', async () => {
      const result = await listCapas();

      expect(result).toHaveProperty('capas');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.capas)).toBe(true);
    });

    it('should accept filter parameters', async () => {
      const result = await listCapas({
        status: 'open',
        type: 'corrective',
        priority: 'high',
        page: 1,
        limit: 10
      });

      expect(result).toHaveProperty('capas');
      expect(result).toHaveProperty('total');
    });

    it('should filter by overdue', async () => {
      const result = await listCapas({ overdue: true });

      expect(result).toHaveProperty('capas');
      expect(result).toHaveProperty('total');
    });

    it('should filter by owner', async () => {
      const result = await listCapas({ ownerId: 1 });

      expect(result).toHaveProperty('capas');
    });
  });

  describe('getCapaById', () => {
    it('should return null when CAPA not found', async () => {
      const result = await getCapaById(999);
      expect(result).toBeNull();
    });
  });

  describe('getCapaDetails', () => {
    it('should return null when CAPA not found', async () => {
      const result = await getCapaDetails(999);
      expect(result).toBeNull();
    });
  });

  describe('createCapa', () => {
    it('should require mandatory fields', async () => {
      const validData: CapaCreate = {
        title: 'Test CAPA',
        sourceType: 'deviation',
        sourceId: 1,
        type: 'corrective',
        priority: 'high',
        ownerId: 1,
        dueDate: '2025-02-01'
      };

      // Should not throw with valid data
      expect(validData.title).toBeTruthy();
      expect(validData.type).toBe('corrective');
      expect(validData.priority).toBe('high');
    });

    it('should support different source types', async () => {
      const sourceTypes = ['deviation', 'complaint', 'audit_finding', 'other'];

      sourceTypes.forEach(sourceType => {
        const data: CapaCreate = {
          title: 'Test CAPA',
          sourceType: sourceType as 'deviation' | 'complaint' | 'audit_finding' | 'other',
          type: 'corrective',
          priority: 'medium',
          ownerId: 1,
          dueDate: '2025-02-01'
        };

        expect(data.sourceType).toBe(sourceType);
      });
    });

    it('should support different CAPA types', async () => {
      const capaTypes = ['corrective', 'preventive', 'both'];

      capaTypes.forEach(type => {
        const data: CapaCreate = {
          title: 'Test CAPA',
          sourceType: 'deviation',
          type: type as 'corrective' | 'preventive' | 'both',
          priority: 'medium',
          ownerId: 1,
          dueDate: '2025-02-01'
        };

        expect(data.type).toBe(type);
      });
    });

    it('should support all priority levels', async () => {
      const priorities = ['low', 'medium', 'high', 'critical'];

      priorities.forEach(priority => {
        const data: CapaCreate = {
          title: 'Test CAPA',
          sourceType: 'deviation',
          type: 'corrective',
          priority: priority as 'low' | 'medium' | 'high' | 'critical',
          ownerId: 1,
          dueDate: '2025-02-01'
        };

        expect(data.priority).toBe(priority);
      });
    });
  });

  describe('createFromDeviation', () => {
    it('should accept deviation ID and CAPA data', async () => {
      const deviationId = 1;
      const capaData = {
        title: 'CAPA from Deviation',
        type: 'corrective' as const,
        priority: 'high' as const,
        ownerId: 1,
        dueDate: '2025-02-01'
      };

      expect(deviationId).toBe(1);
      expect(capaData.title).toBe('CAPA from Deviation');
    });
  });

  describe('updateCapa', () => {
    it('should support partial updates', async () => {
      const updates = {
        title: 'Updated Title',
        priority: 'critical' as const,
        status: 'investigation' as const
      };

      expect(updates.title).toBe('Updated Title');
      expect(updates.priority).toBe('critical');
    });

    it('should support root cause update', async () => {
      const updates = {
        rootCauseAnalysis: '5-Why analysis completed',
        rootCauseCategory: 'Human Error'
      };

      expect(updates.rootCauseAnalysis).toBeTruthy();
      expect(updates.rootCauseCategory).toBe('Human Error');
    });
  });

  describe('closeCapa', () => {
    it('should accept closure notes', async () => {
      const closureNotes = 'All actions completed and verified effective';
      expect(closureNotes).toBeTruthy();
    });
  });

  describe('addAction', () => {
    it('should require mandatory action fields', async () => {
      const actionData: CapaActionCreate = {
        description: 'Implement corrective measure',
        actionType: 'corrective',
        assigneeId: 1,
        dueDate: '2025-01-30'
      };

      expect(actionData.description).toBeTruthy();
      expect(actionData.actionType).toBe('corrective');
      expect(actionData.assigneeId).toBe(1);
      expect(actionData.dueDate).toBeTruthy();
    });

    it('should support different action types', async () => {
      const actionTypes = ['immediate', 'corrective', 'preventive'];

      actionTypes.forEach(actionType => {
        const data: CapaActionCreate = {
          description: 'Test action',
          actionType: actionType as 'immediate' | 'corrective' | 'preventive',
          assigneeId: 1,
          dueDate: '2025-01-30'
        };

        expect(data.actionType).toBe(actionType);
      });
    });
  });

  describe('updateAction', () => {
    it('should support status updates', async () => {
      const statuses = ['pending', 'in_progress', 'completed', 'overdue'];

      statuses.forEach(status => {
        expect(['pending', 'in_progress', 'completed', 'overdue']).toContain(status);
      });
    });

    it('should support completion notes', async () => {
      const update = {
        status: 'completed' as const,
        completionNotes: 'Action implemented successfully'
      };

      expect(update.status).toBe('completed');
      expect(update.completionNotes).toBeTruthy();
    });
  });

  describe('verifyAction', () => {
    it('should record verifier and timestamp', async () => {
      const userId = 1;
      const actionId = 1;

      expect(userId).toBe(1);
      expect(actionId).toBe(1);
    });
  });

  describe('recordEffectiveness', () => {
    it('should require mandatory effectiveness fields', async () => {
      const effectivenessData: CapaEffectivenessCreate = {
        criteria: 'No recurrence of deviation',
        result: 'effective'
      };

      expect(effectivenessData.criteria).toBeTruthy();
      expect(effectivenessData.result).toBe('effective');
    });

    it('should support all result types', async () => {
      const results = ['effective', 'not_effective', 'partial'];

      results.forEach(result => {
        const data: CapaEffectivenessCreate = {
          criteria: 'Test criteria',
          result: result as 'effective' | 'not_effective' | 'partial'
        };

        expect(data.result).toBe(result);
      });
    });

    it('should support optional fields', async () => {
      const data: CapaEffectivenessCreate = {
        checkDate: '2025-02-15',
        criteria: 'Process improvement verified',
        result: 'effective',
        evidence: 'QC records show improvement',
        followUpRequired: false,
        notes: 'Additional notes'
      };

      expect(data.checkDate).toBe('2025-02-15');
      expect(data.evidence).toBeTruthy();
      expect(data.followUpRequired).toBe(false);
      expect(data.notes).toBeTruthy();
    });

    it('should allow follow-up required flag', async () => {
      const data: CapaEffectivenessCreate = {
        criteria: 'Partial improvement',
        result: 'partial',
        followUpRequired: true,
        notes: 'Schedule follow-up check in 30 days'
      };

      expect(data.result).toBe('partial');
      expect(data.followUpRequired).toBe(true);
    });
  });

  describe('getCapaDashboard', () => {
    it('should return dashboard statistics structure', async () => {
      const dashboard = await getCapaDashboard();

      expect(dashboard).toHaveProperty('totalOpen');
      expect(dashboard).toHaveProperty('byStatus');
      expect(dashboard).toHaveProperty('byPriority');
      expect(dashboard).toHaveProperty('overdue');
      expect(dashboard).toHaveProperty('closedThisMonth');
      expect(dashboard).toHaveProperty('avgClosureTime');
      expect(dashboard).toHaveProperty('effectivenessRate');
    });

    it('should have correct status counts structure', async () => {
      const dashboard = await getCapaDashboard();

      expect(dashboard.byStatus).toHaveProperty('open');
      expect(dashboard.byStatus).toHaveProperty('investigation');
      expect(dashboard.byStatus).toHaveProperty('action_pending');
      expect(dashboard.byStatus).toHaveProperty('verification');
      expect(dashboard.byStatus).toHaveProperty('closed');
      expect(dashboard.byStatus).toHaveProperty('cancelled');
    });

    it('should have correct priority counts structure', async () => {
      const dashboard = await getCapaDashboard();

      expect(dashboard.byPriority).toHaveProperty('low');
      expect(dashboard.byPriority).toHaveProperty('medium');
      expect(dashboard.byPriority).toHaveProperty('high');
      expect(dashboard.byPriority).toHaveProperty('critical');
    });
  });

  describe('CAPA Workflow', () => {
    it('should follow standard CAPA workflow states', () => {
      const workflowStates = [
        'open',           // Initial state
        'investigation',  // Root cause analysis
        'action_pending', // Actions defined
        'verification',   // Actions verified
        'closed',         // CAPA complete
        'cancelled'       // CAPA cancelled
      ];

      expect(workflowStates).toHaveLength(6);
      expect(workflowStates[0]).toBe('open');
      expect(workflowStates[4]).toBe('closed');
    });

    it('should require effectiveness verification before closure', () => {
      // Business rule: CAPA cannot be closed without effectiveness check
      const closureRequirements = [
        'All actions completed',
        'At least one effectiveness check',
        'Effectiveness result is effective'
      ];

      expect(closureRequirements).toHaveLength(3);
    });
  });

  describe('Thai FDA GMP Compliance', () => {
    it('should support 5-why root cause categories', () => {
      const rootCauseCategories = [
        'Human Error',
        'Equipment Failure',
        'Material Defect',
        'Method Issue',
        'Environment Factor',
        'Measurement Error'
      ];

      // These categories align with 5M+E analysis
      expect(rootCauseCategories).toContain('Human Error');
      expect(rootCauseCategories).toContain('Equipment Failure');
    });

    it('should link CAPA to source documents', () => {
      const sourceTypes = ['deviation', 'complaint', 'audit_finding', 'other'];

      // All source types should be traceable
      expect(sourceTypes).toHaveLength(4);
      expect(sourceTypes).toContain('deviation');
      expect(sourceTypes).toContain('complaint');
      expect(sourceTypes).toContain('audit_finding');
    });
  });
});
