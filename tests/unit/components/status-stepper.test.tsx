/**
 * StatusStepper — which step reads as "current".
 *
 * Regression cover for the bug where a status that is not in `steps` fell back
 * to index 0, so a fully-processed record (a PR already converted to a PO, a QC
 * sample already released) rendered as if it were still at the FIRST step —
 * i.e. the workflow bar showed no progress at all.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusStepper } from '@/components/shared/StatusStepper';

const STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
];

/** A step is "current" when its label carries the emerald current styling. */
function labelClassOf(text: string): string {
  return screen.getByText(text).className;
}

describe('StatusStepper', () => {
  it('marks the matching step as current and earlier ones as done', () => {
    render(<StatusStepper steps={STEPS} current="submitted" />);
    expect(labelClassOf('Draft')).toContain('text-emerald-700');
    expect(labelClassOf('Submitted')).toContain('font-semibold');
    expect(labelClassOf('Approved')).toContain('text-gray-400');
  });

  it('does NOT report step 0 as current for a status outside the list', () => {
    // 'converted' is past 'approved' but absent from STEPS. The old fallback
    // painted 'Draft' as the current step, which read as "no progress made".
    render(<StatusStepper steps={STEPS} current="converted" />);
    expect(labelClassOf('Draft')).not.toContain('font-semibold');
    expect(labelClassOf('Draft')).toContain('text-gray-400');
  });

  it('does not report step 0 as current when `current` is undefined', () => {
    render(<StatusStepper steps={STEPS} />);
    expect(labelClassOf('Draft')).toContain('text-gray-400');
  });

  it('resolves a status listed in a step\'s `matches` onto that step', () => {
    const steps = [
      { key: 'registered', matches: ['draft'], label: 'Registered' },
      { key: 'testing', label: 'Testing' },
    ];
    render(<StatusStepper steps={steps} current="draft" />);
    expect(labelClassOf('Registered')).toContain('font-semibold');
    expect(labelClassOf('Testing')).toContain('text-gray-400');
  });

  it('marks every earlier step done when the LAST step is current', () => {
    render(<StatusStepper steps={STEPS} current="approved" />);
    expect(labelClassOf('Draft')).toContain('text-emerald-700');
    expect(labelClassOf('Submitted')).toContain('text-emerald-700');
    expect(labelClassOf('Approved')).toContain('font-semibold');
  });
});
