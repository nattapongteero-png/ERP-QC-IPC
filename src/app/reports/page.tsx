'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { PageHeader } from '@/components/ui/page-header';
import {
  FileText,
  Download,
  Package,
  Factory,
  ShoppingCart,
  Truck,
  ClipboardCheck,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

const reportTypes: ReportType[] = [
  {
    id: 'inventory_summary',
    name: 'Inventory Summary',
    description: 'สรุปสินค้าคงคลังทั้งหมด แยกตามประเภทและสถานะ',
    icon: <Package className="h-6 w-6" />,
    category: 'inventory',
  },
  {
    id: 'lot_traceability',
    name: 'Lot Traceability',
    description: 'รายงานการตรวจสอบย้อนกลับ Lot',
    icon: <FileText className="h-6 w-6" />,
    category: 'inventory',
  },
  {
    id: 'expiry_report',
    name: 'Expiry Report',
    description: 'รายงานสินค้าใกล้หมดอายุ',
    icon: <TrendingUp className="h-6 w-6" />,
    category: 'inventory',
  },
  {
    id: 'production_summary',
    name: 'Production Summary',
    description: 'สรุปการผลิตตามช่วงเวลา',
    icon: <Factory className="h-6 w-6" />,
    category: 'production',
  },
  {
    id: 'batch_record',
    name: 'Batch Production Record',
    description: 'บันทึกการผลิตแต่ละ Batch (BPR)',
    icon: <FileText className="h-6 w-6" />,
    category: 'production',
  },
  {
    id: 'quality_summary',
    name: 'Quality Summary',
    description: 'สรุปผลการตรวจสอบคุณภาพ',
    icon: <ClipboardCheck className="h-6 w-6" />,
    category: 'quality',
  },
  {
    id: 'coa_report',
    name: 'Certificate of Analysis',
    description: 'ใบรับรองผลการวิเคราะห์ (COA)',
    icon: <FileText className="h-6 w-6" />,
    category: 'quality',
  },
  {
    id: 'purchase_summary',
    name: 'Purchase Summary',
    description: 'สรุปการจัดซื้อตามช่วงเวลา',
    icon: <Truck className="h-6 w-6" />,
    category: 'purchasing',
  },
  {
    id: 'sales_summary',
    name: 'Sales Summary',
    description: 'สรุปการขายตามช่วงเวลา',
    icon: <ShoppingCart className="h-6 w-6" />,
    category: 'sales',
  },
];

const categories = [
  { value: '', label: 'All Categories' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'production', label: 'Production' },
  { value: 'quality', label: 'Quality' },
  { value: 'purchasing', label: 'Purchasing' },
  { value: 'sales', label: 'Sales' },
];

export default function ReportsPage() {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);

  const filteredReports = categoryFilter
    ? reportTypes.filter((r) => r.category === categoryFilter)
    : reportTypes;

  const handleGenerateReport = async (reportId: string) => {
    setGenerating(reportId);
    try {
      // Simulate report generation
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // TODO: Implement actual report generation API call
      console.log(`Report ${reportId} generated successfully!`);
    } catch {
      // API errors handled by global error handler
      console.error('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Reports"
          description="รายงานและการส่งออกข้อมูล"
        />

        {/* Filters */}
        <Card elevation="raised">
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <DxSelectBox
                  items={categories}
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  valueExpr="value"
                  displayExpr="label"
                  placeholder="Select Category"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <DxDateBox
                  value={dateFrom}
                  onValueChange={(value) => setDateFrom(value || '')}
                  placeholder="Select start date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <DxDateBox
                  value={dateTo}
                  onValueChange={(value) => setDateTo(value || '')}
                  placeholder="Select end date"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report, index) => (
            <Card
              key={report.id}
              elevation="raised"
              interactive
              className={cn(
                'motion-safe:animate-fade-in motion-reduce:animate-none'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                    {report.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{report.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {report.description}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <DxButton
                        text={generating === report.id ? 'Generating...' : 'Generate'}
                        icon={generating !== report.id ? 'doc' : undefined}
                        type="default"
                        onClick={() => handleGenerateReport(report.id)}
                        disabled={generating === report.id}
                      />
                      <DxButton
                        text="Export"
                        icon="download"
                        type="normal"
                        stylingMode="outlined"
                        onClick={() => handleGenerateReport(report.id)}
                        disabled={generating === report.id}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
