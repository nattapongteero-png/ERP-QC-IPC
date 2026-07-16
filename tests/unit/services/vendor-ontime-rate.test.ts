/**
 * The vendor scorecard has to measure punctuality, not assume it.
 *
 * onTimeRate was a hardcoded 95 for every vendor — and it is 30% of the
 * overall score used to judge suppliers. A flat 95 means every vendor scores
 * identically on delivery, which is how a chronically late supplier keeps its
 * contract: the number that would flag it was never real.
 *
 * A PO is on time when the first lot received against it arrived on or before
 * the expected date. Vendors with nothing datable to measure are null, not 95
 * and not 0 — "not measured" must not masquerade as either.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { daysUntilExpiry } from '@/lib/utils/lot-expiry';
import { toDateSafe } from '@/lib/db/date-utils';

const strip = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const SERVICE = strip('src/lib/services/reports.service.ts');

const scorecardBody = (): string => {
  const from = SERVICE.indexOf('export async function getVendorPerformanceReport');
  expect(from, 'getVendorPerformanceReport not found').toBeGreaterThan(-1);
  const after = SERVICE.indexOf('export async function', from + 10);
  return SERVICE.slice(from, after > -1 ? after : undefined);
};

// The on-time decision the service now makes, mirrored so it can be exercised.
const isOnTime = (expected: string, received: string) => {
  const days = daysUntilExpiry(expected, toDateSafe(received));
  return days !== null && days >= 0;
};

const rate = (deliveries: Array<{ expected: string; received: string }>) => {
  if (deliveries.length === 0) return null;
  const onTime = deliveries.filter((d) => isOnTime(d.expected, d.received)).length;
  return (onTime / deliveries.length) * 100;
};

describe('the flat 95 is gone', () => {
  it('no longer hardcodes an on-time rate', () => {
    const body = scorecardBody();
    expect(body).not.toMatch(/onTimeRate = 95/);
    expect(body).not.toMatch(/would need actual delivery tracking/);
  });

  it('derives it from received vs expected dates', () => {
    const body = scorecardBody();
    expect(body).toMatch(/receivedDate/);
    expect(body).toMatch(/expectedDate/);
    expect(body).toMatch(/onTimePOs/);
  });
});

describe('on-time decision', () => {
  it('counts a delivery on the expected date as on time', () => {
    expect(isOnTime('2026-06-18', '2026-06-18')).toBe(true);
  });

  it('counts an early delivery as on time', () => {
    // PO-202606-000002 on UAT: expected 06-24, received 06-11.
    expect(isOnTime('2026-06-24', '2026-06-11')).toBe(true);
  });

  it('counts a late delivery as not on time', () => {
    expect(isOnTime('2026-06-18', '2026-06-25')).toBe(false);
  });

  it('is one day of lateness, not an hour of clock time', () => {
    // received the day after expected, both at whatever time — still late.
    expect(isOnTime('2026-06-18', '2026-06-19')).toBe(false);
  });
});

describe('rate over a vendor', () => {
  it('is the fraction of POs that arrived on or before expected', () => {
    expect(
      rate([
        { expected: '2026-06-18', received: '2026-06-18' }, // on time
        { expected: '2026-06-24', received: '2026-06-11' }, // early
        { expected: '2026-06-18', received: '2026-06-25' }, // late
        { expected: '2026-06-20', received: '2026-06-30' }, // late
      ]),
    ).toBe(50);
  });

  it('is null — not 95, not 0 — when nothing can be measured', () => {
    // The whole point: an unmeasured vendor must not be scored on fiction.
    expect(rate([])).toBeNull();
  });

  it('the SOURCE returns null on no measured deliveries, never 0', () => {
    // Guards the tempting `: 0` — which reads as "0% on time", a defamatory
    // score for a vendor we simply have no delivery dates for.
    const body = scorecardBody();
    expect(body).toMatch(/measuredPOs > 0 \? \(onTimePOs \/ measuredPOs\) \* 100 : null/);
    expect(body).not.toMatch(/measuredPOs > 0 \?[^;]*: 0;/);
  });

  it('is 100 when every measured delivery was on time', () => {
    expect(rate([{ expected: '2026-06-18', received: '2026-06-17' }])).toBe(100);
  });
});

describe('overall score handles the null honestly', () => {
  // The service: onTimeRate === null ? qualityRate : onTimeRate*0.3 + quality*0.7
  const score = (onTime: number | null, quality: number) =>
    onTime === null ? quality : onTime * 0.3 + quality * 0.7;

  it('rests on quality alone when punctuality is unmeasured', () => {
    expect(score(null, 80)).toBe(80);
  });

  it('blends 30/70 when punctuality is known', () => {
    expect(score(90, 80)).toBe(90 * 0.3 + 80 * 0.7);
  });

  it('the source applies exactly that rule', () => {
    const body = scorecardBody();
    expect(body).toMatch(/onTimeRate === null \? qualityRate :/);
    expect(body).toMatch(/onTimeRate \* 0\.3 \+ qualityRate \* 0\.7/);
  });

  it('reports how many deliveries were actually measured', () => {
    // So a 100% built on one delivery is not mistaken for a proven record.
    expect(scorecardBody()).toMatch(/measuredDeliveries: measuredPOs/);
  });
});
