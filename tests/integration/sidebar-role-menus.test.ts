/**
 * Integration test: Sidebar menu visibility by HR (non-legacy) role
 *
 * Context
 * ───────
 * Sidebar items have an `roles` allow-list of lowercase legacy codes
 * (admin, manager, qc, production, warehouse, purchasing, sales,
 *  accounting, finance, hr, hr_admin, hr_staff, ...).
 *
 * When a user is assigned a modern HR role code (e.g. QC_ANALYST,
 * PROD_MANAGER, PROCUREMENT_MANAGER), `expandRole()` translates the
 * code into legacy aliases before the sidebar runs its filter.
 *
 * This test pins the expected menu for each HR role so that future
 * changes to HR_ROLE_TO_LEGACY are caught early — a broken mapping
 * shows up here as "user X unexpectedly sees menu Y" or vice versa.
 *
 * The menu fixture mirrors the real allow-lists in
 *   src/components/layout/sidebar.tsx (navigation const).
 * Keep them in sync when menu visibility rules change.
 */

import { describe, it, expect } from 'vitest';
import { hasAnyRole } from '../../src/lib/auth/role-mapping';

/**
 * MENU_FIXTURE mirrors the `navigation` constant in sidebar.tsx.
 * Empty `roles` = open to all authenticated users.
 */
const MENU_FIXTURE: Array<{ name: string; roles: string[] }> = [
  { name: 'Dashboard', roles: [] },
  { name: 'Inventory', roles: ['admin', 'manager', 'warehouse', 'production', 'qc', 'purchasing'] },
  { name: 'Production', roles: ['admin', 'manager', 'production', 'qc'] },
  { name: 'Quality', roles: ['admin', 'manager', 'production', 'qc'] },
  { name: 'GMP Compliance', roles: ['admin', 'manager', 'qc', 'qa', 'production'] },
  { name: 'Purchasing', roles: ['admin', 'manager', 'purchasing', 'warehouse'] },
  { name: 'Sales', roles: ['admin', 'manager', 'sales', 'warehouse'] },
  { name: 'Accounting', roles: ['admin', 'manager', 'accounting', 'finance'] },
  { name: 'Cost Management', roles: ['admin', 'manager', 'finance', 'accounting', 'purchasing', 'production'] },
  { name: 'VMI Portal', roles: ['admin', 'manager', 'sales', 'warehouse'] },
  { name: 'HR', roles: ['admin', 'manager', 'hr', 'hr_admin', 'hr_staff'] },
  { name: 'Template', roles: ['admin'] },
  { name: 'Issues', roles: [] },
  { name: 'Reports', roles: ['admin', 'manager', 'hr'] },
  { name: 'Users', roles: ['admin', 'manager'] },
  { name: 'Admin', roles: ['admin'] },
  { name: 'Settings', roles: ['admin', 'manager'] },
];

/** Return the set of menu names visible to the given user role. */
function visibleMenus(role: string | null | undefined): string[] {
  return MENU_FIXTURE
    .filter((m) => hasAnyRole(role, m.roles))
    .map((m) => m.name);
}

