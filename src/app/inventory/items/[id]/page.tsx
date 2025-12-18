'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Trash2, Package, AlertTriangle } from 'lucide-react';
import {
  useItemCategories,
  useItemUnits,
  categoriesToOptions,
  unitsToOptions,
} from '@/hooks/use-lookup-data';

interface Item {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  type: string;
  category: string | null;
  description: string | null;
  primaryUnit: string;
  secondaryUnit: string | null;
  conversionFactor: number | null;
  minStock: number | null;
  maxStock: number | null;
  reorderPoint: number | null;
  safetyStock: number | null;
  shelfLifeDays: number | null;
  storageConditions: string | null;
  isLotControlled: boolean;
  isFefo: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Item types are fixed business logic
const itemTypes = [
  { value: 'raw_material', label: 'Raw Material (วัตถุดิบ)' },
  { value: 'extract', label: 'Extract (สารสกัด)' },
  { value: 'excipient', label: 'Excipient (สารช่วย)' },
  { value: 'packaging', label: 'Packaging (บรรจุภัณฑ์)' },
  { value: 'wip', label: 'WIP (งานระหว่างผลิต)' },
  { value: 'finished_product', label: 'Finished Product (สินค้าสำเร็จรูป)' },
];

// Storage options (could be moved to lookup table in future)
const storageOptions = [
  { value: 'room_temp', label: 'Room Temperature (15-30°C)' },
  { value: 'cool', label: 'Cool Storage (8-15°C)' },
  { value: 'refrigerated', label: 'Refrigerated (2-8°C)' },
  { value: 'frozen', label: 'Frozen (-20°C)' },
  { value: 'controlled', label: 'Controlled Environment' },
];

export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const isNew = params.id === 'new';

  // Fetch categories and units from database
  const { data: categories, isLoading: categoriesLoading } = useItemCategories();
  const { data: units, isLoading: unitsLoading } = useItemUnits();

  // Convert to select options
  const categoryOptions = useMemo(
    () => categoriesToOptions(categories, true),
    [categories]
  );
  const unitOptions = useMemo(
    () => unitsToOptions(units, false),
    [units]
  );
  const unitOptionsWithNone = useMemo(
    () => unitsToOptions(units, true),
    [units]
  );

