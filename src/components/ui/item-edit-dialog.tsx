'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
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
        <ItemEditForm
          item={item}
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

export default ItemEditDialog;
