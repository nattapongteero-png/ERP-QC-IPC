'use client';

import * as React from 'react';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxButton } from '@/components/ui/dx-button';
import {
  ItemEditForm,
  type Item,
  type ItemFormData,
  getTypeConfig,
} from '@/components/ui/item-edit-form';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

// Re-export types for backward compatibility
export type { Item, ItemFormData } from '@/components/ui/item-edit-form';
export { itemTypes, getDefaultFormData, itemToFormData, getTypeConfig } from '@/components/ui/item-edit-form';

export interface ItemEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  onSave: (data: ItemFormData) => Promise<void>;
}

export function ItemEditDialog({
  open,
  onOpenChange,
  item,
  onSave,
}: ItemEditDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const isEditing = !!item;
  const typeConfig = getTypeConfig(item?.type || 'raw_material');
  const TypeIcon = typeConfig.icon;

  const handleSave = async (data: ItemFormData) => {
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
                {isEditing ? 'Edit Item' : 'Create New Item'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {isEditing
                  ? `Editing ${item.code} - ${item.nameTh}`
                  : 'Add a new item to your inventory system'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isEditing && (
              <Badge
                variant={item.isActive ? 'success' : 'danger'}
                dot
                className="text-sm px-3 py-1"
              >
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <ItemEditForm
        item={item}
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

export default ItemEditDialog;
