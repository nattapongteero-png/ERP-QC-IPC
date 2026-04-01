'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxTabs, DxTabItem } from '@/components/ui/dx-tabs';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { ItemSearchDialog, Item } from '@/components/ui/item-search-dialog';
import { ClipboardCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface LineClearanceStatus {
  required: boolean;
  status: 'not_started' | 'pending' | 'performed' | 'verified' | 'rejected';
  canStartProduction: boolean;
  message: string;
}

interface WorkOrderDetail {
  workOrder: {
    id: number;
    woNumber: string;
    productId: number;
    productCode: string;
    productName: string;
    productNameEn: string;
    productUnit: string;
    ttmtCode: string | null;
    drugCode24: string | null;
    batchNumber: string;
    plannedQty: number;
    actualQty: number;
    status: string;
    plannedStartDate: string;
    plannedEndDate: string;
    actualStartDate: string;
    actualEndDate: string;
    deliveryDate: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
    lineClearanceRequired?: boolean;
    lineClearanceStatus?: string;
  };
  materials: Array<{
    id: number;
    itemId: number;
    itemCode: string;
    itemName: string;
    itemNameEn: string;
    itemUnit: string;
    plannedQty: number;
    actualQty: number;
    lotId: number;
    lotNumber: string;
    lotExpiryDate: string;
    consumptionPercent: number;
    variance: number;
  }>;
  qcTests: Array<{
    id: number;
    testCode: string;
    testType: string;
    status: string;
    result: string;
    testedAt: string;
  }>;
  ebmr: {
    batchNumber: string;
    productCode: string;
    productName: string;
    ttmtCode: string | null;
    drugCode24: string | null;
    plannedQty: number;
    actualQty: number;
    yieldPercent: number;
    productionTimeHours: number;
    status: string;
    materials: any[];
    qcTests: any[];
    operations: Array<{
      id: number;
      sequence: number;
      name: string;
      description: string;
      standardTime: number;
      setupTime: number;
      cleaningTime: number;
      instructions: string;
    }>;
    batchRecords: Array<{
      id: number;
      sequence: number;
      stepName: string;
      instructions: string;
      parameters: any[] | null;
      actualValues: Record<string, any> | null;
      status: string;
      startTime: string;
      endTime: string;
      performerName: string | null;
      verifierName: string | null;
      verifiedAt: string;
      notes: string;
    }>;
    timeline: {
      plannedStart: string;
      plannedEnd: string;
      actualStart: string;
      actualEnd: string;
    };
  };
  summary: {
    yieldPercent: number;
    productionTimeHours: number;
    materialCount: number;
    qcTestCount: number;
    qcPassCount: number;
  };
}

interface Lot {
  id: number;
  lotNumber: string;
  quantity: number;
  reservedQuantity: number;
  unit: string;
  expiryDate: string;
  itemId: number;
  itemCode: string;
  itemName: string;
}

interface ProductSpec {
  id: number;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  isCritical: boolean;
}

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('production');

  // Use translation for page title
  const pageTitle = t('workOrderDetail.title');
  const [data, setData] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // Add Material Dialog State
  const [itemSearchDialogOpen, setItemSearchDialogOpen] = useState(false);
  const [materialDetailsDialogOpen, setMaterialDetailsDialogOpen] = useState(false);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [plannedQuantity, setPlannedQuantity] = useState(0);
  const [actualQuantity, setActualQuantity] = useState(0);
  const [addingMaterial, setAddingMaterial] = useState(false);

  // Add QC Test Dialog State
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [testType, setTestType] = useState('');
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
  const [testMethod, setTestMethod] = useState('');
  const [testNotes, setTestNotes] = useState('');
  const [addingQCTest, setAddingQCTest] = useState(false);
  const [productSpecs, setProductSpecs] = useState<ProductSpec[]>([]);

  // Line Clearance State (FR-062)
  const [lineClearanceStatus, setLineClearanceStatus] = useState<LineClearanceStatus | null>(null);

  const tabs: DxTabItem[] = [
    { text: 'Overview', icon: 'info' },
    { text: 'Execution', icon: 'runner' },
    { text: 'Materials', icon: 'box' },
    { text: 'QC Tests', icon: 'check' },
    { text: 'eBMR', icon: 'doc' },
  ];

  useEffect(() => {
    fetchWorkOrderDetail();
    fetchLineClearanceStatus();
  }, [params.id]);

  useEffect(() => {
    if (selectedItem) {
      fetchLots(selectedItem.id);
    } else {
      setLots([]);
    }
  }, [selectedItem]);

  const fetchLineClearanceStatus = async () => {
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/line-clearance`);
      const result = await response.json();
      if (result.success) {
        setLineClearanceStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch line clearance status:', error);
    }
  };

  const fetchWorkOrderDetail = async () => {
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/detail`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        // Fetch product-specific QC specs
        if (result.data.workOrder?.productId) {
          fetchProductSpecs(result.data.workOrder.productId);
        }
      }
    } catch (error) {
      console.error('Failed to fetch work order detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductSpecs = async (productId: number) => {
    try {
      const response = await fetch(`/api/quality/specs?itemId=${productId}&isActive=true&limit=100`);
      const result = await response.json();
      if (result.success) {
        const specs = result.data?.items || result.data?.data || (Array.isArray(result.data) ? result.data : []);
        setProductSpecs(specs);
      }
    } catch (error) {
      console.error('Failed to fetch product specs:', error);
    }
  };

  const fetchLots = async (itemId: number) => {
    try {
      const response = await fetch(`/api/inventory/lots?itemId=${itemId}&status=released&limit=50`);
      const result = await response.json();
      if (result.success) {
        setLots(result.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch lots:', error);
    }
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setItemSearchDialogOpen(false);
    setMaterialDetailsDialogOpen(true);
  };

  const handleAddMaterial = async () => {
    if (!selectedItem || !plannedQuantity) return;

    setAddingMaterial(true);
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          lotId: selectedLot?.id || null,
          plannedQuantity: plannedQuantity,
          actualQuantity: actualQuantity || null,
          unit: selectedItem.primaryUnit,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setMaterialDetailsDialogOpen(false);
        resetMaterialForm();
        fetchWorkOrderDetail();
      }
    } catch (error) {
      console.error('Failed to add material:', error);
    } finally {
      setAddingMaterial(false);
    }
  };

  const resetMaterialForm = () => {
    setSelectedItem(null);
    setSelectedLot(null);
    setPlannedQuantity(0);
    setActualQuantity(0);
    setLots([]);
  };

  const handleAddQCTest = async () => {
    if (!selectedSpecId && !testType) return;

    setAddingQCTest(true);
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/qc-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specId: selectedSpecId || null,
          testType: testType || 'in_process',
          notes: testNotes || null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setQcDialogOpen(false);
        resetQCForm();
        fetchWorkOrderDetail();
      }
    } catch (error) {
      console.error('Failed to add QC test:', error);
    } finally {
      setAddingQCTest(false);
    }
  };

  const resetQCForm = () => {
    setTestType('');
    setSelectedSpecId(null);
    setTestMethod('');
    setTestNotes('');
  };

  const handleStatusChange = async (newStatus: string) => {
    // FR-062: Check line clearance before starting production
    if (newStatus === 'in_progress') {
      if (lineClearanceStatus?.required && !lineClearanceStatus?.canStartProduction) {
        toast.error(
          `Cannot start production: ${lineClearanceStatus.message}. ` +
          `Please complete line clearance first.`
        );
        return;
      }
    }

    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`Work order status updated to ${newStatus}`);
        fetchWorkOrderDetail();
        fetchLineClearanceStatus();
      } else {
        toast.error(result.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusVariant = (status: string): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (status) {
      case 'completed': return 'primary';
      case 'in_progress': return 'secondary';
      case 'cancelled': return 'danger';
      case 'pass': return 'primary';
      case 'fail': return 'danger';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'draft': 'Draft',
      'planned': 'Planned',
      'released': 'Released',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'closed': 'Closed',
      'cancelled': 'Cancelled',
    };
    return labels[status] || status;
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const flow: Record<string, string> = {
      'draft': 'planned',
      'planned': 'released',
      'released': 'in_progress',
      'in_progress': 'completed',
      'completed': 'closed',
    };
    return flow[currentStatus] || null;
  };

  // Grid columns for materials
  const materialsColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'Item',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.itemCode}</p>
          <p className="text-sm text-gray-500">{cellInfo.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'lotNumber',
      caption: 'Lot',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.lotNumber || '-'}</p>
          {cellInfo.data.lotExpiryDate && (
            <p className="text-sm text-gray-500">Exp: {new Date(cellInfo.data.lotExpiryDate).toLocaleDateString('th-TH')}</p>
          )}
        </div>
      ),
    },
    {
      dataField: 'plannedQty',
      caption: 'Planned Qty',
      cellRender: (cellInfo) => <span>{cellInfo.data.plannedQty} {cellInfo.data.itemUnit}</span>,
    },
    {
      dataField: 'actualQty',
      caption: 'Actual Qty',
      cellRender: (cellInfo) => <span>{cellInfo.data.actualQty || '-'} {cellInfo.data.actualQty ? cellInfo.data.itemUnit : ''}</span>,
    },
    {
      dataField: 'variance',
      caption: 'Variance',
      cellRender: (cellInfo) => (
        cellInfo.data.variance !== null ? (
          <span className={cellInfo.data.variance > 0 ? 'text-red-600' : cellInfo.data.variance < 0 ? 'text-green-600' : ''}>
            {cellInfo.data.variance > 0 ? '+' : ''}{cellInfo.data.variance} {cellInfo.data.itemUnit}
          </span>
        ) : <span>-</span>
      ),
    },
    {
      dataField: 'consumptionPercent',
      caption: 'Consumption %',
      cellRender: (cellInfo) => (
        cellInfo.data.consumptionPercent !== null ? (
          <Badge variant={cellInfo.data.consumptionPercent <= 100 ? 'primary' : 'danger'}>
            {cellInfo.data.consumptionPercent}%
          </Badge>
        ) : <span>-</span>
      ),
    },
  ];

  // Grid columns for QC tests
  const qcTestsColumns: DxDataGridColumn[] = [
    {
      dataField: 'testCode',
      caption: 'Test Code',
      cellRender: (cellInfo) => <span className="font-medium">{cellInfo.data.testCode}</span>,
    },
    {
      dataField: 'testType',
      caption: 'Test Type',
    },
    {
      dataField: 'status',
      caption: 'Status',
      cellRender: (cellInfo) => <Badge variant={getStatusVariant(cellInfo.data.status)}>{cellInfo.data.status}</Badge>,
    },
    {
      dataField: 'result',
      caption: 'Result',
      cellRender: (cellInfo) => (
        cellInfo.data.result ? <Badge variant={getStatusVariant(cellInfo.data.result)}>{cellInfo.data.result}</Badge> : null
      ),
    },
    {
      dataField: 'testedAt',
      caption: 'Tested At',
      cellRender: (cellInfo) => <span>{cellInfo.data.testedAt ? new Date(cellInfo.data.testedAt).toLocaleString('th-TH') : '-'}</span>,
    },
  ];

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
        <p className="text-gray-500">Work Order not found</p>
        <DxButton
          text="Back to List"
          type="normal"
          stylingMode="outlined"
          className="mt-4"
          onClick={() => router.push('/production/work-orders')}
        />
      </div>
    );
  }

  const { workOrder, materials, qcTests, ebmr, summary } = data;
  const nextStatus = getNextStatus(workOrder.status);

  return (
    <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <DxButton
                text="Back"
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/production/work-orders')}
              />
              <h1 className="text-2xl font-bold text-gray-900">Work Order: {workOrder.woNumber}</h1>
              <Badge variant={getStatusVariant(workOrder.status)}>
                {getStatusLabel(workOrder.status)}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">Batch: {workOrder.batchNumber || 'N/A'}</p>
          </div>
          <div className="flex gap-2">
            {/* Line Clearance Button (FR-062) - Show when in released status */}
            {workOrder.status === 'released' && lineClearanceStatus?.required && (
              <DxButton
                text="Line Clearance"
                icon="check"
                type={lineClearanceStatus?.canStartProduction ? 'success' : 'danger'}
                stylingMode={lineClearanceStatus?.canStartProduction ? 'outlined' : 'contained'}
                onClick={() => router.push(`/production/line-clearance?workOrderId=${workOrder.id}`)}
              />
            )}
            {nextStatus && (
              <DxButton
                text={`Advance to ${getStatusLabel(nextStatus)}`}
                type="default"
                onClick={() => handleStatusChange(nextStatus)}
                disabled={nextStatus === 'in_progress' && lineClearanceStatus?.required && !lineClearanceStatus?.canStartProduction}
              />
            )}
            <DxButton
              text="Print eBMR"
              icon="print"
              type="normal"
              stylingMode="outlined"
              onClick={() => window.print()}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Planned Qty</p>
                <p className="text-2xl font-bold text-blue-600">{workOrder.plannedQty?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500">{workOrder.productUnit}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Actual Qty</p>
                <p className="text-2xl font-bold text-green-600">{workOrder.actualQty?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500">{workOrder.productUnit}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Yield</p>
                <p className={`text-2xl font-bold ${summary.yieldPercent && summary.yieldPercent >= 95 ? 'text-green-600' : summary.yieldPercent && summary.yieldPercent >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {summary.yieldPercent ? `${summary.yieldPercent}%` : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Production Time</p>
                <p className="text-2xl font-bold text-gray-600">
                  {summary.productionTimeHours ? `${summary.productionTimeHours}h` : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">QC Tests</p>
                <p className="text-2xl font-bold text-gray-600">
                  {summary.qcPassCount}/{summary.qcTestCount}
                </p>
                <p className="text-xs text-gray-500">Passed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Clearance Status Card (FR-062) */}
        {lineClearanceStatus?.required && workOrder.status === 'released' && (
          <Card className={`border-2 ${lineClearanceStatus.canStartProduction ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${lineClearanceStatus.canStartProduction ? 'bg-green-100' : 'bg-amber-100'}`}>
                    {lineClearanceStatus.canStartProduction ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <ClipboardCheck className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <h3 className={`font-medium ${lineClearanceStatus.canStartProduction ? 'text-green-800' : 'text-amber-800'}`}>
                      Line Clearance {lineClearanceStatus.canStartProduction ? 'Complete' : 'Required'}
                    </h3>
                    <p className={`text-sm ${lineClearanceStatus.canStartProduction ? 'text-green-600' : 'text-amber-600'}`}>
                      {lineClearanceStatus.message}
                    </p>
                  </div>
                </div>
                {!lineClearanceStatus.canStartProduction && (
                  <DxButton
                    text="Complete Line Clearance"
                    type="default"
                    onClick={() => router.push(`/production/line-clearance?workOrderId=${workOrder.id}`)}
                  />
                )}
              </div>
            </CardContent>
          </Card>
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
            {/* Product Info */}
            <Card>
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">Product Code</dt>
                    <dd className="font-medium">{workOrder.productCode}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Product Name</dt>
                    <dd className="font-medium">{workOrder.productName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Batch Number</dt>
                    <dd className="font-medium">{workOrder.batchNumber || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Unit</dt>
                    <dd className="font-medium">{workOrder.productUnit}</dd>
                  </div>
                  {workOrder.ttmtCode && (
                    <div>
                      <dt className="text-sm text-gray-500">TTMT Code</dt>
                      <dd className="font-medium text-green-700">{workOrder.ttmtCode}</dd>
                    </div>
                  )}
                  {workOrder.drugCode24 && (
                    <div>
                      <dt className="text-sm text-gray-500">รหัสยา 24 หลัก</dt>
                      <dd className="font-medium text-blue-700">{workOrder.drugCode24}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">Planned Start</dt>
                    <dd className="font-medium">
                      {workOrder.plannedStartDate ? new Date(workOrder.plannedStartDate).toLocaleDateString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Planned End</dt>
                    <dd className="font-medium">
                      {workOrder.plannedEndDate ? new Date(workOrder.plannedEndDate).toLocaleDateString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Actual Start</dt>
                    <dd className="font-medium">
                      {workOrder.actualStartDate ? new Date(workOrder.actualStartDate).toLocaleString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Actual End</dt>
                    <dd className="font-medium">
                      {workOrder.actualEndDate ? new Date(workOrder.actualEndDate).toLocaleString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div className="col-span-2 border-t pt-3 mt-1">
                    <dt className="text-sm text-gray-500">Delivery Date (วันที่ส่งมอบ)</dt>
                    <dd className={`font-medium text-lg ${workOrder.deliveryDate && new Date(workOrder.deliveryDate) < new Date(new Date().toDateString()) ? 'text-red-600' : 'text-orange-700'}`}>
                      {workOrder.deliveryDate ? new Date(workOrder.deliveryDate).toLocaleDateString('th-TH') : '-'}
                      {workOrder.deliveryDate && new Date(workOrder.deliveryDate) < new Date(new Date().toDateString()) && workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          <AlertCircle className="w-3 h-3" />
                          เลยกำหนดส่งมอบ
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{workOrder.notes || 'No notes'}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTabIndex === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Production Execution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">
                  Access the detailed production execution workflow including material weighing,
                  SOP execution, environmental monitoring, cleaning checklists, and quality control.
                </p>
                <DxButton
                  text="Open Execution Dashboard"
                  type="default"
                  icon="runner"
                  onClick={() => router.push(`/production/work-orders/${workOrder.id}/execution`)}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                <button
                  onClick={() => router.push(`/production/work-orders/${workOrder.id}/material-weighing`)}
                  className="p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="text-lg font-medium text-gray-900">Material Weighing</div>
                  <div className="text-sm text-gray-500">Record actual weights</div>
                </button>
                <button
                  onClick={() => router.push(`/production/work-orders/${workOrder.id}/sop-execution`)}
                  className="p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="text-lg font-medium text-gray-900">SOP Execution</div>
                  <div className="text-sm text-gray-500">Execute production steps</div>
                </button>
                <button
                  onClick={() => router.push(`/production/work-orders/${workOrder.id}/environmental-monitoring`)}
                  className="p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="text-lg font-medium text-gray-900">Environmental</div>
                  <div className="text-sm text-gray-500">Monitor temp/humidity</div>
                </button>
                <button
                  onClick={() => router.push(`/production/work-orders/${workOrder.id}/cleaning`)}
                  className="p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="text-lg font-medium text-gray-900">Cleaning</div>
                  <div className="text-sm text-gray-500">Room/equipment checklists</div>
                </button>
                <button
                  onClick={() => router.push(`/production/work-orders/${workOrder.id}/packaging-qc`)}
                  className="p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="text-lg font-medium text-gray-900">Packaging QC</div>
                  <div className="text-sm text-gray-500">Weight & integrity checks</div>
                </button>
                <button
                  onClick={() => router.push(`/production/work-orders/${workOrder.id}/finished-inspection`)}
                  className="p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="text-lg font-medium text-gray-900">Final Inspection</div>
                  <div className="text-sm text-gray-500">15-point checklist</div>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTabIndex === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Material Consumption</CardTitle>
                <DxButton
                  text="Add Material"
                  icon="plus"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setItemSearchDialogOpen(true)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <DxDataGrid
                dataSource={materials}
                keyExpr="id"
                columns={materialsColumns}
                showBorders
                rowAlternationEnabled
                noDataText="No materials defined for this work order"
              />
            </CardContent>
          </Card>
        )}

        {activeTabIndex === 3 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Quality Control Tests</CardTitle>
                <DxButton
                  text="Add QC Test"
                  icon="plus"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setQcDialogOpen(true)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <DxDataGrid
                dataSource={qcTests}
                keyExpr="id"
                columns={qcTestsColumns}
                showBorders
                rowAlternationEnabled
                noDataText="No QC tests for this work order"
              />
            </CardContent>
          </Card>
        )}

        {activeTabIndex === 4 && (
          <div className="space-y-6 print:space-y-4" id="ebmr-content">
            {/* eBMR Header */}
            <Card>
              <CardHeader>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900">Electronic Batch Manufacturing Record (eBMR)</h2>
                  <p className="text-gray-600">Production Record</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 border p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Batch Number</p>
                    <p className="font-bold text-lg text-gray-900">{ebmr.batchNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Product</p>
                    <p className="font-bold text-gray-900">{ebmr.productCode}</p>
                    <p className="text-sm text-gray-700">{ebmr.productName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge variant={getStatusVariant(ebmr.status)} className="text-lg">
                      {getStatusLabel(ebmr.status)}
                    </Badge>
                  </div>
                </div>
                {(ebmr.ttmtCode || ebmr.drugCode24) && (
                  <div className="grid grid-cols-3 gap-4 border border-t-0 p-4 rounded-b-lg -mt-1">
                    {ebmr.ttmtCode && (
                      <div>
                        <p className="text-sm text-gray-500">TTMT Code</p>
                        <p className="font-semibold text-green-700">{ebmr.ttmtCode}</p>
                      </div>
                    )}
                    {ebmr.drugCode24 && (
                      <div>
                        <p className="text-sm text-gray-500">รหัสยา 24 หลัก</p>
                        <p className="font-semibold text-blue-700">{ebmr.drugCode24}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Production Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Production Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="border p-3 rounded-lg text-center">
                    <p className="text-sm text-gray-500">Planned Quantity</p>
                    <p className="text-xl font-bold text-gray-900">{ebmr.plannedQty}</p>
                  </div>
                  <div className="border p-3 rounded-lg text-center">
                    <p className="text-sm text-gray-500">Actual Quantity</p>
                    <p className="text-xl font-bold text-gray-900">{ebmr.actualQty || '-'}</p>
                  </div>
                  <div className="border p-3 rounded-lg text-center">
                    <p className="text-sm text-gray-500">Yield</p>
                    <p className={`text-xl font-bold ${ebmr.yieldPercent && ebmr.yieldPercent >= 95 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {ebmr.yieldPercent ? `${ebmr.yieldPercent}%` : '-'}
                    </p>
                  </div>
                  <div className="border p-3 rounded-lg text-center">
                    <p className="text-sm text-gray-500">Production Time</p>
                    <p className="text-xl font-bold text-gray-900">{ebmr.productionTimeHours ? `${ebmr.productionTimeHours}h` : '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Production Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border p-3 rounded-lg">
                    <p className="text-sm text-gray-500 font-medium">Planned</p>
                    <p className="text-gray-900">Start: {ebmr.timeline.plannedStart ? new Date(ebmr.timeline.plannedStart).toLocaleString('th-TH') : '-'}</p>
                    <p className="text-gray-900">End: {ebmr.timeline.plannedEnd ? new Date(ebmr.timeline.plannedEnd).toLocaleString('th-TH') : '-'}</p>
                  </div>
                  <div className="border p-3 rounded-lg">
                    <p className="text-sm text-gray-500 font-medium">Actual</p>
                    <p className="text-gray-900">Start: {ebmr.timeline.actualStart ? new Date(ebmr.timeline.actualStart).toLocaleString('th-TH') : '-'}</p>
                    <p className="text-gray-900">End: {ebmr.timeline.actualEnd ? new Date(ebmr.timeline.actualEnd).toLocaleString('th-TH') : '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Production Steps (Operations from BOM) */}
            {ebmr.operations && ebmr.operations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Production Steps (Operations)</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full border-collapse border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-center text-gray-700 w-16">Step</th>
                        <th className="border p-2 text-left text-gray-700">Operation</th>
                        <th className="border p-2 text-left text-gray-700">Description</th>
                        <th className="border p-2 text-right text-gray-700">Std Time (min)</th>
                        <th className="border p-2 text-right text-gray-700">Setup (min)</th>
                        <th className="border p-2 text-right text-gray-700">Cleaning (min)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ebmr.operations.map((op) => (
                        <tr key={op.id}>
                          <td className="border p-2 text-center text-gray-900 font-medium">{op.sequence}</td>
                          <td className="border p-2 text-gray-900 font-medium">{op.name}</td>
                          <td className="border p-2 text-gray-900">{op.description || '-'}</td>
                          <td className="border p-2 text-right text-gray-900">{op.standardTime ?? '-'}</td>
                          <td className="border p-2 text-right text-gray-900">{op.setupTime ?? '-'}</td>
                          <td className="border p-2 text-right text-gray-900">{op.cleaningTime ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Batch Records (Step-by-Step Execution) */}
            {ebmr.batchRecords && ebmr.batchRecords.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Batch Record Execution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {ebmr.batchRecords.map((br) => (
                      <div key={br.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                              {br.sequence}
                            </span>
                            <h4 className="font-medium text-gray-900">{br.stepName}</h4>
                          </div>
                          <Badge variant={
                            br.status === 'completed' ? 'primary' :
                            br.status === 'in_progress' ? 'secondary' :
                            br.status === 'deviation' ? 'danger' : 'default'
                          }>
                            {br.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        {br.instructions && (
                          <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">{br.instructions}</p>
                        )}
                        {br.actualValues && Object.keys(br.actualValues).length > 0 && (
                          <div className="bg-gray-50 rounded p-2 mb-2">
                            <p className="text-xs font-medium text-gray-500 mb-1">Recorded Values</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {Object.entries(br.actualValues).map(([key, value]) => (
                                <div key={key} className="text-sm">
                                  <span className="text-gray-500">{key.replace(/_/g, ' ')}:</span>{' '}
                                  <span className="font-medium text-gray-900">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {br.performerName && <span>Performed: {br.performerName}</span>}
                          {br.verifierName && <span>Verified: {br.verifierName}</span>}
                          {br.startTime && <span>Start: {new Date(br.startTime).toLocaleString('th-TH')}</span>}
                          {br.endTime && <span>End: {new Date(br.endTime).toLocaleString('th-TH')}</span>}
                        </div>
                        {br.notes && (
                          <p className="text-sm text-gray-600 mt-1 italic">Note: {br.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Material Consumption */}
            <Card>
              <CardHeader>
                <CardTitle>Material Consumption Record</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full border-collapse border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left text-gray-700">Item Code</th>
                      <th className="border p-2 text-left text-gray-700">Item Name</th>
                      <th className="border p-2 text-left text-gray-700">Lot Number</th>
                      <th className="border p-2 text-right text-gray-700">Planned</th>
                      <th className="border p-2 text-right text-gray-700">Actual</th>
                      <th className="border p-2 text-right text-gray-700">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ebmr.materials.map((mat: any, index: number) => (
                      <tr key={index}>
                        <td className="border p-2 text-gray-900">{mat.itemCode}</td>
                        <td className="border p-2 text-gray-900">{mat.itemName}</td>
                        <td className="border p-2 text-gray-900">{mat.lotNumber || '-'}</td>
                        <td className="border p-2 text-right text-gray-900">{mat.plannedQty} {mat.itemUnit}</td>
                        <td className="border p-2 text-right text-gray-900">{mat.actualQty || '-'}</td>
                        <td className="border p-2 text-right text-gray-900">{mat.variance !== null ? mat.variance : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* QC Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Quality Control Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full border-collapse border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left text-gray-700">Test Code</th>
                      <th className="border p-2 text-left text-gray-700">Test Type</th>
                      <th className="border p-2 text-left text-gray-700">Result</th>
                      <th className="border p-2 text-left text-gray-700">Tested At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ebmr.qcTests.map((test: any, index: number) => (
                      <tr key={index}>
                        <td className="border p-2 text-gray-900">{test.testCode}</td>
                        <td className="border p-2 text-gray-900">{test.testType}</td>
                        <td className="border p-2 text-gray-900">
                          <Badge variant={getStatusVariant(test.result)}>{test.result || test.status}</Badge>
                        </td>
                        <td className="border p-2 text-gray-900">{test.testedAt ? new Date(test.testedAt).toLocaleString('th-TH') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Signatures */}
            <Card>
              <CardHeader>
                <CardTitle>Approval Signatures</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="border p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-500 mb-8">Produced By</p>
                    <div className="border-t pt-2">
                      <p className="text-sm text-gray-900">Name: _________________</p>
                      <p className="text-sm text-gray-900">Date: _________________</p>
                    </div>
                  </div>
                  <div className="border p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-500 mb-8">Verified By (QC)</p>
                    <div className="border-t pt-2">
                      <p className="text-sm text-gray-900">Name: _________________</p>
                      <p className="text-sm text-gray-900">Date: _________________</p>
                    </div>
                  </div>
                  <div className="border p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-500 mb-8">Approved By (QA)</p>
                    <div className="border-t pt-2">
                      <p className="text-sm text-gray-900">Name: _________________</p>
                      <p className="text-sm text-gray-900">Date: _________________</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      {/* Item Search Dialog */}
      <ItemSearchDialog
        open={itemSearchDialogOpen}
        onOpenChange={setItemSearchDialogOpen}
        onSelect={handleSelectItem}
        title="Select Material"
        excludeType="finished_goods"
        allowCreate
      />

      {/* Material Details Dialog */}
      <DxPopup
        visible={materialDetailsDialogOpen}
        onHiding={() => { setMaterialDetailsDialogOpen(false); resetMaterialForm(); }}
        title="Material Details"
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          {/* Selected Item Display */}
          {selectedItem && (
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div>
                <p className="font-medium text-emerald-800">{selectedItem.code}</p>
                <p className="text-sm text-emerald-600">{selectedItem.nameTh}</p>
              </div>
              <DxButton
                text="Change"
                type="normal"
                stylingMode="outlined"
                onClick={() => {
                  setMaterialDetailsDialogOpen(false);
                  setItemSearchDialogOpen(true);
                }}
              />
            </div>
          )}

          {/* Lot Selection */}
          {selectedItem && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lot (Optional)
              </label>
              {lots.length > 0 ? (
                <DxSelectBox
                  items={lots.map(lot => ({
                    id: lot.id,
                    label: `${lot.lotNumber} - Available: ${Number(lot.quantity) - Number(lot.reservedQuantity || 0)} ${lot.unit}${lot.expiryDate ? ` (Exp: ${new Date(lot.expiryDate).toLocaleDateString()})` : ''}`
                  }))}
                  value={selectedLot?.id || null}
                  onValueChange={(value) => {
                    const lot = lots.find((l) => l.id === value);
                    setSelectedLot(lot || null);
                  }}
                  valueExpr="id"
                  displayExpr="label"
                  placeholder="Select a lot (optional)"
                />
              ) : (
                <p className="text-sm text-gray-500 p-2 bg-gray-50 rounded">No released lots available for this item</p>
              )}
            </div>
          )}

          {/* Quantities */}
          {selectedItem && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Planned Quantity <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 items-center">
                  <DxNumberBox
                    value={plannedQuantity}
                    onValueChange={(value) => setPlannedQuantity(value || 0)}
                    format="#,##0.###"
                  />
                  <span className="text-sm text-gray-500">{selectedItem.primaryUnit}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Actual Quantity
                </label>
                <div className="flex gap-2 items-center">
                  <DxNumberBox
                    value={actualQuantity}
                    onValueChange={(value) => setActualQuantity(value || 0)}
                    format="#,##0.###"
                  />
                  <span className="text-sm text-gray-500">{selectedItem.primaryUnit}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => { setMaterialDetailsDialogOpen(false); resetMaterialForm(); }}
            />
            <DxButton
              text={addingMaterial ? 'Adding...' : 'Add Material'}
              type="default"
              onClick={handleAddMaterial}
              disabled={!selectedItem || !plannedQuantity || addingMaterial}
            />
          </div>
        </div>
      </DxPopup>

      {/* Add QC Test Dialog */}
      <DxPopup
        visible={qcDialogOpen}
        onHiding={() => { setQcDialogOpen(false); resetQCForm(); }}
        title="Add QC Test"
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-500">
            เลือกรายการทดสอบคุณภาพสำหรับสินค้าของใบสั่งผลิตนี้
          </p>

          {productSpecs.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specification <span className="text-red-500">*</span>
              </label>
              <DxSelectBox
                items={productSpecs.map((spec) => ({
                  value: spec.id,
                  label: `${spec.testName}${spec.specification ? ` (${spec.specification})` : ''}`,
                  testMethod: spec.testMethod,
                }))}
                value={selectedSpecId}
                onValueChange={(val) => {
                  setSelectedSpecId(val);
                  const spec = productSpecs.find(s => s.id === val);
                  if (spec) {
                    setTestType(spec.testName);
                    setTestMethod(spec.testMethod || '');
                  }
                }}
                valueExpr="value"
                displayExpr="label"
                placeholder="เลือกรายการทดสอบ..."
                searchEnabled
              />
              {selectedSpecId && (() => {
                const spec = productSpecs.find(s => s.id === selectedSpecId);
                if (!spec) return null;
                return (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                    {spec.testMethod && <p>Method: {spec.testMethod}</p>}
                    {spec.specification && <p>Spec: {spec.specification}</p>}
                    {(spec.minValue !== null || spec.maxValue !== null) && (
                      <p>Range: {spec.minValue ?? '-'} ~ {spec.maxValue ?? '-'} {spec.unit || ''}</p>
                    )}
                    {spec.isCritical && <p className="text-red-600 font-medium">Critical Test</p>}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              ไม่พบรายการทดสอบคุณภาพสำหรับสินค้านี้ กรุณากำหนดที่ Quality &gt; Specifications ก่อน
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <DxTextArea
              value={testNotes}
              onValueChange={setTestNotes}
              placeholder="บันทึกเพิ่มเติม..."
              height={80}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => { setQcDialogOpen(false); resetQCForm(); }}
            />
            <DxButton
              text={addingQCTest ? 'Adding...' : 'Add QC Test'}
              type="default"
              onClick={handleAddQCTest}
              disabled={(!selectedSpecId && !testType) || addingQCTest}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
