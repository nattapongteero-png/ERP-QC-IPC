/**
 * ApprovalFlowForm Component (T026)
 * Form for creating/editing approval flows
 * Pattern aligned with /template module
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { TextArea } from 'devextreme-react/text-area';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { Switch } from 'devextreme-react/switch';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import DataGrid, {
  Column,
  Editing,
  RequiredRule,
} from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import type {
  ApprovalFlowWithDetails,
  DocumentType,
  RuleOperator,
  ApproverType,
} from '@/types/approval-workflow';

interface ApprovalFlowFormProps {
  flowId?: number;
  mode: 'create' | 'edit';
  onSuccess?: (flow: ApprovalFlowWithDetails) => void;
  onCancel?: () => void;
}

interface FormData {
  name: string;
  description: string;
  documentType: DocumentType;
  priority: number;
  isActive: boolean;
}

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

const defaultFormData: FormData = {
  name: '',
  description: '',
  documentType: 'purchase_requisition',
  priority: 100,
  isActive: true,
};

async function fetchFlow(id: number): Promise<ApprovalFlowWithDetails> {
  const res = await fetch(`/api/settings/approval-flows/${id}`);
  if (!res.ok) throw new Error('Failed to fetch workflow');
  const data = await res.json();
  return data.data;
}

async function createFlow(data: {
  flow: FormData;
  rules: RuleRow[];
  steps: StepRow[];
}): Promise<ApprovalFlowWithDetails> {
  // Create flow
  const flowRes = await fetch('/api/settings/approval-flows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data.flow),
  });
  if (!flowRes.ok) {
    const error = await flowRes.json();
    throw new Error(error.error || 'Failed to create workflow');
  }
  const flowResult = await flowRes.json();
  const flowId = flowResult.data.id;

  // Create rules if any
  if (data.rules.length > 0) {
    const rulesRes = await fetch(`/api/settings/approval-flows/${flowId}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: data.rules }),
    });
    if (!rulesRes.ok) {
      const error = await rulesRes.json();
      throw new Error(error.error || 'Failed to create rules');
    }
  }

  // Create steps if any
  if (data.steps.length > 0) {
    const stepsRes = await fetch(`/api/settings/approval-flows/${flowId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: data.steps }),
    });
    if (!stepsRes.ok) {
      const error = await stepsRes.json();
      throw new Error(error.error || 'Failed to create steps');
    }
  }

  return flowResult.data;
}

async function updateFlow(
  id: number,
  data: {
    flow: FormData;
    rules: RuleRow[];
    steps: StepRow[];
  }
): Promise<ApprovalFlowWithDetails> {
  // Update flow
  const flowRes = await fetch(`/api/settings/approval-flows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data.flow),
  });
  if (!flowRes.ok) {
    const error = await flowRes.json();
    throw new Error(error.error || 'Failed to update workflow');
  }
  const flowResult = await flowRes.json();

  // Update rules
  const rulesRes = await fetch(`/api/settings/approval-flows/${id}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: data.rules }),
  });
  if (!rulesRes.ok) {
    const error = await rulesRes.json();
    throw new Error(error.error || 'Failed to update rules');
  }

  // Update steps
  const stepsRes = await fetch(`/api/settings/approval-flows/${id}/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steps: data.steps }),
  });
  if (!stepsRes.ok) {
    const error = await stepsRes.json();
    throw new Error(error.error || 'Failed to update steps');
  }

  return flowResult.data;
}

async function deleteFlow(id: number): Promise<void> {
  const res = await fetch(`/api/settings/approval-flows/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete workflow');
  }
}

export function ApprovalFlowForm({
  flowId,
  mode,
  onSuccess,
  onCancel,
}: ApprovalFlowFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState<FormData>(defaultFormData);
  const [rules, setRules] = React.useState<RuleRow[]>([]);
  const [steps, setSteps] = React.useState<StepRow[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Fetch flow for edit mode
  const { data: existingFlow, isLoading: isLoadingFlow } = useQuery({
    queryKey: ['approval-flow', flowId],
    queryFn: () => fetchFlow(flowId!),
    enabled: mode === 'edit' && !!flowId,
  });

  // Set form data when flow is loaded
  React.useEffect(() => {
    if (existingFlow) {
      setFormData({
        name: existingFlow.name,
        description: existingFlow.description || '',
        documentType: existingFlow.documentType,
        priority: existingFlow.priority,
        isActive: existingFlow.isActive,
      });
      setRules(
        existingFlow.rules.map((r) => ({
          id: r.id,
          ruleOrder: r.ruleOrder,
          fieldName: r.fieldName,
          operator: r.operator,
          value: r.value,
          valueTo: r.valueTo || '',
          logicOperator: r.logicOperator,
        }))
      );
      setSteps(
        existingFlow.steps.map((s) => ({
          id: s.id,
          stepOrder: s.stepOrder,
          stepName: s.stepName,
          approverType: s.approverType,
          approverId: s.approverId || undefined,
          canDelegate: s.canDelegate,
          timeoutDays: s.timeoutDays,
        }))
      );
    }
  }, [existingFlow]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createFlow,
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] });
      notify('Workflow created successfully', 'success', 3000);
      if (onSuccess) {
        onSuccess(flow);
      } else {
        router.push('/settings/approval-workflows');
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { flow: FormData; rules: RuleRow[]; steps: StepRow[] }) =>
      updateFlow(flowId!, data),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] });
      queryClient.invalidateQueries({ queryKey: ['approval-flow', flowId] });
      notify('Workflow updated successfully', 'success', 3000);
      if (onSuccess) {
        onSuccess(flow);
      } else {
        router.push('/settings/approval-workflows');
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteFlow(flowId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] });
      notify('Workflow deleted successfully', 'success', 3000);
      router.push('/settings/approval-workflows');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      notify('Please enter a workflow name', 'warning', 3000);
      return;
    }

    const payload = {
      flow: formData,
      rules,
      steps,
    };

    if (mode === 'create') {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    deleteMutation.mutate();
  };

  const addRule = React.useCallback(() => {
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

  const addStep = React.useCallback(() => {
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

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  if (mode === 'edit' && isLoadingFlow) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3 text-gray-500">
            <LoadIndicator height={24} width={24} />
            <span>Loading workflow...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            text="Back"
            icon="back"
            stylingMode="text"
            onClick={handleCancel}
          />
          <div className="h-6 w-px bg-gray-200" />
          <h1 className="text-xl font-semibold text-gray-900" data-testid="page-title">
            {mode === 'create' ? 'Create New Workflow' : `Edit: ${existingFlow?.name}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'edit' && (
            <Button
              text="Delete"
              icon={isDeleting ? 'spindown' : 'trash'}
              type="danger"
              stylingMode="outlined"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            />
          )}
          <Button
            text="Cancel"
            icon="close"
            stylingMode="outlined"
            onClick={handleCancel}
            disabled={isSubmitting}
            data-testid="cancel-btn"
          />
          <Button
            text={mode === 'create' ? 'Create' : 'Save Changes'}
            icon={isSubmitting ? 'spindown' : 'save'}
            type="success"
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name}
            data-testid="save-btn"
          />
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">Confirm Delete</p>
                <p className="text-sm text-red-600">
                  Are you sure you want to delete this workflow? This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="Cancel"
                  stylingMode="outlined"
                  onClick={() => setShowDeleteConfirm(false)}
                />
                <Button
                  text="Delete"
                  icon="trash"
                  type="danger"
                  onClick={handleDelete}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={formData.name}
                    onValueChanged={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.value || '' }))
                    }
                    placeholder="e.g., High-Value PR Approval"
                    data-testid="flow-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Type <span className="text-red-500">*</span>
                  </label>
                  <SelectBox
                    items={documentTypes}
                    valueExpr="value"
                    displayExpr="label"
                    value={formData.documentType}
                    onValueChanged={(e) =>
                      setFormData((prev) => ({ ...prev, documentType: e.value }))
                    }
                    data-testid="document-type"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <TextArea
                    value={formData.description}
                    onValueChanged={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.value || '' }))
                    }
                    placeholder="Describe when this workflow applies"
                    height={80}
                    data-testid="flow-description"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trigger Rules */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Trigger Rules</CardTitle>
                <Button
                  text="Add Rule"
                  icon="plus"
                  type="default"
                  stylingMode="outlined"
                  onClick={addRule}
                  data-testid="add-rule-btn"
                />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Define conditions that must be met for this workflow to trigger. Leave empty to
                always trigger.
              </p>
              <DataGrid
                dataSource={rules}
                keyExpr="ruleOrder"
                showBorders
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
                <Editing mode="cell" allowUpdating allowDeleting />
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
            </CardContent>
          </Card>

          {/* Approval Steps */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Approval Steps</CardTitle>
                <Button
                  text="Add Step"
                  icon="plus"
                  type="default"
                  stylingMode="outlined"
                  onClick={addStep}
                  data-testid="add-step-btn"
                />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Define the approval chain. Steps are executed in order.
              </p>
              <DataGrid
                dataSource={steps}
                keyExpr="stepOrder"
                showBorders
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
                <Editing mode="cell" allowUpdating allowDeleting />
                <Column dataField="stepOrder" caption="Step" width={70} allowEditing={false} />
                <Column dataField="stepName" caption="Name">
                  <RequiredRule />
                </Column>
                <Column dataField="approverType" caption="Approver Type">
                  <RequiredRule />
                </Column>
                <Column dataField="approverId" caption="Approver ID" />
                <Column
                  dataField="canDelegate"
                  caption="Can Delegate"
                  dataType="boolean"
                  width={100}
                />
                <Column
                  dataField="timeoutDays"
                  caption="Timeout (days)"
                  width={100}
                  dataType="number"
                />
              </DataGrid>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status & Priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority (lower = higher priority)
                </label>
                <NumberBox
                  value={formData.priority}
                  onValueChanged={(e) =>
                    setFormData((prev) => ({ ...prev, priority: e.value || 100 }))
                  }
                  min={1}
                  max={1000}
                  data-testid="flow-priority"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Active</label>
                <Switch
                  value={formData.isActive}
                  onValueChanged={(e) =>
                    setFormData((prev) => ({ ...prev, isActive: e.value }))
                  }
                  data-testid="flow-active"
                />
              </div>
            </CardContent>
          </Card>

          {mode === 'edit' && existingFlow && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workflow Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">ID</span>
                  <span className="font-mono text-gray-900">{existingFlow.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Rules</span>
                  <span className="text-gray-900">{rules.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Steps</span>
                  <span className="text-gray-900">{steps.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-900">
                    {existingFlow.createdAt
                      ? new Date(existingFlow.createdAt).toLocaleDateString('th-TH')
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Updated</span>
                  <span className="text-gray-900">
                    {existingFlow.updatedAt
                      ? new Date(existingFlow.updatedAt).toLocaleDateString('th-TH')
                      : '-'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default ApprovalFlowForm;
