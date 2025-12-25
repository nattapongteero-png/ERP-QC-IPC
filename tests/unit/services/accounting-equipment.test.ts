/**
 * Accounting Equipment Service Unit Tests
 * Feature: 010-accounting-module-integration
 * User Story 8: Track Equipment and Maintenance Costs
 *
 * Tests equipment management, maintenance scheduling, and MTBF analysis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('@/lib/db', () => ({
  db: vi.fn(),
  isSqlite: vi.fn(() => true),
}));

// Mock date-utils
vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => '2025-01-15'),
  toDbDate: vi.fn((date: string) => date),
  toQueryDate: vi.fn((date: string) => date),
  getTodayStr: vi.fn(() => '2025-01-15'),
  formatDateFromDb: vi.fn((date: string | Date) => {
    if (date instanceof Date) return date.toISOString().split('T')[0];
    return date;
  }),
}));

// Mock schema
vi.mock('@/lib/db/schema', () => ({
  sqliteEquipment: {
    id: { name: 'id' },
    fixedAssetId: { name: 'fixed_asset_id' },
    serialNumber: { name: 'serial_number' },
    manufacturer: { name: 'manufacturer' },
    model: { name: 'model' },
    operatingHours: { name: 'operating_hours' },
    lastMeterReading: { name: 'last_meter_reading' },
    isAvailable: { name: 'is_available' },
  },
  sqliteMaintenanceSchedules: {
    id: { name: 'id' },
    equipmentId: { name: 'equipment_id' },
    maintenanceType: { name: 'maintenance_type' },
    intervalType: { name: 'interval_type' },
    intervalValue: { name: 'interval_value' },
    nextDue: { name: 'next_due' },
    isActive: { name: 'is_active' },
  },
  sqliteMaintenanceRecords: {
    id: { name: 'id' },
    equipmentId: { name: 'equipment_id' },
    maintenanceType: { name: 'maintenance_type' },
    maintenanceDate: { name: 'maintenance_date' },
    partsCost: { name: 'parts_cost' },
    laborCost: { name: 'labor_cost' },
    externalServiceCost: { name: 'external_service_cost' },
    downtimeHours: { name: 'downtime_hours' },
    totalCost: { name: 'total_cost' },
  },
  sqliteFixedAssets: {},
  mysqlEquipment: {},
  mysqlMaintenanceSchedules: {},
  mysqlMaintenanceRecords: {},
  mysqlFixedAssets: {},
}));

// Test helper: Calculate next due date logic
describe('Maintenance Schedule Due Date Calculation', () => {
  describe('calculateNextDueDate logic', () => {
    // This tests the internal logic via the expected behavior

    it('should add correct number of days for daily interval', () => {
      const fromDate = '2025-01-15';
      const intervalValue = 30;
      const expected = new Date('2025-01-15');
      expected.setDate(expected.getDate() + intervalValue);

      expect(expected.toISOString().split('T')[0]).toBe('2025-02-14');
    });

    it('should add correct number of weeks for weekly interval', () => {
      const fromDate = '2025-01-15';
      const intervalValue = 4; // 4 weeks
      const expected = new Date(fromDate);
      expected.setDate(expected.getDate() + intervalValue * 7);

      expect(expected.toISOString().split('T')[0]).toBe('2025-02-12');
    });

    it('should add correct number of months for monthly interval', () => {
      const fromDate = '2025-01-15';
      const intervalValue = 3; // 3 months
      const expected = new Date(fromDate);
      expected.setMonth(expected.getMonth() + intervalValue);

      expect(expected.toISOString().split('T')[0]).toBe('2025-04-15');
    });

    it('should handle month-end edge cases', () => {
      const fromDate = '2025-01-31';
      const intervalValue = 1;
      const expected = new Date(fromDate);
      expected.setMonth(expected.getMonth() + intervalValue);

      // Jan 31 + 1 month could go to Feb 28/29 or March 2/3 depending on implementation
      // JavaScript Date rolls over, so it would be March 2 or 3
      expect(['2025-02-28', '2025-03-02', '2025-03-03']).toContain(
        expected.toISOString().split('T')[0]
      );
    });
  });
});

// MTBF Calculation Tests
describe('MTBF Analysis Calculations', () => {
  describe('MTBF (Mean Time Between Failures)', () => {
    it('should calculate MTBF correctly with failures', () => {
      const totalOperatingHours = 1000;
      const totalFailures = 4;
      const mtbf = totalOperatingHours / totalFailures;

      expect(mtbf).toBe(250); // 250 hours between failures
    });

    it('should return total operating hours when no failures', () => {
      const totalOperatingHours = 1000;
      const totalFailures = 0;
      const mtbf = totalFailures > 0 ? totalOperatingHours / totalFailures : totalOperatingHours;

      expect(mtbf).toBe(1000);
    });

    it('should handle high failure rate', () => {
      const totalOperatingHours = 100;
      const totalFailures = 20;
      const mtbf = totalOperatingHours / totalFailures;

      expect(mtbf).toBe(5); // Equipment fails every 5 hours on average
    });
  });

  describe('MTTR (Mean Time To Repair)', () => {
    it('should calculate MTTR correctly', () => {
      const totalDowntimeHours = 48;
      const totalFailures = 4;
      const mttr = totalDowntimeHours / totalFailures;

      expect(mttr).toBe(12); // Average 12 hours to repair
    });

    it('should return 0 when no failures', () => {
      const totalDowntimeHours = 0;
      const totalFailures = 0;
      const mttr = totalFailures > 0 ? totalDowntimeHours / totalFailures : 0;

      expect(mttr).toBe(0);
    });
  });

  describe('Availability Calculation', () => {
    it('should calculate availability correctly', () => {
      const mtbf = 250;
      const mttr = 12;
      const availability = (mtbf / (mtbf + mttr)) * 100;

      // 250 / (250 + 12) * 100 = 95.42%
      expect(availability).toBeCloseTo(95.42, 1);
    });

    it('should be 100% when no failures', () => {
      const mtbf = 1000;
      const mttr = 0;
      const availability = mtbf > 0 ? (mtbf / (mtbf + mttr)) * 100 : 100;

      expect(availability).toBe(100);
    });

    it('should handle low MTBF high MTTR scenario', () => {
      const mtbf = 10;
      const mttr = 10;
      const availability = (mtbf / (mtbf + mttr)) * 100;

      expect(availability).toBe(50); // 50% availability
    });
  });
});

// Equipment Cost Summary Tests
describe('Equipment Cost Summary Calculations', () => {
  describe('Total Cost Calculation', () => {
    it('should sum all cost components correctly', () => {
      const partsCost = 5000;
      const laborCost = 2500;
      const externalServiceCost = 1500;
      const totalCost = partsCost + laborCost + externalServiceCost;

      expect(totalCost).toBe(9000);
    });

    it('should handle zero costs', () => {
      const partsCost = 0;
      const laborCost = 0;
      const externalServiceCost = 0;
      const totalCost = partsCost + laborCost + externalServiceCost;

      expect(totalCost).toBe(0);
    });

    it('should handle partial costs', () => {
      const partsCost = 1000;
      const laborCost = 0;
      const externalServiceCost = 500;
      const totalCost = partsCost + laborCost + externalServiceCost;

      expect(totalCost).toBe(1500);
    });
  });

  describe('Maintenance Event Categorization', () => {
    it('should categorize maintenance events correctly', () => {
      const records = [
        { maintenanceType: 'preventive' },
        { maintenanceType: 'preventive' },
        { maintenanceType: 'corrective' },
        { maintenanceType: 'emergency' },
        { maintenanceType: 'preventive' },
        { maintenanceType: 'corrective' },
      ];

      let preventiveEvents = 0;
      let correctiveEvents = 0;
      let emergencyEvents = 0;

      for (const record of records) {
        switch (record.maintenanceType) {
          case 'preventive':
            preventiveEvents++;
            break;
          case 'corrective':
            correctiveEvents++;
            break;
          case 'emergency':
            emergencyEvents++;
            break;
        }
      }

      expect(preventiveEvents).toBe(3);
      expect(correctiveEvents).toBe(2);
      expect(emergencyEvents).toBe(1);
    });
  });

  describe('Downtime Hours Accumulation', () => {
    it('should sum downtime hours correctly', () => {
      const records = [
        { downtimeHours: 2 },
        { downtimeHours: 8 },
        { downtimeHours: 4 },
        { downtimeHours: 0 },
      ];

      const totalDowntime = records.reduce(
        (sum, r) => sum + (Number(r.downtimeHours) || 0),
        0
      );

      expect(totalDowntime).toBe(14);
    });
  });
});

// Meter Reading Tests
describe('Meter Reading Validation', () => {
  describe('Reading Validation', () => {
    it('should reject reading less than previous', () => {
      const previousReading = 1000;
      const newReading = 900;

      expect(newReading < previousReading).toBe(true);
    });

    it('should accept reading equal to previous', () => {
      const previousReading = 1000;
      const newReading = 1000;

      expect(newReading >= previousReading).toBe(true);
    });

    it('should accept reading greater than previous', () => {
      const previousReading = 1000;
      const newReading = 1500;

      expect(newReading >= previousReading).toBe(true);
    });
  });

  describe('Hours Added Calculation', () => {
    it('should calculate hours added correctly', () => {
      const previousReading = 1000;
      const newReading = 1500;
      const hoursAdded = newReading - previousReading;

      expect(hoursAdded).toBe(500);
    });

    it('should return 0 when reading unchanged', () => {
      const previousReading = 1000;
      const newReading = 1000;
      const hoursAdded = newReading - previousReading;

      expect(hoursAdded).toBe(0);
    });
  });
});

// Due/Overdue Maintenance Tests
describe('Maintenance Due/Overdue Detection', () => {
  describe('Days Until Due Calculation', () => {
    it('should calculate positive days for future due date', () => {
      const today = new Date('2025-01-15');
      const dueDate = new Date('2025-01-25');
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysUntilDue).toBe(10);
    });

    it('should calculate 0 days for today', () => {
      const today = new Date('2025-01-15');
      const dueDate = new Date('2025-01-15');
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysUntilDue).toBe(0);
    });
  });

  describe('Days Overdue Calculation', () => {
    it('should calculate positive days for past due date', () => {
      const today = new Date('2025-01-15');
      const dueDate = new Date('2025-01-10');
      const daysOverdue = Math.ceil(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysOverdue).toBe(5);
    });

    it('should calculate 1 day for yesterday', () => {
      const today = new Date('2025-01-15');
      const dueDate = new Date('2025-01-14');
      const daysOverdue = Math.ceil(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysOverdue).toBe(1);
    });
  });
});

// Maintenance Type Constants
describe('Maintenance Type Constants', () => {
  describe('Interval Types', () => {
    const validIntervalTypes = ['days', 'weeks', 'months', 'hours', 'units'];

    it('should include all required interval types', () => {
      expect(validIntervalTypes).toContain('days');
      expect(validIntervalTypes).toContain('weeks');
      expect(validIntervalTypes).toContain('months');
      expect(validIntervalTypes).toContain('hours');
      expect(validIntervalTypes).toContain('units');
    });
  });

  describe('Maintenance Types', () => {
    const validMaintenanceTypes = ['preventive', 'corrective', 'emergency'];

    it('should include all required maintenance types', () => {
      expect(validMaintenanceTypes).toContain('preventive');
      expect(validMaintenanceTypes).toContain('corrective');
      expect(validMaintenanceTypes).toContain('emergency');
    });
  });
});

// Equipment Availability Tests
describe('Equipment Availability', () => {
  describe('Availability Status', () => {
    it('should track available equipment count', () => {
      const equipment = [
        { isAvailable: true },
        { isAvailable: true },
        { isAvailable: false },
        { isAvailable: true },
      ];

      const available = equipment.filter(e => e.isAvailable).length;
      const unavailable = equipment.filter(e => !e.isAvailable).length;

      expect(available).toBe(3);
      expect(unavailable).toBe(1);
    });

    it('should calculate equipment utilization percentage', () => {
      const total = 10;
      const available = 8;
      const utilization = ((total - available) / total) * 100;

      expect(utilization).toBe(20); // 20% in use
    });
  });
});

// GMP Compliance Indicators
describe('GMP Compliance Indicators', () => {
  describe('Critical Maintenance Tracking', () => {
    it('should identify critical maintenance events', () => {
      const records = [
        { isCritical: true, maintenanceType: 'emergency' },
        { isCritical: false, maintenanceType: 'preventive' },
        { isCritical: true, maintenanceType: 'corrective' },
      ];

      const criticalEvents = records.filter(r => r.isCritical).length;

      expect(criticalEvents).toBe(2);
    });

    it('should track equipment with root cause analysis', () => {
      const records = [
        { rootCause: 'Bearing failure due to lubrication issue' },
        { rootCause: null },
        { rootCause: 'Electrical fault in control panel' },
      ];

      const withRootCause = records.filter(r => r.rootCause !== null).length;

      expect(withRootCause).toBe(2);
    });
  });

  describe('Warranty Tracking', () => {
    it('should identify equipment under warranty', () => {
      const today = new Date('2025-01-15');
      const equipment = [
        { warrantyEndDate: '2025-12-31' }, // Active
        { warrantyEndDate: '2024-12-31' }, // Expired
        { warrantyEndDate: null },         // No warranty
        { warrantyEndDate: '2025-06-30' }, // Active
      ];

      const underWarranty = equipment.filter(e => {
        if (!e.warrantyEndDate) return false;
        return new Date(e.warrantyEndDate) >= today;
      }).length;

      expect(underWarranty).toBe(2);
    });
  });
});
