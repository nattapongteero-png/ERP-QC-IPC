# Quickstart: Primary Packaging Material Issuance & Return

**Branch**: `019-primary-packaging`
**Audience**: Developers picking up implementation

## 1. Switch to feature branch

```powershell
git checkout 019-primary-packaging
```

## 2. Start the local stack

```powershell
docker compose start app-dev   # already configured
# UAT local on 6809 also works
```

Login (UAT local 6809):
- Admin: `admin@herbal-erp.com` / `admin123`
- Production: `production@herbal-erp.com` / `user123`
- QC: `qc@herbal-erp.com` / `user123`

## 3. Verify schema sync

```powershell
docker compose exec mysql mysql -uherbal_user -p herbal_erp -e "
  SHOW TABLES LIKE 'wo_packaging%';
  SHOW TABLES LIKE 'packaging_tolerances';
  DESCRIBE wo_packaging_materials;
"
```

Expect: `wo_packaging_materials` (with new columns), `wo_packaging_returns`, `wo_packaging_return_approvals`, `packaging_tolerances`.

## 4. Seed default tolerances (manual, run once on local)

```sql
INSERT IGNORE INTO packaging_tolerances (packaging_category, tolerance_percent, is_active, created_by_user_id, created_at, updated_at)
SELECT 'capsule', 2.00, 1, id, NOW(), NOW() FROM users WHERE email='admin@herbal-erp.com' LIMIT 1;
INSERT IGNORE INTO packaging_tolerances (packaging_category, tolerance_percent, is_active, created_by_user_id, created_at, updated_at)
SELECT 'bottle',  1.00, 1, id, NOW(), NOW() FROM users WHERE email='admin@herbal-erp.com' LIMIT 1;
INSERT IGNORE INTO packaging_tolerances (packaging_category, tolerance_percent, is_active, created_by_user_id, created_at, updated_at)
SELECT 'cap',     1.00, 1, id, NOW(), NOW() FROM users WHERE email='admin@herbal-erp.com' LIMIT 1;
INSERT IGNORE INTO packaging_tolerances (packaging_category, tolerance_percent, is_active, created_by_user_id, created_at, updated_at)
SELECT 'label',   0.50, 1, id, NOW(), NOW() FROM users WHERE email='admin@herbal-erp.com' LIMIT 1;
INSERT IGNORE INTO packaging_tolerances (packaging_category, tolerance_percent, is_active, created_by_user_id, created_at, updated_at)
SELECT 'other',   1.00, 1, id, NOW(), NOW() FROM users WHERE email='admin@herbal-erp.com' LIMIT 1;
```

## 5. Happy path (end-to-end manual walkthrough)

### Step 1 — Operator creates an issuance

1. Login as `production@herbal-erp.com`
2. Open WO-2569-004 → tab Packaging
3. Click **"เบิก Primary Packaging"**
4. Select item (e.g., PK-001 Empty Capsule), source lot, quantity (e.g., 800), container label "PKG-WO004-CAP-001", room "Mixing Room A"
5. Submit → status = `pending_verification`

### Step 2 — Verifier signs (Dual Control)

1. Login as another production user (e.g., `qc@herbal-erp.com` — has production permission too if seeded so)
2. Open the verifier queue → see pending issuance
3. Click → enter password → e-sig
4. Status changes to `issued`, stock decremented by 800 in inventory

### Step 3 — Operator creates return

1. Login back as `production@herbal-erp.com`
2. Open WO → click "คืน Primary Packaging"
3. Select the issuance from Step 1
4. Used = 750, Return = 45, variance auto = 5 (0.625% — within tolerance for capsule)
5. Variance reason = "sampling"
6. Return container label = "PKG-WO004-CAP-RTN-001"
7. Proposed status = `reusable`
8. Submit → returns awaits verification

### Step 4 — Verifier signs return

Similar to Step 2 — different user signs.

### Step 5 — QA approves (Triple Independence)

1. Login as `qc@herbal-erp.com` (or any user with `production:packaging:approve`)
2. Open QA queue
3. Review details → click Approve as Reusable → e-sig
4. **Verify in DB:**
   - New `inventory_lots` row created with `parentLotId = source lot`
   - New `inventory_transactions` row, qty positive
   - `wo_packaging_returns.status = 'approved_reusable'`
   - `wo_packaging_return_approvals` row present
   - No deviation (since within tolerance)

### Step 6 — Reconciliation report

1. Open WO → tab Reconciliation
2. See row: BOM=1000 | Issued=800 | Used=750 | Returned=45 | Variance=5 (0.625%) | Within Tolerance ✓
3. Click Export Excel → download

## 6. Edge cases to test

| Scenario | Expected |
|---|---|
| Operator self-verifies issuance | 400 `DUAL_CONTROL_VIOLATION` |
| Operator verifies own return | 400 `DUAL_CONTROL_VIOLATION` |
| Operator approves own return as QA | 400 `TRIPLE_INDEPENDENCE_VIOLATION` |
| Verifier of return approves as QA | 400 `TRIPLE_INDEPENDENCE_VIOLATION` |
| Wrong password at any e-sig step | 400 `INVALID_PASSWORD` |
| Source lot status = rejected, propose Reusable | 400 `LOT_REJECTED_MUST_REJECT` |
| Used > Issued | 400 `USED_EXCEEDS_ISSUED` |
| Variance > tolerance, no explanation | 400 `VARIANCE_EXPLANATION_REQUIRED` |
| Variance > tolerance, with explanation, approve | 200 + auto deviation created |
| Container label duplicate in 24h (same WO) | 201 with `containerLabelWarning: true` (warning, not blocked) |
| Issuance > stock | 400 `INSUFFICIENT_STOCK` |
| Material not in BOM | 400 `MATERIAL_NOT_IN_BOM` |
| Material `items.type ≠ 'packaging'` | 400 `NOT_PACKAGING_TYPE` |

## 7. Tests to run before commit

```powershell
bunx tsc --noEmit --skipLibCheck
bun run lint
bun run test:run -- packaging
```

## 8. UI screens

| Route | Purpose |
|---|---|
| `/production/work-orders/[id]/packaging-materials` | Operator main page (issue + list) |
| `/production/work-orders/[id]/packaging-materials/return` | Return form |
| `/production/work-orders/[id]/packaging-materials/verify` | Verifier queue (Dual Control) |
| `/production/work-orders/[id]/packaging-materials/approve` | QA queue (Triple Independence) |
| `/production/work-orders/[id]` (extended) | Reconciliation card |

## 9. i18n verification

```powershell
bun run i18n:check
```

## 10. Permission check

Verify via admin UI that:
- `production:packaging:issue` — Operator + Supervisor
- `production:packaging:return` — Operator + Supervisor
- `production:packaging:approve` — QA Manager + QA Officer
- `production:packaging:configure` — Admin + Factory Manager

## 11. Where to look when something breaks

| Symptom | First file to check |
|---|---|
| Issuance fails to create | `src/lib/services/packaging-issuance.service.ts` `createIssuance()` |
| Stock not deducted on verify | Verify-step transaction in same file |
| Return calculation wrong | `packaging-return.service.ts` `createReturn()` variance computation |
| QA approval not atomic | `packaging-return.service.ts` `approveReturn()` transaction block |
| Triple Independence not enforced | Same file — search `TRIPLE_INDEPENDENCE_VIOLATION` |
| Tolerance lookup wrong | `packaging-return.service.ts` `resolveTolerance()` |
| Reconciliation totals off | `packaging-reconciliation.service.ts` |
| UI form validation | DevExtreme validators in `packaging-issuance-form.tsx` |
