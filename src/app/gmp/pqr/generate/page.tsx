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
            text="กลับสู่แดชบอร์ด PQR"
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
                เลือกผลิตภัณฑ์
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ผลิตภัณฑ์ <span className="text-red-500">*</span>
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
                    placeholder="เลือกผลิตภัณฑ์สำเร็จรูป..."
                    searchEnabled
                    showClearButton
                    disabled={loadingProducts}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    เลือกผลิตภัณฑ์สำเร็จรูปสำหรับการทบทวนคุณภาพ
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
                ช่วงเวลาที่ทบทวน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ปีที่ทบทวน <span className="text-red-500">*</span>
                  </label>
                  <DxNumberBox
                    value={formData.reviewYear}
                    onValueChange={handleYearChange}
                    min={2020}
                    max={currentYear + 1}
                    showSpinButtons
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ปีที่ทำการทบทวน (โดยทั่วไปคือปีที่ผ่านมา)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      วันที่เริ่มต้นช่วงเวลา
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
                      วันที่สิ้นสุดช่วงเวลา
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
                  ค่าเริ่มต้นคือตลอดทั้งปีปฏิทิน (1 ม.ค. - 31 ธ.ค.)
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
                  ตัวอย่างรายงาน
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-indigo-200">
                    <span className="text-sm font-medium text-indigo-700">ผลิตภัณฑ์:</span>
                    <span className="text-sm text-indigo-900">
                      {selectedProduct?.code} - {selectedProduct?.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-indigo-200">
                    <span className="text-sm font-medium text-indigo-700">ปีที่ทบทวน:</span>
                    <span className="text-sm text-indigo-900">{formData.reviewYear}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-indigo-200">
                    <span className="text-sm font-medium text-indigo-700">ช่วงเวลาที่ทบทวน:</span>
                    <span className="text-sm text-indigo-900">
                      {formData.periodStart} ถึง {formData.periodEnd}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-indigo-700">เลขที่รายงาน:</span>
                    <span className="text-sm text-indigo-900">
                      สร้างอัตโนมัติ (PQR-{formData.reviewYear}-XXX)
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-indigo-100 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-indigo-800">
                      <p className="font-medium mb-1">สิ่งที่จะถูกสร้างขึ้น:</p>
                      <ul className="space-y-1 list-disc list-inside ml-2">
                        <li>รายงาน PQR ฉบับร่างพร้อมเลขที่รายงานที่สร้างอัตโนมัติ</li>
                        <li>การรวบรวมข้อมูลจากแบตช์การผลิต การเบี่ยงเบน CAPA และข้อร้องเรียน</li>
                        <li>การคำนวณ KPI และการวิเคราะห์ตัวชี้วัด</li>
                        <li>ข้อเสนอแนะอัตโนมัติจากข้อมูลคุณภาพ</li>
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
              <CardTitle className="text-sm">การดำเนินการ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DxButton
                text={createMutation.isPending ? 'กำลังสร้าง...' : 'สร้างรายงาน'}
                icon="check"
                type="success"
                width="100%"
                onClick={handleGenerate}
                disabled={!canGenerate || createMutation.isPending}
              />
              <DxButton
                text="ยกเลิก"
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
                  ข้อมูลที่จำเป็น
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-amber-700">
                  {!formData.productId && (
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>เลือกผลิตภัณฑ์</span>
                    </li>
                  )}
                  {!formData.reviewYear && (
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>กรอกปีที่ทบทวน</span>
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
                เกี่ยวกับรายงาน PQR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  <strong>การทบทวนคุณภาพผลิตภัณฑ์ (PQR)</strong> คือการทบทวนคุณภาพผลิตภัณฑ์ประจำปี
                  อย่างครอบคลุมตามที่ข้อกำหนด GMP กำหนด
                </p>
                <p>
                  ระบบจะรวบรวมข้อมูลโดยอัตโนมัติจาก:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>แบตช์การผลิตและผลผลิต</li>
                  <li>การเบี่ยงเบนและความไม่สอดคล้อง</li>
                  <li>กิจกรรม CAPA</li>
                  <li>ข้อร้องเรียนของลูกค้า</li>
                  <li>ผลที่อยู่นอกข้อกำหนด (OOS)</li>
                  <li>การศึกษาความคงสภาพ</li>
                </ul>
                <p className="text-xs text-gray-500 pt-2 border-t">
                  หลังจากสร้างแล้ว คุณสามารถทบทวน แก้ไข และส่งรายงานเพื่อขออนุมัติได้
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
                  ข้อผิดพลาด
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
