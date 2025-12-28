/**
 * Matching Tolerances Config Page (T117)
 */

'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { Popup } from 'devextreme-react/popup';
import { TextBox } from 'devextreme-react/text-box';
import { NumberBox } from 'devextreme-react/number-box';
import { SelectBox } from 'devextreme-react/select-box';
import { Switch } from 'devextreme-react/switch';
import DataGrid, {
  Column,
  Paging,
  FilterRow,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import {
  TOLERANCE_TYPE_OPTIONS,
  TOLERANCE_METHOD_OPTIONS,
} from '@/types/matching';

interface Tolerance {
  id: number;
  name: string;
  isDefault: boolean;
  quantityTolerancePct: number;
  quantityToleranceAbs: number;
  priceTolerancePct: number;
  priceToleranceAbs: number;
  totalTolerancePct: number;
  isActive: boolean;
  createdAt: string;
}

export default function MatchingTolerancesPage() {
  const [tolerances, setTolerances] = useState<Tolerance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTolerance, setEditingTolerance] = useState<Tolerance | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    toleranceType: 'quantity' as string,
    toleranceMethod: 'percentage' as string,
    toleranceValue: 5,
    isActive: true,
  });

  useEffect(() => {
    fetchTolerances();
  }, []);

  const fetchTolerances = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/matching-tolerances');
      const data = await response.json();
      if (data.success) {
        setTolerances(data.data);
      }
    } catch (error) {
      console.error('Error fetching tolerances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingTolerance(null);
    setFormData({
      name: '',
      toleranceType: 'quantity',
      toleranceMethod: 'percentage',
      toleranceValue: 5,
      isActive: true,
    });
    setShowDialog(true);
  };

  const handleEdit = (tolerance: Tolerance) => {
    setEditingTolerance(tolerance);
    setFormData({
      name: tolerance.name,
      toleranceType: 'quantity',
      toleranceMethod: 'percentage',
      toleranceValue: tolerance.quantityTolerancePct,
      isActive: tolerance.isActive,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a name');
      return;
    }

    setSaving(true);
    try {
      const url = editingTolerance
        ? `/api/settings/matching-tolerances/${editingTolerance.id}`
        : '/api/settings/matching-tolerances';
      const method = editingTolerance ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        setShowDialog(false);
        await fetchTolerances();
      } else {
        alert(result.error || 'Failed to save tolerance');
      }
    } catch (error) {
      console.error('Error saving tolerance:', error);
      alert('Failed to save tolerance');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tolerance: Tolerance) => {
    if (!confirm(`Delete tolerance "${tolerance.name}"?`)) return;

    try {
      const response = await fetch(`/api/settings/matching-tolerances/${tolerance.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        await fetchTolerances();
      } else {
        alert(result.error || 'Failed to delete tolerance');
      }
    } catch (error) {
      console.error('Error deleting tolerance:', error);
      alert('Failed to delete tolerance');
    }
  };

  const renderStatus = (cellData: any) => {
    const isActive = cellData.value;
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}
      >
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const renderDefault = (cellData: any) => {
    const isDefault = cellData.value;
    return isDefault ? (
      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
        Default
      </span>
    ) : null;
  };

  const renderActions = (cellData: any) => {
    const tolerance = cellData.data as Tolerance;
    return (
      <div className="flex gap-1">
        <Button
          icon="edit"
          hint="Edit"
          stylingMode="text"
          onClick={() => handleEdit(tolerance)}
        />
        {!tolerance.isDefault && (
          <Button
            icon="trash"
            hint="Delete"
            stylingMode="text"
            onClick={() => handleDelete(tolerance)}
          />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            Matching Tolerances
          </h1>
          <p className="text-gray-600">
            Configure tolerance thresholds for 3-way matching validation
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
          <h3 className="text-blue-800 font-medium mb-2">About 3-Way Matching</h3>
          <p className="text-blue-700 text-sm">
            3-way matching compares Purchase Orders, Goods Receipts, and Invoices to ensure
            accuracy. Tolerances define acceptable variance thresholds. Variances exceeding
            tolerances will generate exceptions requiring manual approval.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={tolerances}
            keyExpr="id"
            showBorders={true}
            rowAlternationEnabled={true}
            data-testid="tolerances-grid"
          >
            <FilterRow visible={true} />
            <Paging defaultPageSize={10} />
            <Toolbar>
              <Item location="before">
                <span className="text-lg font-medium">Tolerance Profiles</span>
              </Item>
              <Item location="after">
                <Button
                  text="New Tolerance"
                  icon="plus"
                  type="default"
                  stylingMode="contained"
                  onClick={handleNew}
                  data-testid="new-tolerance-btn"
                />
              </Item>
            </Toolbar>

            <Column dataField="name" caption="Name" width={200} />
            <Column
              dataField="isDefault"
              caption=""
              width={80}
              cellRender={renderDefault}
            />
            <Column
              dataField="quantityTolerancePct"
              caption="Qty Tol %"
              width={100}
              alignment="right"
              format="#0.00'%'"
            />
            <Column
              dataField="priceTolerancePct"
              caption="Price Tol %"
              width={100}
              alignment="right"
              format="#0.00'%'"
            />
            <Column
              dataField="totalTolerancePct"
              caption="Total Tol %"
              width={100}
              alignment="right"
              format="#0.00'%'"
            />
            <Column
              dataField="isActive"
              caption="Status"
              width={100}
              cellRender={renderStatus}
            />
            <Column
              caption="Actions"
              width={100}
              alignment="center"
              cellRender={renderActions}
            />
          </DataGrid>
        </div>

        {/* Add/Edit Dialog */}
        <Popup
          visible={showDialog}
          onHiding={() => setShowDialog(false)}
          title={editingTolerance ? 'Edit Tolerance' : 'New Tolerance'}
          width={450}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <TextBox
                value={formData.name}
                onValueChanged={(e) => setFormData({ ...formData, name: e.value || '' })}
                placeholder="Enter tolerance name"
                data-testid="tolerance-name-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tolerance Type
              </label>
              <SelectBox
                items={TOLERANCE_TYPE_OPTIONS}
                value={formData.toleranceType}
                valueExpr="value"
                displayExpr="label"
                onValueChanged={(e) =>
                  setFormData({ ...formData, toleranceType: e.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Method
              </label>
              <SelectBox
                items={TOLERANCE_METHOD_OPTIONS}
                value={formData.toleranceMethod}
                valueExpr="value"
                displayExpr="label"
                onValueChanged={(e) =>
                  setFormData({ ...formData, toleranceMethod: e.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tolerance Value
              </label>
              <NumberBox
                value={formData.toleranceValue}
                onValueChanged={(e) =>
                  setFormData({ ...formData, toleranceValue: e.value || 0 })
                }
                format={formData.toleranceMethod === 'percentage' ? "#0.##'%'" : '#,##0.##'}
                min={0}
                max={formData.toleranceMethod === 'percentage' ? 100 : undefined}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                value={formData.isActive}
                onValueChanged={(e) => setFormData({ ...formData, isActive: e.value })}
              />
              <span className="text-sm text-gray-700">Active</span>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button text="Cancel" onClick={() => setShowDialog(false)} />
              <Button
                text={saving ? 'Saving...' : 'Save'}
                type="default"
                stylingMode="contained"
                onClick={handleSave}
                disabled={saving}
                data-testid="save-tolerance-btn"
              />
            </div>
          </div>
        </Popup>
      </div>
    </MainLayout>
  );
}
