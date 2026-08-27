/**
 * The unit the Live Preview reports for a Multi-Point criterion.
 *
 * Reported from the criteria screen: a tare recorded in mg was linked, the
 * form's own summary showed หน่วย mg, and the preview beside it still said g.
 * Gross, tare and net are one subtraction, so they are one unit — a tare kept
 * in mg cannot be taken off a gross weighed in g.
 *
 * The fix was in the form: linking a tare now sets the criterion's unit from
 * it. What these cover is the half below that — that the preview reports
 * whatever unit is in force and does not hard-code one, so the fix stays
 * visible. The linking itself is exercised in the browser, not here; it needs
 * the whole form mounted with its queries.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IPCLivePreviewCard } from '@/components/master-data/IPCLivePreviewCard';
import { defaultPayload, parseSpecPayload } from '@/lib/master-data/ipc-spec-payload';

function renderWith(unit: string | null) {
  const payload = {
    ...(defaultPayload('multi_point') as unknown as Record<string, unknown>),
    tareMode: 'per_unit',
    tareSourceCode: 'IPC-TARE-01',
    pointCount: '5',
    perPointTarget: '100',
    perPointTolerance: '5',
  };
  render(
    <IPCLivePreviewCard
      formData={{
        code: 'IPC-WV-200',
        name: 'Weight Variation',
        unit,
        sampleSize: 5,
        specTarget: null,
        specTolerancePercent: null,
        tolerancePercent: 0,
        isCritical: false,
        isActive: true,
      }}
      criteriaType="multi_point"
      calculatedMinMax={null}
      acceptanceMath={{ sampleSize: 5, allowedFail: 0, mustPass: 5 }}
      multiStageEnabled={false}
      stages={[]}
      specPayload={payload as never}
      stage="ipc"
    />,
  );
}

describe('Live Preview — the unit follows the criterion', () => {
  it('reports the linked tare unit, not a different one', () => {
    renderWith('mg');
    // The header labels its target with the unit in force.
    expect(screen.getByText(/Target ต่อจุด \(mg\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Target ต่อจุด \(g\)/)).not.toBeInTheDocument();
  });

  it('changes with the unit rather than hard-coding one', () => {
    renderWith('g');
    expect(screen.getByText(/Target ต่อจุด \(g\)/)).toBeInTheDocument();
  });

  it('omits the suffix when no unit is set', () => {
    renderWith(null);
    expect(screen.getByText(/^Target ต่อจุด$/)).toBeInTheDocument();
  });
});

/** The stored spec string survives a save and reopen with its tare intact. */
describe('Multi-Point payload round trip', () => {
  it('keeps the tare link', () => {
    const stored = JSON.stringify({
      type: 'multi_point', tareMode: 'per_unit', tareCount: '10', tareLabel: '',
      pointCount: '5', pointLabel: 'จุด', perPointTarget: '100', perPointTolerance: '5',
      aggregateRule: 'all_pass', aggregateLimit: '', tareSourceCode: 'IPC-TARE-01',
    });
    const parsed = parseSpecPayload('multi_point', stored);
    expect(parsed?.type).toBe('multi_point');
    expect((parsed as { tareSourceCode: string }).tareSourceCode).toBe('IPC-TARE-01');
  });
});
