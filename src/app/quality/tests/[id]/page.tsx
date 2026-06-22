'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { DispositionForm, type DispositionType } from '@/components/quality/disposition-form';
import { useToast } from '@/hooks/use-toast';

interface DispositionData {
  test: {
    id: number;
    testType: string;
    status: string;
    result: string | null;
    disposition: DispositionType | null;
    dispositionReason: string | null;
    dispositionAt: string | null;
    dispositionApprovedAt: string | null;
  };
  lot: {
    id: number;
    lotNumber: string;
    status: string;
  } | null;
  dispositionBy: {
    id: number;
    fullName: string;
  } | null;
  approvedBy: {
    id: number;
    fullName: string;
  } | null;
  signatures: Array<{
    id: number;
    action: string;
    fullName: string;
    signedAt: string;
    meaning: string;
  }>;
}

interface TestDetail {
  test: {
    id: number;
    testCode: string;
    testType: string;
    itemId: number;
    lotId: number;
    woId: number;
    specId: number;
    status: string;
    result: string;
    actualValue: string;
    testedBy: number;
    testedAt: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
  };
  item: {
    id: number;
    code: string;
    nameTh: string;
    nameEn: string;
    type: string;
    unit: string;
  } | null;
  lot: {
    id: number;
    lotNumber: string;
    quantity: number;
    status: string;
    expiryDate: string;
  } | null;
  workOrder: {
    id: number;
    woNumber: string;
    batchNumber: string;
    status: string;
  } | null;
  specification: {
    id: number;
    specCode: string;
    parameter: string;
    method: string;
    minValue: string;
    maxValue: string;
    targetValue: string;
    unit: string;
  } | null;
  tester: {
    id: number;
    name: string;
    email: string;
  } | null;
  analysis: {
    specCompliance: string | null;
    isWithinSpec: boolean;
  };
}

