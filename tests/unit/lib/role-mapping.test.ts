import { describe, it, expect } from 'vitest';
import { expandRole, hasAnyRole } from '../../../src/lib/auth/role-mapping';
import { hasPermission, isAdminRole } from '../../../src/lib/auth';

/**
 * Tests for the HR Role → Legacy Role mapping layer.
 *
 * Regression context: users assigned an HR role code (e.g. QC_ANALYST) were
 * seeing an empty sidebar because the sidebar filter compared the raw string
 * against legacy lowercase role names. The mapping layer added here expands
 * an HR code into its legacy aliases so menus become visible.
 *
 * A separate regression caused department managers like PROD_MANAGER to see
 * EVERY menu because they were mapped to include the 'manager' catch-all.
 * These tests lock in the corrected mapping.
 */

describe('expandRole()', () => {
  describe('Legacy roles (backward compatible)', () => {
    it('returns the lowercase role itself when no HR mapping exists', () => {
      expect(expandRole('admin')).toEqual(['admin']);
      expect(expandRole('manager')).toEqual(['manager']);
      expect(expandRole('qc')).toEqual(['qc']);
      expect(expandRole('production')).toEqual(['production']);
    });

    it('uppercases legacy role input still yields lowercase', () => {
      expect(expandRole('ADMIN')).toContain('admin');
      expect(expandRole('MANAGER')).toContain('manager');
    });
  });

  describe('HR role codes — admin family', () => {
    it('ADMIN maps to full admin access', () => {
      expect(expandRole('ADMIN')).toContain('admin');
    });

    it('METAHERB_FACTORY (factory owner) maps to admin', () => {
      expect(expandRole('METAHERB_FACTORY')).toContain('admin');
    });

    it('BMS_TEST_LEADER maps to admin', () => {
      expect(expandRole('BMS_TEST_LEADER')).toContain('admin');
    });
  });

  describe('HR role codes — executives', () => {
    it('DIRECTOR gets both manager and admin access', () => {
      const expanded = expandRole('DIRECTOR');
      expect(expanded).toContain('manager');
      expect(expanded).toContain('admin');
    });

    it('DEPUTY_DIRECTOR gets manager but NOT admin', () => {
      const expanded = expandRole('DEPUTY_DIRECTOR');
      expect(expanded).toContain('manager');
      expect(expanded).not.toContain('admin');
    });

    it('DIV_HEAD and SECTION_HEAD map to manager', () => {
      expect(expandRole('DIV_HEAD')).toContain('manager');
      expect(expandRole('SECTION_HEAD')).toContain('manager');
    });
  });

  describe('HR role codes — department-specific managers MUST NOT have manager catch-all', () => {
    // Regression test: PROD_MANAGER was incorrectly mapped to include
    // 'manager', which gave it visibility into every menu in the sidebar
    // (because 'manager' appears in every item.roles allow-list).
    it('PROD_MANAGER maps to production only — NOT manager', () => {
      const expanded = expandRole('PROD_MANAGER');
      expect(expanded).toContain('production');
      expect(expanded).not.toContain('manager');
      expect(expanded).not.toContain('admin');
    });

    it('QC_MANAGER maps to qc only — NOT manager', () => {
      expect(expandRole('QC_MANAGER')).not.toContain('manager');
      expect(expandRole('QC_MANAGER')).toContain('qc');
    });

    it('WH_MANAGER maps to warehouse only — NOT manager', () => {
      expect(expandRole('WH_MANAGER')).not.toContain('manager');
      expect(expandRole('WH_MANAGER')).toContain('warehouse');
    });

    it('SALES_MANAGER maps to sales only — NOT manager', () => {
      expect(expandRole('SALES_MANAGER')).not.toContain('manager');
      expect(expandRole('SALES_MANAGER')).toContain('sales');
    });

    it('ACCOUNTING_MANAGER maps to accounting/finance only — NOT manager', () => {
      const expanded = expandRole('ACCOUNTING_MANAGER');
      expect(expanded).not.toContain('manager');
      expect(expanded).toContain('accounting');
      expect(expanded).toContain('finance');
    });

    it('HR_MANAGER maps to hr family only — NOT manager', () => {
      const expanded = expandRole('HR_MANAGER');
      expect(expanded).not.toContain('manager');
      expect(expanded).toContain('hr');
      expect(expanded).toContain('hr_admin');
    });

    it('MAINT_MANAGER maps to production + qc (touches equipment+sanitation)', () => {
      const expanded = expandRole('MAINT_MANAGER');
      expect(expanded).not.toContain('manager');
      expect(expanded).toContain('production');
      expect(expanded).toContain('qc');
    });
  });

  describe('HR role codes — staff level', () => {
    it('QC_ANALYST maps to qc', () => {
      expect(expandRole('QC_ANALYST')).toContain('qc');
    });

    it('PROD_OPERATOR maps to production', () => {
      expect(expandRole('PROD_OPERATOR')).toContain('production');
    });

    it('WH_STAFF maps to warehouse', () => {
      expect(expandRole('WH_STAFF')).toContain('warehouse');
    });

    it('SALES_STAFF maps to sales', () => {
      expect(expandRole('SALES_STAFF')).toContain('sales');
    });

    it('PHARMACIST maps to qc + qa (no manager)', () => {
      const expanded = expandRole('PHARMACIST');
      expect(expanded).toContain('qc');
      expect(expanded).toContain('qa');
      expect(expanded).not.toContain('manager');
    });
  });

  describe('Edge cases', () => {
    it('returns empty array for null/undefined/empty', () => {
      expect(expandRole(null)).toEqual([]);
      expect(expandRole(undefined)).toEqual([]);
      expect(expandRole('')).toEqual([]);
      expect(expandRole('   ')).toEqual([]);
    });

    it('trims and normalizes whitespace', () => {
      expect(expandRole('  QC_ANALYST  ')).toContain('qc');
    });

    it('unknown HR code falls back to lowercased form', () => {
      expect(expandRole('UNKNOWN_XYZ')).toEqual(['unknown_xyz']);
    });

    it('includes lowercased original alongside mapped aliases', () => {
      const expanded = expandRole('QC_MANAGER');
      expect(expanded).toContain('qc_manager');
      expect(expanded).toContain('qc');
    });
  });
});

