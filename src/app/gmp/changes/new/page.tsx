'use client';

/**
 * New Change Request Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * Form for creating a new change request with:
 * - Title, change type, description
 * - Justification, impact assessment, risk assessment
 * - Priority, owner, target date
 * - Submit creates draft change request
 * - Redirect to detail page after creation
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Form } from 'devextreme-react/form';
import Button from 'devextreme-react/button';
import { ArrowLeft, FileEdit, Save } from 'lucide-react';
import type { ChangeRequestCreate, ChangeType, ChangePriority } from '@/types/change-control';

// ============================================
// Types
// ============================================

interface User {
  id: number;
  name: string;
}

interface FormData {
  title: string;
  changeType: ChangeType;
  description: string;
  justification: string;
  impactAssessment: string;
  riskAssessment: string;
  priority: ChangePriority;
  ownerId: number | null;
  targetDate: string;
}

// ============================================
// API Functions
// ============================================

async function fetchUsers(): Promise<User[]> {
  const response = await fetch('/api/users?limit=1000');
  const result = await response.json();
  if (!result.success) return [];
  return result.data.users.map((u: { id: number; name: string }) => ({
    id: u.id,
    name: u.name,
  }));
}

async function createChangeRequest(data: ChangeRequestCreate): Promise<{ id: number }> {
  const response = await fetch('/api/changes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create change request');
  }
  return result.data;
}

// ============================================
// Main Component
// ============================================

export default function NewChangeRequestPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const [formData, setFormData] = useState<FormData>({
    title: '',
    changeType: 'process',
    description: '',
    justification: '',
    impactAssessment: '',
    riskAssessment: '',
    priority: 'medium',
    ownerId: null,
    targetDate: '',
  });

  // Fetch users for owner selection
  const { data: users } = useQuery({
    queryKey: ['users-all'],
    queryFn: fetchUsers,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createChangeRequest,
    onSuccess: (data) => {
      router.push(`/gmp/changes/${data.id}`);
    },
  });

  // Form configuration
  const changeTypeOptions = [
    { value: 'process', text: 'Process' },
    { value: 'equipment', text: 'Equipment' },
    { value: 'document', text: 'Document' },
    { value: 'supplier', text: 'Supplier' },
    { value: 'formula', text: 'Formula' },
    { value: 'other', text: 'Other' },
  ];

  const priorityOptions = [
    { value: 'low', text: 'Low' },
    { value: 'medium', text: 'Medium' },
    { value: 'high', text: 'High' },
    { value: 'urgent', text: 'Urgent' },
  ];

  const userOptions = users?.map((u) => ({ value: u.id, text: u.name })) || [];

  // Handlers
  const handleSubmit = useCallback(() => {
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }
    if (!formData.ownerId) {
      alert('Owner is required');
      return;
    }

    const submitData: ChangeRequestCreate = {
      title: formData.title,
      changeType: formData.changeType,
      description: formData.description || undefined,
      justification: formData.justification || undefined,
      impactAssessment: formData.impactAssessment || undefined,
      riskAssessment: formData.riskAssessment || undefined,
      priority: formData.priority,
      ownerId: formData.ownerId,
      targetDate: formData.targetDate || undefined,
    };

    createMutation.mutate(submitData);
  }, [formData, createMutation]);

  const handleCancel = useCallback(() => {
    router.push('/gmp/changes');
  }, [router]);

  // Form items configuration
  const formItems = [
    {
      itemType: 'group' as const,
      caption: 'Basic Information',
      items: [
        {
          dataField: 'title',
          label: { text: 'Title' },
          isRequired: true,
          editorOptions: {
            placeholder: 'Brief description of the change',
          },
        },
        {
          dataField: 'changeType',
          label: { text: 'Change Type' },
          editorType: 'dxSelectBox',
          isRequired: true,
          editorOptions: {
            items: changeTypeOptions,
            displayExpr: 'text',
            valueExpr: 'value',
          },
        },
        {
          dataField: 'priority',
          label: { text: 'Priority' },
          editorType: 'dxSelectBox',
          isRequired: true,
          editorOptions: {
            items: priorityOptions,
            displayExpr: 'text',
            valueExpr: 'value',
          },
        },
        {
          dataField: 'ownerId',
          label: { text: 'Change Owner' },
          editorType: 'dxSelectBox',
          isRequired: true,
          editorOptions: {
            items: userOptions,
            displayExpr: 'text',
            valueExpr: 'value',
            searchEnabled: true,
            placeholder: 'Select owner',
          },
        },
        {
          dataField: 'targetDate',
          label: { text: 'Target Implementation Date' },
          editorType: 'dxDateBox',
          editorOptions: {
            type: 'date',
            displayFormat: 'dd MMM yyyy',
            placeholder: 'Select target date',
          },
        },
      ],
    },
    {
      itemType: 'group' as const,
      caption: 'Change Description',
      items: [
        {
          dataField: 'description',
          label: { text: 'Description' },
          editorType: 'dxTextArea',
          editorOptions: {
            height: 100,
            placeholder: 'Detailed description of the proposed change',
          },
        },
      ],
    },
    {
      itemType: 'group' as const,
      caption: 'Change Assessment',
      colCount: 1,
      items: [
        {
          dataField: 'justification',
          label: { text: 'Justification' },
          editorType: 'dxTextArea',
          editorOptions: {
            height: 100,
            placeholder: 'Why is this change necessary?',
          },
        },
        {
          dataField: 'impactAssessment',
          label: { text: 'Impact Assessment' },
          editorType: 'dxTextArea',
          editorOptions: {
            height: 100,
            placeholder: 'What areas will be affected by this change?',
          },
        },
        {
          dataField: 'riskAssessment',
          label: { text: 'Risk Assessment' },
          editorType: 'dxTextArea',
          editorOptions: {
            height: 100,
            placeholder: 'What are the risks if this change is not implemented?',
          },
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <FileEdit className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                {t('changes.actions.newChange')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('changes.description')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                icon="back"
                text="Cancel"
                stylingMode="outlined"
                onClick={handleCancel}
              />
              <Button
                icon="save"
                text="Create Change Request"
                type="success"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <FileEdit className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">Creating a Draft Change Request</p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                This form creates a draft change request. After creation, you can add more details and submit it for approval workflow.
                All fields except Title and Owner can be updated later.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <Form
            formData={formData}
            onFieldDataChanged={(e) => {
              if (e.dataField) {
                setFormData((prev) => ({
                  ...prev,
                  [e.dataField!]: e.value,
                }));
              }
            }}
            labelLocation="top"
            showColonAfterLabel={false}
            items={formItems}
          />

          {/* Error Display */}
          {createMutation.error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200 text-sm">
                {createMutation.error.message}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons (Mobile) */}
        <div className="mt-6 flex items-center justify-end gap-3 lg:hidden">
          <Button
            icon="back"
            text="Cancel"
            stylingMode="outlined"
            onClick={handleCancel}
          />
          <Button
            icon="save"
            text="Create"
            type="success"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
