'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTabs, DxTabItem } from '@/components/ui/dx-tabs';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';

interface DeviationDetail {
  deviation: {
    id: number;
    deviationCode: string;
    title: string;
    description: string;
    type: string;
    severity: string;
    status: string;
    itemId: number;
    lotId: number;
    woId: number;
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

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'verified', label: 'Verified' },
  { value: 'closed', label: 'Closed' },
];

export default function DeviationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('quality');
  const [data, setData] = useState<DeviationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    rootCause: '',
    correctiveAction: '',
    preventiveAction: '',
    status: '',
  });

  const tabs: DxTabItem[] = [
    { text: 'Overview', icon: 'chart' },
    { text: 'Investigation', icon: 'search' },
    { text: 'CAPA', icon: 'checklist' },
    { text: 'History', icon: 'clock' },
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

  const getStatusVariant = (status: string): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (status) {
      case 'closed': case 'verified': return 'primary';
      case 'open': case 'in_progress': return 'secondary';
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
    const labels: Record<string, string> = {
      'process': 'Process Deviation',
      'product': 'Product Deviation',
      'equipment': 'Equipment Deviation',
      'documentation': 'Documentation Deviation',
      'environmental': 'Environmental Deviation',
      'other': 'Other',
    };
    return labels[type] || type;
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
          <p className="text-gray-500">Deviation not found</p>
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

  const { deviation, item, lot, workOrder, reporter, assignee, metrics } = data;

  return (
    
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <DxButton
                text="Back"
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/quality')}
              />
              <h1 className="text-2xl font-bold text-gray-900">{deviation.deviationCode}</h1>
              <Badge variant={getStatusVariant(deviation.status)}>
                {deviation.status}
              </Badge>
              <Badge variant={getSeverityVariant(deviation.severity)}>
                {deviation.severity}
              </Badge>
              {metrics.isOverdue && (
                <Badge variant="danger">OVERDUE</Badge>
              )}
            </div>
            <p className="text-gray-600 mt-1">{deviation.title}</p>
          </div>
          <div className="flex gap-2">
            {!isEditing && deviation.status !== 'closed' && (
              <DxButton
                text="Update CAPA"
                type="default"
                onClick={() => setIsEditing(true)}
              />
            )}
            {isEditing && (
              <>
                <DxButton
                  text="Cancel"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setIsEditing(false)}
                />
                <DxButton
                  text="Save"
                  type="success"
                  onClick={handleSave}
                />
              </>
            )}
            <DxButton
              text="Print Report"
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
                <p className="text-sm text-gray-600">Status</p>
                <Badge variant={getStatusVariant(deviation.status)} className="text-lg mt-1">
                  {deviation.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Severity</p>
                <Badge variant={getSeverityVariant(deviation.severity)} className="text-lg mt-1">
                  {deviation.severity}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Days Open</p>
                <p className={`text-2xl font-bold ${metrics.isOverdue ? 'text-red-600' : 'text-blue-600'}`}>
                  {metrics.daysOpen}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Due Date</p>
                <p className={`text-lg font-bold ${metrics.isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                  {deviation.dueDate ? new Date(deviation.dueDate).toLocaleDateString('th-TH') : '-'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alert */}
        {metrics.isOverdue && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-red-800">Deviation Overdue</p>
              <p className="text-sm text-red-600">
                This deviation has passed its due date. Please take immediate action to resolve it.
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
                <CardTitle>Deviation Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">Deviation Code</dt>
                    <dd className="font-medium">{deviation.deviationCode}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Type</dt>
                    <dd className="font-medium">{getTypeLabel(deviation.type)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">Title</dt>
                    <dd className="font-medium">{deviation.title}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">Description</dt>
                    <dd className="font-medium">{deviation.description || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Reported By</dt>
                    <dd className="font-medium">{reporter?.name || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Reported Date</dt>
                    <dd className="font-medium">
                      {deviation.createdAt ? new Date(deviation.createdAt).toLocaleDateString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Assigned To</dt>
                    <dd className="font-medium">{assignee?.name || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Due Date</dt>
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
                <CardTitle>Related Records</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  {item && (
                    <>
                      <div>
                        <dt className="text-sm text-gray-500">Item Code</dt>
                        <dd className="font-medium">{item.code}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Item Name</dt>
                        <dd className="font-medium">{item.nameTh}</dd>
                      </div>
                    </>
                  )}
                  {lot && (
                    <>
                      <div>
                        <dt className="text-sm text-gray-500">Lot Number</dt>
                        <dd className="font-medium text-blue-600 cursor-pointer" onClick={() => router.push(`/inventory/lots/${lot.id}`)}>
                          {lot.lotNumber}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Lot Status</dt>
                        <dd><Badge variant={getStatusVariant(lot.status)}>{lot.status}</Badge></dd>
                      </div>
                    </>
                  )}
                  {workOrder && (
                    <>
                      <div>
                        <dt className="text-sm text-gray-500">Work Order</dt>
                        <dd className="font-medium text-blue-600 cursor-pointer" onClick={() => router.push(`/production/work-orders/${workOrder.id}`)}>
                          {workOrder.woNumber}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Batch Number</dt>
                        <dd className="font-medium">{workOrder.batchNumber || '-'}</dd>
                      </div>
                    </>
                  )}
                  {!item && !lot && !workOrder && (
                    <div className="col-span-2">
                      <p className="text-gray-500">No related records</p>
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
              <CardTitle>Root Cause Investigation</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Root Cause Analysis</label>
                    <DxTextArea
                      value={editForm.rootCause}
                      onValueChange={(value) => setEditForm({ ...editForm, rootCause: value })}
                      placeholder="Describe the root cause analysis using 5-Why or Fishbone diagram methodology..."
                      height={150}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Root Cause Analysis</h4>
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {deviation.rootCause || 'No root cause analysis documented yet.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTabIndex === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Corrective Action */}
            <Card>
              <CardHeader>
                <CardTitle>Corrective Action (CA)</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <DxTextArea
                    value={editForm.correctiveAction}
                    onValueChange={(value) => setEditForm({ ...editForm, correctiveAction: value })}
                    placeholder="Describe the corrective actions taken to address the immediate issue..."
                    height={150}
                  />
                ) : (
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {deviation.correctiveAction || 'No corrective action documented yet.'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Preventive Action */}
            <Card>
              <CardHeader>
                <CardTitle>Preventive Action (PA)</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <DxTextArea
                    value={editForm.preventiveAction}
                    onValueChange={(value) => setEditForm({ ...editForm, preventiveAction: value })}
                    placeholder="Describe the preventive actions to prevent recurrence..."
                    height={150}
                  />
                ) : (
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {deviation.preventiveAction || 'No preventive action documented yet.'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Status Update */}
            {isEditing && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Update Status</CardTitle>
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
              <CardTitle>Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Deviation Created</p>
                    <p className="text-sm text-gray-500">
                      {deviation.createdAt ? new Date(deviation.createdAt).toLocaleString('th-TH') : '-'}
                    </p>
                    <p className="text-sm text-gray-600">Created by {reporter?.name || 'Unknown'}</p>
                  </div>
                </div>
                {deviation.closedAt && (
                  <div className="flex gap-4 items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Deviation Closed</p>
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
