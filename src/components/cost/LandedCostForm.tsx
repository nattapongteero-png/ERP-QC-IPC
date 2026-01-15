'use client';

/**
 * Landed Cost Form Component
 * Creates/edits landed cost documents
 * Feature: 014-unit-cost
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { NumberBox } from 'devextreme-react/number-box';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Summary, TotalItem } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Receipt, Truck, Calculator, FileCheck } from 'lucide-react';
import type {
  LandedCostHeader,
  LandedCostHeaderCreate,
  LandedCostHeaderUpdate,
  LandedCostLineCreate,
  LandedCostType,
  AllocationBasis,
} from '@/types/unit-cost';

export interface LandedCostFormProps {
  mode: 'create' | 'edit';
  landedCostId?: number;
}

interface Vendor {
  id: number;
  code: string;
  name: string;
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorId: number;
  vendorName: string;
  totalAmount: number;
  status: string;
}

interface FormData {
  referenceType: 'po' | 'shipment';
  referenceId: number | null;
  vendorId: number | null;
  invoiceNumber: string;
  invoiceDate: string | null;
  currency: string;
  exchangeRate: number;
  lines: LandedCostLineCreate[];
}

async function fetchLandedCost(id: number): Promise<LandedCostHeader> {
  const res = await fetch(`/api/cost/landed-costs/${id}`);
  if (!res.ok) throw new Error('Failed to fetch landed cost');
  const data = await res.json();
  return data.data;
}

async function fetchVendors(): Promise<Vendor[]> {
  const res = await fetch('/api/vendors?pageSize=1000');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.items || [];
}

async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  const res = await fetch('/api/purchasing/orders?status=received&pageSize=1000');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.items || [];
}

async function createLandedCost(data: LandedCostHeaderCreate): Promise<{ id: number; documentNumber: string }> {
  const res = await fetch('/api/cost/landed-costs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create landed cost');
  }
  const result = await res.json();
  return result.data;
}

async function updateLandedCostApi(id: number, data: LandedCostHeaderUpdate): Promise<void> {
  const res = await fetch(`/api/cost/landed-costs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update landed cost');
  }
}

async function deleteLandedCostApi(id: number): Promise<void> {
  const res = await fetch(`/api/cost/landed-costs/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete landed cost');
  }
}

async function allocateLandedCostApi(id: number): Promise<{ allocations: unknown[] }> {
  const res = await fetch(`/api/cost/landed-costs/${id}/allocate`, {
    method: 'POST',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to allocate landed cost');
  }
  const result = await res.json();
  return result.data;
}

async function postLandedCostApi(id: number): Promise<void> {
  const res = await fetch(`/api/cost/landed-costs/${id}/post`, {
    method: 'POST',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to post landed cost');
  }
}

const costTypes: { value: LandedCostType; label: string }[] = [
  { value: 'freight', label: 'Freight' },
  { value: 'duty', label: 'Duty' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'handling', label: 'Handling' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

const allocationBases: { value: AllocationBasis; label: string }[] = [
  { value: 'value', label: 'By Value' },
  { value: 'quantity', label: 'By Quantity' },
  { value: 'weight', label: 'By Weight' },
  { value: 'volume', label: 'By Volume' },
];

const currencies = ['THB', 'USD', 'EUR', 'JPY', 'CNY'];

const defaultLine: LandedCostLineCreate = {
  costType: 'freight',
  description: '',
  amount: 0,
  allocationBasis: 'value',
};

export function LandedCostForm({ mode, landedCostId }: LandedCostFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    referenceType: 'po',
    referenceId: null,
    vendorId: null,
    invoiceNumber: '',
    invoiceDate: null,
    currency: 'THB',
    exchangeRate: 1,
    lines: [{ ...defaultLine }],
  });

  // Fetch existing landed cost for edit mode
  const { data: landedCost, isLoading: isLoadingLandedCost } = useQuery({
    queryKey: ['landed-cost', landedCostId],
    queryFn: () => fetchLandedCost(landedCostId!),
    enabled: mode === 'edit' && !!landedCostId,
  });

  // Fetch vendors for dropdown
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: fetchVendors,
  });

  // Fetch POs for dropdown
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['po-list-for-landed-cost'],
    queryFn: fetchPurchaseOrders,
  });

  // Update form when landed cost data loads
  useEffect(() => {
    if (landedCost) {
      setFormData({
        referenceType: landedCost.referenceType,
        referenceId: landedCost.referenceId,
        vendorId: landedCost.vendorId,
        invoiceNumber: landedCost.invoiceNumber || '',
        invoiceDate: landedCost.invoiceDate,
        currency: landedCost.currency,
        exchangeRate: landedCost.exchangeRate,
        lines: landedCost.lines?.map((l) => ({
          costType: l.costType,
          description: l.description,
          amount: l.amount,
          allocationBasis: l.allocationBasis,
        })) || [{ ...defaultLine }],
      });
    }
  }, [landedCost]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createLandedCost,
    onSuccess: (result) => {
      notify(`Landed cost ${result.documentNumber} created successfully`, 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['landed-costs'] });
      router.push(`/cost/landed-costs/${result.id}`);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: LandedCostHeaderUpdate) => updateLandedCostApi(landedCostId!, data),
    onSuccess: () => {
      notify('Landed cost updated successfully', 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['landed-costs'] });
      queryClient.invalidateQueries({ queryKey: ['landed-cost', landedCostId] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLandedCostApi(landedCostId!),
    onSuccess: () => {
      notify('Landed cost deleted successfully', 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['landed-costs'] });
      router.push('/cost/landed-costs');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const allocateMutation = useMutation({
    mutationFn: () => allocateLandedCostApi(landedCostId!),
    onSuccess: (result) => {
      notify(`Allocated to ${result.allocations.length} items`, 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['landed-cost', landedCostId] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const postMutation = useMutation({
    mutationFn: () => postLandedCostApi(landedCostId!),
    onSuccess: () => {
      notify('Landed cost posted successfully', 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['landed-costs'] });
      queryClient.invalidateQueries({ queryKey: ['landed-cost', landedCostId] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    if (!formData.referenceId) {
      notify('Please select a Purchase Order', 'error', 3000);
      return;
    }
    if (formData.lines.length === 0 || formData.lines.every((l) => l.amount <= 0)) {
      notify('Please add at least one cost line with amount > 0', 'error', 3000);
      return;
    }

    const payload = {
      referenceType: formData.referenceType,
      referenceId: formData.referenceId,
      vendorId: formData.vendorId,
      invoiceNumber: formData.invoiceNumber || null,
      invoiceDate: formData.invoiceDate,
      currency: formData.currency,
      exchangeRate: formData.exchangeRate,
      lines: formData.lines.filter((l) => l.amount > 0),
    };

    if (mode === 'create') {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, { ...defaultLine }],
    }));
  };

  const removeLine = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const updateLine = (index: number, field: keyof LandedCostLineCreate, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      ),
    }));
  };

  const totalAmount = formData.lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const isEditable = mode === 'create' || landedCost?.status === 'draft';
  const canAllocate = mode === 'edit' && landedCost?.status === 'draft';
  const canPost = mode === 'edit' && landedCost?.status === 'allocated';

  if (mode === 'edit' && isLoadingLandedCost) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="landed-cost-form">
      <ResponsivePageHeader
        title={mode === 'create' ? 'New Landed Cost' : `Landed Cost: ${landedCost?.documentNumber}`}
        icon={Truck}
        subtitle={mode === 'create' ? 'Allocate freight, duty, and other costs to purchase receipts' : undefined}
        actions={
          <div className="flex gap-2">
            {canAllocate && (
              <Button
                text="Allocate"
                icon="chart"
                type="default"
                stylingMode="outlined"
                onClick={() => allocateMutation.mutate()}
                disabled={allocateMutation.isPending}
              />
            )}
            {canPost && (
              <Button
                text="Post"
                icon="check"
                type="success"
                onClick={() => postMutation.mutate()}
                disabled={postMutation.isPending}
              />
            )}
            {isEditable && (
              <>
                <Button
                  text="Cancel"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => router.push('/cost/landed-costs')}
                />
                <Button
                  text={mode === 'create' ? 'Create' : 'Save'}
                  type="default"
                  icon="save"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </>
            )}
            {mode === 'edit' && landedCost?.status === 'draft' && (
              <Button
                text="Delete"
                type="danger"
                stylingMode="outlined"
                icon="trash"
                onClick={() => setShowDeleteConfirm(true)}
              />
            )}
          </div>
        }
      />

      {/* Status Badge */}
      {mode === 'edit' && landedCost && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              landedCost.status === 'draft'
                ? 'bg-yellow-100 text-yellow-800'
                : landedCost.status === 'allocated'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {landedCost.status.charAt(0).toUpperCase() + landedCost.status.slice(1)}
          </span>
        </div>
      )}

      {/* Header Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Header Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Order *
            </label>
            <SelectBox
              dataSource={purchaseOrders}
              displayExpr="poNumber"
              valueExpr="id"
              value={formData.referenceId}
              onValueChanged={(e) => {
                const po = purchaseOrders.find((p) => p.id === e.value);
                setFormData((prev) => ({
                  ...prev,
                  referenceId: e.value,
                  vendorId: po?.vendorId || null,
                }));
              }}
              disabled={!isEditable}
              searchEnabled
              showClearButton
              placeholder="Select PO..."
              data-testid="po-select"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor
            </label>
            <SelectBox
              dataSource={vendors}
              displayExpr="name"
              valueExpr="id"
              value={formData.vendorId}
              onValueChanged={(e) => setFormData((prev) => ({ ...prev, vendorId: e.value }))}
              disabled={!isEditable}
              searchEnabled
              showClearButton
              placeholder="Select vendor..."
              data-testid="vendor-select"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Number
            </label>
            <TextBox
              value={formData.invoiceNumber}
              onValueChanged={(e) => setFormData((prev) => ({ ...prev, invoiceNumber: e.value }))}
              disabled={!isEditable}
              placeholder="Enter invoice number"
              data-testid="invoice-number-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Date
            </label>
            <DxDateBox
              value={formData.invoiceDate || undefined}
              onValueChanged={(e) => setFormData((prev) => ({ ...prev, invoiceDate: e.value }))}
              disabled={!isEditable}
              data-testid="invoice-date-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <SelectBox
              items={currencies}
              value={formData.currency}
              onValueChanged={(e) => setFormData((prev) => ({ ...prev, currency: e.value }))}
              disabled={!isEditable}
              data-testid="currency-select"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exchange Rate
            </label>
            <NumberBox
              value={formData.exchangeRate}
              onValueChanged={(e) => setFormData((prev) => ({ ...prev, exchangeRate: e.value }))}
              disabled={!isEditable}
              min={0.0001}
              format="#,##0.####"
              data-testid="exchange-rate-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cost Lines */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Cost Lines
          </CardTitle>
          {isEditable && (
            <Button
              text="Add Line"
              icon="plus"
              type="default"
              stylingMode="outlined"
              onClick={addLine}
              data-testid="add-line-button"
            />
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {formData.lines.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-gray-50 rounded-lg"
                data-testid={`cost-line-${index}`}
              >
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Cost Type</label>
                  <SelectBox
                    dataSource={costTypes}
                    displayExpr="label"
                    valueExpr="value"
                    value={line.costType}
                    onValueChanged={(e) => updateLine(index, 'costType', e.value)}
                    disabled={!isEditable}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <TextBox
                    value={line.description || ''}
                    onValueChanged={(e) => updateLine(index, 'description', e.value)}
                    disabled={!isEditable}
                    placeholder="Description"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Amount</label>
                  <NumberBox
                    value={line.amount}
                    onValueChanged={(e) => updateLine(index, 'amount', e.value)}
                    disabled={!isEditable}
                    min={0}
                    format="#,##0.00"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Allocation Basis</label>
                  <SelectBox
                    dataSource={allocationBases}
                    displayExpr="label"
                    valueExpr="value"
                    value={line.allocationBasis}
                    onValueChanged={(e) => updateLine(index, 'allocationBasis', e.value)}
                    disabled={!isEditable}
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  {isEditable && formData.lines.length > 1 && (
                    <Button
                      icon="trash"
                      type="danger"
                      stylingMode="text"
                      onClick={() => removeLine(index)}
                      hint="Remove line"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-4 flex justify-end">
            <div className="bg-blue-50 px-6 py-3 rounded-lg">
              <span className="text-sm text-gray-600">Total Amount: </span>
              <span className="text-xl font-bold text-blue-600">
                {new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(totalAmount)}
              </span>
              <span className="ml-1 text-sm text-gray-600">{formData.currency}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Allocations (for edit mode) */}
      {mode === 'edit' && landedCost?.allocations && landedCost.allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Allocations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataGrid
              dataSource={landedCost.allocations}
              showBorders
              columnAutoWidth
              rowAlternationEnabled
            >
              <Column dataField="itemCode" caption="Item Code" width={120} />
              <Column dataField="itemName" caption="Item Name" />
              <Column dataField="basisValue" caption="Basis Value" format="#,##0.00" width={120} />
              <Column dataField="allocatedAmount" caption="Allocated Amount" format="#,##0.0000" width={140} />
              <Summary>
                <TotalItem column="allocatedAmount" summaryType="sum" valueFormat="#,##0.0000" />
              </Summary>
            </DataGrid>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this landed cost? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                text="Cancel"
                type="normal"
                stylingMode="outlined"
                onClick={() => setShowDeleteConfirm(false)}
              />
              <Button
                text="Delete"
                type="danger"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandedCostForm;