describe('Sidebar menu filtering — non-legacy HR roles', () => {
  // ==================================================================
  // Admin family: should see every menu
  // ==================================================================
  describe('Admin-family HR codes (full access)', () => {
    it.each(['ADMIN', 'METAHERB_FACTORY', 'BMS_TEST_LEADER', 'IT_MANAGER'])(
      '%s sees every menu',
      (role) => {
        const menus = visibleMenus(role);
        // Should include every fixture entry
        expect(menus).toEqual(MENU_FIXTURE.map((m) => m.name));
      }
    );
  });

  // ==================================================================
  // Executive family: manager catch-all — sees nearly every menu except Admin
  // ==================================================================
  describe('Executive HR codes (manager catch-all, but not Admin)', () => {
    it('DIRECTOR sees all menus (mapped to manager + admin)', () => {
      const menus = visibleMenus('DIRECTOR');
      expect(menus).toContain('Admin'); // DIRECTOR gets admin too
      expect(menus).toContain('Inventory');
      expect(menus).toContain('HR');
      expect(menus).toContain('Settings');
    });

    it('DEPUTY_DIRECTOR sees manager-scoped menus but NOT Admin', () => {
      const menus = visibleMenus('DEPUTY_DIRECTOR');
      expect(menus).not.toContain('Admin');
      expect(menus).toContain('Inventory');
      expect(menus).toContain('Production');
      expect(menus).toContain('Accounting');
      expect(menus).toContain('HR');
      expect(menus).toContain('Settings');
    });
  });

  // ==================================================================
  // QC family — should see QC-relevant menus only
  // ==================================================================
  describe('Quality HR codes', () => {
    it('QC_ANALYST sees Inventory/Production/Quality/GMP — NOT Sales/Accounting/HR/Admin', () => {
      const menus = visibleMenus('QC_ANALYST');
      // Visible
      expect(menus).toContain('Inventory');
      expect(menus).toContain('Production');
      expect(menus).toContain('Quality');
      expect(menus).toContain('GMP Compliance');
      // Hidden
      expect(menus).not.toContain('Sales');
      expect(menus).not.toContain('Accounting');
      expect(menus).not.toContain('HR');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Settings');
      expect(menus).not.toContain('Users');
      expect(menus).not.toContain('Purchasing');
    });

    it('QA_MANAGER sees Quality + GMP (no manager catch-all)', () => {
      const menus = visibleMenus('QA_MANAGER');
      expect(menus).toContain('Quality');
      expect(menus).toContain('GMP Compliance');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Users'); // manager-only → hidden
      expect(menus).not.toContain('Settings');
    });

    it('PHARMACIST sees Quality + GMP + Production (qc,qa,production)', () => {
      const menus = visibleMenus('PHARMACIST');
      expect(menus).toContain('Quality');
      expect(menus).toContain('GMP Compliance');
      expect(menus).toContain('Production');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Sales');
    });
  });

  // ==================================================================
  // Production family — regression: PROD_MANAGER must NOT see all menus
  // ==================================================================
  describe('Production HR codes', () => {
    it('PROD_MANAGER sees Production/Quality/Inventory/GMP — NOT Sales/HR/Admin/Users', () => {
      const menus = visibleMenus('PROD_MANAGER');
      // Visible
      expect(menus).toContain('Production');
      expect(menus).toContain('Inventory');
      expect(menus).toContain('Quality');
      expect(menus).toContain('GMP Compliance');
      expect(menus).toContain('Cost Management'); // production is in allow-list
      // Hidden — critical regression guards
      expect(menus).not.toContain('Sales');
      expect(menus).not.toContain('Accounting');
      expect(menus).not.toContain('HR');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Users'); // manager-only menu
      expect(menus).not.toContain('Settings'); // manager-only menu
      expect(menus).not.toContain('Purchasing');
    });

    it('PROD_OPERATOR sees Production only (no manager menus)', () => {
      const menus = visibleMenus('PROD_OPERATOR');
      expect(menus).toContain('Production');
      expect(menus).toContain('Inventory');
      expect(menus).not.toContain('Users');
      expect(menus).not.toContain('Settings');
      expect(menus).not.toContain('Admin');
    });
  });

  // ==================================================================
  // Warehouse family
  // ==================================================================
  describe('Warehouse HR codes', () => {
    it('WH_MANAGER sees Inventory/Purchasing/Sales/VMI — NOT Quality/Accounting/Admin', () => {
      const menus = visibleMenus('WH_MANAGER');
      expect(menus).toContain('Inventory');
      expect(menus).toContain('Purchasing'); // warehouse is in allow-list
      expect(menus).toContain('Sales'); // warehouse is in allow-list
      expect(menus).toContain('VMI Portal');
      expect(menus).not.toContain('Quality');
      expect(menus).not.toContain('Accounting');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Users');
    });
  });

  // ==================================================================
  // Purchasing family
  // ==================================================================
  describe('Purchasing HR codes', () => {
    it('PROCUREMENT_MANAGER sees Purchasing/Inventory/Cost — NOT Sales/HR/Admin', () => {
      const menus = visibleMenus('PROCUREMENT_MANAGER');
      expect(menus).toContain('Purchasing');
      expect(menus).toContain('Inventory');
      expect(menus).toContain('Cost Management'); // purchasing is in allow-list
      expect(menus).not.toContain('Sales');
      expect(menus).not.toContain('HR');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Users');
    });

    it('PROCUREMENT staff sees Purchasing + Inventory', () => {
      const menus = visibleMenus('PROCUREMENT');
      expect(menus).toContain('Purchasing');
      expect(menus).toContain('Inventory');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Settings');
    });
  });

  // ==================================================================
  // Sales family
  // ==================================================================
  describe('Sales HR codes', () => {
    it('SALES_MANAGER sees Sales + VMI — NOT Production/Quality/Admin', () => {
      const menus = visibleMenus('SALES_MANAGER');
      expect(menus).toContain('Sales');
      expect(menus).toContain('VMI Portal');
      expect(menus).not.toContain('Production');
      expect(menus).not.toContain('Quality');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Users'); // manager-only menu
      expect(menus).not.toContain('Purchasing');
    });

    it('SALES_STAFF sees Sales + VMI', () => {
      const menus = visibleMenus('SALES_STAFF');
      expect(menus).toContain('Sales');
      expect(menus).toContain('VMI Portal');
      expect(menus).not.toContain('HR');
      expect(menus).not.toContain('Admin');
    });
  });

  // ==================================================================
  // Accounting / Finance
  // ==================================================================
  describe('Accounting/Finance HR codes', () => {
    it('ACCOUNTING_MANAGER sees Accounting + Cost — NOT Admin/Users/Settings', () => {
      const menus = visibleMenus('ACCOUNTING_MANAGER');
      expect(menus).toContain('Accounting');
      expect(menus).toContain('Cost Management');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Users'); // no manager catch-all
      expect(menus).not.toContain('Settings');
      expect(menus).not.toContain('HR');
    });

    it('AP_STAFF sees Accounting (no Cost because accounting not mapped to production)', () => {
      const menus = visibleMenus('AP_STAFF');
      expect(menus).toContain('Accounting');
      expect(menus).toContain('Cost Management'); // accounting IS in Cost Management allow-list
      expect(menus).not.toContain('Production');
      expect(menus).not.toContain('Admin');
    });

    it('FINANCE_MANAGER sees Accounting + Cost', () => {
      const menus = visibleMenus('FINANCE_MANAGER');
      expect(menus).toContain('Accounting');
      expect(menus).toContain('Cost Management');
      expect(menus).not.toContain('Admin');
    });
  });

  // ==================================================================
  // HR family
  // ==================================================================
  describe('HR HR-codes', () => {
    it('HR_MANAGER sees HR + Reports — NOT Admin/Users/Settings', () => {
      const menus = visibleMenus('HR_MANAGER');
      expect(menus).toContain('HR');
      expect(menus).toContain('Reports'); // hr is in Reports allow-list
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Users'); // no manager catch-all
      expect(menus).not.toContain('Settings');
      expect(menus).not.toContain('Production');
    });

    it('HR_STAFF sees HR + Reports only', () => {
      const menus = visibleMenus('HR_STAFF');
      expect(menus).toContain('HR');
      expect(menus).toContain('Reports');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Production');
    });
  });

  // ==================================================================
  // Logistics / Maintenance / R&D — cross-functional
  // ==================================================================
  describe('Cross-functional HR codes', () => {
    it('LOGISTIC_MANAGER sees Warehouse + Sales menus', () => {
      const menus = visibleMenus('LOGISTIC_MANAGER');
      expect(menus).toContain('Inventory'); // warehouse
      expect(menus).toContain('Sales'); // sales
      expect(menus).toContain('VMI Portal');
      expect(menus).toContain('Purchasing'); // warehouse
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Accounting');
    });

    it('MAINT_MANAGER sees Production + Quality (equipment/sanitation)', () => {
      const menus = visibleMenus('MAINT_MANAGER');
      expect(menus).toContain('Production');
      expect(menus).toContain('Quality');
      expect(menus).toContain('GMP Compliance');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Sales');
    });

    it('RD_MANAGER sees Quality + Production (formulation research)', () => {
      const menus = visibleMenus('RD_MANAGER');
      expect(menus).toContain('Quality');
      expect(menus).toContain('Production');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('HR');
    });
  });

  // ==================================================================
  // View-only & misc
  // ==================================================================
  describe('View-only HR codes', () => {
    // Template is now admin-only (dev reference module) — VIEWER/IT_STAFF
    // should NOT see it anymore. Only open menus = Dashboard, Issues.
    it('VIEWER sees only open menus (Dashboard, Issues) — Template is admin-only', () => {
      const menus = visibleMenus('VIEWER');
      expect(menus).toContain('Dashboard');
      expect(menus).toContain('Issues');
      expect(menus).not.toContain('Template');
      expect(menus).not.toContain('Inventory');
      expect(menus).not.toContain('Production');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('HR');
    });

    it('IT_STAFF sees only open menus (Dashboard, Issues) — Template is admin-only', () => {
      const menus = visibleMenus('IT_STAFF');
      expect(menus).toContain('Dashboard');
      expect(menus).toContain('Issues');
      expect(menus).not.toContain('Template');
      expect(menus).not.toContain('Admin');
      expect(menus).not.toContain('Users');
    });
  });

  // ==================================================================
  // Edge cases
  // ==================================================================
  describe('Edge cases', () => {
    it('user with no role sees only open menus (Dashboard + Issues)', () => {
      const menus = visibleMenus(null);
      expect(menus).toEqual(['Dashboard', 'Issues']);
    });

    it('unknown HR code falls back to itself (no matching aliases)', () => {
      const menus = visibleMenus('UNKNOWN_CODE');
      // Lowercased 'unknown_code' matches nothing in allow-lists
      // → sees only the empty-allow-list menus (Dashboard + Issues)
      expect(menus).toEqual(['Dashboard', 'Issues']);
    });

    it('whitespace in role is trimmed before matching', () => {
      const menus = visibleMenus('  QC_ANALYST  ');
      expect(menus).toContain('Quality');
    });
  });
});

