'use client';

/**
 * PQR Generate Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 * Task: T418
 *
 * Form to generate a new PQR report with product and year selection.
 * Shows preview of what will be generated before creation.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { PageHeader } from '@/components/ui/page-header';
import {
  FileBarChart,
  Package,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import type { PqrCreate } from '@/types/pqr';

// ============================================
// API Functions
// ============================================

async function fetchProducts(): Promise<{ id: number; name: string; code: string }[]> {
  const response = await fetch('/api/items?category=finished_goods&limit=100');
  const result = await response.json();
  if (!result.success) return [];
  return (result.data?.items || []).map((item: { id: number; nameTh: string; code: string }) => ({
    id: item.id,
    name: item.nameTh,
    code: item.code,
  }));
}

async function createPqrReport(data: PqrCreate) {
  const response = await fetch('/api/pqr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create PQR report');
  }
  return result.data;
}

// ============================================
// Main Component
// ============================================

export default function GeneratePqrPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  // Form state
  const [formData, setFormData] = useState<Partial<PqrCreate>>({
    reviewYear: currentYear,
    periodStart: `${currentYear}-01-01`,
    periodEnd: `${currentYear}-12-31`,
  });

  const [selectedProduct, setSelectedProduct] = useState<{
    id: number;
    name: string;
    code: string;
  } | null>(null);

  // Fetch products
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['products-finished'],
    queryFn: fetchProducts,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createPqrReport,
    onSuccess: (report) => {
      router.push(`/gmp/pqr/${report.id}`);
    },
  });

  const handleYearChange = (year: number | null | undefined) => {
    const newYear = year || currentYear;
    setFormData((prev) => ({
      ...prev,
      reviewYear: newYear,
      periodStart: `${newYear}-01-01`,
      periodEnd: `${newYear}-12-31`,
    }));
  };

  const handleProductChange = (productId: number | null) => {
    if (!productId) {
      setFormData((prev) => ({ ...prev, productId: undefined }));
      setSelectedProduct(null);
      return;
    }
    const product = products?.find((p) => p.id === productId);
    if (product) {
      setFormData((prev) => ({ ...prev, productId: product.id }));
      setSelectedProduct(product);
    }
  };

  const handleGenerate = () => {
    if (!formData.productId || !formData.reviewYear) {
      return;
    }
    createMutation.mutate(formData as PqrCreate);
  };

  const canGenerate = formData.productId && formData.reviewYear;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generate PQR Report"
        description="Create a new Product Quality Review report for annual assessment"
        backButton={
          <DxButton
            text="Back to PQR Dashboard"
            icon="back"
            type="normal"
            stylingMode="text"
            onClick={() => router.push('/gmp/pqr')}
          />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Selection */}
          <Card elevation="raised">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600" />
                Select Product
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product <span className="text-red-500">*</span>
                  </label>
                  <DxSelectBox
                    items={
                      products?.map((p) => ({
                        value: p.id,
                        label: `${p.code} - ${p.name}`,
                      })) || []
                    }
                    value={formData.productId}
                    valueExpr="value"
                    displayExpr="label"
                    onValueChange={handleProductChange}
                    placeholder="Select a finished product..."
                    searchEnabled
                    showClearButton
                    disabled={loadingProducts}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Choose the finished product for quality review
                  </p>
                </div>

                {selectedProduct && (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Package className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-indigo-900">{selectedProduct.code}</p>
                        <p className="text-sm text-indigo-700">{selectedProduct.name}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Review Period */}
          <Card elevation="raised">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Review Period
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Year <span className="text-red-500">*</span>
                  </label>
                  <DxNumberBox
                    value={formData.reviewYear}
                    onValueChange={handleYearChange}
                    min={2020}
                    max={currentYear + 1}
                    showSpinButtons
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The year being reviewed (typically the previous year)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Period Start
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.periodStart || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, periodStart: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Period End
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.periodEnd || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, periodEnd: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Defaults to full calendar year (Jan 1 - Dec 31)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {canGenerate && (
            <Card elevation="raised" className="border-indigo-200 bg-indigo-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <BarChart3 className="h-5 w-5" />
                  Report Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-indigo-200">
                    <span className="text-sm font-medium text-indigo-700">Product:</span>
                    <span className="text-sm text-indigo-900">
                      {selectedProduct?.code} - {selectedProduct?.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-indigo-200">
                    <span className="text-sm font-medium text-indigo-700">Review Year:</span>
                    <span className="text-sm text-indigo-900">{formData.reviewYear}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-indigo-200">
                    <span className="text-sm font-medium text-indigo-700">Review Period:</span>
                    <span className="text-sm text-indigo-900">
                      {formData.periodStart} to {formData.periodEnd}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-indigo-700">Report Number:</span>
                    <span className="text-sm text-indigo-900">
                      Auto-generated (PQR-{formData.reviewYear}-XXX)
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-indigo-100 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-indigo-800">
                      <p className="font-medium mb-1">What will be generated:</p>
                      <ul className="space-y-1 list-disc list-inside ml-2">
                        <li>Draft PQR report with auto-generated report number</li>
                        <li>Data aggregation from production batches, deviations, CAPAs, complaints</li>
                        <li>KPI calculations and metrics analysis</li>
                        <li>Automated recommendations based on quality data</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DxButton
                text={createMutation.isPending ? 'Generating...' : 'Generate Report'}
                icon="check"
                type="success"
                width="100%"
                onClick={handleGenerate}
                disabled={!canGenerate || createMutation.isPending}
              />
              <DxButton
                text="Cancel"
                type="normal"
                stylingMode="outlined"
                width="100%"
                onClick={() => router.push('/gmp/pqr')}
              />
            </CardContent>
          </Card>

          {/* Validation Messages */}
          {!canGenerate && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                  <AlertCircle className="h-4 w-4" />
                  Required Fields
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-amber-700">
                  {!formData.productId && (
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Select a product</span>
                    </li>
                  )}
                  {!formData.reviewYear && (
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Enter review year</span>
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Help */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileBarChart className="h-4 w-4" />
                About PQR Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  <strong>Product Quality Review (PQR)</strong> is an annual comprehensive review
                  of product quality as required by GMP regulations.
                </p>
                <p>
                  The system will automatically aggregate data from:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Production batches and yields</li>
                  <li>Deviations and non-conformances</li>
                  <li>CAPA activities</li>
                  <li>Customer complaints</li>
                  <li>Out-of-specification (OOS) results</li>
                  <li>Stability studies</li>
                </ul>
                <p className="text-xs text-gray-500 pt-2 border-t">
                  After generation, you can review, edit, and submit the report for approval.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {createMutation.error && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-700">{createMutation.error.message}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
