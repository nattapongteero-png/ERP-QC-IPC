/**
 * VMI Customer Sync
 *
 * Sheet item 10: customers coming from the VMI Portal must appear in the
 * customer register (`/sales/customers`, backed by the `customers` table).
 *
 * When a VMI sales order is ingested (webhook or poll) it stores
 * `vmiCustomerId` / `hospitalCode` / `hospitalName` on the VMI order row but
 * previously never created a matching `customers` row. This helper guarantees
 * an idempotent 1:1 mapping between a VMI hospital and a customer record so the
 * hospital shows up in the register and the VMI order can reference a real
 * customer id.
 *
 * @module vmi-customer-sync.service
 */

import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '../db/db-helper';
import { getNow } from '../db/date-utils';

export interface EnsureVmiCustomerInput {
  /** Hospital code from the VMI portal (stored as customers.vmiCustomerId). */
  hospitalCode: string;
  /** Hospital display name from the VMI portal. */
  hospitalName: string;
  /** Optional VMI portal config id, stored on the customer for traceability. */
  vmiPortalId?: number | null;
}

/**
 * Ensure a `customers` row exists for the given VMI hospital.
 *
 * Idempotent: matches an existing customer by `vmiCustomerId === hospitalCode`.
 * - If found, returns its id (and updates the name if it changed).
 * - If not found, inserts a new hospital customer with a unique `VMI-{code}`
 *   code and returns the new id.
 *
 * @returns the customers.id for this hospital
 */
export async function ensureVmiCustomer(
  input: EnsureVmiCustomerInput
): Promise<number> {
  return executeDbOperation((db) => ensureVmiCustomerWithDb(db, input));
}

/**
 * Same as {@link ensureVmiCustomer} but runs against a supplied db handle, so
 * callers already inside an `executeDbOperation` transaction/context can reuse
 * their connection instead of opening a new one.
 */
export async function ensureVmiCustomerWithDb(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  input: EnsureVmiCustomerInput
): Promise<number> {
  const customers = getTableRef('customers');
  const hospitalCode = String(input.hospitalCode);
  const hospitalName = input.hospitalName;

  // Look up an existing customer by VMI id (idempotency key).
  const [existing] = await db
    .select({
      id: customers.id,
      name: customers.name,
    })
    .from(customers)
    .where(eq(customers.vmiCustomerId, hospitalCode));

  if (existing) {
    // Keep the name in sync if the portal renamed the hospital.
    if (hospitalName && existing.name !== hospitalName) {
      await db
        .update(customers)
        .set({ name: hospitalName, updatedAt: getNow() })
        .where(eq(customers.id, existing.id));
    }
    return existing.id;
  }

  // No customer yet - create one. `VMI-{code}` is unique per hospital, and the
  // vmiCustomerId lookup above prevents duplicate inserts for the same hospital.
  const now = getNow();
  const result = await db.insert(customers).values({
    code: `VMI-${hospitalCode}`,
    name: hospitalName || `VMI ${hospitalCode}`,
    customerType: 'hospital',
    isActive: true,
    vmiCustomerId: hospitalCode,
    vmiPortalId: input.vmiPortalId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return getInsertId(result);
}
