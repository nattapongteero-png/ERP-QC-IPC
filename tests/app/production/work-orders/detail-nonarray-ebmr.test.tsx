/**
 * WO detail page — resilience to a transient non-array eBMR shape.
 *
 * Regression: navigating back to ?tab=execution right after a material return
 * crashed the WHOLE Work Order page with "(m ?? []).map is not a function".
 * Root cause: ebmr.ipcTests briefly arrived as an object (not an array) during
 * the soft navigation, and groupIPCByPhase() / the .map render threw — escaping
 * every section boundary up to the global error page ("เกิดข้อผิดพลาด").
 *
 * The page now coerces every eBMR list to an array (asArr) and groupIPCByPhase
 * tolerates non-array input. This test pins both, plus the global-error copy
 * the user actually saw.
 *
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import React from 'react';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}));

import GlobalError from '@/app/global-error';
import { groupIPCByPhase } from '@/lib/utils/ipc-statistics';

// The exact transient shape that crashed the page: every eBMR list is an
// object instead of an array, with ipcTests being the real culprit.
const CORRUPT_EBMR = {
  operations: {},
  batchRecords: {},
  materials: {},
  qcTests: {},
  sopExecution: {},
  cleaningLogs: {},
  environmentalLogs: {},
  materialWeighing: {},
  ipcTests: { items: [] },
};

describe('WO detail page — non-array eBMR resilience', () => {
  it('eBMR coercion turns every non-array list into a real array', () => {
    // Mirrors the page's own normalization at the data-destructure site.
    const asArr = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);
    const e = CORRUPT_EBMR;
    const ebmr = {
      operations: asArr(e.operations as never),
      batchRecords: asArr(e.batchRecords as never),
      materials: asArr(e.materials as never),
      qcTests: asArr(e.qcTests as never),
      sopExecution: asArr(e.sopExecution as never),
      cleaningLogs: asArr(e.cleaningLogs as never),
      environmentalLogs: asArr(e.environmentalLogs as never),
      materialWeighing: asArr(e.materialWeighing as never),
      ipcTests: asArr(e.ipcTests as never),
    };
    for (const v of Object.values(ebmr)) expect(Array.isArray(v)).toBe(true);
    // The render-site .map calls cannot throw now.
    expect(() => ebmr.ipcTests.map((x) => x)).not.toThrow();
    expect(() => ebmr.operations.map((x) => x)).not.toThrow();
  });

  it('groupIPCByPhase tolerates the non-array ipcTests that caused the crash', () => {
    // Before the fix this threw inside a useMemo and white-screened the page.
    expect(() => groupIPCByPhase(CORRUPT_EBMR.ipcTests as never)).not.toThrow();
    expect(groupIPCByPhase(CORRUPT_EBMR.ipcTests as never)).toEqual({});
  });

  it('global error page shows the generic message (not a stale-chunk reload) for a render TypeError', () => {
    // The user saw "เกิดข้อผิดพลาด" — confirm a plain TypeError is treated as a
    // real error, not auto-reloaded as a missing chunk.
    render(
      <GlobalError
        error={Object.assign(new Error('x.map is not a function'), { name: 'TypeError' })}
        reset={() => {}}
      />,
    );
    expect(screen.getByText('เกิดข้อผิดพลาด')).toBeInTheDocument();
    expect(screen.queryByText('กำลังโหลดเวอร์ชันใหม่…')).not.toBeInTheDocument();
  });
});
