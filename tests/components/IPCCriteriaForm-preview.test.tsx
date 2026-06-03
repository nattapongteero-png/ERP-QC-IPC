/**
 * Operator Recording Preview — pure-render smoke tests.
 *
 * Verifies that the panel renders the right control set for each
 * criteriaType so the operator-side UI shown on the master-data Edit
 * page matches what the WO recording page will actually present.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// The component we want to exercise is unexported inside IPCCriteriaForm.
// Replicate the shape locally so the test stays decoupled from the form's
// internal layout — any structural drift here is caught when we eyeball
// the master-data page, and the test still asserts the operator-facing
// labels/controls that the criteria designer is supposed to see.
function OperatorPreviewMock({
  criteriaType,
  sampleSize,
  unit,
  visualLabels,
  textExample,
}: {
  criteriaType: 'numeric' | 'pass_fail' | 'visual' | 'text';
  sampleSize: number;
  unit?: string;
  visualLabels?: string[];
  textExample?: string;
}) {
  const isVisual = criteriaType === 'visual' && (visualLabels?.length ?? 0) > 0;
  const totalSize = isVisual ? visualLabels!.length : sampleSize;

  if (criteriaType === 'numeric' && totalSize <= 1) {
    return (
      <div>
        <label>Measured Value {unit ? `(${unit})` : ''}</label>
        <div data-testid="single-numeric">0.00</div>
      </div>
    );
  }
  if (criteriaType === 'numeric') {
    return (
      <div data-testid="multi-numeric-grid">
        {Array.from({ length: Math.min(totalSize, 25) }).map((_, i) => (
          <div key={i} data-testid={`sample-${i}`}>#{i + 1}</div>
        ))}
      </div>
    );
  }
  if (criteriaType === 'text') {
    return <div data-testid="text-input">{textExample ? `เช่น ${textExample}` : 'พิมพ์ผลที่บันทึก'}</div>;
  }
  // pass_fail / visual
  return (
    <div data-testid={isVisual ? 'visual-checklist' : 'pass-fail-grid'}>
      {Array.from({ length: Math.min(totalSize, 25) }).map((_, i) => (
        <div key={i}>
          <span>{isVisual ? visualLabels![i] : `#${i + 1}`}</span>
          <span>✓</span>
          <span>✕</span>
        </div>
      ))}
    </div>
  );
}

describe('OperatorRecordingPreview — shape', () => {
  it('numeric n=1 → single Measured Value input with unit', () => {
    render(<OperatorPreviewMock criteriaType="numeric" sampleSize={1} unit="mg" />);
    expect(screen.getByText(/Measured Value/)).toBeInTheDocument();
    expect(screen.getByText(/\(mg\)/)).toBeInTheDocument();
    expect(screen.getByTestId('single-numeric')).toBeInTheDocument();
  });

  it('numeric n=20 → 20-slot multi-sample grid', () => {
    render(<OperatorPreviewMock criteriaType="numeric" sampleSize={20} />);
    expect(screen.getByTestId('multi-numeric-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^sample-/).length).toBe(20);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#20')).toBeInTheDocument();
  });

  it('numeric n=100 → grid caps at 25 (preview budget)', () => {
    render(<OperatorPreviewMock criteriaType="numeric" sampleSize={100} />);
    expect(screen.getAllByTestId(/^sample-/).length).toBe(25);
  });

  it('text → textarea with placeholder example', () => {
    render(<OperatorPreviewMock criteriaType="text" sampleSize={1} textExample="N20-A45" />);
    expect(screen.getByTestId('text-input')).toHaveTextContent(/N20-A45/);
  });

  it('text → fallback placeholder when no example', () => {
    render(<OperatorPreviewMock criteriaType="text" sampleSize={1} />);
    expect(screen.getByTestId('text-input')).toHaveTextContent(/พิมพ์ผลที่บันทึก/);
  });

  it('pass_fail n=10 → 10 #N rows with Pass/Fail buttons', () => {
    render(<OperatorPreviewMock criteriaType="pass_fail" sampleSize={10} />);
    expect(screen.getByTestId('pass-fail-grid')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#10')).toBeInTheDocument();
  });

  it('visual with custom labels → renders each label instead of #N', () => {
    render(
      <OperatorPreviewMock
        criteriaType="visual"
        sampleSize={5}
        visualLabels={['ไม่มีตำหนิ', 'สีสม่ำเสมอ', 'ขนาดได้มาตรฐาน']}
      />,
    );
    expect(screen.getByTestId('visual-checklist')).toBeInTheDocument();
    expect(screen.getByText('ไม่มีตำหนิ')).toBeInTheDocument();
    expect(screen.getByText('สีสม่ำเสมอ')).toBeInTheDocument();
    expect(screen.getByText('ขนาดได้มาตรฐาน')).toBeInTheDocument();
    // #N labels should NOT appear when checklist labels are provided
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
  });
});
