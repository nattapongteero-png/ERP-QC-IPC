'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import { Wand2 } from 'lucide-react';
import type { TemplateCategory, TemplateCategoryCreate, TemplateCategoryUpdate } from '@/types/template';

// DevExtreme imports
import Form, { Item, Label, RequiredRule, PatternRule } from 'devextreme-react/form';
import TextBox from 'devextreme-react/text-box';
import TextArea from 'devextreme-react/text-area';
import NumberBox from 'devextreme-react/number-box';
import ColorBox from 'devextreme-react/color-box';
import LoadIndicator from 'devextreme-react/load-indicator';
import notify from 'devextreme/ui/notify';

export interface TemplateCategoryFormProps {
  mode: 'create' | 'edit';
  categoryId?: number;
  onSuccess?: (category: TemplateCategory) => void;
  onCancel?: () => void;
}

interface FormData {
  code: string;
  nameTh: string;
  nameEn: string;
  description: string;
  color: string;
  sortOrder: number;
}

async function fetchCategory(id: number): Promise<TemplateCategory> {
  const res = await fetch(`/api/template/categories/${id}`);
  if (!res.ok) throw new Error('Failed to fetch category');
  const data = await res.json();
  return data.data;
}

async function createCategory(data: TemplateCategoryCreate): Promise<TemplateCategory> {
  const res = await fetch('/api/template/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to create category');
  }
  const result = await res.json();
  return result.data;
}

async function updateCategory(id: number, data: TemplateCategoryUpdate): Promise<TemplateCategory> {
  const res = await fetch(`/api/template/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to update category');
  }
  const result = await res.json();
  return result.data;
}

async function deleteCategory(id: number): Promise<void> {
  const res = await fetch(`/api/template/categories/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to delete category');
  }
}

async function generateCode(): Promise<string> {
  const res = await fetch('/api/template/categories/generate-code');
  if (!res.ok) {
    // Fallback to client-side generation
    const timestamp = Date.now().toString(36).toUpperCase();
    return `CAT-${timestamp}`;
  }
  const data = await res.json();
  return data.data?.code || `CAT-${Date.now().toString(36).toUpperCase()}`;
}

const defaultFormData: FormData = {
  code: '',
  nameTh: '',
  nameEn: '',
  description: '',
  color: '#3B82F6',
  sortOrder: 0,
};

const presetColors = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