export default function QualityTestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('quality');
  const toast = useToast();

  const resultOptions = [
    { value: '', label: t('tests.detail.resultPlaceholder') },
    { value: 'pass', label: t('tests.status.pass') },
    { value: 'fail', label: t('tests.status.fail') },
    { value: 'retest', label: t('tests.detail.resultRetest') },
  ];
  const [data, setData] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    actualValue: '',
    result: '',
    notes: '',
  });
  const [dispositionData, setDispositionData] = useState<DispositionData | null>(null);

  useEffect(() => {
    fetchTestDetail();
    fetchDispositionDetails();
  }, [params.id]);

  const fetchTestDetail = async () => {
    try {
      const response = await fetch(`/api/quality/tests/${params.id}/detail`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setEditForm({
          actualValue: result.data.test.actualValue || '',
          result: result.data.test.result || '',
          notes: result.data.test.notes || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch test detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDispositionDetails = async () => {
    try {
      const response = await fetch(`/api/quality/tests/${params.id}/disposition`);
      const result = await response.json();
      if (result.success) {
        setDispositionData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch disposition details:', error);
    }
  };

  const handleSetDisposition = useCallback(
    async (
      disposition: DispositionType,
      reason: string,
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/quality/tests/${params.id}/disposition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disposition, reason, password }),
        });
        const result = await response.json();
        if (result.success) {
          toast.success(t('tests.detail.dispositionSaved'));
          fetchDispositionDetails();
          fetchTestDetail();
          return { success: true };
        }
        return { success: false, error: result.error };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
    [params.id]
  );

  const handleApproveDisposition = useCallback(
    async (
      password: string,
      notes?: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/quality/tests/${params.id}/disposition/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, approvalNotes: notes }),
        });
        const result = await response.json();
        if (result.success) {
          toast.success(
            result.data.lotStatusUpdated
              ? t('tests.detail.dispositionApprovedWithLot', { status: result.data.newLotStatus })
              : t('tests.detail.dispositionApproved')
          );
          fetchDispositionDetails();
          fetchTestDetail();
          return { success: true };
        }
        return { success: false, error: result.error };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
    [params.id]
  );

  const handleSubmitResult = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/quality/tests/${params.id}/result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const result = await response.json();
      if (result.success) {
        setIsEditing(false);
        fetchTestDetail();
      }
    } catch (error) {
      console.error('Failed to submit result:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusVariant = (status: string): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (status) {
      case 'pass': case 'completed': case 'released': return 'primary';
      case 'fail': case 'rejected': return 'danger';
      case 'pending': case 'in_progress': return 'secondary';
      default: return 'default';
    }
  };

  const getTestTypeLabel = (type: string): string => {
    const keys: Record<string, string> = {
      'incoming': 'tests.detail.type.incoming',
      'in_process': 'tests.detail.type.in_process',
      'finished': 'tests.detail.type.finished',
      'stability': 'tests.detail.type.stability',
      'release': 'tests.detail.type.release',
    };
    return keys[type] ? t(keys[type]) : type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <DxLoadIndicator />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('tests.detail.notFound')}</p>
        <DxButton
          text={t('page.title')}
          type="normal"
          stylingMode="outlined"
          className="mt-4"
          onClick={() => router.push('/quality')}
        />
      </div>
    );
  }

  const { test, item, lot, workOrder, specification, tester, analysis } = data;

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <DxButton
                text={t('tests.detail.back')}
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/quality')}
              />
              <h1 className="text-2xl font-bold text-gray-900">QC Test: {test.testCode}</h1>
              <Badge variant={getStatusVariant(test.status)}>
                {test.status}
              </Badge>
              {test.result && (
                <Badge variant={getStatusVariant(test.result)}>
                  {test.result.toUpperCase()}
                </Badge>
              )}
            </div>
            <p className="text-gray-600 mt-1">{getTestTypeLabel(test.testType)}</p>
          </div>
          <div className="flex gap-2">
            {test.status === 'pending' && !isEditing && (
              <DxButton
                text={t('tests.detail.enterResult')}
                type="default"
                onClick={() => setIsEditing(true)}
              />
            )}
            {isEditing && (
              <>
                <DxButton
                  text={t('tests.detail.cancel')}
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setIsEditing(false)}
                />
                <DxButton
                  text={isSaving ? t('tests.detail.saving') : t('tests.detail.saveResult')}
                  type="success"
                  onClick={handleSubmitResult}
                  disabled={isSaving}
                />
              </>
            )}
            <DxButton
              text={t('tests.detail.printReport')}
              icon="print"
              type="normal"
              stylingMode="outlined"
              onClick={() => window.print()}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">{t('tests.detail.cards.status')}</p>
                <Badge variant={getStatusVariant(test.status)} className="text-lg mt-1">
                  {test.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">{t('tests.detail.cards.result')}</p>
                {test.result ? (
                  <Badge variant={getStatusVariant(test.result)} className="text-lg mt-1">
                    {test.result.toUpperCase()}
                  </Badge>
                ) : (
                  <p className="text-lg font-bold text-gray-400 mt-1">{t('tests.detail.cards.pending')}</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">{t('tests.detail.cards.measuredValue')}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {test.actualValue || '-'}
                </p>
                {specification?.unit && <p className="text-xs text-gray-500">{specification.unit}</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">{t('tests.detail.cards.specCompliance')}</p>
                {analysis.specCompliance ? (
                  <Badge variant={getStatusVariant(analysis.specCompliance)} className="text-lg mt-1">
                    {analysis.isWithinSpec ? t('tests.detail.cards.withinSpec') : t('tests.detail.cards.outOfSpec')}
                  </Badge>
                ) : (
                  <p className="text-lg font-bold text-gray-400 mt-1">{t('tests.detail.cards.noData')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Test Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('tests.detail.testInfo.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">{t('tests.detail.testInfo.testCode')}</dt>
                  <dd className="font-medium">{test.testCode}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">{t('tests.detail.testInfo.testType')}</dt>
                  <dd className="font-medium">{getTestTypeLabel(test.testType)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">{t('tests.detail.testInfo.testedBy')}</dt>
                  <dd className="font-medium">{tester?.name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">{t('tests.detail.testInfo.testedAt')}</dt>
                  <dd className="font-medium">
                    {test.testedAt ? new Date(test.testedAt).toLocaleString('th-TH') : '-'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sm text-gray-500">{t('tests.detail.testInfo.notes')}</dt>
                  <dd className="font-medium">{test.notes || '-'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Specification */}
          <Card>
            <CardHeader>
              <CardTitle>{t('tests.detail.spec.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {specification ? (
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">{t('tests.detail.spec.specCode')}</dt>
                    <dd className="font-medium">{specification.specCode}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('tests.detail.spec.parameter')}</dt>
                    <dd className="font-medium">{specification.parameter}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('tests.detail.spec.method')}</dt>
                    <dd className="font-medium">{specification.method || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('tests.detail.spec.unit')}</dt>
                    <dd className="font-medium">{specification.unit || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('tests.detail.spec.minValue')}</dt>
                    <dd className="font-medium">{specification.minValue || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('tests.detail.spec.maxValue')}</dt>
                    <dd className="font-medium">{specification.maxValue || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('tests.detail.spec.targetValue')}</dt>
                    <dd className="font-medium">{specification.targetValue || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('tests.detail.spec.measuredValue')}</dt>
                    <dd className={`font-medium ${analysis.isWithinSpec ? 'text-green-600' : 'text-red-600'}`}>
                      {test.actualValue || '-'}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-gray-500">{t('tests.detail.spec.none')}</p>
              )}
            </CardContent>
          </Card>

          {/* Sample Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('tests.detail.sampleInfo.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                {item && (
                  <>
                    <div>
                      <dt className="text-sm text-gray-500">{t('tests.detail.sampleInfo.itemCode')}</dt>
                      <dd className="font-medium">{item.code}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">{t('tests.detail.sampleInfo.itemName')}</dt>
                      <dd className="font-medium">{item.nameTh}</dd>
                    </div>
                  </>
                )}
                {lot && (
                  <>
                    <div>
                      <dt className="text-sm text-gray-500">{t('tests.detail.sampleInfo.lotNumber')}</dt>
                      <dd className="font-medium text-blue-600 cursor-pointer" onClick={() => router.push(`/inventory/lots/${lot.id}`)}>
                        {lot.lotNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">{t('tests.detail.sampleInfo.lotStatus')}</dt>
                      <dd><Badge variant={getStatusVariant(lot.status)}>{lot.status}</Badge></dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">{t('tests.detail.sampleInfo.expiryDate')}</dt>
                      <dd className="font-medium">
                        {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('th-TH') : '-'}
                      </dd>
                    </div>
                  </>
                )}
                {workOrder && (
                  <>
                    <div>
                      <dt className="text-sm text-gray-500">{t('tests.detail.sampleInfo.workOrder')}</dt>
                      <dd className="font-medium text-blue-600 cursor-pointer" onClick={() => router.push(`/production/work-orders/${workOrder.id}`)}>
                        {workOrder.woNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">{t('tests.detail.sampleInfo.batchNumber')}</dt>
                      <dd className="font-medium">{workOrder.batchNumber || '-'}</dd>
                    </div>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Result Entry Form */}
          {isEditing && (
            <Card>
              <CardHeader>
                <CardTitle>{t('tests.detail.resultForm.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('tests.detail.resultForm.measuredValueLabel')} {specification?.unit && `(${specification.unit})`}
                    </label>
                    <DxTextBox
                      value={editForm.actualValue}
                      onValueChange={(value) => setEditForm({ ...editForm, actualValue: value })}
                      placeholder={specification ? t('tests.detail.resultForm.rangePlaceholder', { min: specification.minValue || '-', max: specification.maxValue || '-' }) : t('tests.detail.resultForm.valuePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('tests.detail.resultForm.resultLabel')}</label>
                    <DxSelectBox
                      items={resultOptions}
                      value={editForm.result}
                      onValueChange={(value) => setEditForm({ ...editForm, result: value })}
                      valueExpr="value"
                      displayExpr="label"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('tests.detail.resultForm.notesLabel')}</label>
                    <DxTextArea
                      value={editForm.notes}
                      onValueChange={(value) => setEditForm({ ...editForm, notes: value })}
                      placeholder={t('tests.detail.resultForm.notesPlaceholder')}
                      height={80}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Disposition Section - FR-067, FR-068, FR-069, FR-070 */}
        {test.result && (test.result === 'fail' || test.result === 'failed') && (
          <div className="mt-6">
            <DispositionForm
              testId={test.id}
              testType={getTestTypeLabel(test.testType)}
              testResult={test.result}
              lotNumber={lot?.lotNumber}
              itemName={item?.nameEn || item?.nameTh}
              initialData={dispositionData?.test ? {
                disposition: dispositionData.test.disposition,
                dispositionReason: dispositionData.test.dispositionReason,
                dispositionAt: dispositionData.test.dispositionAt,
                dispositionApprovedAt: dispositionData.test.dispositionApprovedAt,
              } : undefined}
              status={
                dispositionData?.test?.dispositionApprovedAt
                  ? 'approved'
                  : dispositionData?.test?.disposition
                  ? 'dispositioned'
                  : 'pending'
              }
              dispositionByName={dispositionData?.dispositionBy?.fullName}
              approvedByName={dispositionData?.approvedBy?.fullName}
              onSetDisposition={handleSetDisposition}
              onApprove={handleApproveDisposition}
              canDisposition={!dispositionData?.test?.disposition}
              canApprove={!!dispositionData?.test?.disposition && !dispositionData?.test?.dispositionApprovedAt}
              readOnly={!!dispositionData?.test?.dispositionApprovedAt}
            />
          </div>
        )}
      </div>
  );
}
