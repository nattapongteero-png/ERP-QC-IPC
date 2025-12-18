'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface WorkOrderDetail {
  workOrder: {
    id: number;
    woNumber: string;
    productId: number;
    productCode: string;
    productName: string;
    productNameEn: string;
    productUnit: string;
    batchNumber: string;
    plannedQty: number;
    actualQty: number;
    status: string;
    plannedStartDate: string;
    plannedEndDate: string;
    actualStartDate: string;
    actualEndDate: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
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
    plannedQty: number;
    actualQty: number;
    yieldPercent: number;
    productionTimeHours: number;
    status: string;
    materials: any[];
    qcTests: any[];
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

interface Item {
  id: number;
  code: string;
  nameTh: string;
  primaryUnit: string;
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

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'qc' | 'ebmr'>('overview');

  // Add Material Dialog State
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [plannedQuantity, setPlannedQuantity] = useState('');
  const [actualQuantity, setActualQuantity] = useState('');
  const [addingMaterial, setAddingMaterial] = useState(false);

  // Add QC Test Dialog State
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [testType, setTestType] = useState('');
  const [testMethod, setTestMethod] = useState('');
  const [testNotes, setTestNotes] = useState('');
  const [addingQCTest, setAddingQCTest] = useState(false);

  useEffect(() => {
    fetchWorkOrderDetail();
  }, [params.id]);

  useEffect(() => {
    if (materialDialogOpen && itemSearch.length >= 2) {
      searchItems();
    }
  }, [itemSearch, materialDialogOpen]);

  useEffect(() => {
    if (selectedItem) {
      fetchLots(selectedItem.id);
    } else {
      setLots([]);
    }
  }, [selectedItem]);

  const fetchWorkOrderDetail = async () => {
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/detail`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch work order detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchItems = async () => {
    try {
      const response = await fetch(`/api/items?search=${encodeURIComponent(itemSearch)}&limit=20`);
      const result = await response.json();
      if (result.success) {
        setItems(result.data.data || []);
      }
    } catch (error) {
      console.error('Failed to search items:', error);
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
          plannedQuantity: parseFloat(plannedQuantity),
          actualQuantity: actualQuantity ? parseFloat(actualQuantity) : null,
          unit: selectedItem.primaryUnit,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setMaterialDialogOpen(false);
        resetMaterialForm();
        fetchWorkOrderDetail();
      }
      // API errors handled by global error handler
    } catch (error) {
      console.error('Failed to add material:', error);
      // Network errors handled by global error handler
    } finally {
      setAddingMaterial(false);
    }
  };

  const resetMaterialForm = () => {
    setSelectedItem(null);
    setSelectedLot(null);
    setPlannedQuantity('');
    setActualQuantity('');
    setItemSearch('');
    setItems([]);
    setLots([]);
  };

  const handleAddQCTest = async () => {
    if (!testType) return;

    setAddingQCTest(true);
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/qc-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testType,
          testMethod: testMethod || null,
          notes: testNotes || null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setQcDialogOpen(false);
        resetQCForm();
        fetchWorkOrderDetail();
      }
      // API errors handled by global error handler
    } catch (error) {
      console.error('Failed to add QC test:', error);
      // Network errors handled by global error handler
    } finally {
      setAddingQCTest(false);
    }
  };

  const resetQCForm = () => {
    setTestType('');
    setTestMethod('');
    setTestNotes('');
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/production/work-orders/${params.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();
      if (result.success) {
        fetchWorkOrderDetail();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
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

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Work Order not found</p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/production/work-orders')}>
            Back to List
          </Button>
        </div>
      </MainLayout>
    );
  }

  const { workOrder, materials, qcTests, ebmr, summary } = data;
  const nextStatus = getNextStatus(workOrder.status);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => router.push('/production/work-orders')}>
                &larr; Back
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Work Order: {workOrder.woNumber}</h1>
              <Badge variant={getStatusVariant(workOrder.status)}>
                {getStatusLabel(workOrder.status)}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">Batch: {workOrder.batchNumber || 'N/A'}</p>
          </div>
          <div className="flex gap-2">
            {nextStatus && (
              <Button variant="primary" onClick={() => handleStatusChange(nextStatus)}>
                Advance to {getStatusLabel(nextStatus)}
              </Button>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              Print eBMR
            </Button>
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

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'materials', label: 'Materials' },
              { id: 'qc', label: 'QC Tests' },
              { id: 'ebmr', label: 'eBMR' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
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

        {activeTab === 'materials' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Material Consumption</CardTitle>
                <Button variant="secondary" size="sm" onClick={() => setMaterialDialogOpen(true)}>
                  + Add Material
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table
                columns={[
                  { key: 'item', title: 'Item' },
                  { key: 'lot', title: 'Lot' },
                  { key: 'planned', title: 'Planned Qty' },
                  { key: 'actual', title: 'Actual Qty' },
                  { key: 'variance', title: 'Variance' },
                  { key: 'consumption', title: 'Consumption %' },
                ]}
                data={materials}
                renderRow={(mat) => (
                  <tr key={mat.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{mat.itemCode}</p>
                        <p className="text-sm text-gray-500">{mat.itemName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{mat.lotNumber || '-'}</p>
                        {mat.lotExpiryDate && (
                          <p className="text-sm text-gray-500">Exp: {new Date(mat.lotExpiryDate).toLocaleDateString('th-TH')}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{mat.plannedQty} {mat.itemUnit}</td>
                    <td className="px-4 py-3">{mat.actualQty || '-'} {mat.actualQty ? mat.itemUnit : ''}</td>
                    <td className="px-4 py-3">
                      {mat.variance !== null ? (
                        <span className={mat.variance > 0 ? 'text-red-600' : mat.variance < 0 ? 'text-green-600' : ''}>
                          {mat.variance > 0 ? '+' : ''}{mat.variance} {mat.itemUnit}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {mat.consumptionPercent !== null ? (
                        <Badge variant={mat.consumptionPercent <= 100 ? 'primary' : 'danger'}>
                          {mat.consumptionPercent}%
                        </Badge>
                      ) : '-'}
                    </td>
                  </tr>
                )}
              />
              {materials.length === 0 && (
                <p className="text-center text-gray-500 py-8">No materials defined for this work order</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'qc' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Quality Control Tests</CardTitle>
                <Button variant="secondary" size="sm" onClick={() => setQcDialogOpen(true)}>
                  + Add QC Test
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table
                columns={[
                  { key: 'testCode', title: 'Test Code' },
                  { key: 'testType', title: 'Test Type' },
                  { key: 'status', title: 'Status' },
                  { key: 'result', title: 'Result' },
                  { key: 'testedAt', title: 'Tested At' },
                ]}
                data={qcTests}
                renderRow={(test) => (
                  <tr key={test.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{test.testCode}</td>
                    <td className="px-4 py-3">{test.testType}</td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(test.status)}>{test.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {test.result && (
                        <Badge variant={getStatusVariant(test.result)}>{test.result}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {test.testedAt ? new Date(test.testedAt).toLocaleString('th-TH') : '-'}
                    </td>
                  </tr>
                )}
              />
              {qcTests.length === 0 && (
                <p className="text-center text-gray-500 py-8">No QC tests for this work order</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'ebmr' && (
          <div className="space-y-6 print:space-y-4" id="ebmr-content">
            {/* eBMR Header */}
            <Card>
              <CardHeader>
                <div className="text-center">
                  <h2 className="text-xl font-bold">Electronic Batch Manufacturing Record (eBMR)</h2>
                  <p className="text-gray-600">Production Record</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 border p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Batch Number</p>
                    <p className="font-bold text-lg">{ebmr.batchNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Product</p>
                    <p className="font-bold">{ebmr.productCode}</p>
                    <p className="text-sm text-gray-600">{ebmr.productName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge variant={getStatusVariant(ebmr.status)} className="text-lg">
                      {getStatusLabel(ebmr.status)}
                    </Badge>
                  </div>
                </div>
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
                    <p className="text-xl font-bold">{ebmr.plannedQty}</p>
                  </div>
                  <div className="border p-3 rounded-lg text-center">
                    <p className="text-sm text-gray-500">Actual Quantity</p>
                    <p className="text-xl font-bold">{ebmr.actualQty || '-'}</p>
                  </div>
                  <div className="border p-3 rounded-lg text-center">
                    <p className="text-sm text-gray-500">Yield</p>
                    <p className={`text-xl font-bold ${ebmr.yieldPercent && ebmr.yieldPercent >= 95 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {ebmr.yieldPercent ? `${ebmr.yieldPercent}%` : '-'}
                    </p>
                  </div>
                  <div className="border p-3 rounded-lg text-center">
                    <p className="text-sm text-gray-500">Production Time</p>
                    <p className="text-xl font-bold">{ebmr.productionTimeHours ? `${ebmr.productionTimeHours}h` : '-'}</p>
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
                    <p>Start: {ebmr.timeline.plannedStart ? new Date(ebmr.timeline.plannedStart).toLocaleString('th-TH') : '-'}</p>
                    <p>End: {ebmr.timeline.plannedEnd ? new Date(ebmr.timeline.plannedEnd).toLocaleString('th-TH') : '-'}</p>
                  </div>
                  <div className="border p-3 rounded-lg">
                    <p className="text-sm text-gray-500 font-medium">Actual</p>
                    <p>Start: {ebmr.timeline.actualStart ? new Date(ebmr.timeline.actualStart).toLocaleString('th-TH') : '-'}</p>
                    <p>End: {ebmr.timeline.actualEnd ? new Date(ebmr.timeline.actualEnd).toLocaleString('th-TH') : '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Material Consumption */}
            <Card>
              <CardHeader>
                <CardTitle>Material Consumption Record</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full border-collapse border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Item Code</th>
                      <th className="border p-2 text-left">Item Name</th>
                      <th className="border p-2 text-left">Lot Number</th>
                      <th className="border p-2 text-right">Planned</th>
                      <th className="border p-2 text-right">Actual</th>
                      <th className="border p-2 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ebmr.materials.map((mat: any, index: number) => (
                      <tr key={index}>
                        <td className="border p-2">{mat.itemCode}</td>
                        <td className="border p-2">{mat.itemName}</td>
                        <td className="border p-2">{mat.lotNumber || '-'}</td>
                        <td className="border p-2 text-right">{mat.plannedQty} {mat.itemUnit}</td>
                        <td className="border p-2 text-right">{mat.actualQty || '-'}</td>
                        <td className="border p-2 text-right">{mat.variance !== null ? mat.variance : '-'}</td>
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
                      <th className="border p-2 text-left">Test Code</th>
                      <th className="border p-2 text-left">Test Type</th>
                      <th className="border p-2 text-left">Result</th>
                      <th className="border p-2 text-left">Tested At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ebmr.qcTests.map((test: any, index: number) => (
                      <tr key={index}>
                        <td className="border p-2">{test.testCode}</td>
                        <td className="border p-2">{test.testType}</td>
                        <td className="border p-2">
                          <Badge variant={getStatusVariant(test.result)}>{test.result || test.status}</Badge>
                        </td>
                        <td className="border p-2">{test.testedAt ? new Date(test.testedAt).toLocaleString('th-TH') : '-'}</td>
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
                      <p className="text-sm">Name: _________________</p>
                      <p className="text-sm">Date: _________________</p>
                    </div>
                  </div>
                  <div className="border p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-500 mb-8">Verified By (QC)</p>
                    <div className="border-t pt-2">
                      <p className="text-sm">Name: _________________</p>
                      <p className="text-sm">Date: _________________</p>
                    </div>
                  </div>
                  <div className="border p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-500 mb-8">Approved By (QA)</p>
                    <div className="border-t pt-2">
                      <p className="text-sm">Name: _________________</p>
                      <p className="text-sm">Date: _________________</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Add Material Dialog */}
      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
            <DialogDescription>
              Add a material to this work order. Search for an item and optionally select a lot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Item Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item <span className="text-red-500">*</span>
              </label>
              {selectedItem ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div>
                    <p className="font-medium">{selectedItem.code}</p>
                    <p className="text-sm text-gray-500">{selectedItem.nameTh}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedItem(null)}>
                    Change
                  </Button>
                </div>
              ) : (
                <div>
                  <Input
                    placeholder="Search item code or name..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                  />
                  {items.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-auto border rounded-lg">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b last:border-b-0"
                          onClick={() => {
                            setSelectedItem(item);
                            setItems([]);
                            setItemSearch('');
                          }}
                        >
                          <p className="font-medium">{item.code}</p>
                          <p className="text-sm text-gray-500">{item.nameTh}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Lot Selection */}
            {selectedItem && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lot (Optional)
                </label>
                {lots.length > 0 ? (
                  <Select
                    value={selectedLot?.id?.toString() || ''}
                    onChange={(e) => {
                      const lot = lots.find((l) => l.id.toString() === e.target.value);
                      setSelectedLot(lot || null);
                    }}
                  >
                    <option value="">Select a lot (optional)</option>
                    {lots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lotNumber} - Available: {Number(lot.quantity) - Number(lot.reservedQuantity || 0)} {lot.unit}
                        {lot.expiryDate && ` (Exp: ${new Date(lot.expiryDate).toLocaleDateString()})`}
                      </option>
                    ))}
                  </Select>
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
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.001"
                      value={plannedQuantity}
                      onChange={(e) => setPlannedQuantity(e.target.value)}
                      placeholder="0.00"
                    />
                    <span className="flex items-center text-sm text-gray-500">{selectedItem.primaryUnit}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Actual Quantity
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.001"
                      value={actualQuantity}
                      onChange={(e) => setActualQuantity(e.target.value)}
                      placeholder="0.00"
                    />
                    <span className="flex items-center text-sm text-gray-500">{selectedItem.primaryUnit}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setMaterialDialogOpen(false); resetMaterialForm(); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddMaterial}
              disabled={!selectedItem || !plannedQuantity || addingMaterial}
            >
              {addingMaterial ? 'Adding...' : 'Add Material'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add QC Test Dialog */}
      <Dialog open={qcDialogOpen} onOpenChange={setQcDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add QC Test</DialogTitle>
            <DialogDescription>
              Create a new quality control test for this work order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Type <span className="text-red-500">*</span>
              </label>
              <Select value={testType} onChange={(e) => setTestType(e.target.value)}>
                <option value="">Select test type</option>
                <option value="identity">Identity Test</option>
                <option value="purity">Purity Test</option>
                <option value="potency">Potency Test</option>
                <option value="microbial">Microbial Test</option>
                <option value="heavy_metals">Heavy Metals Test</option>
                <option value="pesticides">Pesticides Test</option>
                <option value="moisture">Moisture Content</option>
                <option value="dissolution">Dissolution Test</option>
                <option value="disintegration">Disintegration Test</option>
                <option value="appearance">Appearance</option>
                <option value="other">Other</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Method
              </label>
              <Input
                value={testMethod}
                onChange={(e) => setTestMethod(e.target.value)}
                placeholder="e.g., HPLC, TLC, USP Method..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={3}
                value={testNotes}
                onChange={(e) => setTestNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setQcDialogOpen(false); resetQCForm(); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddQCTest}
              disabled={!testType || addingQCTest}
            >
              {addingQCTest ? 'Adding...' : 'Add QC Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
