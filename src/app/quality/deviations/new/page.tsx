'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

function NewDeviationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('quality');
  const [isSaving, setIsSaving] = useState(false);

  const sourceTypeOptions = [
    { value: '', label: t('deviations.new.sourceTypePlaceholder') },
    { value: 'production', label: t('deviations.source.production') },
    { value: 'quality', label: t('deviations.source.quality') },
    { value: 'warehouse', label: t('deviations.source.warehouse') },
  ];

  const severityOptions = [
    { value: 'minor', label: t('deviations.severity.minor') },
    { value: 'major', label: t('deviations.severity.major') },
    { value: 'critical', label: t('deviations.severity.critical') },
  ];

  // Pre-fill from query params. When a QC result is recorded as OOS/FAIL, the
  // QC entry page navigates here with title/description/severity/source filled
  // so the operator only has to confirm + submit the deviation. sourceId links
  // the deviation back to the originating record (e.g. the QC sample test).
  const sourceId = searchParams.get('sourceId');
  const [formData, setFormData] = useState({
    title: searchParams.get('title') ?? '',
    description: searchParams.get('description') ?? '',
    sourceType: searchParams.get('sourceType') ?? '',
    severity: searchParams.get('severity') ?? 'minor',
    dueDate: '',
  });

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert(t('deviations.new.titleRequired'));
      return;
    }

    if (!formData.description.trim()) {
      alert(t('deviations.new.descriptionRequired'));
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
          sourceId: sourceId ? Number(sourceId) : null,
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
        return t('deviations.new.severityDescription.critical');
      case 'major':
        return t('deviations.new.severityDescription.major');
      default:
        return t('deviations.new.severityDescription.minor');
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
              text={t('deviations.new.back')}
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
                <CardTitle>{t('deviations.new.detailsTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('deviations.new.titleLabel')} <span className="text-red-500">*</span>
                    </label>
                    <DxTextBox
                      placeholder={t('deviations.new.titlePlaceholder')}
                      value={formData.title}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, title: value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('deviations.new.descriptionLabel')} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      rows={5}
                      placeholder={t('deviations.new.descriptionPlaceholder')}
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
                <CardTitle>{t('deviations.new.classificationTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('deviations.new.sourceTypeLabel')}
                    </label>
                    <DxSelectBox
                      items={sourceTypeOptions}
                      value={formData.sourceType}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, sourceType: value }))
                      }
                      placeholder={t('deviations.new.sourceTypePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('deviations.new.severityLabel')} <span className="text-red-500">*</span>
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
                      {t('deviations.new.severityLevelLabel', { level: t(`deviations.severity.${formData.severity}`) })}
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
                <CardTitle>{t('deviations.new.timelineTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('deviations.new.dueDateLabel')}
                    </label>
                    <DxDateBox
                      value={formData.dueDate}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, dueDate: value || '' }))
                      }
                      min={toLocalDateStr(new Date())}
                      placeholder={t('deviations.new.dueDatePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('deviations.new.recommendedTimelineLabel')}
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                      {formData.severity === 'critical' && t('deviations.new.timeline.critical')}
                      {formData.severity === 'major' && t('deviations.new.timeline.major')}
                      {formData.severity === 'minor' && t('deviations.new.timeline.minor')}
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
                <CardTitle className="text-sm">{t('deviations.new.actionsTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DxButton
                  text={isSaving ? t('deviations.new.creating') : t('deviations.new.submit')}
                  icon="save"
                  type="success"
                  width="100%"
                  onClick={handleSubmit}
                  disabled={!formData.title || !formData.description || isSaving}
                />
                <DxButton
                  text={t('deviations.new.cancel')}
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
                  {t('deviations.new.help.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <p>
                    {t('deviations.new.help.definition')}
                  </p>
                  <p>
                    <strong>{t('deviations.new.help.reportWhen')}</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-500">
                    <li>{t('deviations.new.help.case1')}</li>
                    <li>{t('deviations.new.help.case2')}</li>
                    <li>{t('deviations.new.help.case3')}</li>
                    <li>{t('deviations.new.help.case4')}</li>
                    <li>{t('deviations.new.help.case5')}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Severity Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('deviations.new.severityGuide.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertOctagon className="h-4 w-4 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">{t('deviations.severity.critical')}</p>
                      <p className="text-xs text-gray-500">
                        {t('deviations.new.severityGuide.critical')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">{t('deviations.severity.major')}</p>
                      <p className="text-xs text-gray-500">
                        {t('deviations.new.severityGuide.major')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">{t('deviations.severity.minor')}</p>
                      <p className="text-xs text-gray-500">
                        {t('deviations.new.severityGuide.minor')}
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

function NewDeviationLoading() {
  const t = useTranslations('quality');
  return <div className="p-6 text-gray-500">{t('deviations.new.loading')}</div>;
}

export default function NewDeviationPage() {
  return (
    <Suspense fallback={<NewDeviationLoading />}>
      <NewDeviationForm />
    </Suspense>
  );
}
