'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import type { TemplateItem, TemplateCategory, TemplateItemCreate, TemplateItemUpdate } from '@/types/template';

// DevExtreme imports
import Form, { Item, GroupItem, Label, RequiredRule, PatternRule, RangeRule } from 'devextreme-react/form';
import SelectBox from 'devextreme-react/select-box';
import TextBox from 'devextreme-react/text-box';
import TextArea from 'devextreme-react/text-area';
import NumberBox from 'devextreme-react/number-box';
import LoadIndicator from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';

export interface TemplateItemFormProps {
  mode: 'create' | 'edit';
  itemId?: number;
  onSuccess?: (item: TemplateItem) => void;
  onCancel?: () => void;
}

interface FormData {
  code: string;
  nameTh: string;
  nameEn: string;
  description: string;
  status: string;
  priority: string;
  categoryId: number | null;
  quantity: number;
  unitPrice: number;
  notes: string;
}

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

async function fetchCategories(): Promise<TemplateCategory[]> {
  const res = await fetch('/api/template/categories?isActive=true');
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  return data.data || [];
}

async function fetchItem(id: number): Promise<TemplateItem> {
  const res = await fetch(`/api/template/items/${id}`);
  if (!res.ok) throw new Error('Failed to fetch item');
  const data = await res.json();
  return data.data;
}

async function createItem(data: TemplateItemCreate): Promise<TemplateItem> {
  const res = await fetch('/api/template/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to create item');
  }
  const result = await res.json();
  return result.data;
}

async function updateItem(id: number, data: TemplateItemUpdate): Promise<TemplateItem> {
  const res = await fetch(`/api/template/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to update item');
  }
  const result = await res.json();
  return result.data;
}

async function deleteItem(id: number): Promise<void> {
  const res = await fetch(`/api/template/items/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to delete item');
  }
}

const defaultFormData: FormData = {
  code: '',
  nameTh: '',
  nameEn: '',
  description: '',
  status: 'draft',
  priority: 'medium',
  categoryId: null,
  quantity: 0,
  unitPrice: 0,
  notes: '',
};

