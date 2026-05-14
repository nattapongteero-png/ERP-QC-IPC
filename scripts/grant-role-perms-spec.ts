#!/usr/bin/env bun
/**
 * Grant the full role → permission matrix requested by the product owner
 * (see their /hr/roles audit message) across all production tenants.
 *
 * Idempotent: uses INSERT IGNORE so rows that already exist stay as-is and
 * no hardcoded defaults are overwritten. The runtime resolver picks these
 * up within 60 seconds (or immediately when admin saves through the UI).
 *
 * Cost Management tier: B — business-aware.
 *   cost:read  → finance, accounting, production, procurement, sales line.
 *   cost:write → finance + accounting managers + PROD_MANAGER.
 *
 * Admin-level roles (ADMIN, DIRECTOR, DEPUTY_DIRECTOR, DIV_HEAD,
 * SECTION_HEAD, METAHERB_FACTORY, BMS_TEST_LEADER, IT_MANAGER) bypass
 * permission checks at runtime via isAdminRole(), so this script does
 * NOT touch them — their rows in hr_role_permissions are irrelevant.
 */

import mysql from 'mysql2/promise';

const TENANTS = [
  'herbal_erp_metaherb',
  'herbal_erp_arjaro',
  'herbal_erp_renunakhon',
  'herbal_erp_huaikoeng',
  'herbal_erp_phonphisai',
];

// ---- Permission bundles -----------------------------------------------------

const INVENTORY_FULL = [
  'inventory:read', 'inventory:write', 'inventory:adjust',
  'items:read', 'items:write', 'items:delete',
];

const PRODUCTION_FULL = [
  'production:read', 'production:write', 'production:approve',
  'production:execute', 'production:complete',
  'production:clean_mark', 'production:clean_verify',
];

const GMP_FULL = [
  'documents:read', 'documents:write', 'documents:approve',
  'capa:read', 'capa:write', 'capa:close',
  'complaints:read', 'complaints:write', 'complaints:investigate', 'complaints:close',
  'recalls:read', 'recalls:write', 'recalls:execute', 'recalls:close',
  'stability:read', 'stability:write', 'stability:approve',
  'sanitation:read', 'sanitation:write', 'sanitation:verify',
  'audit:read', 'audit:write', 'audit:approve',
  'pqr:read', 'pqr:write', 'pqr:approve', 'pqr:delete',
  'change_control:read', 'change_control:write', 'change_control:approve',
];

const VMI_FULL = [
  'vmi-settings:read', 'vmi-settings:write',
  'vmi-sync:execute',
  'vmi-orders:read', 'vmi-orders:write',
];

const PURCHASING_FULL = [
  'purchasing:read', 'purchasing:write', 'purchasing:approve',
];

const SALES_FULL = [
  'sales:read', 'sales:write', 'sales:approve',
];

const ACCOUNTING_FULL = [
  'accounting:gl_accounts:read', 'accounting:gl_accounts:write', 'accounting:gl_accounts:delete',
  'accounting:gl_account_types:read', 'accounting:gl_account_types:write',
  'accounting:journal_entries:read', 'accounting:journal_entries:write',
  'accounting:journal_entries:post', 'accounting:journal_entries:reverse',
  'accounting:fiscal_periods:read', 'accounting:fiscal_periods:write', 'accounting:fiscal_periods:close',
  'accounting:ap_invoices:read', 'accounting:ap_invoices:write',
  'accounting:ap_invoices:approve', 'accounting:ap_invoices:pay',
  'accounting:ar_invoices:read', 'accounting:ar_invoices:write', 'accounting:ar_invoices:confirm',
  'accounting:payments:read', 'accounting:payments:write',
  'accounting:cost_allocation:read', 'accounting:cost_allocation:write',
  'accounting:fixed_assets:read', 'accounting:fixed_assets:write',
  'accounting:asset_categories:read', 'accounting:asset_categories:write',
  'accounting:equipment:read', 'accounting:equipment:write',
  'accounting:maintenance:read', 'accounting:maintenance:write',
  'accounting:reports:read',
];

const HR_FULL = ['hr:read', 'hr:write', 'hr:admin', 'hr:health_staff'];

// ---- Target matrix: role code → permission codes ----------------------------
// Admin-tier roles intentionally excluded (handled by isAdminRole bypass).

