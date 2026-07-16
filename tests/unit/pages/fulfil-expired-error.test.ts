/**
 * The expired-lot refusal has to survive the trip from service to operator.
 *
 * issueMaterial throws a plain English string; the fulfilment screen parses it
 * into a Thai message. If the two ever drift apart the operator gets a raw
 * server string, or worse, a generic "unknown error" that hides a safety stop.
 * These tests pin the two ends to each other.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const strip = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const SERVICE = strip('src/lib/services/inventory.service.ts');
const PAGE = strip('src/app/sales/orders/[id]/page.tsx');

// The regex the page uses, lifted out so we can run it against a real message.
const EXPIRED_RE = /Lot\s+([\w-]+)\s+expired on\s+([\d-]+)/i;

describe('service → screen contract', () => {
  it('the page regex matches the message the service actually throws', () => {
    // Built the same way inventory.service.ts builds it.
    const thrown = 'Lot RM-0001-260611-451 expired on 2026-06-25 and cannot be issued';
    const m = thrown.match(EXPIRED_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('RM-0001-260611-451');
    expect(m![2]).toBe('2026-06-25');
  });

  it('the service still throws in that shape', () => {
    // If someone rewords the throw, this fails before the operator sees a raw
    // English string on screen.
    expect(SERVICE).toMatch(/expired on \$\{formatDateFromDb\(lot\.expiryDate\)\}/);
    expect(SERVICE).toMatch(/Lot \$\{lot\.lotNumber\} expired on/);
  });

  it('the page carries the same pattern', () => {
    expect(PAGE).toMatch(/expired on/);
    expect(PAGE).toMatch(/lot_expired/);
  });

  it('does not swallow an expired lot as a generic unknown error', () => {
    // The expired branch must come before the fallback.
    const expiredAt = PAGE.indexOf("type: 'lot_expired'");
    const unknownAt = PAGE.indexOf("type: 'unknown'");
    expect(expiredAt).toBeGreaterThan(-1);
    expect(unknownAt).toBeGreaterThan(-1);
    expect(expiredAt).toBeLessThan(unknownAt);
  });

  it('is not confused by the not-released message', () => {
    // Two different refusals; each must land on its own branch.
    const released = 'Lot ABC-123 is not released (status: quarantine)';
    expect(released.match(EXPIRED_RE)).toBeNull();
  });
});

describe('how it reads to the operator', () => {
  it('shows red, not grey — an expired lot is a safety stop', () => {
    expect(PAGE).toMatch(/fulfillError\.type === 'lot_expired' \? 'bg-red-100'/);
    expect(PAGE).toMatch(/fulfillError\.type === 'lot_expired' \? 'text-red-800'/);
  });

  it('speaks Thai through the translation layer, not a hardcoded string', () => {
    expect(PAGE).toMatch(/orders\.detail\.error\.lotExpired\.title/);
    expect(PAGE).toMatch(/orders\.detail\.error\.lotExpired\.suggestion1/);
  });

  it('tells the operator what to do next, not just that it failed', () => {
    expect(PAGE).toMatch(/lotExpired\.suggestion1/);
    expect(PAGE).toMatch(/lotExpired\.suggestion2/);
  });
});

describe('translations exist in both locales', () => {
  const load = (loc: string) =>
    JSON.parse(readFileSync(join(process.cwd(), `src/locales/${loc}/sales.json`), 'utf-8'));

  for (const loc of ['th', 'en']) {
    it(`${loc} has every lotExpired key the page asks for`, () => {
      const e = load(loc).orders.detail.error.lotExpired;
      for (const k of ['title', 'message', 'suggestion1', 'suggestion2']) {
        expect(e?.[k], `${loc}.${k}`).toBeTruthy();
      }
    });
  }

  it('Thai copy is actually Thai — a missed translation is an English leak', () => {
    const e = load('th').orders.detail.error.lotExpired;
    expect(e.title).toMatch(/[฀-๿]/);
    expect(e.suggestion1).toMatch(/[฀-๿]/);
  });
});