  const [item, setItem] = useState<Partial<Item>>({
    code: '',
    nameTh: '',
    nameEn: '',
    type: 'raw_material',
    category: '',
    description: '',
    primaryUnit: 'kg',
    secondaryUnit: '',
    conversionFactor: 1,
    minStock: 0,
    maxStock: 0,
    reorderPoint: 0,
    safetyStock: 0,
    shelfLifeDays: 365,
    storageConditions: 'room_temp',
    isLotControlled: true,
    isFefo: true,
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew) {
      fetchItem();
    }
  }, [params.id]);

  const fetchItem = async () => {
    try {
      const res = await fetch(`/api/items/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setItem(data.data);
      } else {
        setError(data.error || 'Failed to load item');
      }
    } catch (err) {
      setError('Failed to load item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      const url = isNew ? '/api/items' : `/api/items/${params.id}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      
      const data = await res.json();
      
      if (data.success) {
        router.push('/inventory/items');
      } else {
        setError(data.error || 'Failed to save item');
      }
    } catch (err) {
      setError('Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      const res = await fetch(`/api/items/${params.id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        router.push('/inventory/items');
      } else {
        setError(data.error || 'Failed to delete item');
      }
    } catch (err) {
      setError('Failed to delete item');
    }
  };

  const updateField = (field: keyof Item, value: any) => {
    setItem(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isNew ? 'New Item' : `Item: ${item.code}`}
              </h1>
              <p className="text-gray-600">
                {isNew ? 'สร้างรายการใหม่' : 'แก้ไขข้อมูลรายการ'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!isNew && (
              <Button variant="danger" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold">Basic Information</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Code <span className="text-red-500">*</span>
                </label>
                <Input
                  value={item.code || ''}
                  onChange={(e) => updateField('code', e.target.value)}
                  placeholder="e.g., RM-001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name (Thai) <span className="text-red-500">*</span>
                </label>
                <Input
                  value={item.nameTh || ''}
                  onChange={(e) => updateField('nameTh', e.target.value)}
                  placeholder="ชื่อภาษาไทย"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name (English)
                </label>
                <Input
                  value={item.nameEn || ''}
                  onChange={(e) => updateField('nameEn', e.target.value)}
                  placeholder="English name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <Select
                  options={itemTypes}
                  value={item.type || ''}
                  onChange={(e) => updateField('type', e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <Select
                  options={categoryOptions}
                  value={item.category || ''}
                  onChange={(e) => updateField('category', e.target.value)}
                  disabled={categoriesLoading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={3}
                  value={item.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="รายละเอียดเพิ่มเติม"
                />
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.isActive}
                    onChange={(e) => updateField('isActive', e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>
          </Card>

          {/* Units & Conversion */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Units & Conversion</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Unit <span className="text-red-500">*</span>
                </label>
                <Select
                  options={unitOptions}
                  value={item.primaryUnit || ''}
                  onChange={(e) => updateField('primaryUnit', e.target.value)}
                  disabled={unitsLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secondary Unit
                </label>
                <Select
                  options={unitOptionsWithNone}
                  value={item.secondaryUnit || ''}
                  onChange={(e) => updateField('secondaryUnit', e.target.value)}
                  disabled={unitsLoading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conversion Factor
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={item.conversionFactor || ''}
                  onChange={(e) => updateField('conversionFactor', parseFloat(e.target.value))}
                  placeholder="1 secondary = X primary"
                />
                <p className="text-xs text-gray-500 mt-1">
                  1 {item.secondaryUnit || 'secondary'} = {item.conversionFactor || 1} {item.primaryUnit || 'primary'}
                </p>
              </div>
            </div>
          </Card>

          {/* Stock Management */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Stock Management</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Stock
                  </label>
                  <Input
                    type="number"
                    value={item.minStock || ''}
                    onChange={(e) => updateField('minStock', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Stock
                  </label>
                  <Input
                    type="number"
                    value={item.maxStock || ''}
                    onChange={(e) => updateField('maxStock', parseFloat(e.target.value))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reorder Point
                  </label>
                  <Input
                    type="number"
                    value={item.reorderPoint || ''}
                    onChange={(e) => updateField('reorderPoint', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Safety Stock
                  </label>
                  <Input
                    type="number"
                    value={item.safetyStock || ''}
                    onChange={(e) => updateField('safetyStock', parseFloat(e.target.value))}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.isLotControlled}
                    onChange={(e) => updateField('isLotControlled', e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Lot Controlled</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.isFefo}
                    onChange={(e) => updateField('isFefo', e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">FEFO (First Expiry First Out)</span>
                </label>
              </div>
            </div>
          </Card>

          {/* Storage & Shelf Life */}
          <Card>
            <h2 className="text-lg font-semibold mb-4">Storage & Shelf Life</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shelf Life (Days)
                </label>
                <Input
                  type="number"
                  value={item.shelfLifeDays || ''}
                  onChange={(e) => updateField('shelfLifeDays', parseInt(e.target.value))}
                  placeholder="365"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Storage Conditions
                </label>
                <Select
                  options={storageOptions}
                  value={item.storageConditions || ''}
                  onChange={(e) => updateField('storageConditions', e.target.value)}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Item Status Card */}
        {!isNew && (
          <Card>
            <h2 className="text-lg font-semibold mb-4">Item Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={item.isActive ? 'success' : 'danger'}>
                  {item.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Lot Controlled</p>
                <Badge variant={item.isLotControlled ? 'info' : 'default'}>
                  {item.isLotControlled ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">FEFO</p>
                <Badge variant={item.isFefo ? 'info' : 'default'}>
                  {item.isFefo ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-sm font-medium">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
