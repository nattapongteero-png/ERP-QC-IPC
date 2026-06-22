'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { StatusStepper } from '@/components/shared';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTabs, DxTabItem } from '@/components/ui/dx-tabs';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';

interface DeviationDetail {
  deviation: {
    id: number;
    deviationNumber: string;
    title: string;
    description: string;
    type: string;
    severity: string;
    status: string;
    lotId: number;
    workOrderId: number;
    reportedBy: number;
    assignedTo: number;
    rootCause: string;
    correctiveAction: string;
    preventiveAction: string;
    dueDate: string;
    closedAt: string;
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
  reporter: {
    id: number;
    name: string;
    email: string;
  } | null;
  assignee: {
    id: number;
    name: string;
    email: string;
  } | null;
  metrics: {
    daysOpen: number;
    isOverdue: boolean;
  };
}

export default function DeviationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('quality');

  const statusOptions = [
    { value: 'open', label: t('deviations.status.open') },
    { value: 'investigating', label: t('deviations.status.investigating') },
    { value: 'resolved', label: t('deviations.status.resolved') },
    { value: 'closed', label: t('deviations.status.closed') },
  ];
  const [data, setData] = useState<DeviationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    rootCause: '',
    correctiveAction: '',
    preventiveAction: '',
    status: '',
  });

  const tabs: DxTabItem[] = [
    { text: t('deviations.detail.tabs.overview'), icon: 'chart' },
    { text: t('deviations.detail.tabs.investigation'), icon: 'search' },
    { text: 'CAPA', icon: 'checklist' },
    { text: t('deviations.detail.tabs.history'), icon: 'clock' },
  ];

  useEffect(() => {
    fetchDeviationDetail();
  }, [params.id]);

  const fetchDeviationDetail = async () => {
    try {
      const response = await fetch(`/api/quality/deviations/${params.id}/detail`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setEditForm({
          rootCause: result.data.deviation.rootCause || '',
          correctiveAction: result.data.deviation.correctiveAction || '',
          preventiveAction: result.data.deviation.preventiveAction || '',
          status: result.data.deviation.status || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch deviation detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/quality/deviations/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootCause: editForm.rootCause,
          correctiveAction: editForm.correctiveAction,
          preventiveAction: editForm.preventiveAction,
          status: editForm.status,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setIsEditing(false);
        fetchDeviationDetail();
      }
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  // Delete a mistaken / test deviation — only allowed while status === 'open'.
  // The API enforces the same guard server-side.
  const handleDelete = async () => {
    if (!window.confirm(t('deviations.detail.deleteConfirm'))) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/quality/deviations/${params.id}`, {
        method: 'DELETE',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || t('deviations.detail.deleteFailed'));
      }
      router.push('/quality/deviations');
    } catch (err) {
      alert(err instanceof Error ? err.message : t('deviations.detail.deleteFailed'));
      setDeleting(false);
    }
  };

  const getStatusVariant = (status: string): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (status) {
      case 'closed': case 'resolved': return 'primary';
      case 'open': case 'investigating': return 'secondary';
      case 'overdue': return 'danger';
      default: return 'default';
    }
  };

  const getSeverityVariant = (severity: string): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'major': return 'secondary';
      case 'minor': return 'default';
      default: return 'default';
    }
  };

  const getTypeLabel = (type: string): string => {
    const keys: Record<string, string> = {
      'process': 'deviations.detail.type.process',
      'product': 'deviations.detail.type.product',
      'equipment': 'deviations.detail.type.equipment',
      'documentation': 'deviations.detail.type.documentation',
      'environmental': 'deviations.detail.type.environmental',
      'other': 'deviations.detail.type.other',
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
          <p className="text-gray-500">{t('deviations.detail.notFound')}</p>
          <DxButton
            text={t('page.title')}
            type="normal"
            stylingMode="outlined"
            className="mt-4"
            onClick={() => router.push('/quality/deviations')}
          />
        </div>
      
    );
  }

  const { deviation, item, lot, workOrder, reporter, assignee, metrics } = data;

  return (
    
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <DxButton
                text={t('deviations.detail.back')}
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/quality/deviations')}
              />
              <h1 className="text-2xl font-bold text-gray-900">{deviation.deviationNumber}</h1>
              <Badge variant={getStatusVariant(deviation.status)}>
                {t(`deviations.status.${deviation.status}`)}
              </Badge>
              <Badge variant={getSeverityVariant(deviation.severity)}>
                {t(`deviations.severity.${deviation.severity}`)}
              </Badge>
              {metrics.isOverdue && (
                <Badge variant="danger">{t('deviations.detail.overdueBadge')}</Badge>
              )}
            </div>
            <p className="text-gray-600 mt-1">{deviation.title}</p>
          </div>
          <div className="flex gap-2">
            {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
            {!isEditing && deviation.status !== 'closed' && (
              <DxButton
                text={t('deviations.detail.updateCapa')}
                type="default"
                onClick={() => setIsEditing(true)}
              />
            )}
            {isEditing && (
              <>
                <DxButton
                  text={t('deviations.detail.cancel')}
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setIsEditing(false)}
                />
                <DxButton
                  text={t('deviations.detail.save')}
                  type="success"
                  onClick={handleSave}
                />
              </>
            )}
            <DxButton
              text={t('deviations.detail.printReport')}
              icon="print"
              type="normal"
              stylingMode="outlined"
              onClick={() => window.print()}
            />
            {/* Delete only offered while still "open" (typo / test entry). */}
            {!isEditing && deviation.status === 'open' && (
              <DxButton
                text={t('deviations.detail.delete')}
                icon="trash"
                type="danger"
                stylingMode="outlined"
                disabled={deleting}
                onClick={handleDelete}
                elementAttr={{ 'data-testid': 'deviation-delete-btn' }}
              />
            )}
          </div>
        </div>

        {/* Workflow status — สถานะการดำเนินงาน */}
        <StatusStepper
          title={t('deviations.detail.workflowStatus')}
          current={deviation.status}
          steps={[
            { key: 'open', label: t('deviations.status.open') },
            { key: 'investigating', label: t('deviations.status.investigating') },
            { key: 'resolved', label: t('deviations.status.resolved') },
            { key: 'closed', label: t('deviations.status.closed') },
          ]}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">{t('deviations.detail.cards.status')}</p>
              <Badge variant={getStatusVariant(deviation.status)} className="text-lg mt-1">
                {t(`deviations.status.${deviation.status}`)}
              </Badge>
            </div>
          </div>
          <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">{t('deviations.detail.cards.severity')}</p>
              <Badge variant={getSeverityVariant(deviation.severity)} className="text-lg mt-1">
                {t(`deviations.severity.${deviation.severity}`)}
              </Badge>
            </div>
          </div>
          <div className={`bg-white border border-gray-200 border-l-4 ${metrics.isOverdue ? 'border-l-rose-500' : 'border-l-blue-500'} rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4`}>
            <div className="text-center">
              <p className="text-sm text-gray-500">{t('deviations.detail.cards.daysOpen')}</p>
              <p className={`text-2xl font-bold ${metrics.isOverdue ? 'text-rose-500' : 'text-gray-900'}`}>
                {metrics.daysOpen}
              </p>
            </div>
          </div>
          <div className={`bg-white border border-gray-200 border-l-4 ${metrics.isOverdue ? 'border-l-rose-500' : 'border-l-gray-500'} rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4`}>
            <div className="text-center">
              <p className="text-sm text-gray-500">{t('deviations.detail.cards.dueDate')}</p>
              <p className={`text-lg font-bold ${metrics.isOverdue ? 'text-rose-500' : 'text-gray-900'}`}>
                {deviation.dueDate ? new Date(deviation.dueDate).toLocaleDateString('th-TH') : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Overdue Alert */}
        {metrics.isOverdue && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-red-800">{t('deviations.detail.overdueAlert.title')}</p>
              <p className="text-sm text-red-600">
                {t('deviations.detail.overdueAlert.message')}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <DxTabs
          items={tabs}
          selectedIndex={activeTabIndex}
          onItemClick={(e) => setActiveTabIndex(e.itemIndex || 0)}
        />

        {/* Tab Content */}
        {activeTabIndex === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deviation Info */}
            <Card>
              <CardHeader>
                <CardTitle>{t('deviations.detail.info.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">{t('deviations.detail.info.number')}</dt>
                    <dd className="font-medium">{deviation.deviationNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('deviations.detail.info.type')}</dt>
                    <dd className="font-medium">{getTypeLabel(deviation.type)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">{t('deviations.detail.info.titleField')}</dt>
                    <dd className="font-medium">{deviation.title}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">{t('deviations.detail.info.description')}</dt>
                    <dd className="font-medium">{deviation.description || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('deviations.detail.info.reportedBy')}</dt>
                    <dd className="font-medium">{reporter?.name || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('deviations.detail.info.reportedDate')}</dt>
                    <dd className="font-medium">
                      {deviation.createdAt ? new Date(deviation.createdAt).toLocaleDateString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('deviations.detail.info.assignedTo')}</dt>
                    <dd className="font-medium">{assignee?.name || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">{t('deviations.detail.info.dueDate')}</dt>
                    <dd className={`font-medium ${metrics.isOverdue ? 'text-red-600' : ''}`}>
                      {deviation.dueDate ? new Date(deviation.dueDate).toLocaleDateString('th-TH') : '-'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Related Records */}
            <Card>
              <CardHeader>
                <CardTitle>{t('deviations.detail.related.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  {item && (
                    <>
                      <div>
                        <dt className="text-sm text-gray-500">{t('deviations.detail.related.itemCode')}</dt>
                        <dd className="font-medium">{item.code}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">{t('deviations.detail.related.itemName')}</dt>
                        <dd className="font-medium">{item.nameTh}</dd>
                      </div>
                    </>
                  )}
                  {lot && (
                    <>
                      <div>
                        <dt className="text-sm text-gray-500">{t('deviations.detail.related.lotNumber')}</dt>
                        <dd className="font-medium text-blue-600 cursor-pointer" onClick={() => router.push(`/inventory/lots/${lot.id}`)}>
                          {lot.lotNumber}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">{t('deviations.detail.related.lotStatus')}</dt>
                        <dd><Badge variant={getStatusVariant(lot.status)}>{lot.status}</Badge></dd>
                      </div>
                    </>
                  )}
                  {workOrder && (
                    <>
                      <div>
                        <dt className="text-sm text-gray-500">{t('deviations.detail.related.workOrder')}</dt>
                        <dd className="font-medium text-blue-600 cursor-pointer" onClick={() => router.push(`/production/work-orders/${workOrder.id}`)}>
                          {workOrder.woNumber}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">{t('deviations.detail.related.batchNumber')}</dt>
                        <dd className="font-medium">{workOrder.batchNumber || '-'}</dd>
                      </div>
                    </>
                  )}
                  {!item && !lot && !workOrder && (
                    <div className="col-span-2">
                      <p className="text-gray-500">{t('deviations.detail.related.none')}</p>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTabIndex === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('deviations.detail.investigation.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('deviations.detail.investigation.rootCauseLabel')}</label>
                    <DxTextArea
                      value={editForm.rootCause}
                      onValueChange={(value) => setEditForm({ ...editForm, rootCause: value })}
                      placeholder={t('deviations.detail.investigation.rootCausePlaceholder')}
                      height={150}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">{t('deviations.detail.investigation.rootCauseLabel')}</h4>
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {deviation.rootCause || t('deviations.detail.investigation.rootCauseEmpty')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTabIndex === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create formal CAPA record from this deviation */}
            <div className="lg:col-span-2 bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-medium text-indigo-900">{t('deviations.detail.capa.createTitle')}</p>
                <p className="text-sm text-indigo-700">
                  {t('deviations.detail.capa.createDescription')}
                </p>
              </div>
              <DxButton
                text={t('deviations.detail.capa.createButton')}
                icon="plus"
                type="default"
                elementAttr={{ 'data-testid': 'create-capa-from-deviation' }}
                onClick={() =>
                  router.push(
                    `/gmp/capa/new?deviationId=${deviation.id}&deviationNumber=${encodeURIComponent(deviation.deviationNumber)}`
                  )
                }
              />
            </div>

            {/* Corrective Action */}
            <Card>
              <CardHeader>
                <CardTitle>{t('deviations.detail.capa.correctiveTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <DxTextArea
                    value={editForm.correctiveAction}
                    onValueChange={(value) => setEditForm({ ...editForm, correctiveAction: value })}
                    placeholder={t('deviations.detail.capa.correctivePlaceholder')}
                    height={150}
                  />
                ) : (
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {deviation.correctiveAction || t('deviations.detail.capa.correctiveEmpty')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Preventive Action */}
            <Card>
              <CardHeader>
                <CardTitle>{t('deviations.detail.capa.preventiveTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <DxTextArea
                    value={editForm.preventiveAction}
                    onValueChange={(value) => setEditForm({ ...editForm, preventiveAction: value })}
                    placeholder={t('deviations.detail.capa.preventivePlaceholder')}
                    height={150}
                  />
                ) : (
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {deviation.preventiveAction || t('deviations.detail.capa.preventiveEmpty')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Status Update */}
            {isEditing && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>{t('deviations.detail.capa.statusUpdateTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-w-xs">
                    <DxSelectBox
                      items={statusOptions}
                      value={editForm.status}
                      onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                      valueExpr="value"
                      displayExpr="label"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTabIndex === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('deviations.detail.history.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">{t('deviations.detail.history.created')}</p>
                    <p className="text-sm text-gray-500">
                      {deviation.createdAt ? new Date(deviation.createdAt).toLocaleString('th-TH') : '-'}
                    </p>
                    <p className="text-sm text-gray-600">{t('deviations.detail.history.createdBy', { name: reporter?.name || t('deviations.detail.history.unknown') })}</p>
                  </div>
                </div>
                {deviation.closedAt && (
                  <div className="flex gap-4 items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">{t('deviations.detail.history.closed')}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(deviation.closedAt).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    
  );
}
