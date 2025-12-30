/**
 * Approval Rule Builder Component (T123)
 * Visual rule builder for approval workflow conditions
 * Part of 011-accounting-spec-gap - User Story 5
 */

'use client';

import { useState } from 'react';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { TextBox } from 'devextreme-react/text-box';
import type { ApprovalRule, UIRuleOperator, RuleField } from '@/types/approval-workflow';

const FIELD_OPTIONS: { value: RuleField; label: string }[] = [
  { value: 'amount', label: 'Amount' },
  { value: 'department', label: 'Department' },
  { value: 'costCenter', label: 'Cost Center' },
  { value: 'project', label: 'Project' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'customer', label: 'Customer' },
  { value: 'category', label: 'Category' },
];

const OPERATOR_OPTIONS: { value: UIRuleOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not In List' },
  { value: 'contains', label: 'Contains' },
];

interface RuleBuilderProps {
  rules: ApprovalRule[];
  onChange: (rules: ApprovalRule[]) => void;
  readonly?: boolean;
}

interface LocalRule {
  id?: number;
  tempId: string;
  field: RuleField;
  operator: UIRuleOperator;
  value: string;
  valueSecondary?: string;
  priority: number;
}

export function ApprovalRuleBuilder({ rules, onChange, readonly = false }: RuleBuilderProps) {
  const [localRules, setLocalRules] = useState<LocalRule[]>(() =>
    rules.map((r) => ({
      id: r.id,
      tempId: `rule-${r.id || Math.random().toString(36).substr(2, 9)}`,
      field: r.field,
      operator: r.operator,
      value: r.value,
      valueSecondary: r.valueSecondary,
      priority: r.priority,
    }))
  );

  const updateRules = (newRules: LocalRule[]) => {
    setLocalRules(newRules);
    onChange(
      newRules.map((r) => ({
        id: r.id,
        flowId: 0, // Will be set by parent
        field: r.field,
        operator: r.operator,
        value: r.value,
        valueSecondary: r.valueSecondary,
        priority: r.priority,
        createdAt: '',
      }))
    );
  };

  const addRule = () => {
    const newRule: LocalRule = {
      tempId: `rule-${Math.random().toString(36).substr(2, 9)}`,
      field: 'amount',
      operator: 'greater_than',
      value: '',
      priority: localRules.length + 1,
    };
    updateRules([...localRules, newRule]);
  };

  const removeRule = (tempId: string) => {
    updateRules(localRules.filter((r) => r.tempId !== tempId));
  };

  const updateRule = (tempId: string, updates: Partial<LocalRule>) => {
    updateRules(
      localRules.map((r) => (r.tempId === tempId ? { ...r, ...updates } : r))
    );
  };

  const moveRule = (tempId: string, direction: 'up' | 'down') => {
    const index = localRules.findIndex((r) => r.tempId === tempId);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === localRules.length - 1)
    )
      return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newRules = [...localRules];
    [newRules[index], newRules[newIndex]] = [newRules[newIndex], newRules[index]];
    // Update priorities
    newRules.forEach((r, i) => (r.priority = i + 1));
    updateRules(newRules);
  };

  const showSecondaryValue = (operator: UIRuleOperator) => operator === 'between';
  const isNumericField = (field: RuleField) => field === 'amount';

  return (
    <div className="space-y-4" data-testid="rule-builder">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Workflow Rules</h3>
        {!readonly && (
          <Button
            text="Add Rule"
            icon="plus"
            type="default"
            stylingMode="outlined"
            onClick={addRule}
            data-testid="add-rule-btn"
          />
        )}
      </div>

      {localRules.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">
            No rules defined. This workflow will apply to all documents of the selected type.
          </p>
          {!readonly && (
            <Button
              text="Add First Rule"
              icon="plus"
              type="default"
              stylingMode="text"
              onClick={addRule}
              className="mt-2"
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {localRules.map((rule, index) => (
            <div
              key={rule.tempId}
              className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
              data-testid={`rule-row-${index}`}
            >
              {/* Priority Badge */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>

              {/* Field Select */}
              <div className="w-36">
                <SelectBox
                  items={FIELD_OPTIONS}
                  value={rule.field}
                  valueExpr="value"
                  displayExpr="label"
                  onValueChanged={(e) => updateRule(rule.tempId, { field: e.value })}
                  disabled={readonly}
                  placeholder="Field"
                  data-testid={`rule-field-${index}`}
                />
              </div>

              {/* Operator Select */}
              <div className="w-36">
                <SelectBox
                  items={OPERATOR_OPTIONS}
                  value={rule.operator}
                  valueExpr="value"
                  displayExpr="label"
                  onValueChanged={(e) => updateRule(rule.tempId, { operator: e.value })}
                  disabled={readonly}
                  placeholder="Operator"
                  data-testid={`rule-operator-${index}`}
                />
              </div>

              {/* Value Input */}
              <div className="flex-1">
                {isNumericField(rule.field) ? (
                  <NumberBox
                    value={parseFloat(rule.value) || 0}
                    onValueChanged={(e) => updateRule(rule.tempId, { value: String(e.value) })}
                    disabled={readonly}
                    format="#,##0.##"
                    placeholder="Value"
                    data-testid={`rule-value-${index}`}
                  />
                ) : (
                  <TextBox
                    value={rule.value}
                    onValueChanged={(e) => updateRule(rule.tempId, { value: e.value || '' })}
                    disabled={readonly}
                    placeholder="Value"
                    data-testid={`rule-value-${index}`}
                  />
                )}
              </div>

              {/* Secondary Value (for between operator) */}
              {showSecondaryValue(rule.operator) && (
                <>
                  <span className="text-gray-500">and</span>
                  <div className="flex-1">
                    {isNumericField(rule.field) ? (
                      <NumberBox
                        value={parseFloat(rule.valueSecondary || '') || 0}
                        onValueChanged={(e) =>
                          updateRule(rule.tempId, { valueSecondary: String(e.value) })
                        }
                        disabled={readonly}
                        format="#,##0.##"
                        placeholder="Second Value"
                        data-testid={`rule-value2-${index}`}
                      />
                    ) : (
                      <TextBox
                        value={rule.valueSecondary || ''}
                        onValueChanged={(e) =>
                          updateRule(rule.tempId, { valueSecondary: e.value || '' })
                        }
                        disabled={readonly}
                        placeholder="Second Value"
                        data-testid={`rule-value2-${index}`}
                      />
                    )}
                  </div>
                </>
              )}

              {/* Action Buttons */}
              {!readonly && (
                <div className="flex gap-1">
                  <Button
                    icon="arrowup"
                    hint="Move Up"
                    stylingMode="text"
                    onClick={() => moveRule(rule.tempId, 'up')}
                    disabled={index === 0}
                  />
                  <Button
                    icon="arrowdown"
                    hint="Move Down"
                    stylingMode="text"
                    onClick={() => moveRule(rule.tempId, 'down')}
                    disabled={index === localRules.length - 1}
                  />
                  <Button
                    icon="trash"
                    hint="Remove"
                    stylingMode="text"
                    onClick={() => removeRule(rule.tempId)}
                    data-testid={`remove-rule-${index}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rule Logic Explanation */}
      {localRules.length > 1 && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> All rules must match (AND logic) for this workflow to apply.
            Rules are evaluated in priority order.
          </p>
        </div>
      )}
    </div>
  );
}
