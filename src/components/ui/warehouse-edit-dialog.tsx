'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen m-0 p-0 rounded-none flex flex-col">
        {/* Custom Header for Dialog */}
        <div className="flex-none px-8 py-5 border-b bg-white">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-10 w-10 p-0 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
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
      </DialogContent>
    </Dialog>
  );
}

export default WarehouseEditDialog;
