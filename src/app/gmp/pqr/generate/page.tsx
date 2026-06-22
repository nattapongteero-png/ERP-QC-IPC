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
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('gmp');
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
        title={t('pqr.generate.title')}
        description={t('pqr.generate.description')}
        backButton={
          <DxButton
            text={t('pqr.generate.backToDashboard')}
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
                {t('pqr.generate.selectProduct')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pqr.generate.productLabel')} <span className="text-red-500">*</span>
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
                    placeholder={t('pqr.generate.productPlaceholder')}
                    searchEnabled
                    showClearButton
                    disabled={loadingProducts}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('pqr.generate.productHint')}
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
                {t('pqr.generate.reviewPeriod')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pqr.generate.reviewYearLabel')} <span className="text-red-500">*</span>
                  </label>
                  <DxNumberBox
                    value={formData.reviewYear}
                    onValueChange={handleYearChange}
                    min={2020}
                    max={currentYear + 1}
                    showSpinButtons
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('pqr.generate.reviewYearHint')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('pqr.generate.periodStartLabel')}
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
                      {t('pqr.generate.periodEndLabel')}
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
                  {t('pqr.generate.periodDefaultHint')}
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
                  {t('pqr.generate.previewTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-indigo-200">
                    <span className="text-sm font-medium text-indigo-700">{t('pqr.generate.previewProduct')}</span>
                    <span className="text-sm text-indigo-900">
                      {selectedProduct?.code} - {selectedProduct?.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-indigo-200">
                    <span className="text-sm font-medium text-indigo-700">{t('pqr.generate.previewReviewYear')}</span>
                    <span className="text-sm text-indigo-900">{formData.reviewYear}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-indigo-200">
                    <span className="text-sm font-medium text-indigo-700">{t('pqr.generate.previewPeriod')}</span>
                    <span className="text-sm text-indigo-900">
                      {t('pqr.generate.periodRange', { start: formData.periodStart ?? '', end: formData.periodEnd ?? '' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-indigo-700">{t('pqr.generate.previewReportNumber')}</span>
                    <span className="text-sm text-indigo-900">
                      {t('pqr.generate.autoGeneratedNumber', { year: formData.reviewYear ?? '' })}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-indigo-100 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-indigo-800">
                      <p className="font-medium mb-1">{t('pqr.generate.whatWillBeCreated')}</p>
                      <ul className="space-y-1 list-disc list-inside ml-2">
                        <li>{t('pqr.generate.created.draftReport')}</li>
                        <li>{t('pqr.generate.created.dataAggregation')}</li>
                        <li>{t('pqr.generate.created.kpiCalculation')}</li>
                        <li>{t('pqr.generate.created.autoRecommendations')}</li>
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
              <CardTitle className="text-sm">{t('pqr.generate.actionsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DxButton
                text={createMutation.isPending ? t('pqr.generate.creating') : t('pqr.generate.createReport')}
                icon="check"
                type="success"
                width="100%"
                onClick={handleGenerate}
                disabled={!canGenerate || createMutation.isPending}
              />
              <DxButton
                text={t('common.cancel')}
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
                  {t('pqr.generate.requiredInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-amber-700">
                  {!formData.productId && (
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{t('pqr.generate.selectProduct')}</span>
                    </li>
                  )}
                  {!formData.reviewYear && (
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{t('pqr.generate.enterReviewYear')}</span>
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
                {t('pqr.generate.aboutTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  <strong>{t('pqr.generate.aboutPqrTerm')}</strong> {t('pqr.generate.aboutDescription')}
                </p>
                <p>
                  {t('pqr.generate.aboutAggregateIntro')}
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>{t('pqr.generate.aboutSource.batches')}</li>
                  <li>{t('pqr.generate.aboutSource.deviations')}</li>
                  <li>{t('pqr.generate.aboutSource.capa')}</li>
                  <li>{t('pqr.generate.aboutSource.complaints')}</li>
                  <li>{t('pqr.generate.aboutSource.oos')}</li>
                  <li>{t('pqr.generate.aboutSource.stability')}</li>
                </ul>
                <p className="text-xs text-gray-500 pt-2 border-t">
                  {t('pqr.generate.aboutFooter')}
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
                  {t('common.error')}
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