describe('Sidebar menu filtering — legacy role codes still work', () => {
  it('legacy "admin" sees every menu', () => {
    expect(visibleMenus('admin')).toEqual(MENU_FIXTURE.map((m) => m.name));
  });

  it('legacy "qc" sees Quality/Production/GMP etc.', () => {
    const menus = visibleMenus('qc');
    expect(menus).toContain('Quality');
    expect(menus).toContain('Production');
    expect(menus).toContain('GMP Compliance');
    expect(menus).not.toContain('Admin');
  });

  it('legacy "warehouse" sees Inventory/Purchasing/Sales', () => {
    const menus = visibleMenus('warehouse');
    expect(menus).toContain('Inventory');
    expect(menus).toContain('Purchasing');
    expect(menus).toContain('Sales');
    expect(menus).not.toContain('Admin');
  });
});

// ======================================================================
// Data-driven: ALL 47 HR role codes from herbal_erp_metaherb.hr_app_roles
// ─────────────────────────────────────────────────────────────────────
// 44 are mapped in HR_ROLE_TO_LEGACY (expected to behave per mapping).
// 3 are custom roles created via /hr/roles UI — fall back to itself
// (lowercase) which matches no legacy allow-list, so user sees only
// open-access menus. That's the expected defensive default.
// ======================================================================

