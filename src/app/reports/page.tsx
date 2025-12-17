'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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
      alert(`Report ${reportId} generated successfully!`);
    } catch (error) {
      alert('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">รายงานและการส่งออกข้อมูล</p>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <Select
                options={categories}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <Card key={report.id} className="hover:shadow-lg transition-shadow">
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
                    <Button
                      size="sm"
                      onClick={() => handleGenerateReport(report.id)}
                      disabled={generating === report.id}
                    >
                      {generating === report.id ? (
                        'Generating...'
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-1" />
                          Generate
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleGenerateReport(report.id)}
                      disabled={generating === report.id}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
