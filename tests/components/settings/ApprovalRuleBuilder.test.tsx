/**
 * ApprovalRuleBuilder Component Test (T128)
 * Part of 011-accounting-spec-gap - User Story 5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalRuleBuilder } from '@/components/settings/ApprovalRuleBuilder';
import type { ApprovalRule } from '@/types/approval-workflow';

// Mock DevExtreme components
vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, disabled, ...props }: any) => (
    <button
      data-testid={props['data-testid']}
      onClick={onClick}
      disabled={disabled}
    >
      {text}
    </button>
  ),
}));

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ value, items, onValueChanged, disabled, ...props }: any) => (
    <select
      data-testid={props['data-testid']}
      value={value}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
      disabled={disabled}
    >
      {items?.map((item: any) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('devextreme-react/number-box', () => ({
  NumberBox: ({ value, onValueChanged, disabled, ...props }: any) => (
    <input
      data-testid={props['data-testid']}
      type="number"
      value={value || 0}
      onChange={(e) => onValueChanged?.({ value: parseFloat(e.target.value) })}
      disabled={disabled}
    />
  ),
}));

vi.mock('devextreme-react/text-box', () => ({
  TextBox: ({ value, onValueChanged, disabled, ...props }: any) => (
    <input
      data-testid={props['data-testid']}
      type="text"
      value={value || ''}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
      disabled={disabled}
    />
  ),
}));

describe('ApprovalRuleBuilder', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the rule builder container', () => {
    render(<ApprovalRuleBuilder rules={[]} onChange={mockOnChange} />);

    expect(screen.getByTestId('rule-builder')).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<ApprovalRuleBuilder rules={[]} onChange={mockOnChange} />);

    expect(screen.getByText('Workflow Rules')).toBeInTheDocument();
  });

  it('renders add rule button', () => {
    render(<ApprovalRuleBuilder rules={[]} onChange={mockOnChange} />);

    expect(screen.getByTestId('add-rule-btn')).toBeInTheDocument();
    expect(screen.getByText('Add Rule')).toBeInTheDocument();
  });

  it('shows empty state message when no rules', () => {
    render(<ApprovalRuleBuilder rules={[]} onChange={mockOnChange} />);

    expect(
      screen.getByText(
        /No rules defined. This workflow will apply to all documents of the selected type./
      )
    ).toBeInTheDocument();
  });

  it('renders existing rules', () => {
    const existingRules: ApprovalRule[] = [
      {
        id: 1,
        flowId: 1,
        field: 'amount',
        operator: 'greater_than',
        value: '10000',
        priority: 1,
        createdAt: '2024-12-20',
      },
    ];

    render(<ApprovalRuleBuilder rules={existingRules} onChange={mockOnChange} />);

    expect(screen.getByTestId('rule-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('rule-field-0')).toBeInTheDocument();
    expect(screen.getByTestId('rule-operator-0')).toBeInTheDocument();
    expect(screen.getByTestId('rule-value-0')).toBeInTheDocument();
  });

  it('calls onChange when adding a rule', () => {
    render(<ApprovalRuleBuilder rules={[]} onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('add-rule-btn'));

    expect(mockOnChange).toHaveBeenCalled();
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'amount',
          operator: 'greater_than',
          priority: 1,
        }),
      ])
    );
  });

  it('renders multiple rules', () => {
    const multipleRules: ApprovalRule[] = [
      {
        id: 1,
        flowId: 1,
        field: 'amount',
        operator: 'greater_than',
        value: '5000',
        priority: 1,
        createdAt: '2024-12-20',
      },
      {
        id: 2,
        flowId: 1,
        field: 'department',
        operator: 'equals',
        value: 'Finance',
        priority: 2,
        createdAt: '2024-12-20',
      },
    ];

    render(<ApprovalRuleBuilder rules={multipleRules} onChange={mockOnChange} />);

    expect(screen.getByTestId('rule-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('rule-row-1')).toBeInTheDocument();
  });

  it('shows AND logic note when multiple rules exist', () => {
    const multipleRules: ApprovalRule[] = [
      {
        id: 1,
        flowId: 1,
        field: 'amount',
        operator: 'greater_than',
        value: '5000',
        priority: 1,
        createdAt: '2024-12-20',
      },
      {
        id: 2,
        flowId: 1,
        field: 'department',
        operator: 'equals',
        value: 'Finance',
        priority: 2,
        createdAt: '2024-12-20',
      },
    ];

    render(<ApprovalRuleBuilder rules={multipleRules} onChange={mockOnChange} />);

    expect(
      screen.getByText(/All rules must match \(AND logic\) for this workflow to apply/i)
    ).toBeInTheDocument();
  });

  it('renders remove button for each rule', () => {
    const existingRules: ApprovalRule[] = [
      {
        id: 1,
        flowId: 1,
        field: 'amount',
        operator: 'greater_than',
        value: '10000',
        priority: 1,
        createdAt: '2024-12-20',
      },
    ];

    render(<ApprovalRuleBuilder rules={existingRules} onChange={mockOnChange} />);

    expect(screen.getByTestId('remove-rule-0')).toBeInTheDocument();
  });

  it('hides add/remove buttons in readonly mode', () => {
    const existingRules: ApprovalRule[] = [
      {
        id: 1,
        flowId: 1,
        field: 'amount',
        operator: 'greater_than',
        value: '10000',
        priority: 1,
        createdAt: '2024-12-20',
      },
    ];

    render(
      <ApprovalRuleBuilder rules={existingRules} onChange={mockOnChange} readonly={true} />
    );

    expect(screen.queryByTestId('add-rule-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remove-rule-0')).not.toBeInTheDocument();
  });

  it('disables inputs in readonly mode', () => {
    const existingRules: ApprovalRule[] = [
      {
        id: 1,
        flowId: 1,
        field: 'amount',
        operator: 'greater_than',
        value: '10000',
        priority: 1,
        createdAt: '2024-12-20',
      },
    ];

    render(
      <ApprovalRuleBuilder rules={existingRules} onChange={mockOnChange} readonly={true} />
    );

    expect(screen.getByTestId('rule-field-0')).toBeDisabled();
    expect(screen.getByTestId('rule-operator-0')).toBeDisabled();
    expect(screen.getByTestId('rule-value-0')).toBeDisabled();
  });

  it('shows priority badges for rules', () => {
    const multipleRules: ApprovalRule[] = [
      {
        id: 1,
        flowId: 1,
        field: 'amount',
        operator: 'greater_than',
        value: '5000',
        priority: 1,
        createdAt: '2024-12-20',
      },
      {
        id: 2,
        flowId: 1,
        field: 'department',
        operator: 'equals',
        value: 'Finance',
        priority: 2,
        createdAt: '2024-12-20',
      },
    ];

    render(<ApprovalRuleBuilder rules={multipleRules} onChange={mockOnChange} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('ApprovalRuleBuilder with between operator', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows secondary value field for between operator', () => {
    const betweenRule: ApprovalRule[] = [
      {
        id: 1,
        flowId: 1,
        field: 'amount',
        operator: 'between',
        value: '5000',
        valueSecondary: '10000',
        priority: 1,
        createdAt: '2024-12-20',
      },
    ];

    render(<ApprovalRuleBuilder rules={betweenRule} onChange={mockOnChange} />);

    expect(screen.getByTestId('rule-value-0')).toBeInTheDocument();
    expect(screen.getByTestId('rule-value2-0')).toBeInTheDocument();
    expect(screen.getByText('and')).toBeInTheDocument();
  });
});

describe('ApprovalRuleBuilder rule types', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders text input for non-numeric fields', () => {
    const textRule: ApprovalRule[] = [
      {
        id: 1,
        flowId: 1,
        field: 'department',
        operator: 'equals',
        value: 'Finance',
        priority: 1,
        createdAt: '2024-12-20',
      },
    ];

    render(<ApprovalRuleBuilder rules={textRule} onChange={mockOnChange} />);

    const input = screen.getByTestId('rule-value-0');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('renders number input for amount field', () => {
    const amountRule: ApprovalRule[] = [
      {
        id: 1,
        flowId: 1,
        field: 'amount',
        operator: 'greater_than',
        value: '50000',
        priority: 1,
        createdAt: '2024-12-20',
      },
    ];

    render(<ApprovalRuleBuilder rules={amountRule} onChange={mockOnChange} />);

    const input = screen.getByTestId('rule-value-0');
    expect(input).toHaveAttribute('type', 'number');
  });
});