export function TemplateCategoryForm({
  mode,
  categoryId,
  onSuccess,
  onCancel,
}: TemplateCategoryFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const formRef = React.useRef<Form>(null);
  const [formData, setFormData] = React.useState<FormData>(defaultFormData);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = React.useState(false);

  // Fetch category for edit mode
  const { data: existingCategory, isLoading: isLoadingCategory } = useQuery({
    queryKey: ['template-category', categoryId],
    queryFn: () => fetchCategory(categoryId!),
    enabled: mode === 'edit' && !!categoryId,
  });

  // Set form data when category is loaded
  React.useEffect(() => {
    if (existingCategory) {
      setFormData({
        code: existingCategory.code,
        nameTh: existingCategory.nameTh,
        nameEn: existingCategory.nameEn || '',
        description: existingCategory.description || '',
        color: existingCategory.color || '#3B82F6',
        sortOrder: existingCategory.sortOrder || 0,
      });
    }
  }, [existingCategory]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ['template-categories'] });
      queryClient.invalidateQueries({ queryKey: ['template-categories-list'] });
      queryClient.invalidateQueries({ queryKey: ['template-dashboard'] });
      notify('Category created successfully', 'success', 3000);
      if (onSuccess) {
        onSuccess(category);
      } else {
        // Navigate back to list page after creation
        router.push('/template/categories');
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: TemplateCategoryUpdate) => updateCategory(categoryId!, data),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ['template-categories'] });
      queryClient.invalidateQueries({ queryKey: ['template-categories-list'] });
      queryClient.invalidateQueries({ queryKey: ['template-category', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['template-dashboard'] });
      notify('Category updated successfully', 'success', 3000);
      if (onSuccess) {
        onSuccess(category);
      } else {
        // Navigate back to list page after update
        router.push('/template/categories');
      }
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteCategory(categoryId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-categories'] });
      queryClient.invalidateQueries({ queryKey: ['template-dashboard'] });
      notify('Category deleted successfully', 'success', 3000);
      router.push('/template/categories');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Auto-generate code handler
  const handleGenerateCode = async () => {
    setIsGeneratingCode(true);
    try {
      const newCode = await generateCode();
      setFormData((prev) => ({ ...prev, code: newCode }));
      notify('Code generated successfully', 'success', 2000);
    } catch {
      notify('Failed to generate code', 'error', 3000);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleSubmit = () => {
    const validationResult = formRef.current?.instance()?.validate();
    if (!validationResult?.isValid) {
      notify('Please fill in all required fields', 'warning', 3000);
      return;
    }

    const submitData = {
      code: formData.code,
      nameTh: formData.nameTh,
      nameEn: formData.nameEn || null,
      description: formData.description || null,
      color: formData.color,
      sortOrder: formData.sortOrder,
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

  if (mode === 'edit' && isLoadingCategory) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3 text-gray-500">
            <LoadIndicator height={24} width={24} />
            <span>Loading category...</span>
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
          <h1 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Create New Category' : `Edit: ${existingCategory?.nameTh}`}
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
                  Are you sure you want to delete this category? This action cannot be undone.
                  Categories with items cannot be deleted.
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
                {/* Code Field with Auto-Generate Button */}
                <Item colSpan={1}>
                  <Label text="Code" />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <TextBox
                        value={formData.code}
                        onValueChanged={(e) => setFormData((prev) => ({ ...prev, code: e.value || '' }))}
                        placeholder="Enter code or generate"
                        readOnly={mode === 'edit'}
                        maxLength={20}
                      />
                    </div>
                    {mode === 'create' && (
                      <Button
                        icon={isGeneratingCode ? 'spindown' : undefined}
                        hint="Auto-generate code"
                        stylingMode="contained"
                        type="default"
                        onClick={handleGenerateCode}
                        disabled={isGeneratingCode}
                        width={44}
                      >
                        {!isGeneratingCode && <Wand2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  <RequiredRule message="Code is required" />
                  <PatternRule
                    pattern={/^[A-Z0-9-]+$/i}
                    message="Code can only contain letters, numbers, and dashes"
                  />
                </Item>
                <Item dataField="sortOrder" colSpan={1}>
                  <Label text="Sort Order" />
                  <NumberBox
                    value={formData.sortOrder}
                    onValueChanged={(e) => setFormData((prev) => ({ ...prev, sortOrder: e.value || 0 }))}
                    min={0}
                    showSpinButtons
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
                    maxLength={500}
                    placeholder="Enter category description..."
                  />
                </Item>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Category Color</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <ColorBox
                  value={formData.color}
                  onValueChanged={(e) => setFormData((prev) => ({ ...prev, color: e.value || '#3B82F6' }))}
                  editAlphaChannel={false}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick Colors</label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color
                          ? 'border-gray-800 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                <div
                  className="px-3 py-2 rounded-full text-white text-sm font-medium text-center"
                  style={{ backgroundColor: formData.color }}
                >
                  {formData.nameTh || 'Category Name'}
                </div>
              </div>
            </CardContent>
          </Card>

          {mode === 'edit' && existingCategory && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">ID</span>
                  <span className="font-mono text-gray-900">{existingCategory.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Code</span>
                  <span className="font-mono text-gray-900">{existingCategory.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    existingCategory.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {existingCategory.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Items</span>
                  <span className="text-gray-900">{existingCategory.itemCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-900">
                    {new Date(existingCategory.createdAt).toLocaleDateString('th-TH')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Updated</span>
                  <span className="text-gray-900">
                    {new Date(existingCategory.updatedAt).toLocaleDateString('th-TH')}
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