const MATRIX: Record<string, string[]> = {
  // Production
  PROD_MANAGER:   [...INVENTORY_FULL, ...PRODUCTION_FULL, ...GMP_FULL, ...VMI_FULL],
  PROD_OPERATOR:  [...INVENTORY_FULL, ...PRODUCTION_FULL, ...VMI_FULL],

  // QC
  QC_MANAGER:     [...INVENTORY_FULL, ...PRODUCTION_FULL, ...GMP_FULL],
  QC_ANALYST:     [...INVENTORY_FULL, ...PRODUCTION_FULL],

  // QA
  QA_MANAGER:     [...INVENTORY_FULL, ...PRODUCTION_FULL, ...GMP_FULL],
  QA_OFFICER:     [...INVENTORY_FULL, ...PRODUCTION_FULL],

  // Warehouse
  WH_MANAGER:     [...INVENTORY_FULL, ...GMP_FULL, ...VMI_FULL, ...PURCHASING_FULL],
  WH_STAFF:       [...INVENTORY_FULL, ...VMI_FULL, ...PURCHASING_FULL],

  // Sales / Marketing — the spec lumps both together for this org
  SALES_MANAGER:      [...INVENTORY_FULL, ...GMP_FULL, ...PURCHASING_FULL, ...SALES_FULL, ...ACCOUNTING_FULL, ...VMI_FULL],
  MARKETING_MANAGER:  [...INVENTORY_FULL, ...GMP_FULL, ...PURCHASING_FULL, ...SALES_FULL, ...ACCOUNTING_FULL, ...VMI_FULL],
  SALES_STAFF:        [...INVENTORY_FULL, ...PURCHASING_FULL, ...SALES_FULL, ...ACCOUNTING_FULL, ...VMI_FULL],
  MARKETING_STAFF:    [...INVENTORY_FULL, ...PURCHASING_FULL, ...SALES_FULL, ...ACCOUNTING_FULL, ...VMI_FULL],

  // Procurement
  PROCUREMENT_MANAGER: [...INVENTORY_FULL, ...GMP_FULL, ...PURCHASING_FULL, ...SALES_FULL, ...ACCOUNTING_FULL, ...VMI_FULL],
  PROCUREMENT:         [...INVENTORY_FULL, ...PURCHASING_FULL, ...SALES_FULL, ...ACCOUNTING_FULL, ...VMI_FULL],

  // HR
  HR_MANAGER:     [...GMP_FULL, ...HR_FULL],
  HR_ADMIN:       [...GMP_FULL, ...HR_FULL],
  HR_STAFF:       [...GMP_FULL, ...HR_FULL],

  // Accounting — full accounting + Cost Management + support modules per spec
  ACCOUNTING_MANAGER: [...INVENTORY_FULL, ...GMP_FULL, ...PURCHASING_FULL, ...SALES_FULL, ...ACCOUNTING_FULL, 'cost:read', 'cost:write', ...VMI_FULL],
  AP_STAFF:           [...INVENTORY_FULL, ...PURCHASING_FULL, ...SALES_FULL, ...ACCOUNTING_FULL, 'cost:read', 'cost:write', ...VMI_FULL],
  AR_STAFF:           [...INVENTORY_FULL, ...PURCHASING_FULL, ...SALES_FULL, ...ACCOUNTING_FULL, 'cost:read', 'cost:write', ...VMI_FULL],
  GL_ACCOUNTANT:      [...INVENTORY_FULL, ...PURCHASING_FULL, ...SALES_FULL, ...ACCOUNTING_FULL, 'cost:read', 'cost:write', ...VMI_FULL],
};

// Cost Management — Tier B additions (beyond what's already in MATRIX above).
// Anyone listed here gets cost:read; the WRITE list is a narrower subset.
const COST_READ_EXTRA = [
  'PROD_MANAGER', 'PROD_OPERATOR',
  'PROCUREMENT_MANAGER', 'PROCUREMENT',
  'SALES_MANAGER', 'MARKETING_MANAGER',
  'SALES_STAFF', 'MARKETING_STAFF',
  'FINANCE_MANAGER', 'FINANCE_STAFF',
];
const COST_WRITE_EXTRA = ['PROD_MANAGER', 'FINANCE_MANAGER'];

for (const r of COST_READ_EXTRA) {
  MATRIX[r] = Array.from(new Set([...(MATRIX[r] ?? []), 'cost:read']));
}
for (const r of COST_WRITE_EXTRA) {
  MATRIX[r] = Array.from(new Set([...(MATRIX[r] ?? []), 'cost:write']));
}

// ---- Apply to each tenant ---------------------------------------------------

async function applyTenant(db: string) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: db,
    charset: 'utf8mb4',
  });

  // Resolve role + permission codes to their integer ids in this tenant.
  const [roleRows] = (await conn.query(
    'SELECT id, UPPER(code) AS code FROM hr_app_roles'
  )) as [{ id: number; code: string }[], unknown];
  const roleIdByCode = new Map(roleRows.map((r) => [r.code, r.id]));

  const [permRows] = (await conn.query(
    'SELECT id, code FROM hr_app_permissions'
  )) as [{ id: number; code: string }[], unknown];
  const permIdByCode = new Map(permRows.map((p) => [p.code, p.id]));

  let added = 0;
  let skippedMissingRole = 0;
  let skippedMissingPerm = 0;

  for (const [roleCode, perms] of Object.entries(MATRIX)) {
    const roleId = roleIdByCode.get(roleCode);
    if (!roleId) {
      skippedMissingRole++;
      continue;
    }
    for (const permCode of perms) {
      const permId = permIdByCode.get(permCode);
      if (!permId) {
        skippedMissingPerm++;
        continue;
      }
      const [res] = (await conn.query(
        'INSERT IGNORE INTO hr_role_permissions (role_id, permission_id) VALUES (?, ?)',
        [roleId, permId]
      )) as [{ affectedRows: number }, unknown];
      if (res.affectedRows > 0) added++;
    }
  }

  console.log(`  ${db}: added ${added} role-perm rows` +
    (skippedMissingRole ? ` (roles not found: ${skippedMissingRole})` : '') +
    (skippedMissingPerm ? ` (perms not found: ${skippedMissingPerm})` : ''));

  await conn.end();
}

async function main() {
  console.log('Applying role-permission matrix to production tenants...\n');
  for (const db of TENANTS) {
    try {
      await applyTenant(db);
    } catch (err) {
      console.error(`  ${db}: FAILED — ${(err as Error).message}`);
    }
  }
  console.log('\nDone. Runtime resolver TTL is 60s; admin edits via UI pick up these rows immediately on save.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
