'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
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
  { value: '', label: 'Select Source Type...' },
  { value: 'production', label: 'Production' },
  { value: 'quality', label: 'Quality Control' },
  { value: 'warehouse', label: 'Warehouse' },
];

const severityOptions = [
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
  { value: 'critical', label: 'Critical' },
];

export default function NewDeviationPage() {
  const router = useRouter();
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
      alert('Please enter a title');
      return;
    }

    if (!formData.description.trim()) {
      alert('Please enter a description');
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
        return 'Immediate action required. May impact product safety or efficacy.';
      case 'major':
        return 'Significant deviation requiring prompt attention and investigation.';
      default:
        return 'Minor deviation that should be documented and addressed.';
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
    return date.toISOString().split('T')[0];
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Report Deviation"
          description="Document a quality deviation for investigation"
          backButton={
            <DxButton
              text="Back"
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
                <CardTitle>Deviation Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <DxTextBox
                      placeholder="Brief description of the deviation"
                      value={formData.title}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, title: value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      rows={5}
                      placeholder="Provide detailed description of what happened, when, where, and any immediate actions taken..."
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
                <CardTitle>Classification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Source Type
                    </label>
                    <DxSelectBox
                      items={sourceTypeOptions}
                      value={formData.sourceType}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, sourceType: value }))
                      }
                      placeholder="Select Source Type..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Severity <span className="text-red-500">*</span>
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
                    <p className={`font-medium capitalize ${
                      formData.severity === 'critical'
                        ? 'text-red-800'
                        : formData.severity === 'major'
                        ? 'text-yellow-800'
                        : 'text-blue-800'
                    }`}>
                      {formData.severity} Severity
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
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <DxDateBox
                      value={formData.dueDate}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, dueDate: value || '' }))
                      }
                      min={new Date().toISOString().split('T')[0]}
                      placeholder="เลือกวันครบกำหนด"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Suggested Timeline
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                      {formData.severity === 'critical' && 'Critical: Resolve within 3 days'}
                      {formData.severity === 'major' && 'Major: Resolve within 14 days'}
                      {formData.severity === 'minor' && 'Minor: Resolve within 30 days'}
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
                <CardTitle className="text-sm">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DxButton
                  text={isSaving ? 'Creating...' : 'Report Deviation'}
                  icon="save"
                  type="success"
                  width="100%"
                  onClick={handleSubmit}
                  disabled={!formData.title || !formData.description || isSaving}
                />
                <DxButton
                  text="Cancel"
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
                  About Deviations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <p>
                    A deviation is any departure from approved procedures, specifications, or
                    established standards.
                  </p>
                  <p>
                    <strong>Report when:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-500">
                    <li>Process parameters outside limits</li>
                    <li>Equipment malfunction</li>
                    <li>Test results out of specification</li>
                    <li>Documentation errors</li>
                    <li>Environmental excursions</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Severity Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Severity Classification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertOctagon className="h-4 w-4 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Critical</p>
                      <p className="text-xs text-gray-500">
                        Direct impact on product safety, patient health, or regulatory compliance
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">Major</p>
                      <p className="text-xs text-gray-500">
                        Significant impact on product quality or process control
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Minor</p>
                      <p className="text-xs text-gray-500">
                        Limited impact, easily correctable, no direct quality effect
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
