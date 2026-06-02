# Quickstart: Material Withdrawal Approval

**Branch**: `018-material-withdrawal-approval`
**Audience**: Developers picking up implementation work

## 1. Switch to feature branch

```powershell
git checkout 018-material-withdrawal-approval
```

## 2. Start the local stack

```powershell
# Docker (preferred)
docker compose up -d mysql reporting-backend
bun run dev   # starts Next.js on http://localhost:33021
```

Login credentials (from local memory):
- Admin: `admin@herbal-erp.com` / `admin123`
- Production roles: `production@...` / `user123`

## 3. Verify schema sync

After pulling, schema-sync runs on first dev boot. Confirm new tables exist:

```powershell
docker compose exec mysql mysql -uherbal_user -p herbal_erp -e "SHOW TABLES LIKE 'material_withdrawal%'"
# Expect: material_withdrawal_requests, _request_items, _approvals, _attachments, _rules
```

## 4. Happy path (end-to-end manual walkthrough)

### Step 1 — Operator creates a request

1. Login as a production operator (any `production@…` user).
2. Navigate to **Production → Work Orders**, open an in-progress WO.
3. Click **"ขอเบิกวัตถุดิบเพิ่ม"**.
4. Pick a material from the BOM dropdown, enter quantity, choose reason "การตั้งค่าเครื่อง (Machine Setup Loss)", specify machine phase, room.
5. (Optional) Upload a photo.
6. Submit → expect toast "บันทึกคำขอเรียบร้อย" and status = pending.

**Verify in DB:**
```sql
SELECT id, work_order_id, status, reason_type FROM material_withdrawal_requests ORDER BY id DESC LIMIT 1;
```
Should show your request with `status='pending'`.

### Step 2 — Phase auto-blocks (Selective Block FR-035)

1. Stay on the WO detail page.
2. The phase that uses the requested material should now show a yellow banner: "ขั้นตอนนี้ถูกบล็อก — มีคำขอเบิกเพิ่มรออนุมัติ".
3. Other phases (that don't use that material) remain advanceable.
4. Click into the banner → opens the pending request detail.

### Step 3 — Supervisor approves

1. Logout, login as a Production Supervisor (must have `production:withdrawal:approve`).
2. Open **Production → คำขอเบิกเพิ่ม → รออนุมัติ**.
3. See the request in the queue. Click into it.
4. Review details (history of WO's prior withdrawals shown).
5. Click **Approve** → password prompt (E-signature).
6. Enter password → expect success toast + stock deduction.

**Verify:**
- `material_withdrawal_requests.status = 'approved'`
- A new row in `inventory_transactions` with negative qty for the material
- A new row in `deviations` linked via `withdrawal_request_id`
- `material_consumption.additional_qty_via_withdrawal_request` incremented
- Phase banner cleared on the WO

### Step 4 — Operator sees the unblock

1. Switch back to operator account, refresh WO page.
2. Banner gone; phase advanceable again.
3. Notification icon shows: "คำขอเบิกเพิ่ม #N ได้รับการอนุมัติ".

## 5. Edge cases to test

| Scenario | Expected |
|---|---|
| Operator tries to approve own request | 400 — `DUAL_CONTROL_VIOLATION` |
| Wrong password on approve | 400 — `INVALID_PASSWORD` |
| Stock insufficient at approve-time | 400 — `INSUFFICIENT_STOCK` |
| Submit > hard cap (50% by default) | 409 — `EXCEEDS_HARD_CAP` |
| Submit > soft cap (10%) but ≤ hard cap | 201 + warning flag in response |
| Cancel a pending request (own) | 204 + request status → `cancelled` |
| Cancel after approved | 409 |
| Double-submit within 30s (same payload) | 409 — `DUPLICATE_SUBMISSION` |
| WO is closed while request pending | Request auto-cancelled, deviation logged |

## 6. Tests to run before commit

```powershell
bunx tsc --noEmit --skipLibCheck   # type check (constitution gate)
bun run lint                        # lint (constitution gate)
bun run test:run                    # unit + integration tests
```

Specific test groups for this feature:

```powershell
bun run test:run -- material-withdrawal
bun run test:run -- production-gate
bun run test:run -- approval-workflow
```

## 7. Local seed data

To seed sample WO + BOM + materials for manual testing:

```powershell
# Seed runs on docker compose restart app-dev
docker compose restart app-dev
```

(If specific withdrawal-test seed needed, add to `src/lib/db/seeds/material-withdrawal.seed.ts` — created during implementation.)

## 8. UI screens to verify

| Route | Purpose |
|---|---|
| `/material-withdrawal` | All requests (filterable) |
| `/material-withdrawal/pending` | Supervisor queue |
| `/material-withdrawal/reports` | Aggregations + export |
| `/material-withdrawal/rules` | Admin cap config |
| `/production/work-orders/[id]` (extended) | Embedded request button + history + phase banner |

## 9. i18n verification

```powershell
bun run i18n:check
```
Confirms `src/locales/th/material-withdrawal.json` and `src/locales/en/material-withdrawal.json` have matching keys.

## 10. Permission check

Confirm via the admin UI (`/admin/permissions`) that:
- `production:withdrawal:request` — assigned to Operator + Supervisor roles
- `production:withdrawal:approve` — assigned to Supervisor only
- `production:withdrawal:configure` — assigned to System Admin + Factory Manager

## 11. Where to look when something breaks

| Symptom | First file to check |
|---|---|
| Request fails to create | `src/lib/services/material-withdrawal.service.ts` `createRequest()` |
| Approval doesn't deduct stock | Approve flow transaction in same file |
| Phase doesn't block | `src/lib/services/production-gate.service.ts` `isPhaseBlockedByPendingWithdrawal()` |
| Deviation not created | Approve transaction step 5 — search `deviations` insert |
| Wrong cap applied | `material-withdrawal.service.ts` `resolveCapRule()` |
| UI form errors | DevExtreme Form validators in `material-withdrawal-request-dialog.tsx` |
