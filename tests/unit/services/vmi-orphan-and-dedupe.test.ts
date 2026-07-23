/**
 * Regression tests for two faults found on UAT (2026-07-23):
 *
 *  1. Orphaned VMI orders — rows whose portal config was deleted stayed in the
 *     list via a LEFT JOIN. They can never be polled, cancelled or synced (all
 *     of those need the portal's URL + API key), so offering them as actionable
 *     orders was misleading.
 *
 *  2. Duplicate imports — dedupe was scoped to portal *id*, so deleting a
 *     portal config and re-adding it (new id) re-imported every order. UAT held
 *     the same PO twice, the copies drifting to different statuses.
 *
 * These assert the query SHAPE, which is where both bugs lived.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SERVICE_SRC = readFileSync(
  join(process.cwd(), 'src/lib/services/vmi-sales-order.service.ts'),
  'utf8',
);

/**
 * Slice from a method's declaration to the start of the next `private`/`async`
 * sibling, so assertions cannot leak into a neighbouring method.
 */
function methodBody(name: string): string {
  const start = SERVICE_SRC.indexOf(`async ${name}(`);
  expect(start, `method ${name} should exist`).toBeGreaterThan(-1);
  const rest = SERVICE_SRC.slice(start + name.length + 8);
  const nextDecl = rest.search(/\n {2}(?:private |public )?async \w+\(/);
  return nextDecl === -1 ? SERVICE_SRC.slice(start) : rest.slice(0, nextDecl);
}

describe('orphaned VMI orders are excluded from the list', () => {
  it('listOrders joins portals with innerJoin, not leftJoin', () => {
    const body = methodBody('listOrders');
    expect(body).toContain('.innerJoin(portals');
    // A LEFT JOIN here is exactly what surfaced orphans.
    expect(body).not.toContain('.leftJoin(portals');
  });

  it('counts totals with the same join so the pager cannot over-report', () => {
    const body = methodBody('listOrders');
    // The count query must be constrained too, otherwise the total includes
    // rows the page query will never return.
    const countIdx = body.indexOf('Get total count') >= 0
      ? body.indexOf('Get total count')
      : body.indexOf('const allOrders');
    expect(countIdx).toBeGreaterThan(-1);
    const countSection = body.slice(countIdx, countIdx + 600);
    expect(countSection).toContain('innerJoin(portals');
  });
});

describe('re-created portal config must not duplicate order history', () => {
  it('poll dedupes via findExistingPortalOrder, not a portal-id-only lookup', () => {
    const body = methodBody('pollPortalOrders');
    expect(body).toContain('findExistingPortalOrder');
  });

  it('findExistingPortalOrder matches on portal address, not just id', () => {
    // The definition, not the call site.
    const body = methodBody('findExistingPortalOrder');
    // Same portalUrl + vendorId => same portal, regardless of config row id.
    expect(body).toContain('portals.portalUrl');
    expect(body).toContain('portals.vendorId');
    expect(body).toContain('inArray(orders.portalId');
  });
});

describe('portal status reconcile is safely one-directional', () => {
  const section = methodBody('reconcileStatusesFromPortal');

  it('only ever writes cancelled — never rewrites confirm/ship from a poll', () => {
    expect(section).toContain("portalStatus !== 'cancelled'");
    // Confirm/ship carry side effects (sales orders, stock) and are driven by
    // us; a poll must not overwrite them.
    expect(section).not.toContain("localStatus: 'confirmed'");
    expect(section).not.toContain("localStatus: 'shipped'");
  });

  it('only inspects rows still open locally, preserving cancelled rows', () => {
    expect(section).toContain("inArray(orders.localStatus, ['pending', 'confirmed', 'processing', 'shipped']");
  });

  it('does not abort the whole pass when one order is unreachable', () => {
    expect(section).toContain('catch');
    expect(section).toContain('Status reconcile failed');
  });
});
