/**
 * ApprovalFlowForm Component (T026)
 * Form for creating/editing approval flows
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TextBox } from 'devextreme-react/text-box';
import { TextArea } from 'devextreme-react/text-area';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { Switch } from 'devextreme-react/switch';
import { Button } from 'devextreme-react/button';
import DataGrid, {
  Column,
  Editing,
  RequiredRule,
} from 'devextreme-react/data-grid';
import type {
  ApprovalFlowWithDetails,
  DocumentType,
  RuleOperator,
  ApproverType,
} from '@/types/approval-workflow';

interface ApprovalFlowFormProps {
  flowId?: number;
  initialData?: ApprovalFlowWithDetails;
  mode: 'create' | 'edit';
}

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: 'purchase_requisition', label: 'Purchase Requisition' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'ap_invoice', label: 'AP Invoice' },
  { value: 'ar_invoice', label: 'AR Invoice' },
  { value: 'payment', label: 'Payment' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'debit_note', label: 'Debit Note' },
];

const ruleOperators: { value: RuleOperator; label: string }[] = [
  { value: 'eq', label: 'Equals (=)' },
  { value: 'ne', label: 'Not Equals (≠)' },
  { value: 'gt', label: 'Greater Than (>)' },
  { value: 'gte', label: 'Greater Than or Equal (≥)' },
  { value: 'lt', label: 'Less Than (<)' },
  { value: 'lte', label: 'Less Than or Equal (≤)' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not In List' },
];

const approverTypes: { value: ApproverType; label: string }[] = [
  { value: 'user', label: 'Specific User' },
  { value: 'role', label: 'Role' },
  { value: 'department_head', label: 'Department Head' },
  { value: 'requester_manager', label: 'Requester Manager' },
];

const fieldOptions = [
  { value: 'total_amount', label: 'Total Amount' },
  { value: 'department_id', label: 'Department' },
  { value: 'priority', label: 'Priority' },
];

interface RuleRow {
  id?: number;
  ruleOrder: number;
  fieldName: string;
  operator: RuleOperator;
  value: string;
  valueTo?: string;
  logicOperator: 'and' | 'or';
}

interface StepRow {
  id?: number;
  stepOrder: number;
  stepName: string;
  approverType: ApproverType;
  approverId?: number;
  canDelegate: boolean;
  timeoutDays: number;
}

export function ApprovalFlowForm({ flowId, initialData, mode }: ApprovalFlowFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [documentType, setDocumentType] = useState<DocumentType>(
    initialData?.documentType || 'purchase_requisition'
  );
  const [priority, setPriority] = useState(initialData?.priority || 100);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  // Rules and steps
  const [rules, setRules] = useState<RuleRow[]>(
    initialData?.rules.map((r) => ({
      id: r.id,
      ruleOrder: r.ruleOrder,
      fieldName: r.fieldName,
      operator: r.operator,
      value: r.value,
      valueTo: r.valueTo || '',
      logicOperator: r.logicOperator,
    })) || []
  );

  const [steps, setSteps] = useState<StepRow[]>(
    initialData?.steps.map((s) => ({
      id: s.id,
      stepOrder: s.stepOrder,
      stepName: s.stepName,
      approverType: s.approverType,
      approverId: s.approverId || undefined,
      canDelegate: s.canDelegate,
      timeoutDays: s.timeoutDays,
    })) || []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create/Update flow
      const flowData = {
        name,
        description,
        documentType,
        priority,
        isActive,
      };

      let currentFlowId = flowId;

      if (mode === 'create') {
        const response = await fetch('/api/settings/approval-flows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flowData),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        currentFlowId = result.data.id;
      } else {
        const response = await fetch(`/api/settings/approval-flows/${flowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flowData),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
      }

      // Update rules
      if (rules.length > 0) {
        const rulesResponse = await fetch(
          `/api/settings/approval-flows/${currentFlowId}/rules`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules }),
          }
        );
        const rulesResult = await rulesResponse.json();
        if (!rulesResult.success) throw new Error(rulesResult.error);
      }

      // Update steps
      if (steps.length > 0) {
        const stepsResponse = await fetch(
          `/api/settings/approval-flows/${currentFlowId}/steps`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps }),
          }
        );
        const stepsResult = await stepsResponse.json();
        if (!stepsResult.success) throw new Error(stepsResult.error);
      }

      router.push('/settings/approval-workflows');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addRule = useCallback(() => {
    setRules((prev) => [
      ...prev,
      {
        ruleOrder: prev.length + 1,
        fieldName: 'total_amount',
        operator: 'gte',
        value: '0',
        logicOperator: 'and',
      },
    ]);
  }, []);

  const addStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      {
        stepOrder: prev.length + 1,
        stepName: `Step ${prev.length + 1}`,
        approverType: 'user',
        canDelegate: false,
        timeoutDays: 3,
      },
    ]);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" data-testid="form-error">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <TextBox
              value={name}
              onValueChanged={(e) => setName(e.value)}
              placeholder="e.g., High-Value PR Approval"
              data-testid="flow-name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Type <span className="text-red-500">*</span>
            </label>
            <SelectBox
              items={documentTypes}
              valueExpr="value"
              displayExpr="label"
              value={documentType}
              onValueChanged={(e) => setDocumentType(e.value)}
              data-testid="document-type"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <TextArea
              value={description}
              onValueChanged={(e) => setDescription(e.value)}
              placeholder="Describe when this workflow applies"
              height={80}
              data-testid="flow-description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority (lower = higher priority)
            </label>
            <NumberBox
              value={priority}
              onValueChanged={(e) => setPriority(e.value)}
              min={1}
              max={1000}
              data-testid="flow-priority"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              value={isActive}
              onValueChanged={(e) => setIsActive(e.value)}
              data-testid="flow-active"
            />
            <label className="text-sm font-medium text-gray-700">Active</label>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Trigger Rules</h3>
          <Button
            text="Add Rule"
            icon="plus"
            type="default"
            stylingMode="outlined"
            onClick={addRule}
            data-testid="add-rule-btn"
          />
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Define conditions that must be met for this workflow to trigger. Leave empty to always trigger.
        </p>
        <DataGrid
          dataSource={rules}
          keyExpr="ruleOrder"
          showBorders={true}
          onRowUpdated={(e) => {
            setRules((prev) =>
              prev.map((r) => (r.ruleOrder === e.key ? { ...r, ...e.data } : r))
            );
          }}
          onRowRemoved={(e) => {
            setRules((prev) => prev.filter((r) => r.ruleOrder !== e.key));
          }}
          data-testid="rules-grid"
        >
          <Editing mode="cell" allowUpdating={true} allowDeleting={true} />
          <Column dataField="ruleOrder" caption="Order" width={70} allowEditing={false} />
          <Column dataField="fieldName" caption="Field">
            <RequiredRule />
          </Column>
          <Column dataField="operator" caption="Operator">
            <RequiredRule />
          </Column>
          <Column dataField="value" caption="Value">
            <RequiredRule />
          </Column>
          <Column dataField="valueTo" caption="To Value" />
          <Column dataField="logicOperator" caption="Logic" width={80} />
        </DataGrid>
      </div>

      {/* Steps */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Approval Steps</h3>
          <Button
            text="Add Step"
            icon="plus"
            type="default"
            stylingMode="outlined"
            onClick={addStep}
            data-testid="add-step-btn"
          />
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Define the approval chain. Steps are executed in order.
        </p>
        <DataGrid
          dataSource={steps}
          keyExpr="stepOrder"
          showBorders={true}
          onRowUpdated={(e) => {
            setSteps((prev) =>
              prev.map((s) => (s.stepOrder === e.key ? { ...s, ...e.data } : s))
            );
          }}
          onRowRemoved={(e) => {
            setSteps((prev) => prev.filter((s) => s.stepOrder !== e.key));
          }}
          data-testid="steps-grid"
        >
          <Editing mode="cell" allowUpdating={true} allowDeleting={true} />
          <Column dataField="stepOrder" caption="Step" width={70} allowEditing={false} />
          <Column dataField="stepName" caption="Name">
            <RequiredRule />
          </Column>
          <Column dataField="approverType" caption="Approver Type">
            <RequiredRule />
          </Column>
          <Column dataField="approverId" caption="Approver ID" />
          <Column dataField="canDelegate" caption="Can Delegate" dataType="boolean" width={100} />
          <Column dataField="timeoutDays" caption="Timeout (days)" width={100} dataType="number" />
        </DataGrid>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          text="Cancel"
          type="normal"
          stylingMode="outlined"
          onClick={() => router.push('/settings/approval-workflows')}
          data-testid="cancel-btn"
        />
        <Button
          text={mode === 'create' ? 'Create Flow' : 'Save Changes'}
          type="success"
          stylingMode="contained"
          useSubmitBehavior={true}
          disabled={loading || !name}
          data-testid="save-btn"
        />
      </div>
    </form>
  );
}

export default ApprovalFlowForm;
