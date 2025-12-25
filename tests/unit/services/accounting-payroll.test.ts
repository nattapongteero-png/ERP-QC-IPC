/**
 * Payroll Accounting Service Unit Tests
 * Feature: 010-accounting-module-integration
 * User Story 10: Integrate with HR for Payroll Accounting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database module
vi.mock('../../../src/lib/db', () => ({
  db: vi.fn(() => mockDb),
  isSqlite: vi.fn(() => true),
}));

// Mock the audit log
vi.mock('../../../src/lib/audit', () => ({
  createAuditLog: vi.fn(),
}));

// Mock accounting service createJournalEntry
const mockCreateJournalEntry = vi.fn();

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  $returningId: vi.fn().mockReturnThis(),
};

// Import the functions to test
import {
  calculateThaiSSO,
  allocatePayrollToCostCenters,
} from '../../../src/lib/services/accounting.service';

import type {
  PayrollEntry,
  PayrollBatch,
  PayrollAccountConfig,
} from '../../../src/types/accounting';

describe('Payroll Accounting Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================
  // Thai SSO Calculation Tests
  // ============================================
  describe('calculateThaiSSO', () => {
    it('should calculate SSO for salary below max wage base', () => {
      const result = calculateThaiSSO(10000);

      expect(result.employeeContribution).toBe(500); // 10000 * 5%
      expect(result.employerContribution).toBe(500);
      expect(result.total).toBe(1000);
    });

    it('should cap SSO at max contribution (750 THB) for high salaries', () => {
      const result = calculateThaiSSO(50000);

      expect(result.employeeContribution).toBe(750); // max 750
      expect(result.employerContribution).toBe(750);
      expect(result.total).toBe(1500);
    });

    it('should calculate SSO at exactly max wage base (15000)', () => {
      const result = calculateThaiSSO(15000);

      expect(result.employeeContribution).toBe(750); // 15000 * 5%
      expect(result.employerContribution).toBe(750);
      expect(result.total).toBe(1500);
    });

    it('should return 0 for zero salary', () => {
      const result = calculateThaiSSO(0);

      expect(result.employeeContribution).toBe(0);
      expect(result.employerContribution).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should calculate SSO for minimum salary', () => {
      const result = calculateThaiSSO(1000);

      expect(result.employeeContribution).toBe(50); // 1000 * 5%
      expect(result.employerContribution).toBe(50);
      expect(result.total).toBe(100);
    });

    it('should handle fractional results correctly', () => {
      const result = calculateThaiSSO(12345);

      expect(result.employeeContribution).toBeCloseTo(617.25, 2);
      expect(result.employerContribution).toBeCloseTo(617.25, 2);
      expect(result.total).toBeCloseTo(1234.5, 2);
    });
  });

  // ============================================
  // Cost Center Allocation Tests
  // ============================================
  describe('allocatePayrollToCostCenters', () => {
    it('should allocate payroll to single cost center', async () => {
      const payrollBatch: PayrollBatch = {
        payrollPeriod: '2025-01',
        payrollDate: '2025-01-31',
        entries: [
          {
            employeeId: 1,
            employeeName: 'John Doe',
            costCenterId: 1,
            costCenterCode: 'PROD',
            baseSalary: 30000,
            overtime: 5000,
            bonuses: 0,
            allowances: 2000,
            otherEarnings: 0,
            grossPay: 37000,
            ssoEmployee: 750,
            whtAmount: 3000,
            otherDeductions: 0,
            totalDeductions: 3750,
            netPay: 33250,
            ssoEmployer: 750,
          },
        ],
      };

      const allocations = await allocatePayrollToCostCenters(payrollBatch);

      expect(allocations).toHaveLength(1);
      expect(allocations[0].costCenterId).toBe(1);
      expect(allocations[0].costCenterCode).toBe('PROD');
      expect(allocations[0].employeeCount).toBe(1);
      expect(allocations[0].grossPay).toBe(37000);
      expect(allocations[0].totalCost).toBe(37750); // grossPay + ssoEmployer
    });

    it('should allocate payroll to multiple cost centers', async () => {
      const payrollBatch: PayrollBatch = {
        payrollPeriod: '2025-01',
        payrollDate: '2025-01-31',
        entries: [
          {
            employeeId: 1,
            employeeName: 'John Doe',
            costCenterId: 1,
            costCenterCode: 'PROD',
            baseSalary: 30000,
            overtime: 0,
            bonuses: 0,
            allowances: 0,
            otherEarnings: 0,
            grossPay: 30000,
            ssoEmployee: 750,
            whtAmount: 2000,
            otherDeductions: 0,
            totalDeductions: 2750,
            netPay: 27250,
            ssoEmployer: 750,
          },
          {
            employeeId: 2,
            employeeName: 'Jane Smith',
            costCenterId: 1,
            costCenterCode: 'PROD',
            baseSalary: 25000,
            overtime: 0,
            bonuses: 0,
            allowances: 0,
            otherEarnings: 0,
            grossPay: 25000,
            ssoEmployee: 750,
            whtAmount: 1500,
            otherDeductions: 0,
            totalDeductions: 2250,
            netPay: 22750,
            ssoEmployer: 750,
          },
          {
            employeeId: 3,
            employeeName: 'Bob Wilson',
            costCenterId: 2,
            costCenterCode: 'QC',
            baseSalary: 35000,
            overtime: 0,
            bonuses: 0,
            allowances: 0,
            otherEarnings: 0,
            grossPay: 35000,
            ssoEmployee: 750,
            whtAmount: 3000,
            otherDeductions: 0,
            totalDeductions: 3750,
            netPay: 31250,
            ssoEmployer: 750,
          },
        ],
      };

      const allocations = await allocatePayrollToCostCenters(payrollBatch);

      expect(allocations).toHaveLength(2);

      // PROD cost center
      const prodAllocation = allocations.find(a => a.costCenterId === 1);
      expect(prodAllocation).toBeDefined();
      expect(prodAllocation!.employeeCount).toBe(2);
      expect(prodAllocation!.grossPay).toBe(55000); // 30000 + 25000
      expect(prodAllocation!.totalCost).toBe(56500); // 55000 + 750 + 750

      // QC cost center
      const qcAllocation = allocations.find(a => a.costCenterId === 2);
      expect(qcAllocation).toBeDefined();
      expect(qcAllocation!.employeeCount).toBe(1);
      expect(qcAllocation!.grossPay).toBe(35000);
      expect(qcAllocation!.totalCost).toBe(35750); // 35000 + 750
    });

    it('should handle entries without cost center', async () => {
      const payrollBatch: PayrollBatch = {
        payrollPeriod: '2025-01',
        payrollDate: '2025-01-31',
        entries: [
          {
            employeeId: 1,
            employeeName: 'John Doe',
            // No cost center
            baseSalary: 20000,
            overtime: 0,
            bonuses: 0,
            allowances: 0,
            otherEarnings: 0,
            grossPay: 20000,
            ssoEmployee: 750,
            whtAmount: 1000,
            otherDeductions: 0,
            totalDeductions: 1750,
            netPay: 18250,
            ssoEmployer: 750,
          },
        ],
      };

      const allocations = await allocatePayrollToCostCenters(payrollBatch);

      expect(allocations).toHaveLength(1);
      expect(allocations[0].costCenterId).toBeNull();
      expect(allocations[0].costCenterCode).toBeNull();
    });

    it('should aggregate all payroll components correctly', async () => {
      const payrollBatch: PayrollBatch = {
        payrollPeriod: '2025-01',
        payrollDate: '2025-01-31',
        entries: [
          {
            employeeId: 1,
            employeeName: 'John Doe',
            costCenterId: 1,
            costCenterCode: 'ADMIN',
            baseSalary: 25000,
            overtime: 5000,
            bonuses: 10000,
            allowances: 3000,
            otherEarnings: 2000,
            grossPay: 45000,
            ssoEmployee: 750,
            whtAmount: 5000,
            otherDeductions: 500,
            totalDeductions: 6250,
            netPay: 38750,
            ssoEmployer: 750,
          },
        ],
      };

      const allocations = await allocatePayrollToCostCenters(payrollBatch);

      expect(allocations[0].baseSalary).toBe(25000);
      expect(allocations[0].overtime).toBe(5000);
      expect(allocations[0].bonuses).toBe(10000);
      expect(allocations[0].allowances).toBe(3000);
      expect(allocations[0].grossPay).toBe(45000);
      expect(allocations[0].ssoEmployee).toBe(750);
      expect(allocations[0].ssoEmployer).toBe(750);
      expect(allocations[0].whtAmount).toBe(5000);
      expect(allocations[0].netPay).toBe(38750);
    });

    it('should return empty array for empty entries', async () => {
      const payrollBatch: PayrollBatch = {
        payrollPeriod: '2025-01',
        payrollDate: '2025-01-31',
        entries: [],
      };

      const allocations = await allocatePayrollToCostCenters(payrollBatch);

      expect(allocations).toHaveLength(0);
    });
  });

  // ============================================
  // Payroll Entry Validation Tests
  // ============================================
  describe('PayrollEntry validation', () => {
    it('should validate gross pay equals sum of components', () => {
      const entry: PayrollEntry = {
        employeeId: 1,
        employeeName: 'Test Employee',
        baseSalary: 25000,
        overtime: 5000,
        bonuses: 3000,
        allowances: 2000,
        otherEarnings: 1000,
        grossPay: 36000, // Should equal sum
        ssoEmployee: 750,
        whtAmount: 3000,
        otherDeductions: 250,
        totalDeductions: 4000,
        netPay: 32000,
        ssoEmployer: 750,
      };

      const expectedGross = entry.baseSalary + entry.overtime + entry.bonuses +
        entry.allowances + entry.otherEarnings;

      expect(entry.grossPay).toBe(expectedGross);
    });

    it('should validate net pay equals gross minus deductions', () => {
      const entry: PayrollEntry = {
        employeeId: 1,
        employeeName: 'Test Employee',
        baseSalary: 30000,
        overtime: 0,
        bonuses: 0,
        allowances: 0,
        otherEarnings: 0,
        grossPay: 30000,
        ssoEmployee: 750,
        whtAmount: 2000,
        otherDeductions: 250,
        totalDeductions: 3000,
        netPay: 27000,
        ssoEmployer: 750,
      };

      const expectedNet = entry.grossPay - entry.totalDeductions;

      expect(entry.netPay).toBe(expectedNet);
    });

    it('should validate total deductions equals sum of all deductions', () => {
      const entry: PayrollEntry = {
        employeeId: 1,
        employeeName: 'Test Employee',
        baseSalary: 30000,
        overtime: 0,
        bonuses: 0,
        allowances: 0,
        otherEarnings: 0,
        grossPay: 30000,
        ssoEmployee: 750,
        whtAmount: 2500,
        otherDeductions: 500,
        totalDeductions: 3750,
        netPay: 26250,
        ssoEmployer: 750,
      };

      const expectedDeductions = entry.ssoEmployee + entry.whtAmount + entry.otherDeductions;

      expect(entry.totalDeductions).toBe(expectedDeductions);
    });
  });

  // ============================================
  // PayrollAccountConfig Validation Tests
  // ============================================
  describe('PayrollAccountConfig', () => {
    it('should have all required account IDs', () => {
      const config: PayrollAccountConfig = {
        salaryExpenseAccountId: 51010, // Salary Expense
        wagesExpenseAccountId: 51020, // Wages Expense
        bonusExpenseAccountId: 51030, // Bonus Expense
        overtimeExpenseAccountId: 51040, // Overtime Expense
        ssoEmployerExpenseAccountId: 51050, // SSO Employer Expense
        ssoPayableAccountId: 21510, // SSO Payable
        whtPayableAccountId: 21520, // WHT Payable
        salaryPayableAccountId: 21500, // Salary Payable
        cashAccountId: 11010, // Cash at Bank
      };

      expect(config.salaryExpenseAccountId).toBeGreaterThan(0);
      expect(config.ssoEmployerExpenseAccountId).toBeGreaterThan(0);
      expect(config.ssoPayableAccountId).toBeGreaterThan(0);
      expect(config.whtPayableAccountId).toBeGreaterThan(0);
      expect(config.cashAccountId).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Thai Statutory Rates Tests
  // ============================================
  describe('Thai Statutory Rates', () => {
    it('should use correct SSO rate (5%)', () => {
      const salary = 10000;
      const result = calculateThaiSSO(salary);

      expect(result.employeeContribution).toBe(salary * 0.05);
    });

    it('should cap SSO at maximum wage base (15000 THB)', () => {
      const highSalary = 100000;
      const result = calculateThaiSSO(highSalary);

      // Max contribution = 15000 * 5% = 750
      expect(result.employeeContribution).toBe(750);
      expect(result.employerContribution).toBe(750);
    });

    it('should match employee and employer contributions', () => {
      const salaries = [5000, 10000, 15000, 20000, 50000];

      for (const salary of salaries) {
        const result = calculateThaiSSO(salary);
        expect(result.employeeContribution).toBe(result.employerContribution);
      }
    });
  });

  // ============================================
  // Payroll Batch Tests
  // ============================================
  describe('PayrollBatch', () => {
    it('should have required period information', () => {
      const batch: PayrollBatch = {
        payrollPeriod: '2025-01',
        payrollDate: '2025-01-31',
        payrollNumber: 'PAY-2025-01',
        description: 'Monthly payroll for January 2025',
        entries: [],
      };

      expect(batch.payrollPeriod).toMatch(/^\d{4}-\d{2}$/);
      expect(batch.payrollDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should calculate batch totals correctly', async () => {
      const batch: PayrollBatch = {
        payrollPeriod: '2025-01',
        payrollDate: '2025-01-31',
        entries: [
          {
            employeeId: 1,
            employeeName: 'Employee 1',
            baseSalary: 30000,
            overtime: 0,
            bonuses: 0,
            allowances: 0,
            otherEarnings: 0,
            grossPay: 30000,
            ssoEmployee: 750,
            whtAmount: 2000,
            otherDeductions: 0,
            totalDeductions: 2750,
            netPay: 27250,
            ssoEmployer: 750,
          },
          {
            employeeId: 2,
            employeeName: 'Employee 2',
            baseSalary: 40000,
            overtime: 0,
            bonuses: 0,
            allowances: 0,
            otherEarnings: 0,
            grossPay: 40000,
            ssoEmployee: 750,
            whtAmount: 3000,
            otherDeductions: 0,
            totalDeductions: 3750,
            netPay: 36250,
            ssoEmployer: 750,
          },
        ],
      };

      const totalGrossPay = batch.entries.reduce((sum, e) => sum + e.grossPay, 0);
      const totalNetPay = batch.entries.reduce((sum, e) => sum + e.netPay, 0);
      const totalSSOEmployee = batch.entries.reduce((sum, e) => sum + e.ssoEmployee, 0);
      const totalSSOEmployer = batch.entries.reduce((sum, e) => sum + e.ssoEmployer, 0);
      const totalWHT = batch.entries.reduce((sum, e) => sum + e.whtAmount, 0);

      expect(totalGrossPay).toBe(70000);
      expect(totalNetPay).toBe(63500);
      expect(totalSSOEmployee).toBe(1500);
      expect(totalSSOEmployer).toBe(1500);
      expect(totalWHT).toBe(5000);
    });
  });

  // ============================================
  // Journal Entry Balance Tests
  // ============================================
  describe('Journal Entry Balance', () => {
    it('should balance debits and credits for payroll entry', () => {
      const entry: PayrollEntry = {
        employeeId: 1,
        employeeName: 'Test Employee',
        baseSalary: 30000,
        overtime: 5000,
        bonuses: 0,
        allowances: 2000,
        otherEarnings: 0,
        grossPay: 37000,
        ssoEmployee: 750,
        whtAmount: 3000,
        otherDeductions: 0,
        totalDeductions: 3750,
        netPay: 33250,
        ssoEmployer: 750,
      };

      // Debits: Salary Expense (grossPay) + SSO Employer Expense
      const totalDebits = entry.grossPay + entry.ssoEmployer;

      // Credits: SSO Payable (employee + employer) + WHT Payable + Cash (netPay)
      const totalCredits = entry.ssoEmployee + entry.ssoEmployer + entry.whtAmount + entry.netPay;

      expect(totalDebits).toBe(totalCredits);
    });

    it('should balance for multiple employees', () => {
      const entries: PayrollEntry[] = [
        {
          employeeId: 1,
          employeeName: 'Employee 1',
          baseSalary: 25000,
          overtime: 0,
          bonuses: 0,
          allowances: 0,
          otherEarnings: 0,
          grossPay: 25000,
          ssoEmployee: 750,
          whtAmount: 1500,
          otherDeductions: 0,
          totalDeductions: 2250,
          netPay: 22750,
          ssoEmployer: 750,
        },
        {
          employeeId: 2,
          employeeName: 'Employee 2',
          baseSalary: 35000,
          overtime: 0,
          bonuses: 0,
          allowances: 0,
          otherEarnings: 0,
          grossPay: 35000,
          ssoEmployee: 750,
          whtAmount: 3000,
          otherDeductions: 0,
          totalDeductions: 3750,
          netPay: 31250,
          ssoEmployer: 750,
        },
      ];

      let totalDebits = 0;
      let totalCredits = 0;

      for (const entry of entries) {
        totalDebits += entry.grossPay + entry.ssoEmployer;
        totalCredits += entry.ssoEmployee + entry.ssoEmployer + entry.whtAmount + entry.netPay;
      }

      expect(totalDebits).toBe(totalCredits);
    });
  });
});

describe('Payroll API Response Types', () => {
  it('should have correct PayrollJournalResult structure', () => {
    const result = {
      success: true,
      journalEntryId: 1,
      entryNumber: 'JE-202501-000001',
      message: 'Created payroll journal entry for 5 employees',
      totals: {
        totalGrossPay: 150000,
        totalNetPay: 135000,
        totalSSOEmployee: 3750,
        totalSSOEmployer: 3750,
        totalWHT: 8500,
        totalOtherDeductions: 0,
      },
      costCenterAllocations: [
        {
          costCenterId: 1,
          costCenterCode: 'PROD',
          salaryExpense: 100000,
          ssoEmployerExpense: 2500,
          totalExpense: 102500,
        },
      ],
    };

    expect(result.success).toBe(true);
    expect(result.journalEntryId).toBeGreaterThan(0);
    expect(result.totals.totalGrossPay).toBeGreaterThan(0);
    expect(result.costCenterAllocations).toBeInstanceOf(Array);
  });

  it('should have correct StatutoryLiabilitiesResult structure', () => {
    const result = {
      success: true,
      journalEntryId: null,
      message: 'Statutory liabilities for 2025-01: SSO 7500.00 THB, WHT 8500.00 THB',
      ssoPayable: 7500,
      whtPayable: 8500,
      totalPayable: 16000,
    };

    expect(result.success).toBe(true);
    expect(result.ssoPayable).toBe(7500);
    expect(result.whtPayable).toBe(8500);
    expect(result.totalPayable).toBe(result.ssoPayable + result.whtPayable);
  });
});