/** Expected minimum menus for each mapped HR role. Subset assertions. */
const ROLE_EXPECTATIONS: Record<string, { mustHave: string[]; mustNotHave: string[] }> = {
  // Admin family
  ADMIN: { mustHave: ['Admin', 'Users', 'Settings', 'HR', 'Accounting'], mustNotHave: [] },
  METAHERB_FACTORY: { mustHave: ['Admin', 'Settings'], mustNotHave: [] },
  BMS_TEST_LEADER: { mustHave: ['Admin', 'Settings'], mustNotHave: [] },
  IT_MANAGER: { mustHave: ['Admin', 'Settings'], mustNotHave: [] },

  // Executive
  DIRECTOR: { mustHave: ['Admin', 'Settings', 'HR'], mustNotHave: [] },
  DEPUTY_DIRECTOR: { mustHave: ['Inventory', 'Production', 'Accounting', 'HR', 'Settings'], mustNotHave: ['Admin'] },
  DIV_HEAD: { mustHave: ['Inventory', 'Production', 'Accounting', 'Settings'], mustNotHave: ['Admin'] },
  SECTION_HEAD: { mustHave: ['Inventory', 'Production', 'Accounting', 'Settings'], mustNotHave: ['Admin'] },

  // Quality & Pharmacy
  PHARMACIST: { mustHave: ['Quality', 'GMP Compliance', 'Production'], mustNotHave: ['Admin', 'Users', 'Sales'] },
  QA_MANAGER: { mustHave: ['Quality', 'GMP Compliance'], mustNotHave: ['Admin', 'Users', 'Sales'] },
  QA_OFFICER: { mustHave: ['Quality', 'GMP Compliance'], mustNotHave: ['Admin', 'Users', 'Sales'] },
  QC_MANAGER: { mustHave: ['Quality', 'Production', 'GMP Compliance'], mustNotHave: ['Admin', 'Users', 'Sales'] },
  QC_ANALYST: { mustHave: ['Quality', 'Production', 'GMP Compliance'], mustNotHave: ['Admin', 'Users', 'Sales'] },

  // Production
  PROD_MANAGER: { mustHave: ['Production', 'Inventory', 'Quality'], mustNotHave: ['Admin', 'Users', 'Settings', 'Sales', 'HR'] },
  PROD_OPERATOR: { mustHave: ['Production', 'Inventory'], mustNotHave: ['Admin', 'Users', 'Settings'] },

  // Warehouse
  WH_MANAGER: { mustHave: ['Inventory', 'Purchasing', 'Sales', 'VMI Portal'], mustNotHave: ['Admin', 'Users', 'Accounting'] },
  WH_STAFF: { mustHave: ['Inventory', 'Purchasing', 'Sales'], mustNotHave: ['Admin', 'Users', 'Accounting'] },

  // Purchasing
  PROCUREMENT: { mustHave: ['Purchasing', 'Inventory', 'Cost Management'], mustNotHave: ['Admin', 'Users', 'HR'] },
  PROCUREMENT_MANAGER: { mustHave: ['Purchasing', 'Inventory', 'Cost Management'], mustNotHave: ['Admin', 'Users', 'HR'] },

  // Sales
  SALES_MANAGER: { mustHave: ['Sales', 'VMI Portal'], mustNotHave: ['Admin', 'Users', 'Production', 'Quality'] },
  SALES_STAFF: { mustHave: ['Sales', 'VMI Portal'], mustNotHave: ['Admin', 'Users', 'Production'] },

  // Marketing (mapped to sales)
  MARKETING_MANAGER: { mustHave: ['Sales', 'VMI Portal'], mustNotHave: ['Admin', 'Users', 'Production', 'Accounting'] },
  MARKETING_STAFF: { mustHave: ['Sales', 'VMI Portal'], mustNotHave: ['Admin', 'Users', 'Accounting'] },

  // Accounting & Finance
  ACCOUNTING_MANAGER: { mustHave: ['Accounting', 'Cost Management'], mustNotHave: ['Admin', 'Users', 'HR'] },
  AP_STAFF: { mustHave: ['Accounting', 'Cost Management'], mustNotHave: ['Admin', 'Users', 'HR'] },
  AR_STAFF: { mustHave: ['Accounting', 'Cost Management'], mustNotHave: ['Admin', 'Users', 'HR'] },
  GL_ACCOUNTANT: { mustHave: ['Accounting', 'Cost Management'], mustNotHave: ['Admin', 'Users'] },
  FINANCE_MANAGER: { mustHave: ['Accounting', 'Cost Management'], mustNotHave: ['Admin', 'Users'] },
  FINANCE_STAFF: { mustHave: ['Accounting', 'Cost Management'], mustNotHave: ['Admin', 'Users'] },

  // HR
  HR_ADMIN: { mustHave: ['HR', 'Reports'], mustNotHave: ['Admin', 'Users', 'Settings', 'Production'] },
  HR_MANAGER: { mustHave: ['HR', 'Reports'], mustNotHave: ['Admin', 'Users', 'Settings', 'Production'] },
  HR_STAFF: { mustHave: ['HR', 'Reports'], mustNotHave: ['Admin', 'Users', 'Settings', 'Production'] },

  // Logistics (cross-functional: warehouse + sales)
  LOGISTIC_MANAGER: { mustHave: ['Inventory', 'Purchasing', 'Sales', 'VMI Portal'], mustNotHave: ['Admin', 'Accounting'] },
  LOGISTIC_STAFF: { mustHave: ['Inventory', 'Purchasing', 'Sales'], mustNotHave: ['Admin', 'Accounting'] },

  // Maintenance (production + qc)
  MAINT_MANAGER: { mustHave: ['Production', 'Quality', 'GMP Compliance'], mustNotHave: ['Admin', 'Sales', 'HR'] },
  MAINT_STAFF: { mustHave: ['Production', 'Quality'], mustNotHave: ['Admin', 'Sales', 'HR'] },

  // R&D
  RD_MANAGER: { mustHave: ['Quality', 'Production'], mustNotHave: ['Admin', 'HR', 'Sales'] },
  RD_STAFF: { mustHave: ['Quality', 'Production'], mustNotHave: ['Admin', 'HR', 'Sales'] },
  RD_RESEARCHER: { mustHave: ['Quality', 'Production'], mustNotHave: ['Admin', 'HR', 'Sales'] },
  SCIENTIST: { mustHave: ['Quality', 'Production'], mustNotHave: ['Admin', 'HR', 'Sales'] },

  // IT
  IT_STAFF: { mustHave: ['Dashboard', 'Issues'], mustNotHave: ['Admin', 'Users', 'Inventory', 'Template'] },

  // Registration & Technician — REGISTRATION maps to hr_staff only, which
  // matches HR menu but NOT Reports (Reports requires 'hr', not 'hr_staff')
  REGISTRATION: { mustHave: ['Quality', 'HR'], mustNotHave: ['Admin', 'Users', 'Sales', 'Reports'] },
  TECHNICIAN: { mustHave: ['Production', 'Inventory'], mustNotHave: ['Admin', 'Users', 'HR'] },

  // View-only
  VIEWER: { mustHave: ['Dashboard', 'Issues'], mustNotHave: ['Admin', 'Users', 'Inventory', 'Template'] },
};

