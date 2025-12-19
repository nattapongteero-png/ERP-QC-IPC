'use client';

import * as React from 'react';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxButton } from '@/components/ui/dx-button';
import {
  WarehouseEditForm,
  type Warehouse,
  type WarehouseFormData,
  type WarehouseSummary,
  getTypeConfig,
} from '@/components/ui/warehouse-edit-form';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

// Re-export types for backward compatibility
export type { Warehouse, WarehouseFormData, WarehouseSummary } from '@/components/ui/warehouse-edit-form';
export { warehouseTypes, getDefaultFormData, warehouseToFormData, getTypeConfig } from '@/components/ui/warehouse-edit-form';

export interface WarehouseEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse | null;
  summary?: WarehouseSummary | null;
  onSave: (data: WarehouseFormData) => Promise<void>;
}

export function WarehouseEditDialog({
  open,
  onOpenChange,
  warehouse,
  summary,
  onSave,
}: WarehouseEditDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const isEditing = !!warehouse;
  const typeConfig = getTypeConfig(warehouse?.type || 'raw_material');
  const TypeIcon = typeConfig.icon;

  const handleSave = async (data: WarehouseFormData) => {
    setIsSaving(true);
    try {
      await onSave(data);
    } finally {
      setIsSaving(false);
    }
  };

  const renderDialogContent = () => (
    <div className="flex flex-col h-full">
      {/* Custom Header for Dialog */}
      <div className="flex-none px-8 py-5 border-b bg-white -mx-4 -mt-4 px-4 pt-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className={cn('p-3 rounded-2xl', typeConfig.bgColor, typeConfig.borderColor, 'border')}>
              <TypeIcon className={cn('h-7 w-7', typeConfig.color)} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isEditing ? 'Edit Warehouse' : 'Create New Warehouse'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {isEditing
                  ? `Editing ${warehouse.code} - ${warehouse.name}`
                  : 'Add a new warehouse to your inventory system'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isEditing && (
              <Badge
                variant={warehouse.isActive ? 'success' : 'danger'}
                dot
                className="text-sm px-3 py-1"
              >
                {warehouse.isActive ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <WarehouseEditForm
        warehouse={warehouse}
        summary={summary}
        onSave={handleSave}
        onCancel={() => onOpenChange(false)}
        isSaving={isSaving}
        showHeader={false}
        className="flex-1"
      />
    </div>
  );

  return (
    <DxPopup
      visible={open}
      onHiding={() => onOpenChange(false)}
      title=""
      width="100%"
      height="100%"
      showCloseButton
      showTitle={false}
      fullScreen
    >
      {renderDialogContent()}
    </DxPopup>
  );
}

export default WarehouseEditDialog;
