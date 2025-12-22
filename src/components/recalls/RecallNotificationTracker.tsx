'use client';

/**
 * Recall Notification Tracker Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Tracks customer notifications and their responses.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxDataGrid, DxColumn, DxPaging } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { Phone, Mail, FileText, Truck, CheckCircle, AlertTriangle } from 'lucide-react';
import type {
  RecallNotification,
  NotificationMethod,
  NotificationResponseStatus,
  RecallNotificationUpdate,
} from '@/types/recalls';

interface RecallNotificationTrackerProps {
  recallId: number;
  canEdit?: boolean;
}

const methodIcons: Record<NotificationMethod, React.ReactNode> = {
  phone: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  fax: <FileText className="h-4 w-4" />,
  courier: <Truck className="h-4 w-4" />,
};

const statusColors: Record<NotificationResponseStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  acknowledged: 'bg-blue-100 text-blue-800',
  returning: 'bg-purple-100 text-purple-800',
  returned: 'bg-green-100 text-green-800',
  unresponsive: 'bg-red-100 text-red-800',
};

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'returning', label: 'Returning' },
  { value: 'returned', label: 'Returned' },
  { value: 'unresponsive', label: 'Unresponsive' },
];

async function fetchNotifications(recallId: number): Promise<RecallNotification[]> {
  const response = await fetch(`/api/recalls/${recallId}/notifications`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function updateNotification(
  notificationId: number,
  data: RecallNotificationUpdate
): Promise<RecallNotification> {
  const response = await fetch(`/api/recalls/0/notifications/${notificationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

export function RecallNotificationTracker({
  recallId,
  canEdit = true,
}: RecallNotificationTrackerProps) {
  const queryClient = useQueryClient();
  const [editingNotification, setEditingNotification] = useState<RecallNotification | null>(null);
  const [updateData, setUpdateData] = useState<RecallNotificationUpdate>({});

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['recall-notifications', recallId],
    queryFn: () => fetchNotifications(recallId),
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: number; data: RecallNotificationUpdate }) =>
      updateNotification(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recall-notifications', recallId] });
      queryClient.invalidateQueries({ queryKey: ['recall', recallId] });
      setEditingNotification(null);
      setUpdateData({});
    },
  });

  // Calculate summary stats
  const stats = {
    total: notifications.length,
    acknowledged: notifications.filter((n) => n.responseStatus !== 'pending').length,
    returned: notifications.filter((n) => n.responseStatus === 'returned').length,
    unresponsive: notifications.filter((n) => n.responseStatus === 'unresponsive').length,
  };

  const handleEdit = (notification: RecallNotification) => {
    setEditingNotification(notification);
    setUpdateData({
      responseStatus: notification.responseStatus,
      quantityReturned: notification.quantityReturned,
      notes: notification.notes || '',
    });
  };

  const handleSave = () => {
    if (!editingNotification) return;
    updateMutation.mutate({ id: editingNotification.id, data: updateData });
  };

  const renderMethodCell = (cellData: { value: NotificationMethod }) => (
    <div className="flex items-center gap-2">
      {methodIcons[cellData.value]}
      <span className="capitalize">{cellData.value}</span>
    </div>
  );

  const renderStatusCell = (cellData: { value: NotificationResponseStatus }) => (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[cellData.value]}`}
    >
      {cellData.value.replace('_', ' ')}
    </span>
  );

  const renderActionsCell = (cellData: { data: RecallNotification }) => {
    if (!canEdit) return null;
    return (
      <DxButton
        text="Update"
        stylingMode="text"
        onClick={() => handleEdit(cellData.data)}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Notified</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.acknowledged}</div>
          <div className="text-xs text-muted-foreground">Responded</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.returned}</div>
          <div className="text-xs text-muted-foreground">Returned</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.unresponsive}</div>
          <div className="text-xs text-muted-foreground">Unresponsive</div>
        </div>
      </div>

      {/* Notifications Table */}
      <DxDataGrid
        dataSource={notifications}
        showBorders
        rowAlternationEnabled
        loading={isLoading}
      >
        <DxPaging defaultPageSize={10} />

        <DxColumn dataField="customerName" caption="Customer" minWidth={150} />
        <DxColumn
          dataField="notificationMethod"
          caption="Method"
          width={100}
          cellRender={renderMethodCell}
        />
        <DxColumn dataField="notifiedAt" caption="Notified" dataType="date" width={110} />
        <DxColumn
          dataField="responseStatus"
          caption="Status"
          width={120}
          cellRender={renderStatusCell}
        />
        <DxColumn
          dataField="quantityDistributed"
          caption="Distributed"
          width={100}
          dataType="number"
          format="#,##0"
        />
        <DxColumn
          dataField="quantityReturned"
          caption="Returned"
          width={90}
          dataType="number"
          format="#,##0"
        />
        {canEdit && (
          <DxColumn
            caption="Actions"
            width={80}
            cellRender={renderActionsCell}
            allowFiltering={false}
            allowSorting={false}
          />
        )}
      </DxDataGrid>

      {/* Edit Dialog */}
      <DxPopup
        visible={!!editingNotification}
        onHiding={() => setEditingNotification(null)}
        title="Update Notification Status"
        width={400}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Response Status</label>
            <DxSelectBox
              dataSource={statusOptions}
              valueExpr="value"
              displayExpr="label"
              value={updateData.responseStatus}
              onValueChanged={(e) =>
                setUpdateData({ ...updateData, responseStatus: e.value })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Quantity Returned</label>
            <DxNumberBox
              value={updateData.quantityReturned || 0}
              onValueChanged={(e) =>
                setUpdateData({ ...updateData, quantityReturned: e.value || 0 })
              }
              min={0}
              format="#,##0"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <DxTextArea
              value={updateData.notes || ''}
              onValueChange={(value) =>
                setUpdateData({ ...updateData, notes: value || '' })
              }
              placeholder="Add notes..."
              height={80}
            />
          </div>

          {updateMutation.error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {updateMutation.error.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="Cancel"
              onClick={() => setEditingNotification(null)}
              stylingMode="outlined"
            />
            <DxButton
              text="Save"
              onClick={handleSave}
              type="default"
              disabled={updateMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
