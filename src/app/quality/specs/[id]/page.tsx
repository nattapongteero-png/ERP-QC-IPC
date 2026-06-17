'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  ArrowLeft,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FlaskConical,
  Package,
  Save,
  X,
} from 'lucide-react';

interface QualitySpecDetail {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string;
  isCritical: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  recentTests: {
    id: number;
    testType: string;
    sampleNumber: string;
    testDate: string;
    result: string;
    numericResult: number | null;
    status: string;
    specMinValue?: number | null;
    specMaxValue?: number | null;
    specSpecification?: string | null;
    specUnit?: string | null;
    createdAt: string;
  }[];
  stats: {
    totalTests: number;
    passCount: number;
    failCount: number;
    pendingCount: number;
    retestCount: number;
  };
}

export default function QualitySpecDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('quality');
  const id = params.id as string;

  const [spec, setSpec] = useState<QualitySpecDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [editForm, setEditForm] = useState({
    testName: '',
    testMethod: '',
    specification: '',
    minValue: null as number | null,
    maxValue: null as number | null,
    unit: '',
    isCritical: false,
  });

  const fetchSpec = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/quality/specs/${id}`);
      const data = await res.json();

      if (data.success) {
        setSpec(data.data);
        setEditForm({
          testName: data.data.testName || '',
          testMethod: data.data.testMethod || '',
          specification: data.data.specification || '',
          minValue: data.data.minValue,
          maxValue: data.data.maxValue,
          unit: data.data.unit || '',
          isCritical: data.data.isCritical || false,
        });
      } else {
        console.error('API error:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch spec:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchSpec();
    }
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/quality/specs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditing(false);
        fetchSpec();
      }
    } catch (error) {
      console.error('Failed to update spec:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!spec) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/quality/specs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !spec.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSpec();
      }
    } catch (error) {
      console.error('Failed to toggle status:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/quality/specs/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        router.push('/quality/specs');
      } else {
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      console.error('Failed to delete spec:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeVariant = (status: string): 'primary' | 'danger' | 'warning' | 'default' => {
    switch (status) {
      case 'pass':
        return 'primary';
      case 'fail':
        return 'danger';
      case 'retest':
        return 'warning';
      default:
        return 'default';
    }
  };

  const testColumns: DxDataGridColumn[] = [
    {
      dataField: 'testType',
      caption: 'ประเภท',
      width: 100,
      cellRender: (cellInfo) => (
        <Badge variant="secondary" size="sm">
          {cellInfo.data.testType}
        </Badge>
      ),
    },
    {
      dataField: 'sampleNumber',
      caption: 'ตัวอย่าง',
      cellRender: (cellInfo) => cellInfo.data.sampleNumber || '-',
    },
    {
      dataField: 'result',
      caption: 'ผลลัพธ์',
      cellRender: (cellInfo) => (
        <span className="font-medium">
          {cellInfo.data.numericResult !== null ? cellInfo.data.numericResult : cellInfo.data.result || '-'}
        </span>
      ),
    },
    {
      dataField: 'specMinValue',
      caption: 'ช่วงข้อกำหนด (ณ เวลาทดสอบ)',
      cellRender: (cellInfo) => {
        const d = cellInfo.data;
        const min = d.specMinValue ?? spec?.minValue;
        const max = d.specMaxValue ?? spec?.maxValue;
        const unit = d.specUnit ?? spec?.unit ?? '';
        const hasSnapshot = d.specMinValue !== null && d.specMinValue !== undefined;
        if (min === null && max === null) return <span className="text-gray-400">-</span>;
        return (
          <span className={`text-xs ${hasSnapshot ? 'text-gray-700' : 'text-amber-600 italic'}`}>
            {min !== null && min !== undefined ? min : '—'} ~ {max !== null && max !== undefined ? max : '—'} {unit}
            {!hasSnapshot && <span title="ใช้ค่าปัจจุบัน (ไม่มี snapshot)"> *</span>}
          </span>
        );
      },
    },
    {
      dataField: 'testDate',
      caption: 'วันที่ทดสอบ',
      cellRender: (cellInfo) => formatDate(cellInfo.data.testDate),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      cellRender: (cellInfo) => (
        <Badge variant={getStatusBadgeVariant(cellInfo.data.status)} dot size="sm">
          {cellInfo.data.status}
        </Badge>
      ),
    },
  ];

  if (isLoading) {
    return (
      
        <div className="flex items-center justify-center h-64">
          <DxLoadIndicator />
        </div>
      
    );
  }

  if (!spec) {
    return (
      
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">ไม่พบข้อกำหนด</h2>
          <p className="text-gray-500 mt-2">ไม่มีข้อกำหนดที่คุณกำลังค้นหา</p>
          <DxButton
            text="กลับไปหน้าข้อกำหนด"
            type="normal"
            stylingMode="outlined"
            className="mt-4"
            onClick={() => router.push('/quality/specs')}
          />
        </div>
      
    );
  }

  return (
    
      <div className="space-y-6">
        <PageHeader
          title={`${t('specifications.title')}: ${spec.testName}`}
          description={`${spec.itemCode} - ${spec.itemName}`}
          backButton={
            <DxButton
              text="ย้อนกลับ"
              icon="back"
              type="normal"
              stylingMode="text"
              onClick={() => router.push('/quality/specs')}
            />
          }
          actions={
            <div className="flex items-center gap-2">
              {spec.isCritical && (
                <Badge variant="danger" size="md">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  วิกฤต
                </Badge>
              )}
              <Badge variant={spec.isActive ? 'primary' : 'default'} dot size="md">
                {spec.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
              </Badge>
            </div>
          }
        />

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">ลบข้อกำหนดนี้?</p>
                    <p className="text-sm text-red-600">
                      การดำเนินการนี้ไม่สามารถยกเลิกได้ ข้อกำหนดที่มีการทดสอบไม่สามารถลบได้
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <DxButton
                    text="ยกเลิก"
                    type="normal"
                    stylingMode="outlined"
                    onClick={() => setShowDeleteConfirm(false)}
                  />
                  <DxButton
                    text="ลบ"
                    type="danger"
                    onClick={handleDelete}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Total Tests</p>
              <p className="text-2xl font-bold">{spec.stats.totalTests}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Passed</p>
              <p className="text-2xl font-bold text-green-600">{spec.stats.passCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold text-red-600">{spec.stats.failCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-gray-600">{spec.stats.pendingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Pass Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {spec.stats.totalTests > 0
                  ? Math.round((spec.stats.passCount / spec.stats.totalTests) * 100)
                  : 0}
                %
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Specification Details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Specification Details</CardTitle>
                  {!isEditing ? (
                    <DxButton
                      text="Edit"
                      icon="edit"
                      type="normal"
                      stylingMode="outlined"
                      onClick={() => setIsEditing(true)}
                    />
                  ) : (
                    <div className="flex gap-2">
                      <DxButton
                        text="Cancel"
                        type="normal"
                        stylingMode="outlined"
                        onClick={() => setIsEditing(false)}
                      />
                      <DxButton
                        text="Save"
                        icon="save"
                        type="default"
                        onClick={handleSave}
                        disabled={isSaving}
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
                        <DxTextBox
                          value={editForm.testName}
                          onValueChange={(value) => setEditForm({ ...editForm, testName: value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Test Method</label>
                        <DxTextBox
                          value={editForm.testMethod}
                          onValueChange={(value) => setEditForm({ ...editForm, testMethod: value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Specification</label>
                      <DxTextBox
                        value={editForm.specification}
                        onValueChange={(value) => setEditForm({ ...editForm, specification: value })}
                        placeholder="e.g., White to off-white powder"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Min Value</label>
                        <DxNumberBox
                          value={editForm.minValue}
                          onValueChange={(value) => setEditForm({ ...editForm, minValue: value })}
                          format="#,##0.###"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Value</label>
                        <DxNumberBox
                          value={editForm.maxValue}
                          onValueChange={(value) => setEditForm({ ...editForm, maxValue: value })}
                          format="#,##0.###"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                        <DxTextBox
                          value={editForm.unit}
                          onValueChange={(value) => setEditForm({ ...editForm, unit: value })}
                          placeholder="e.g., mg, %, pH"
                        />
                      </div>
                    </div>
                    <DxCheckBox
                      value={editForm.isCritical}
                      onValueChange={(value) => setEditForm({ ...editForm, isCritical: value })}
                      text="Critical Test Parameter"
                    />
                  </div>
                ) : (
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-gray-500">Test Name</dt>
                      <dd className="font-medium">{spec.testName}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Test Method</dt>
                      <dd className="font-medium">{spec.testMethod || '-'}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-sm text-gray-500">Specification</dt>
                      <dd className="font-medium">{spec.specification || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Min Value</dt>
                      <dd className="font-medium">
                        {spec.minValue !== null ? `${spec.minValue} ${spec.unit || ''}` : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Max Value</dt>
                      <dd className="font-medium">
                        {spec.maxValue !== null ? `${spec.maxValue} ${spec.unit || ''}` : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Unit</dt>
                      <dd className="font-medium">{spec.unit || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Critical</dt>
                      <dd>
                        <Badge variant={spec.isCritical ? 'danger' : 'default'}>
                          {spec.isCritical ? 'Yes' : 'No'}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                )}
              </CardContent>
            </Card>

            {/* Recent Tests */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5" />
                    Recent Tests
                  </CardTitle>
                  <DxButton
                    text="New Test"
                    type="normal"
                    stylingMode="outlined"
                    onClick={() => router.push('/quality/tests/new')}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {spec.recentTests.length > 0 ? (
                  <DxDataGrid
                    dataSource={spec.recentTests}
                    keyExpr="id"
                    columns={testColumns}
                    showBorders
                    rowAlternationEnabled
                    onRowClick={(e) => router.push(`/quality/tests/${e.data.id}`)}
                  />
                ) : (
                  <p className="text-center py-8 text-gray-500">
                    No tests have been performed using this specification yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Item Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Item Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Item Code</p>
                  <p className="font-medium">{spec.itemCode}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Item Name</p>
                  <p className="font-medium">{spec.itemName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Item Type</p>
                  <p className="font-medium capitalize">{spec.itemType}</p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DxButton
                  text={spec.isActive ? 'Deactivate' : 'Activate'}
                  type={spec.isActive ? 'normal' : 'default'}
                  stylingMode={spec.isActive ? 'outlined' : 'contained'}
                  width="100%"
                  onClick={handleToggleActive}
                  disabled={isSaving}
                />
                <DxButton
                  text="Delete"
                  icon="trash"
                  type="danger"
                  stylingMode="outlined"
                  width="100%"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving || spec.stats.totalTests > 0}
                />
                {spec.stats.totalTests > 0 && (
                  <p className="text-xs text-gray-500 text-center">
                    Cannot delete - has {spec.stats.totalTests} associated tests
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Timestamps */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="font-medium">{formatDate(spec.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="font-medium">{formatDate(spec.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    
  );
}
