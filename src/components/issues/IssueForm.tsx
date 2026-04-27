'use client';

/**
 * Issue Form Component
 * Feature: Issue Tracker
 *
 * Form for creating and editing issues with structured description fields,
 * category selector, severity selector, and AI validation integration.
 */

import { useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Issue,
  IssueCreate,
  IssueDescription,
  IssueSeverity,
  IssueCategory,
  AIValidationResult,
} from '@/types/issues';

// ============================================
// Types
// ============================================

interface IssueFormProps {
  issue?: Issue | null;
  onSave?: (issue: Issue) => void;
  onCancel?: () => void;
  onValidate?: (result: AIValidationResult) => void;
}

interface FormData {
  title: string;
  summary: string;
  impact: string;
  environment: string;
  expectedBehavior: string;
  actualBehavior: string;
  stepsToReproduce: string;
  categoryId: number | null;
  severity: IssueSeverity;
  tagIds: number[];
}

// ============================================
// API Functions
// ============================================

async function fetchCategories(): Promise<IssueCategory[]> {
  const response = await fetch('/api/issues/categories?isActive=true');
  const result = await response.json();
  if (!result.success) return [];
  return result.data || [];
}

async function createIssue(data: IssueCreate): Promise<Issue> {
  const response = await fetch('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create issue');
  }
  return result.data;
}

