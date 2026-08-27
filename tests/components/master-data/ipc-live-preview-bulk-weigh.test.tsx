/**
 * The spec header of the Live Preview, for a Multi-Point criterion whose tare
 * is weighed in bulk.
 *
 * Reported from the criteria screen: the author fills in Target ต่อเม็ด and
 * ±% Tolerance ต่อเม็ด and the preview beside them keeps showing "—". The
 * header had branches for the two other Multi-Point shapes (capsule_net and
 * tare_matched) but none for bulk_weigh, so it fell through to the generic
 * numeric header — which reads formData.specTarget, a field this criteria
 * type never fills.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IPCLivePreviewCard } from '@/components/master-data/IPCLivePreviewCard';
import { defaultPayload, parseSpecPayload } from '@/lib/master-data/ipc-spec-payload';

const baseForm = {
  code: 'IPC-WV-152',
  name: 'Weight Variation',
  unit: 'g',
  sampleSize: 20,
  specTarget: null,
  specTolerancePercent: null,
  tolerancePercent: 0,
  isCritical: false,
  isActive: true,
};

function renderPreview(overrides: Record<string, unknown>) {
  const payload = {
    ...(defaultPayload('multi_point') as unknown as Record<string, unknown>),
    ...overrides,
  };
  render(
    <IPCLivePreviewCard
      formData={baseForm}
      criteriaType="multi_point"
      calculatedMinMax={null}
      acceptanceMath={{ sampleSize: 20, allowedFail: 0, mustPass: 20 }}
      multiStageEnabled={false}
      stages={[]}
      specPayload={payload as never}
      stage="ipc"
    />,
  );
}

describe('Live Preview — Multi-Point with a bulk-weighed tare', () => {
  /** The value shown in the spec header field carrying this label. */
  function headerValue(label: string | RegExp) {
    const labelEl = screen.getByText(label);
    // SpecField renders <p>label</p> then the boxed value as its sibling.
    return labelEl.parentElement?.textContent?.replace(String(labelEl.textContent), '').trim();
  }

  it('shows the per-point target and tolerance the author typed', () => {
    renderPreview({
      tareMode: 'bulk',
      pointCount: '20',
      pointLabel: 'แคปซูล',
      perPointTarget: '0.5',
      perPointTolerance: '7.5',
    });

    // The author's own figures, read out of the header rather than from
    // anywhere else on the card — the recorder below repeats the target, and
    // a loose text query would pass on that copy while the header still said
    // "—", which is exactly the bug.
    expect(headerValue(/^จำนวนตัวอย่าง$/)).toBe('20');
    expect(headerValue(/^Target ต่อหน่วย/)).toBe('0.5');
    expect(headerValue(/^± % Tolerance$/)).toBe('7.5');
  });

  /**
   * The recall half of the same report: saved, then opened again.
   *
   * This is the exact `specification` string the API stores and hands back for
   * this criterion — captured from a real save — so the test fails if either
   * the parse or the header stops honouring it.
   */
  it('shows the same figures after a save-and-reopen round trip', () => {
    const stored = JSON.stringify({
      type: 'multi_point', tareMode: 'bulk', tareCount: '10', tareLabel: 'เปลือกเปล่า',
      pointCount: '20', pointLabel: 'แคปซูล',
      perPointTarget: '0.5', perPointTolerance: '7.5',
      aggregateRule: 'all_pass', aggregateLimit: '0.4625-0.5375', tareSourceCode: '',
    });

    render(
      <IPCLivePreviewCard
        formData={baseForm}
        criteriaType="multi_point"
        calculatedMinMax={null}
        acceptanceMath={{ sampleSize: 20, allowedFail: 0, mustPass: 20 }}
        multiStageEnabled={false}
        stages={[]}
        specPayload={parseSpecPayload('multi_point', stored)}
        stage="ipc"
      />,
    );

    expect(headerValue(/^จำนวนตัวอย่าง$/)).toBe('20');
    expect(headerValue(/^Target ต่อหน่วย/)).toBe('0.5');
    expect(headerValue(/^± % Tolerance$/)).toBe('7.5');
  });

  it('still falls back to a dash when the author has typed nothing', () => {
    renderPreview({
      tareMode: 'bulk',
      pointCount: '',
      pointLabel: '',
      perPointTarget: '',
      perPointTolerance: '',
    });
    const card = screen.getByTestId('live-preview-card');
    expect(card.textContent).toContain('—');
  });
});
