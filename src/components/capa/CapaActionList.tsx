'use client';

/**
 * CAPA Action List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Displays and manages CAPA actions with status tracking.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  User,
  Calendar,
  Shield,
} from 'lucide-react';
import type { CapaAction, CapaActionCreate, CapaActionStatus, CapaActionType } from '@/types/capa';

// ============================================
// Types
// ============================================

interface CapaActionListProps {
  capaId: number;
  actions: CapaAction[];
  canEdit?: boolean;
  onActionAdded?: () => void;
  onActionUpdated?: () => void;
}

interface NewActionForm {
  description: string;
  actionType: CapaActionType;
  assigneeId: number | null;
  dueDate: string;
}

// ============================================
// API Functions
// ============================================

async function addAction(capaId: number, data: CapaActionCreate): Promise<CapaAction> {
  const response = await fetch(`/api/capa/${capaId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function updateAction(
  capaId: number,
  actionId: number,
  data: { status?: CapaActionStatus; completionNotes?: string }
): Promise<CapaAction> {
  const response = await fetch(`/api/capa/${capaId}/actions/${actionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function verifyAction(capaId: number, actionId: number): Promise<CapaAction> {
  const response = await fetch(`/api/capa/${capaId}/actions/${actionId}/verify`, {
    method: 'POST',
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchUsers(): Promise<{ id: number; name: string }[]> {
  const response = await fetch('/api/users');
  const result = await response.json();
  if (!result.success) return [];
  return result.data || [];
}

// ============================================
// Component
// ============================================

export function CapaActionList({
  capaId,
  actions,
  canEdit = true,
  onActionAdded,
  onActionUpdated,
}: CapaActionListProps) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState<CapaAction | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);

  const [newAction, setNewAction] = useState<NewActionForm>({
    description: '',
    actionType: 'corrective',
    assigneeId: null,
    dueDate: '',
  });

  // Load users when dialog opens
  const loadUsers = async () => {
    const data = await fetchUsers();
    setUsers(data);
  };

  // Add action mutation
  const addMutation = useMutation({
    mutationFn: () => addAction(capaId, {
      description: newAction.description,
      actionType: newAction.actionType,
      assigneeId: newAction.assigneeId!,
      dueDate: newAction.dueDate,
    }),
    onSuccess: () => {
      setShowAddDialog(false);
      setNewAction({ description: '', actionType: 'corrective', assigneeId: null, dueDate: '' });
      queryClient.invalidateQueries({ queryKey: ['capa', capaId] });
      onActionAdded?.();
    },
  });

  // Update action mutation
  const updateMutation = useMutation({
    mutationFn: ({ actionId, data }: { actionId: number; data: { status?: CapaActionStatus; completionNotes?: string } }) =>
      updateAction(capaId, actionId, data),
    onSuccess: () => {
      setShowCompleteDialog(false);
      setSelectedAction(null);
      setCompletionNotes('');
      queryClient.invalidateQueries({ queryKey: ['capa', capaId] });
      onActionUpdated?.();
    },
  });

  // Verify action mutation
  const verifyMutation = useMutation({
    mutationFn: (actionId: number) => verifyAction(capaId, actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capa', capaId] });
      onActionUpdated?.();
    },
  });

  // Get status icon
  const getStatusIcon = (status: CapaActionStatus, verified: boolean) => {
    if (verified) {
      return <Shield className="h-5 w-5 text-green-600" />;
    }
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'overdue':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  // Get status badge
  const getStatusBadge = (status: CapaActionStatus, verified: boolean) => {
    if (verified) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          Verified
        </span>
      );
    }

    const statusColors: Record<CapaActionStatus, string> = {
      pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status]}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  // Action type options
  const actionTypeOptions = [
    { value: 'immediate', label: 'Immediate' },
    { value: 'corrective', label: 'Corrective' },
    { value: 'preventive', label: 'Preventive' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Actions ({actions.length})
        </h3>
        {canEdit && (
          <DxButton
            text="Add Action"
            icon="add"
            onClick={() => {
              loadUsers();
              setShowAddDialog(true);
            }}
            stylingMode="outlined"
          />
        )}
      </div>

      {actions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No actions defined yet</p>
          {canEdit && (
            <p className="text-sm mt-2">Click &quot;Add Action&quot; to create the first action</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(action.status, !!action.verifiedBy)}

                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-medium text-sm">
                        Action #{action.actionNumber}
                      </span>
                      <span className="mx-2 text-muted-foreground">-</span>
                      <span className="text-xs px-2 py-0.5 bg-muted rounded capitalize">
                        {action.actionType}
                      </span>
                    </div>
                    {getStatusBadge(action.status, !!action.verifiedBy)}
                  </div>

                  <p className="text-sm">{action.description}</p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {action.assigneeName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {action.assigneeName}
                      </span>
                    )}
                    {action.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {action.dueDate}
                      </span>
                    )}
                    {action.verifiedByName && (
                      <span className="flex items-center gap-1 text-green-600">
                        <Shield className="h-3 w-3" />
                        Verified by {action.verifiedByName}
                      </span>
                    )}
                  </div>

                  {action.completionNotes && (
                    <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                      <span className="font-medium">Completion Notes: </span>
                      {action.completionNotes}
                    </div>
                  )}

                  {/* Action buttons */}
                  {canEdit && (
                    <div className="flex items-center gap-2 mt-3">
                      {action.status === 'pending' && (
                        <DxButton
                          text="Start"
                          onClick={() => updateMutation.mutate({
                            actionId: action.id,
                            data: { status: 'in_progress' }
                          })}
                          stylingMode="outlined"
                        />
                      )}
                      {action.status === 'in_progress' && (
                        <DxButton
                          text="Complete"
                          onClick={() => {
                            setSelectedAction(action);
                            setShowCompleteDialog(true);
                          }}
                          type="success"
                        />
                      )}
                      {action.status === 'completed' && !action.verifiedBy && (
                        <DxButton
                          text="Verify"
                          icon="check"
                          onClick={() => verifyMutation.mutate(action.id)}
                          type="success"
                          disabled={verifyMutation.isPending}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Action Dialog */}
      <DxPopup
        visible={showAddDialog}
        onHiding={() => setShowAddDialog(false)}
        title="Add Action"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Action Type</label>
            <DxSelectBox
              items={actionTypeOptions}
              value={newAction.actionType}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(value) => setNewAction((prev) => ({ ...prev, actionType: value as CapaActionType }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <DxTextArea
              value={newAction.description}
              onValueChange={(value) => setNewAction((prev) => ({ ...prev, description: value || '' }))}
              placeholder="Describe the action to be taken..."
              height={100}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Assignee</label>
            <DxSelectBox
              items={users.map((u) => ({ value: u.id, label: u.name }))}
              value={newAction.assigneeId}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(value) => setNewAction((prev) => ({ ...prev, assigneeId: value }))}
              placeholder="Select assignee"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Due Date</label>
            <DxDateBox
              value={newAction.dueDate || undefined}
              onValueChange={(value) =>
                setNewAction((prev) => ({
                  ...prev,
                  dueDate: value ? new Date(value).toISOString().split('T')[0] : '',
                }))
              }
              type="date"
              displayFormat="yyyy-MM-dd"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="Cancel"
              onClick={() => setShowAddDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="Add Action"
              icon="add"
              onClick={() => addMutation.mutate()}
              type="success"
              disabled={!newAction.description || !newAction.assigneeId || !newAction.dueDate || addMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>

      {/* Complete Action Dialog */}
      <DxPopup
        visible={showCompleteDialog}
        onHiding={() => {
          setShowCompleteDialog(false);
          setSelectedAction(null);
          setCompletionNotes('');
        }}
        title="Complete Action"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          {selectedAction && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">Action #{selectedAction.actionNumber}</p>
              <p className="text-sm text-muted-foreground">{selectedAction.description}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Completion Notes</label>
            <DxTextArea
              value={completionNotes}
              onValueChange={(value) => setCompletionNotes(value || '')}
              placeholder="Describe what was done to complete this action..."
              height={120}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="Cancel"
              onClick={() => {
                setShowCompleteDialog(false);
                setSelectedAction(null);
                setCompletionNotes('');
              }}
              stylingMode="outlined"
            />
            <DxButton
              text="Mark Complete"
              icon="check"
              onClick={() => {
                if (selectedAction) {
                  updateMutation.mutate({
                    actionId: selectedAction.id,
                    data: { status: 'completed', completionNotes }
                  });
                }
              }}
              type="success"
              disabled={updateMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