async function updateIssue(id: number, data: Partial<IssueCreate>): Promise<Issue> {
  const response = await fetch(`/api/issues/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update issue');
  }
  return result.data;
}

async function validateIssue(title: string, description: IssueDescription, categoryId: number): Promise<AIValidationResult> {
  const response = await fetch('/api/issues/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, categoryId }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to validate issue');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function IssueForm({
  issue,
  onSave,
  onCancel,
  onValidate,
}: IssueFormProps) {
  const t = useTranslations('issues.form');
  const locale = useLocale();
  const isEditing = !!issue;
  const queryClient = useQueryClient();

  // Severity options translated at render time so switching language
  // refreshes the dropdown labels
  const SEVERITY_OPTIONS = [
    { id: 'critical', name: t('severity.critical'), description: t('severity.criticalDesc') },
    { id: 'major', name: t('severity.major'), description: t('severity.majorDesc') },
    { id: 'minor', name: t('severity.minor'), description: t('severity.minorDesc') },
  ];

  // Form state
  const [formData, setFormData] = useState<FormData>({
    title: issue?.title || '',
    summary: issue?.description?.summary || '',
    impact: issue?.description?.impact || '',
    environment: issue?.description?.environment || '',
    expectedBehavior: issue?.description?.expectedBehavior || '',
    actualBehavior: issue?.description?.actualBehavior || '',
    stepsToReproduce: issue?.description?.stepsToReproduce || '',
    categoryId: issue?.categoryId || null,
    severity: issue?.severity || 'minor',
    tagIds: issue?.tags?.map(t => t.id) || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<AIValidationResult | null>(null);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['issue-categories'],
    queryFn: fetchCategories,
  });

  // Handle field changes
  const handleChange = useCallback((field: keyof FormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    // Clear validation result when form changes
    setValidationResult(null);
  }, [errors]);

  // Build description object
  const buildDescription = useCallback((): IssueDescription => ({
    summary: formData.summary,
    impact: formData.impact || undefined,
    environment: formData.environment || undefined,
    expectedBehavior: formData.expectedBehavior || undefined,
    actualBehavior: formData.actualBehavior || undefined,
    stepsToReproduce: formData.stepsToReproduce || undefined,
  }), [formData]);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }

    if (!formData.summary.trim()) {
      newErrors.summary = 'Summary is required';
    } else if (formData.summary.length < 10) {
      newErrors.summary = 'Summary must be at least 10 characters';
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'Category is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // AI Validation
  const handleValidate = useCallback(async () => {
    if (!validate()) return;
    if (!formData.categoryId) return;

    setIsValidating(true);
    try {
      const result = await validateIssue(formData.title, buildDescription(), formData.categoryId);
      setValidationResult(result);
      onValidate?.(result);
    } catch (error) {
      console.error('Validation failed:', error);
      // Set fallback validation result
      setValidationResult({
        pass: false,
        missingItems: [],
        feedback: [],
        followUpQuestions: [],
        aiUnavailable: true,
      });
    } finally {
      setIsValidating(false);
    }
  }, [formData, validate, buildDescription, onValidate]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () => {
      if (!formData.categoryId) throw new Error('Category is required');
      return createIssue({
        title: formData.title,
        description: buildDescription(),
        categoryId: formData.categoryId,
        severity: formData.severity,
        tagIds: formData.tagIds.length > 0 ? formData.tagIds : undefined,
      });
    },
    onSuccess: (issue) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      onSave?.(issue);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!issue) throw new Error('No issue to update');
      return updateIssue(issue.id, {
        title: formData.title,
        description: buildDescription(),
        categoryId: formData.categoryId || undefined,
        severity: formData.severity,
        tagIds: formData.tagIds.length > 0 ? formData.tagIds : undefined,
      });
    },
    onSuccess: (updatedIssue) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['issue', issue?.id] });
      onSave?.(updatedIssue);
    },
  });

  const handleSubmit = useCallback(() => {
    if (!validate()) return;

    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }, [validate, isEditing, createMutation, updateMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const saveError = createMutation.error || updateMutation.error;

  return (
    <div className="space-y-6" key={locale}>
      {/* Basic Information */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">{t('sections.basic')}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.title')} <span className="text-red-500">*</span>
            </label>
            <DxTextBox
              value={formData.title}
              onValueChange={(value) => handleChange('title', value)}
              placeholder={t('placeholders.title')}
              data-testid="issue-title"
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">{errors.title}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fields.category')} <span className="text-red-500">*</span>
              </label>
              <DxSelectBox
                dataSource={(categories || []) as unknown as Record<string, unknown>[]}
                value={formData.categoryId}
                onValueChange={(value) => handleChange('categoryId', value)}
                displayExpr="name"
                valueExpr="id"
                placeholder={t('placeholders.category')}
                data-testid="issue-category"
              />
              {errors.categoryId && (
                <p className="text-red-500 text-sm mt-1">{errors.categoryId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fields.severity')} <span className="text-red-500">*</span>
              </label>
              <DxSelectBox
                dataSource={SEVERITY_OPTIONS}
                value={formData.severity}
                onValueChange={(value) => handleChange('severity', value)}
                displayExpr="name"
                valueExpr="id"
                placeholder={t('placeholders.severity')}
                data-testid="issue-severity"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">{t('sections.description')}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.summary')} <span className="text-red-500">*</span>
            </label>
            <DxTextArea
              value={formData.summary}
              onValueChange={(value) => handleChange('summary', value)}
              placeholder={t('placeholders.summary')}
              height={100}
              data-testid="issue-summary"
            />
            {errors.summary && (
              <p className="text-red-500 text-sm mt-1">{errors.summary}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.impact')}
            </label>
            <DxTextArea
              value={formData.impact}
              onValueChange={(value) => handleChange('impact', value)}
              placeholder={t('placeholders.impact')}
              height={80}
              data-testid="issue-impact"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.environment')}
            </label>
            <DxTextBox
              value={formData.environment}
              onValueChange={(value) => handleChange('environment', value)}
              placeholder={t('placeholders.environment')}
              data-testid="issue-environment"
            />
          </div>
        </div>
      </div>

      {/* For Bugs */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">{t('sections.bugDetails')}</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fields.expectedBehavior')}
              </label>
              <DxTextArea
                value={formData.expectedBehavior}
                onValueChange={(value) => handleChange('expectedBehavior', value)}
                placeholder={t('placeholders.expectedBehavior')}
                height={80}
                data-testid="issue-expected-behavior"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fields.actualBehavior')}
              </label>
              <DxTextArea
                value={formData.actualBehavior}
                onValueChange={(value) => handleChange('actualBehavior', value)}
                placeholder={t('placeholders.actualBehavior')}
                height={80}
                data-testid="issue-actual-behavior"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.stepsToReproduce')}
            </label>
            <DxTextArea
              value={formData.stepsToReproduce}
              onValueChange={(value) => handleChange('stepsToReproduce', value)}
              placeholder={t('placeholders.stepsToReproduce')}
              height={100}
              data-testid="issue-steps-to-reproduce"
            />
          </div>
        </div>
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div className={`p-4 rounded-lg border ${validationResult.pass ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`font-semibold ${validationResult.pass ? 'text-green-700' : 'text-yellow-700'}`}>
              {validationResult.pass ? t('validation.passed') : t('validation.needsAttention')}
            </span>
            {validationResult.aiUnavailable && (
              <span className="text-sm text-gray-500">{t('validation.aiUnavailable')}</span>
            )}
          </div>

          {validationResult.missingItems.length > 0 && (
            <div className="mb-2">
              <p className="text-sm font-medium text-yellow-700">{t('validation.missingItems')}</p>
              <ul className="list-disc list-inside text-sm text-yellow-600">
                {validationResult.missingItems.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.followUpQuestions.length > 0 && (
            <div>
              <p className="text-sm font-medium text-yellow-700">{t('validation.followUpQuestions')}</p>
              <ul className="list-disc list-inside text-sm text-yellow-600">
                {validationResult.followUpQuestions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {saveError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-red-700">{saveError.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <DxButton
            text={t('actions.cancel')}
            type="normal"
            stylingMode="outlined"
            onClick={onCancel}
            data-testid="issue-cancel-btn"
          />
        )}

        <DxButton
          text={isValidating ? t('actions.validating') : t('actions.validate')}
          type="default"
          stylingMode="outlined"
          onClick={handleValidate}
          disabled={isValidating || isSaving}
          data-testid="issue-validate-btn"
        />

        <DxButton
          text={isSaving ? t('actions.saving') : (isEditing ? t('actions.update') : t('actions.create'))}
          type="default"
          stylingMode="contained"
          onClick={handleSubmit}
          disabled={isSaving}
          data-testid="issue-submit-btn"
        />
      </div>
    </div>
  );
}

export default IssueForm;
