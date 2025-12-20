'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DxButton } from '@/components/ui/dx-button';
import { ArrowLeft, FileText, Loader2, AlertCircle } from 'lucide-react';

interface ReportCategory {
  id: number;
  name: string;
  description?: string;
}

interface FormData {
  name: string;
  code: string;
  description: string;
  categoryId: string;
}

interface FormErrors {
  name?: string;
  code?: string;
  description?: string;
  categoryId?: string;
}

export default function NewReportPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    code: '',
    description: '',
    categoryId: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/reports/categories');
        const data = await response.json();

        if (response.ok && data.success) {
          setCategories(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Generate code from name
  const generateCode = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }, []);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      code: generateCode(name),
    }));
    setFormErrors(prev => ({ ...prev, name: undefined, code: undefined }));
  }, [generateCode]);

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData(prev => ({ ...prev, code }));
    setFormErrors(prev => ({ ...prev, code: undefined }));
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, description: e.target.value }));
  }, []);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, categoryId: e.target.value }));
    setFormErrors(prev => ({ ...prev, categoryId: undefined }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Report name is required';
    } else if (formData.name.length < 3) {
      errors.name = 'Report name must be at least 3 characters';
    } else if (formData.name.length > 100) {
      errors.name = 'Report name must be less than 100 characters';
    }

    if (!formData.code.trim()) {
      errors.code = 'Report code is required';
    } else if (formData.code.length < 3) {
      errors.code = 'Report code must be at least 3 characters';
    } else if (formData.code.length > 50) {
      errors.code = 'Report code must be less than 50 characters';
    } else if (!/^[a-z0-9-]+$/.test(formData.code)) {
      errors.code = 'Report code can only contain lowercase letters, numbers, and hyphens';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create the report template
      const response = await fetch('/api/reports/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim(),
          description: formData.description.trim() || null,
          categoryId: formData.categoryId ? parseInt(formData.categoryId, 10) : null,
          definition: '<?xml version="1.0" encoding="utf-8"?><XtraReportsLayoutSerializer SerializerVersion="25.1.0.0" />',
          isPublished: false,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create report template');
      }

      // Redirect to the designer with the new report code
      router.push(`/reports/design/${data.data?.code || formData.code}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create report';
      setError(errorMessage);
      console.error('Report creation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, router]);

  const handleBack = () => {
    router.push('/reports');
  };

  const handleOpenDesignerDirectly = () => {
    router.push('/reports/design/new');
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to reports"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <PageHeader
            title="Create New Report"
            description="Enter report details and start designing"
          />
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Report Details</h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Report Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Report Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={handleNameChange}
                placeholder="e.g., Monthly Inventory Valuation"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>

            {/* Report Code */}
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                Report Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="code"
                value={formData.code}
                onChange={handleCodeChange}
                placeholder="e.g., monthly-inventory-valuation"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                  formErrors.code ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-gray-500">
                Used in URLs and API. Only lowercase letters, numbers, and hyphens.
              </p>
              {formErrors.code && (
                <p className="mt-1 text-sm text-red-600">{formErrors.code}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={handleDescriptionChange}
                rows={3}
                placeholder="Describe the purpose and contents of this report..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="category"
                value={formData.categoryId}
                onChange={handleCategoryChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting || isLoading}
              >
                <option value="">Select a category (optional)</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleOpenDesignerDirectly}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Skip and open designer directly
              </button>
              <div className="flex gap-3">
                <DxButton
                  text="Cancel"
                  type="normal"
                  stylingMode="outlined"
                  onClick={handleBack}
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Create & Open Designer
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Quick Start Templates */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Start Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                setFormData({
                  name: 'Inventory Valuation Report',
                  code: 'inventory-valuation-report',
                  description: 'Shows current inventory value by item and category',
                  categoryId: categories.find(c => c.name.toLowerCase().includes('inventory'))?.id.toString() || '',
                });
              }}
              className="text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="font-medium text-gray-900">Inventory Report</div>
              <div className="text-xs text-gray-500 mt-1">Stock levels and valuation</div>
            </button>
            <button
              onClick={() => {
                setFormData({
                  name: 'Production Summary Report',
                  code: 'production-summary-report',
                  description: 'Summary of production activities and output',
                  categoryId: categories.find(c => c.name.toLowerCase().includes('production'))?.id.toString() || '',
                });
              }}
              className="text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="font-medium text-gray-900">Production Report</div>
              <div className="text-xs text-gray-500 mt-1">Work orders and output</div>
            </button>
            <button
              onClick={() => {
                setFormData({
                  name: 'Quality Analysis Report',
                  code: 'quality-analysis-report',
                  description: 'Quality control test results and analysis',
                  categoryId: categories.find(c => c.name.toLowerCase().includes('quality'))?.id.toString() || '',
                });
              }}
              className="text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="font-medium text-gray-900">Quality Report</div>
              <div className="text-xs text-gray-500 mt-1">Test results and analysis</div>
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
