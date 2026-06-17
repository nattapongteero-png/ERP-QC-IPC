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
  { value: 'open', label: 'เปิด' },
  { value: 'in_progress', label: 'กำลังดำเนินการ' },
  { value: 'pending_verification', label: 'รอตรวจสอบ' },
  { value: 'verified', label: 'ตรวจสอบแล้ว' },
  { value: 'closed', label: 'ปิด' },
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
    { text: 'ภาพรวม', icon: 'chart' },
    { text: 'การสืบสวน', icon: 'search' },
    { text: 'CAPA', icon: 'checklist' },
    { text: 'ประวัติ', icon: 'clock' },
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
      'process': 'ความเบี่ยงเบนของกระบวนการ',
      'product': 'ความเบี่ยงเบนของผลิตภัณฑ์',
      'equipment': 'ความเบี่ยงเบนของเครื่องจักร',
      'documentation': 'ความเบี่ยงเบนของเอกสาร',
      'environmental': 'ความเบี่ยงเบนของสภาพแวดล้อม',
      'other': 'อื่น ๆ',
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
          <p className="text-gray-500">ไม่พบความเบี่ยงเบน</p>
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
                text="กลับ"
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/quality/deviations')}
              />
              <h1 className="text-2xl font-bold text-gray-900">{deviation.deviationCode}</h1>
              <Badge variant={getStatusVariant(deviation.status)}>
                {deviation.status}
              </Badge>
              <Badge variant={getSeverityVariant(deviation.severity)}>
                {deviation.severity}
              </Badge>
              {metrics.isOverdue && (
                <Badge variant="danger">เกินกำหนด</Badge>
              )}
            </div>
            <p className="text-gray-600 mt-1">{deviation.title}</p>
          </div>
          <div className="flex gap-2">
            {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
            {!isEditing && deviation.status !== 'closed' && (
              <DxButton
                text="อัปเดต CAPA"
                type="default"
                onClick={() => setIsEditing(true)}
              />
            )}
            {isEditing && (
              <>
                <DxButton
                  text="ยกเลิก"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setIsEditing(false)}
                />
                <DxButton
                  text="บันทึก"
                  type="success"
                  onClick={handleSave}
                />
              </>
            )}
            <DxButton
              text="พิมพ์รายงาน"
              icon="print"
              type="normal"
              stylingMode="outlined"
              onClick={() => window.print()}
            />
          </div>
        </div>

        {/* Workflow status — สถานะการดำเนินงาน */}
        <StatusStepper
          title="สถานะการดำเนินงาน"
          current={deviation.status}
          steps={[
            { key: 'open', label: 'เปิด' },
            { key: 'in_progress', label: 'กำลังสืบสวน' },
            { key: 'pending_verification', label: 'รอตรวจสอบ' },
            { key: 'verified', label: 'ตรวจสอบแล้ว' },
            { key: 'closed', label: 'ปิด' },
          ]}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">สถานะ</p>
              <Badge variant={getStatusVariant(deviation.status)} className="text-lg mt-1">
                {deviation.status}
              </Badge>
            </div>
          </div>
          <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">ความรุนแรง</p>
              <Badge variant={getSeverityVariant(deviation.severity)} className="text-lg mt-1">
                {deviation.severity}
              </Badge>
            </div>
          </div>
          <div className={`bg-white border border-gray-200 border-l-4 ${metrics.isOverdue ? 'border-l-rose-500' : 'border-l-blue-500'} rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4`}>
            <div className="text-center">
              <p className="text-sm text-gray-500">จำนวนวันที่เปิด</p>
              <p className={`text-2xl font-bold ${metrics.isOverdue ? 'text-rose-500' : 'text-gray-900'}`}>
                {metrics.daysOpen}
              </p>
            </div>
          </div>
          <div className={`bg-white border border-gray-200 border-l-4 ${metrics.isOverdue ? 'border-l-rose-500' : 'border-l-gray-500'} rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-4`}>
            <div className="text-center">
              <p className="text-sm text-gray-500">วันครบกำหนด</p>
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
              <p className="font-medium text-red-800">ความเบี่ยงเบนเกินกำหนด</p>
              <p className="text-sm text-red-600">
                ความเบี่ยงเบนนี้เลยวันครบกำหนดแล้ว กรุณาดำเนินการแก้ไขทันที
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
                <CardTitle>ข้อมูลความเบี่ยงเบน</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">รหัสความเบี่ยงเบน</dt>
                    <dd className="font-medium">{deviation.deviationCode}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">ประเภท</dt>
                    <dd className="font-medium">{getTypeLabel(deviation.type)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">หัวข้อ</dt>
                    <dd className="font-medium">{deviation.title}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">รายละเอียด</dt>
                    <dd className="font-medium">{deviation.description || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">รายงานโดย</dt>
                    <dd className="font-medium">{reporter?.name || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">วันที่รายงาน</dt>
                    <dd className="font-medium">
                      {deviation.createdAt ? new Date(deviation.createdAt).toLocaleDateString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">มอบหมายให้</dt>
                    <dd className="font-medium">{assignee?.name || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">วันครบกำหนด</dt>
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
                <CardTitle>ระเบียนที่เกี่ยวข้อง</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  {item && (
                    <>
                      <div>
                        <dt className="text-sm text-gray-500">รหัสรายการ</dt>
                        <dd className="font-medium">{item.code}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">ชื่อรายการ</dt>
                        <dd className="font-medium">{item.nameTh}</dd>
                      </div>
                    </>
                  )}
                  {lot && (
                    <>
                      <div>
                        <dt className="text-sm text-gray-500">หมายเลขล็อต</dt>
                        <dd className="font-medium text-blue-600 cursor-pointer" onClick={() => router.push(`/inventory/lots/${lot.id}`)}>
                          {lot.lotNumber}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">สถานะล็อต</dt>
                        <dd><Badge variant={getStatusVariant(lot.status)}>{lot.status}</Badge></dd>
                      </div>
                    </>
                  )}
                  {workOrder && (
                    <>
                      <div>
                        <dt className="text-sm text-gray-500">ใบสั่งผลิต</dt>
                        <dd className="font-medium text-blue-600 cursor-pointer" onClick={() => router.push(`/production/work-orders/${workOrder.id}`)}>
                          {workOrder.woNumber}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">หมายเลขแบทช์</dt>
                        <dd className="font-medium">{workOrder.batchNumber || '-'}</dd>
                      </div>
                    </>
                  )}
                  {!item && !lot && !workOrder && (
                    <div className="col-span-2">
                      <p className="text-gray-500">ไม่มีระเบียนที่เกี่ยวข้อง</p>
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
              <CardTitle>การสืบสวนสาเหตุราก</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">การวิเคราะห์สาเหตุราก</label>
                    <DxTextArea
                      value={editForm.rootCause}
                      onValueChange={(value) => setEditForm({ ...editForm, rootCause: value })}
                      placeholder="อธิบายการวิเคราะห์สาเหตุรากโดยใช้วิธี 5-Why หรือแผนภาพก้างปลา..."
                      height={150}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">การวิเคราะห์สาเหตุราก</h4>
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {deviation.rootCause || 'ยังไม่มีการบันทึกการวิเคราะห์สาเหตุราก'}
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
                <CardTitle>การแก้ไข (CA)</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <DxTextArea
                    value={editForm.correctiveAction}
                    onValueChange={(value) => setEditForm({ ...editForm, correctiveAction: value })}
                    placeholder="อธิบายการแก้ไขที่ดำเนินการเพื่อจัดการกับปัญหาเฉพาะหน้า..."
                    height={150}
                  />
                ) : (
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {deviation.correctiveAction || 'ยังไม่มีการบันทึกการแก้ไข'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Preventive Action */}
            <Card>
              <CardHeader>
                <CardTitle>การป้องกัน (PA)</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <DxTextArea
                    value={editForm.preventiveAction}
                    onValueChange={(value) => setEditForm({ ...editForm, preventiveAction: value })}
                    placeholder="อธิบายการป้องกันเพื่อไม่ให้เกิดซ้ำ..."
                    height={150}
                  />
                ) : (
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {deviation.preventiveAction || 'ยังไม่มีการบันทึกการป้องกัน'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Status Update */}
            {isEditing && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>อัปเดตสถานะ</CardTitle>
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
              <CardTitle>ประวัติกิจกรรม</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">สร้างความเบี่ยงเบน</p>
                    <p className="text-sm text-gray-500">
                      {deviation.createdAt ? new Date(deviation.createdAt).toLocaleString('th-TH') : '-'}
                    </p>
                    <p className="text-sm text-gray-600">สร้างโดย {reporter?.name || 'ไม่ทราบ'}</p>
                  </div>
                </div>
                {deviation.closedAt && (
                  <div className="flex gap-4 items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">ปิดความเบี่ยงเบน</p>
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
