'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { PageHeader } from '@/components/ui/page-header';
import {
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
} from 'lucide-react';

const sourceTypeOptions = [
  { value: '', label: 'เลือกประเภทแหล่งที่มา...' },
  { value: 'production', label: 'การผลิต' },
  { value: 'quality', label: 'ควบคุมคุณภาพ' },
  { value: 'warehouse', label: 'คลังสินค้า' },
];

const severityOptions = [
  { value: 'minor', label: 'น้อย' },
  { value: 'major', label: 'มาก' },
  { value: 'critical', label: 'วิกฤต' },
];

export default function NewDeviationPage() {
  const router = useRouter();
  const t = useTranslations('quality');
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    sourceType: '',
    severity: 'minor',
    dueDate: '',
  });

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('กรุณากรอกหัวข้อ');
      return;
    }

    if (!formData.description.trim()) {
      alert('กรุณากรอกรายละเอียด');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/quality/deviations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          sourceType: formData.sourceType || null,
          severity: formData.severity,
          dueDate: formData.dueDate || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/quality/deviations/${data.data.id}`);
      }
    } catch (error) {
      console.error('Failed to create deviation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertOctagon className="h-5 w-5 text-red-600" />;
      case 'major':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
    }
  };

  const getSeverityDescription = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'ต้องดำเนินการทันที อาจส่งผลต่อความปลอดภัยหรือประสิทธิภาพของผลิตภัณฑ์';
      case 'major':
        return 'ความเบี่ยงเบนที่มีนัยสำคัญ ต้องให้ความสนใจและสืบสวนโดยเร็ว';
      default:
        return 'ความเบี่ยงเบนเล็กน้อยที่ควรบันทึกและแก้ไข';
    }
  };

  // Calculate default due date based on severity
  const getDefaultDueDate = (severity: string) => {
    const date = new Date();
    switch (severity) {
      case 'critical':
        date.setDate(date.getDate() + 3); // 3 days for critical
        break;
      case 'major':
        date.setDate(date.getDate() + 14); // 14 days for major
        break;
      default:
        date.setDate(date.getDate() + 30); // 30 days for minor
    }
    return toLocalDateStr(date);
  };

  return (
    
      <div className="space-y-6">
        <PageHeader
          title={t('nonConformance.title')}
          description={t('nonConformance.description')}
          backButton={
            <DxButton
              text="กลับ"
              icon="back"
              type="normal"
              stylingMode="text"
              onClick={() => router.push('/quality/deviations')}
            />
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card elevation="raised">
              <CardHeader>
                <CardTitle>รายละเอียดความเบี่ยงเบน</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      หัวข้อ <span className="text-red-500">*</span>
                    </label>
                    <DxTextBox
                      placeholder="คำอธิบายสั้น ๆ ของความเบี่ยงเบน"
                      value={formData.title}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, title: value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      รายละเอียด <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      rows={5}
                      placeholder="อธิบายรายละเอียดว่าเกิดอะไรขึ้น เมื่อใด ที่ไหน และการดำเนินการเบื้องต้นที่ได้ทำไป..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Classification */}
            <Card elevation="raised">
              <CardHeader>
                <CardTitle>การจัดประเภท</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ประเภทแหล่งที่มา
                    </label>
                    <DxSelectBox
                      items={sourceTypeOptions}
                      value={formData.sourceType}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, sourceType: value }))
                      }
                      placeholder="เลือกประเภทแหล่งที่มา..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ความรุนแรง <span className="text-red-500">*</span>
                    </label>
                    <DxSelectBox
                      items={severityOptions}
                      value={formData.severity}
                      onValueChange={(value) => {
                        setFormData((prev) => ({
                          ...prev,
                          severity: value,
                          dueDate: prev.dueDate || getDefaultDueDate(value),
                        }));
                      }}
                    />
                  </div>
                </div>

                {/* Severity Description */}
                <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                  formData.severity === 'critical'
                    ? 'bg-red-50 border border-red-200'
                    : formData.severity === 'major'
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  {getSeverityIcon(formData.severity)}
                  <div>
                    <p className={`font-medium ${
                      formData.severity === 'critical'
                        ? 'text-red-800'
                        : formData.severity === 'major'
                        ? 'text-yellow-800'
                        : 'text-blue-800'
                    }`}>
                      ความรุนแรงระดับ{formData.severity === 'critical' ? 'วิกฤต' : formData.severity === 'major' ? 'มาก' : 'น้อย'}
                    </p>
                    <p className={`text-sm ${
                      formData.severity === 'critical'
                        ? 'text-red-600'
                        : formData.severity === 'major'
                        ? 'text-yellow-600'
                        : 'text-blue-600'
                    }`}>
                      {getSeverityDescription(formData.severity)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card elevation="raised">
              <CardHeader>
                <CardTitle>กรอบเวลา</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      วันครบกำหนด
                    </label>
                    <DxDateBox
                      value={formData.dueDate}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, dueDate: value || '' }))
                      }
                      min={toLocalDateStr(new Date())}
                      placeholder="เลือกวันครบกำหนด"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      กรอบเวลาที่แนะนำ
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                      {formData.severity === 'critical' && 'วิกฤต: แก้ไขภายใน 3 วัน'}
                      {formData.severity === 'major' && 'มาก: แก้ไขภายใน 14 วัน'}
                      {formData.severity === 'minor' && 'น้อย: แก้ไขภายใน 30 วัน'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                  text={isSaving ? 'กำลังสร้าง...' : 'รายงานความเบี่ยงเบน'}
                  icon="save"
                  type="success"
                  width="100%"
                  onClick={handleSubmit}
                  disabled={!formData.title || !formData.description || isSaving}
                />
                <DxButton
                  text="ยกเลิก"
                  type="normal"
                  stylingMode="outlined"
                  width="100%"
                  onClick={() => router.push('/quality/deviations')}
                />
              </CardContent>
            </Card>

            {/* Help */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  เกี่ยวกับความเบี่ยงเบน
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <p>
                    ความเบี่ยงเบน คือ การเบี่ยงเบนใด ๆ จากขั้นตอน ข้อกำหนด หรือมาตรฐานที่ได้รับการอนุมัติ
                  </p>
                  <p>
                    <strong>รายงานเมื่อ:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-500">
                    <li>พารามิเตอร์กระบวนการอยู่นอกขีดจำกัด</li>
                    <li>เครื่องจักรทำงานผิดปกติ</li>
                    <li>ผลการทดสอบอยู่นอกข้อกำหนด</li>
                    <li>ข้อผิดพลาดในเอกสาร</li>
                    <li>สภาวะแวดล้อมเบี่ยงเบน</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Severity Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">การจัดระดับความรุนแรง</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertOctagon className="h-4 w-4 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">วิกฤต</p>
                      <p className="text-xs text-gray-500">
                        ส่งผลโดยตรงต่อความปลอดภัยของผลิตภัณฑ์ สุขภาพผู้ป่วย หรือการปฏิบัติตามกฎระเบียบ
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">มาก</p>
                      <p className="text-xs text-gray-500">
                        ส่งผลกระทบอย่างมีนัยสำคัญต่อคุณภาพผลิตภัณฑ์หรือการควบคุมกระบวนการ
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">น้อย</p>
                      <p className="text-xs text-gray-500">
                        ผลกระทบจำกัด แก้ไขได้ง่าย ไม่ส่งผลโดยตรงต่อคุณภาพ
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    
  );
}
