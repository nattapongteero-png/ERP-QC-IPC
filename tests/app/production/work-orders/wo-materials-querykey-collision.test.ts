/**
 * Regression: query-key collision crashed the Work Order page.
 *
 * material-weighing/page caches { materials, requisitionStatus } (an OBJECT).
 * WithdrawalPanel + ExecutionDashboard cache the raw materials ARRAY and call
 * (woMaterials ?? []).map(...). They MUST NOT share a React-Query key, or the
 * object shape leaks into the array consumer on navigation and throws
 * "(woMaterials ?? []).map is not a function" → whole-page error boundary.
 *
 * This test reads the source files and asserts the keys stay distinct, so the
 * collision can't be silently reintroduced.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../../');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

describe('wo-materials query-key collision guard', () => {
  const materialWeighing = read('src/app/production/work-orders/[id]/material-weighing/page.tsx');
  const withdrawalPanel = read('src/components/production/withdrawal-panel.tsx');
  const executionDashboard = read('src/components/production/ExecutionDashboard.tsx');

  it('material-weighing does NOT use the array-shaped wo-materials key for its own object-shaped query', () => {
    // Its useQuery must key on the distinct, object-shaped data.
    expect(materialWeighing).toContain("queryKey: ['wo-material-weighing', workOrderId]");
    // And must NOT define a useQuery on the array key (only invalidations allowed).
    expect(materialWeighing).not.toMatch(/queryKey:\s*\['wo-materials', workOrderId\][\s\S]{0,200}queryFn/);
  });

  it('the array consumers still read the array-shaped wo-materials key', () => {
    expect(withdrawalPanel).toContain("queryKey: ['wo-materials', workOrderId]");
    // WithdrawalPanel maps over it — proving it expects an array.
    expect(withdrawalPanel).toMatch(/\(woMaterials \?\? \[\]\)\.map/);
  });

  it('material-weighing still invalidates wo-materials so the array consumers refresh', () => {
    // Renaming its own query must not drop the cross-component refresh.
    expect(materialWeighing).toContain("invalidateQueries({ queryKey: ['wo-materials', workOrderId] })");
  });

  it('ExecutionDashboard does not register a conflicting wo-materials query (invalidate only)', () => {
    // It may invalidate, but must not define a query that stores a different
    // shape under the shared key.
    const hasQueryFnOnKey =
      /queryKey:\s*\['wo-materials'[\s\S]{0,200}queryFn/.test(executionDashboard);
    expect(hasQueryFnOnKey).toBe(false);
  });
});
