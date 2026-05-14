/**
 * HR Role → Legacy System Role Mapping
 * ─────────────────────────────────────
 * The sidebar and auth permission matrix were originally built around a small
 * set of lowercase "system role" strings (admin, manager, qc, production, etc).
 * The HR module later introduced a richer catalog of role codes managed from
 * /hr/roles (e.g. QC_ANALYST, PHARMACIST, WH_MANAGER).
 *
 * When an HR role is assigned to a user via /users/new, the uppercase code is
 * stored directly in users.role. Without a mapping layer, the sidebar compares
 * e.g. "QC_ANALYST" against ["qc", "manager", ...] and finds nothing, so the
 * user sees an empty menu even though they have permissions in hr_role_permissions.
 *
 * This module translates an HR role code into the set of legacy system roles
 * that behave equivalently for menu visibility and permission checks. Callers
 * should use `expandRole(userRole)` before doing any `.includes(role)` check
 * against the legacy role lists.
 *
 * Returned array always includes the original (lowercased) code so legacy
 * users (role = 'admin' / 'manager' / 'qc' / …) continue to work unchanged.
 */

/**
 * Map from HR role code (UPPER_CASE) → legacy system role aliases (lowercase).
 *
 * Each HR role maps to one or more legacy roles so the existing sidebar
 * filtering and `hasPermission()` checks keep working without a big refactor.
 * Guiding principle: give each HR role at least the legacy baseline that
 * matches its GMP function (QC, Production, Warehouse, …).
 */
// IMPORTANT: The legacy 'manager' role is a CATCH-ALL that unlocks every menu
// in the sidebar (it appears in every item.roles allow-list). Only assign it
// to truly cross-functional executive roles (Director, Division Head). A
// department-specific manager (e.g. PROD_MANAGER) must NOT be mapped to
// 'manager' — instead give them their functional legacy aliases only, which
// grants access to the menus relevant to their department.
const HR_ROLE_TO_LEGACY: Record<string, string[]> = {
  // Admin / Owner — full access
  ADMIN: ['admin'],
  METAHERB_FACTORY: ['admin'],
  BMS_TEST_LEADER: ['admin'],

  // Executives — true cross-functional oversight; get the 'manager' catch-all
  DIRECTOR: ['manager', 'admin'],
  DEPUTY_DIRECTOR: ['manager'],
  DIV_HEAD: ['manager'],
  // Section head supervises within a functional area — still gets 'manager'
  // because they may oversee multiple departments.
  SECTION_HEAD: ['manager'],

  // Quality & Pharmacy — functional roles, NOT given 'manager' catch-all
  PHARMACIST: ['qc', 'qa'],
  QA_MANAGER: ['qc', 'qa'],
  QA_OFFICER: ['qc', 'qa'],
  QC_MANAGER: ['qc'],
  QC_ANALYST: ['qc'],

  // Production — functional only
  PROD_MANAGER: ['production'],
  PROD_OPERATOR: ['production'],

  // Warehouse / Inventory — functional only
  WH_MANAGER: ['warehouse'],
  WH_STAFF: ['warehouse'],

  // Purchasing — functional only
  PROCUREMENT: ['purchasing'],
  PROCUREMENT_MANAGER: ['purchasing'],

  // Sales — functional only
  SALES_MANAGER: ['sales'],
  SALES_STAFF: ['sales'],

  // Marketing — read sales + customers (no write/approve on orders)
  MARKETING_MANAGER: ['sales'],
  MARKETING_STAFF: ['sales'],

  // Accounting — functional only
  ACCOUNTING_MANAGER: ['accounting', 'finance'],
  AP_STAFF: ['accounting'],
  AR_STAFF: ['accounting'],
  GL_ACCOUNTANT: ['accounting'],

  // Finance — functional only
  FINANCE_MANAGER: ['finance', 'accounting'],
  FINANCE_STAFF: ['finance', 'accountant'],

  // HR — functional only
  HR_ADMIN: ['hr_admin', 'hr'],
  HR_MANAGER: ['hr_admin', 'hr'],
  HR_STAFF: ['hr_staff', 'hr'],

  // Logistics — cross-functional (warehouse + sales access needed)
  LOGISTIC_MANAGER: ['warehouse', 'sales'],
  LOGISTIC_STAFF: ['warehouse', 'sales'],

  // Maintenance — touches production equipment + sanitation
  MAINT_MANAGER: ['production', 'qc'],
  MAINT_STAFF: ['production', 'qc'],

  // R&D — formulation research
  RD_MANAGER: ['qc', 'production'],
  RD_STAFF: ['qc', 'production'],

  // IT — keep 'admin' because IT Manager legitimately needs cross-system
  // access (users, settings, audit trail). IT Staff gets a lighter footprint.
  IT_MANAGER: ['admin'],
  IT_STAFF: ['user'],

  // Scientist / Researcher / Technicians — functional, no catch-all
  SCIENTIST: ['qc', 'production'],
  RD_RESEARCHER: ['qc', 'production'],
  REGISTRATION: ['hr_staff', 'qc'],
  TECHNICIAN: ['production'],

  // View-only
  VIEWER: ['user'],
};

/**
 * Expand a user's role (as stored on users.role) into the set of legacy role
 * codes the sidebar and `hasPermission()` compare against.
 *
 * The returned array is always lowercased. The original role (lowercased) is
 * always included as the last entry so existing legacy usage keeps working.
 *
 * Usage:
 *   const legacyRoles = expandRole(session.role);
 *   const canSee = item.roles.some(r => legacyRoles.includes(r));
 */
export function expandRole(role: string | null | undefined): string[] {
  if (!role) return [];
  const trimmed = role.trim();
  if (!trimmed) return [];
  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();

  const mapped = HR_ROLE_TO_LEGACY[upper];
  if (mapped && mapped.length > 0) {
    // Include the original (lower) too, so both legacy and HR codes work.
    return Array.from(new Set([...mapped, lower]));
  }
  // No HR mapping — treat as a legacy role directly (e.g. 'admin', 'manager').
  return [lower];
}

/**
 * Convenience: does any of the user's expanded roles intersect the allow-list?
 * Returns true for empty allow-lists (open to all authenticated users).
 */
export function hasAnyRole(userRole: string | null | undefined, allowedRoles: string[] | undefined): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  const expanded = expandRole(userRole);
  if (expanded.length === 0) return false;
  if (expanded.includes('admin')) return true;
  return allowedRoles.some((r) => expanded.includes(r.toLowerCase()));
}