describe('hasAnyRole()', () => {
  it('returns true when allowedRoles is empty (open to all)', () => {
    expect(hasAnyRole('QC_ANALYST', [])).toBe(true);
    expect(hasAnyRole('QC_ANALYST', undefined)).toBe(true);
  });

  it('returns false when user has no role', () => {
    expect(hasAnyRole(null, ['qc'])).toBe(false);
    expect(hasAnyRole('', ['qc'])).toBe(false);
  });

  it('admin always passes regardless of allow-list', () => {
    expect(hasAnyRole('admin', ['qc'])).toBe(true);
    expect(hasAnyRole('ADMIN', ['nonexistent'])).toBe(true);
    expect(hasAnyRole('METAHERB_FACTORY', ['sales'])).toBe(true);
  });

  it('QC_ANALYST passes qc allow-list', () => {
    expect(hasAnyRole('QC_ANALYST', ['qc'])).toBe(true);
  });

  it('QC_ANALYST does NOT pass sales allow-list', () => {
    expect(hasAnyRole('QC_ANALYST', ['sales'])).toBe(false);
  });

  it('PROD_MANAGER does NOT pass a manager-only menu anymore', () => {
    // Regression: PROD_MANAGER used to pass because of 'manager' catch-all.
    expect(hasAnyRole('PROD_MANAGER', ['manager'])).toBe(false);
    expect(hasAnyRole('PROD_MANAGER', ['production'])).toBe(true);
  });

  it('DIRECTOR still passes manager-only menus', () => {
    expect(hasAnyRole('DIRECTOR', ['manager'])).toBe(true);
  });
});

describe('hasPermission() with HR role codes', () => {
  it('grants production:read to QC_ANALYST (qc is in allow-list)', () => {
    expect(hasPermission('QC_ANALYST' as any, 'production:read')).toBe(true);
  });

  it('grants quality:write to QC_ANALYST', () => {
    expect(hasPermission('QC_ANALYST' as any, 'quality:write')).toBe(true);
  });

  it('denies sales:write to QC_ANALYST', () => {
    expect(hasPermission('QC_ANALYST' as any, 'sales:write')).toBe(false);
  });

  it('grants purchasing:read to PROD_MANAGER (vendor lookup for traceability)', () => {
    // Regression: production roles used to be blocked from vendor master
    // data lookup, which broke the Inventory Lots page for them.
    expect(hasPermission('PROD_MANAGER' as any, 'purchasing:read')).toBe(true);
  });

  it('denies purchasing:write to PROD_MANAGER (write still restricted)', () => {
    expect(hasPermission('PROD_MANAGER' as any, 'purchasing:write')).toBe(false);
  });

  it('denies production:approve to PROD_OPERATOR (only execute)', () => {
    expect(hasPermission('PROD_OPERATOR' as any, 'production:approve')).toBe(false);
  });

  it('admin passes every permission', () => {
    expect(hasPermission('admin' as any, 'sales:approve')).toBe(true);
    expect(hasPermission('ADMIN' as any, 'settings:write')).toBe(true);
    expect(hasPermission('METAHERB_FACTORY' as any, 'hr:admin')).toBe(true);
  });
});

describe('isAdminRole() recognizes HR admin-family codes', () => {
  it('accepts lowercase admin', () => {
    expect(isAdminRole('admin')).toBe(true);
  });

  it('accepts HR code ADMIN', () => {
    expect(isAdminRole('ADMIN')).toBe(true);
  });

  it('accepts METAHERB_FACTORY (owner)', () => {
    expect(isAdminRole('METAHERB_FACTORY')).toBe(true);
  });

  it('accepts BMS_TEST_LEADER', () => {
    expect(isAdminRole('BMS_TEST_LEADER')).toBe(true);
  });

  it('rejects non-admin roles', () => {
    expect(isAdminRole('QC_ANALYST')).toBe(false);
    expect(isAdminRole('PROD_MANAGER')).toBe(false);
    expect(isAdminRole('manager')).toBe(false);
  });
});