export function TemplateItemForm({
  mode,
  itemId,
  onSuccess,
  onCancel,
}: TemplateItemFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const formRef = React.useRef<any>(null);
  const [formData, setFormData] = React.useState<FormData>(defaultFormData);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['template-categories'],
    queryFn: fetchCategories,
  });

  // Fetch item for edit mode
  const { data: existingItem, isLoading: isLoadingItem } = useQuery({
    queryKey: ['template-item', itemId],
    queryFn: () => fetchItem(itemId!),
    enabled: mode === 'edit' && !!itemId,
  });

  // Set form data when item is loaded
  React.useEffect(() => {
    if (existingItem) {
      setFormData({
        code: existingItem.code,
        nameTh: existingItem.nameTh,
        nameEn: existingItem.nameEn || '',
        description: existingItem.description || '',
        status: existingItem.status,
        priority: existingItem.priority,
        categoryId: existingItem.categoryId,
        quantity: existingItem.quantity,
        unitPrice: existingItem.unitPrice,
        notes: existingItem.notes || '',
      });
    }
  }, [existingItem]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createItem,
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['template-items'] });
      queryClient.invalidateQueries({ queryKey: ['template-dashboard'] });
      notify('Item created successfully', 'success', 3000);
      if (onSuccess) {
        onSuccess(item);
      } else {
        router.push(`/template/items/${item.id}`);
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: TemplateItemUpdate) => updateItem(itemId!, data),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['template-items'] });
      queryClient.invalidateQueries({ queryKey: ['template-item', itemId] });
      queryClient.invalidateQueries({ queryKey: ['template-dashboard'] });
      notify('Item updated successfully', 'success', 3000);
      if (onSuccess) {
        onSuccess(item);
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteItem(itemId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-items'] });
      queryClient.invalidateQueries({ queryKey: ['template-dashboard'] });
      notify('Item deleted successfully', 'success', 3000);
      router.push('/template/items');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    const validationResult = formRef.current?.instance?.validate();
    if (!validationResult?.isValid) {
      notify('Please fill in all required fields', 'warning', 3000);
      return;
    }

    const submitData = {
      code: formData.code,
      nameTh: formData.nameTh,
      nameEn: formData.nameEn || null,
      description: formData.description || null,
      status: formData.status as 'draft' | 'active' | 'archived',
      priority: formData.priority as 'low' | 'medium' | 'high' | 'urgent',
      categoryId: formData.categoryId,
      quantity: formData.quantity,
      unitPrice: formData.unitPrice,
      notes: formData.notes || null,
    };

    if (mode === 'create') {
      createMutation.mutate(submitData);
    } else {
      updateMutation.mutate(submitData);
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

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  if (mode === 'edit' && isLoadingItem) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3 text-gray-500">
            <LoadIndicator height={24} width={24} />
            <span>Loading item...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalValue = formData.quantity * formData.unitPrice;

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
          <h1 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Create New Item' : `Edit: ${existingItem?.nameTh}`}
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
          />
          <Button
            text={mode === 'create' ? 'Create' : 'Save Changes'}
            icon={isSubmitting ? 'spindown' : 'save'}
            type="success"
            onClick={handleSubmit}
            disabled={isSubmitting}
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
                  Are you sure you want to delete this item? This action cannot be undone.
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Form
                ref={formRef}
                formData={formData}
                onFieldDataChanged={(e) => {
                  if (e.dataField) {
                    setFormData((prev) => ({ ...prev, [e.dataField!]: e.value }));
                  }
                }}
                labelLocation="top"
                showColonAfterLabel={false}
                colCount={2}
              >
                <Item dataField="code" editorType="dxTextBox" colSpan={1}>
                  <Label text="Code" />
                  <RequiredRule message="Code is required" />
                  <PatternRule
                    pattern={/^[A-Z0-9-]+$/i}
                    message="Code can only contain letters, numbers, and dashes"
                  />
                </Item>
                <Item dataField="categoryId" colSpan={1}>
                  <Label text="Category" />
                  <SelectBox
                    dataSource={categories}
                    displayExpr="nameTh"
                    valueExpr="id"
                    value={formData.categoryId}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, categoryId: e.value }))}
                    placeholder="Select category..."
                    showClearButton
                    searchEnabled
                  />
                </Item>
                <Item dataField="nameTh" editorType="dxTextBox" colSpan={1}>
                  <Label text="Name (Thai)" />
                  <RequiredRule message="Thai name is required" />
                </Item>
                <Item dataField="nameEn" editorType="dxTextBox" colSpan={1}>
                  <Label text="Name (English)" />
                </Item>
                <Item dataField="description" editorType="dxTextArea" colSpan={2}>
                  <Label text="Description" />
                  <TextArea
                    value={formData.description}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, description: e.value || '' }))}
                    height={100}
                  />
                </Item>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quantity & Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                  <NumberBox
                    value={formData.quantity}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, quantity: e.value || 0 }))}
                    min={0}
                    format="#,##0.####"
                    showSpinButtons
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price</label>
                  <NumberBox
                    value={formData.unitPrice}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, unitPrice: e.value || 0 }))}
                    min={0}
                    format="#,##0.00"
                    showSpinButtons
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Value</label>
                  <div className="h-10 px-3 flex items-center bg-gray-100 rounded-md text-lg font-semibold text-gray-900">
                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(totalValue)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <TextArea
                value={formData.notes}
                onValueChanged={(e) => setFormData((prev) => ({ ...prev, notes: e.value || '' }))}
                height={120}
                placeholder="Add any additional notes..."
              />
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <SelectBox
                  dataSource={statusOptions}
                  displayExpr="label"
                  valueExpr="value"
                  value={formData.status}
                  onValueChanged={(e) => setFormData((prev) => ({ ...prev, status: e.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <SelectBox
                  dataSource={priorityOptions}
                  displayExpr="label"
                  valueExpr="value"
                  value={formData.priority}
                  onValueChanged={(e) => setFormData((prev) => ({ ...prev, priority: e.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {mode === 'edit' && existingItem && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Item Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">ID</span>
                  <span className="font-mono text-gray-900">{existingItem.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Code</span>
                  <span className="font-mono text-gray-900">{existingItem.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-900">
                    {new Date(existingItem.createdAt).toLocaleDateString('th-TH')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Updated</span>
                  <span className="text-gray-900">
                    {new Date(existingItem.updatedAt).toLocaleDateString('th-TH')}
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
