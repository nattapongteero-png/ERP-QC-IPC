'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { PageHeader } from '@/components/ui/page-header';
import {
  ArrowLeft,
  Save,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      // API errors handled by global error handler
    } catch (error) {
      console.error('Failed to create deviation:', error);
      // API errors handled by global error handler
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
            <Button variant="ghost" size="sm" onClick={() => router.push('/quality/deviations')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          }
        />

        <form onSubmit={handleSubmit}>
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
                    <Input
                      label="Title *"
                      placeholder="Brief description of the deviation"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, title: e.target.value }))
                      }
                      required
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description *
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        rows={5}
                        placeholder="Provide detailed description of what happened, when, where, and any immediate actions taken..."
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, description: e.target.value }))
                        }
                        required
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
                    <Select
                      label="Source Type"
                      options={sourceTypeOptions}
                      value={formData.sourceType}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, sourceType: e.target.value }))
                      }
                    />
                    <Select
                      label="Severity *"
                      options={severityOptions}
                      value={formData.severity}
                      onChange={(e) => {
                        const newSeverity = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          severity: newSeverity,
                          dueDate: prev.dueDate || getDefaultDueDate(newSeverity),
                        }));
                      }}
                    />
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
                    <DatePicker
                      label="Due Date"
                      value={formData.dueDate}
                      onChange={(value) =>
                        setFormData((prev) => ({ ...prev, dueDate: value }))
                      }
                      min={new Date().toISOString().split('T')[0]}
                      showQuickActions={false}
                      size="sm"
                    />
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
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!formData.title || !formData.description || isSaving}
                    leftIcon={<Save className="h-4 w-4" />}
                  >
                    {isSaving ? 'Creating...' : 'Report Deviation'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => router.push('/quality/deviations')}
                  >
                    Cancel
                  </Button>
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
        </form>
      </div>
    </MainLayout>
  );
}