describe('Sidebar menu filtering — complete coverage for all 47 HR roles', () => {
  it('ROLE_EXPECTATIONS covers all 44 mapped HR codes', () => {
    // Guard: if someone adds a new entry to HR_ROLE_TO_LEGACY but forgets
    // to add a ROLE_EXPECTATIONS entry, this count check fails.
    expect(Object.keys(ROLE_EXPECTATIONS)).toHaveLength(44);
  });

  describe.each(Object.entries(ROLE_EXPECTATIONS))(
    'HR role: %s',
    (role, { mustHave, mustNotHave }) => {
      it('shows all required menus', () => {
        const menus = visibleMenus(role);
        for (const m of mustHave) {
          expect(menus, `${role} should see "${m}"`).toContain(m);
        }
      });

      it('hides all restricted menus', () => {
        const menus = visibleMenus(role);
        for (const m of mustNotHave) {
          expect(menus, `${role} should NOT see "${m}"`).not.toContain(m);
        }
      });

      it('always has Dashboard + Issues (open-access menus)', () => {
        const menus = visibleMenus(role);
        expect(menus).toContain('Dashboard');
        expect(menus).toContain('Issues');
        // Template is now admin-only — only admin-family roles see it
      });
    }
  );

  describe('Custom / unknown roles from DB (not in HR_ROLE_TO_LEGACY)', () => {
    // These exist in hr_app_roles but have no mapping entry.
    // expandRole() falls back to [lowercase] which doesn't match any
    // legacy allow-list → user sees only the open-access menus.
    it.each(['automate_test', 'test_manager', 'test_test_test'])(
      '%s falls back to open menus only (safe default)',
      (role) => {
        const menus = visibleMenus(role);
        expect(menus).toEqual(['Dashboard', 'Issues']);
      }
    );
  });
});
