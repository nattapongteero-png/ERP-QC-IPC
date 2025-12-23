'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  Save,
  Search,
  FileCheck,
  AlertTriangle,
  Package,
  Check,
  ChevronRight,
  BoxSelect,
  Leaf,
  Box,
  Pill,
  PackageCheck,
  PackageX,
  AlertCircle,
  TrendingUp,
  Hash,
} from 'lucide-react';

interface Item {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  type: string;
  category?: string | null;
  primaryUnit: string;
  onHand: number | string | null;
  minStock?: number | null;
}

const itemTypes = [
  { value: '', label: 'All Types', icon: Package, color: 'gray' },
  { value: 'raw_material', label: 'Raw Material', icon: Leaf, color: 'emerald' },
  { value: 'extract', label: 'Extract', icon: FlaskConical, color: 'purple' },
  { value: 'packaging', label: 'Packaging', icon: Box, color: 'blue' },
  { value: 'wip', label: 'WIP', icon: Package, color: 'orange' },
  { value: 'finished_goods', label: 'Finished Goods', icon: Pill, color: 'indigo' },
];

const getTypeConfig = (type: string) => {
  const config: Record<string, { icon: typeof Package; bgColor: string; textColor: string; label: string }> = {
    raw_material: { icon: Leaf, bgColor: 'bg-emerald-100', textColor: 'text-emerald-700', label: 'Raw Material' },
    packaging: { icon: Box, bgColor: 'bg-blue-100', textColor: 'text-blue-700', label: 'Packaging' },
    wip: { icon: Package, bgColor: 'bg-orange-100', textColor: 'text-orange-700', label: 'WIP' },
    finished_goods: { icon: Pill, bgColor: 'bg-purple-100', textColor: 'text-purple-700', label: 'Finished Goods' },
    consumable: { icon: Package, bgColor: 'bg-gray-100', textColor: 'text-gray-700', label: 'Consumable' },
  };
  return config[type] || { icon: Package, bgColor: 'bg-gray-100', textColor: 'text-gray-700', label: type };
};

const getStockStatus = (onHand: number, minStock?: number | null) => {
  if (onHand <= 0) {
    return { label: 'Out of Stock', color: 'text-red-600', bgColor: 'bg-red-50', icon: PackageX };
  }
  if (minStock && onHand <= minStock) {
    return { label: 'Low Stock', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: AlertCircle };
  }
  return { label: 'In Stock', color: 'text-green-600', bgColor: 'bg-green-50', icon: PackageCheck };
};

export default function NewQualitySpecPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Item dialog states
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchItems, setSearchItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedItemTemp, setSelectedItemTemp] = useState<Item | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    testName: '',
    testMethod: '',
    specification: '',
    minValue: '' as string | number,
    maxValue: '' as string | number,
    unit: '',
    isCritical: false,
  });

  // Debounced item search for dialog
  useEffect(() => {
    const timer = setTimeout(() => {
      if (itemDialogOpen) {
        fetchItems();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch, typeFilter, itemDialogOpen]);

  // Load items when dialog opens
  useEffect(() => {
    if (itemDialogOpen) {
      fetchItems();
    }
  }, [itemDialogOpen]);

  const fetchItems = async () => {
    setItemsLoading(true);
    try {
      const params = new URLSearchParams();
      if (itemSearch.trim()) {
        params.append('search', itemSearch);
      }
      if (typeFilter) {
        params.append('type', typeFilter);
      }
      params.append('limit', '20');

      const response = await fetch(`/api/items?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setSearchItems(result.data?.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleSelectItemTemp = (item: Item) => {
    setSelectedItemTemp(item);
  };

  const handleConfirmItem = () => {
    if (selectedItemTemp) {
      setSelectedItem(selectedItemTemp);
      setItemDialogOpen(false);
      setItemSearch('');
      setSelectedItemTemp(null);
    }
  };

  const handleOpenItemDialog = () => {
    setSelectedItemTemp(selectedItem);
    setTypeFilter('');
    setItemSearch('');
    setSearchItems([]);
    setItemDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedItem) {
      alert('Please select an item');
      return;
    }

    if (!formData.testName.trim()) {
      alert('Please enter a test name');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/quality/specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          testName: formData.testName,
          testMethod: formData.testMethod || null,
          specification: formData.specification || null,
          minValue: formData.minValue !== '' ? Number(formData.minValue) : null,
          maxValue: formData.maxValue !== '' ? Number(formData.maxValue) : null,
          unit: formData.unit || null,
          isCritical: formData.isCritical,
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/quality/specs/${data.data.id}`);
      }
      // API errors handled by global error handler
    } catch (error) {
      console.error('Failed to create spec:', error);
      // API errors handled by global error handler
    } finally {
      setIsSaving(false);
    }
  };

  const renderItemDialogContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Select Item</h2>
              <p className="text-emerald-100 text-sm">Choose an item to create quality specification</p>
            </div>
          </div>
          {searchItems.length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                <Hash className="h-4 w-4" />
                <span>{searchItems.length} items</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                <TrendingUp className="h-4 w-4" />
                <span>{searchItems.filter(i => Number(i.onHand) > 0).length} in stock</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="px-6 py-4 bg-gray-50 border-b space-y-3">
        {/* Search Input */}
        <div className="relative">
          <DxTextBox
            placeholder="Search by item code, name, or category..."
            value={itemSearch}
            onValueChange={setItemSearch}
            mode="search"
            showClearButton
          />
        </div>

        {/* Type Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">Type:</span>
          {itemTypes.map((type) => {
            const Icon = type.icon;
            const isActive = typeFilter === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setTypeFilter(type.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Header */}
      <div className="bg-gray-100 border-b px-6 py-2.5 grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
        <div className="col-span-5">Item Details</div>
        <div className="col-span-2 text-center">Category</div>
        <div className="col-span-2 text-center">Type</div>
        <div className="col-span-2 text-right">Stock Status</div>
        <div className="col-span-1"></div>
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-auto min-h-[300px]">
        {itemsLoading && searchItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
            <DxLoadIndicator />
            <p className="font-medium mt-4">Loading items...</p>
            <p className="text-sm text-gray-400">Please wait while we fetch the data</p>
          </div>
        ) : searchItems.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {searchItems.map((item) => {
              const onHandValue = Number(item.onHand) || 0;
              const typeConfig = getTypeConfig(item.type);
              const stockStatus = getStockStatus(onHandValue, item.minStock);
              const TypeIcon = typeConfig.icon;
              const StockIcon = stockStatus.icon;
              const isSelected = selectedItemTemp?.id === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectItemTemp(item)}
                  className={`w-full px-6 py-4 text-left transition-all grid grid-cols-12 gap-4 items-center ${
                    isSelected
                      ? 'bg-emerald-50 border-l-4 border-emerald-500'
                      : 'hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  {/* Item Details */}
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-emerald-100' : typeConfig.bgColor
                    }`}>
                      <TypeIcon className={`h-6 w-6 ${isSelected ? 'text-emerald-600' : typeConfig.textColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${isSelected ? 'text-emerald-700' : 'text-gray-900'}`}>
                          {item.code}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${isSelected ? 'text-emerald-600' : 'text-gray-700'}`}>
                        {item.nameTh}
                      </p>
                      {item.nameEn && (
                        <p className="text-xs text-gray-400 truncate">{item.nameEn}</p>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="col-span-2 text-center">
                    {item.category ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                        {item.category}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </div>

                  {/* Type */}
                  <div className="col-span-2 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${typeConfig.bgColor} ${typeConfig.textColor}`}>
                      <TypeIcon className="h-3.5 w-3.5" />
                      {typeConfig.label}
                    </span>
                  </div>

                  {/* Stock Status */}
                  <div className="col-span-2 text-right">
                    <div className="inline-flex flex-col items-end">
                      <span className={`text-base font-bold ${stockStatus.color}`}>
                        {onHandValue.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500">{item.primaryUnit}</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium mt-0.5 ${stockStatus.color}`}>
                        <StockIcon className="h-3 w-3" />
                        {stockStatus.label}
                      </span>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  <div className="col-span-1 flex justify-center">
                    {isSelected ? (
                      <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="h-5 w-5 text-white" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full border-2 border-gray-200 flex items-center justify-center">
                        <div className="h-3 w-3 rounded-full bg-gray-200" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : itemSearch.length > 0 || typeFilter ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
            <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700">No items found</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md text-center">
              No items match your search criteria. Try adjusting your search term or filter.
            </p>
            <button
              type="button"
              onClick={() => { setItemSearch(''); setTypeFilter(''); }}
              className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
            <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700">No items available</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md text-center">
              There are no items in the system. Please create items in the Inventory module first.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-gray-50 px-6 py-4">
        <div className="flex items-center justify-between">
          {selectedItemTemp ? (
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${getTypeConfig(selectedItemTemp.type).bgColor}`}>
                {(() => { const Icon = getTypeConfig(selectedItemTemp.type).icon; return <Icon className={`h-5 w-5 ${getTypeConfig(selectedItemTemp.type).textColor}`} />; })()}
              </div>
              <div>
                <p className="text-sm text-gray-500">Selected item:</p>
                <p className="font-semibold text-gray-900">{selectedItemTemp.code} - {selectedItemTemp.nameTh}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Click on an item row to select it
            </p>
          )}
          <div className="flex gap-3">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => {
                setItemDialogOpen(false);
                setItemSearch('');
                setTypeFilter('');
                setSelectedItemTemp(null);
              }}
            />
            <DxButton
              text="Confirm Selection"
              type="success"
              onClick={handleConfirmItem}
              disabled={!selectedItemTemp}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="New Quality Specification"
          description="Define test criteria for quality control"
          backButton={
            <DxButton
              text="Back"
              icon="back"
              type="normal"
              stylingMode="text"
              onClick={() => router.push('/quality/specs')}
            />
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Item Selection */}
            <Card elevation="raised">
              <CardHeader>
                <CardTitle>Select Item</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedItem ? (
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Package className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-green-800">{selectedItem.code}</p>
                        <p className="text-sm text-green-600">{selectedItem.nameTh}</p>
                        <p className="text-xs text-green-500 capitalize">{selectedItem.type}</p>
                      </div>
                    </div>
                    <DxButton
                      text="Change"
                      type="normal"
                      stylingMode="outlined"
                      onClick={handleOpenItemDialog}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenItemDialog}
                    className="w-full flex items-center justify-between p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 text-gray-500 group-hover:text-green-600">
                      <BoxSelect className="h-5 w-5" />
                      <span>Click to select an item...</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-green-500" />
                  </button>
                )}
              </CardContent>
            </Card>

            {/* Test Details */}
            <Card elevation="raised">
              <CardHeader>
                <CardTitle>Test Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Test Name <span className="text-red-500">*</span>
                      </label>
                      <DxTextBox
                        placeholder="e.g., Moisture Content, pH, Microbial Count"
                        value={formData.testName}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, testName: value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Test Method
                      </label>
                      <DxTextBox
                        placeholder="e.g., USP <731>, AOAC 925.10"
                        value={formData.testMethod}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, testMethod: value }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Specification (Text)
                    </label>
                    <DxTextBox
                      placeholder="e.g., White to off-white powder, Clear colorless liquid"
                      value={formData.specification}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, specification: value }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Acceptance Criteria */}
            <Card elevation="raised">
              <CardHeader>
                <CardTitle>Acceptance Criteria (Numeric)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Value
                      </label>
                      <DxTextBox
                        placeholder="e.g., 5.0"
                        value={formData.minValue?.toString() || ''}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, minValue: value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Value
                      </label>
                      <DxTextBox
                        placeholder="e.g., 8.0"
                        value={formData.maxValue?.toString() || ''}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, maxValue: value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit
                      </label>
                      <DxTextBox
                        placeholder="e.g., %, mg/g, pH, CFU/g"
                        value={formData.unit}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, unit: value }))
                        }
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Leave min/max empty if the test is pass/fail based on text specification only.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Critical Test */}
            <Card elevation="raised">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Critical Test Parameter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <DxCheckBox
                    value={formData.isCritical}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, isCritical: value }))
                    }
                    text="Mark as Critical Test"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2 ml-6">
                  Critical tests are parameters that directly impact product safety or efficacy.
                  Failure of a critical test may result in batch rejection.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DxButton
                  text={isSaving ? 'Creating...' : 'Create Specification'}
                  icon="save"
                  type="success"
                  width="100%"
                  onClick={handleSubmit}
                  disabled={!selectedItem || !formData.testName || isSaving}
                />
                <DxButton
                  text="Cancel"
                  type="normal"
                  stylingMode="outlined"
                  width="100%"
                  onClick={() => router.push('/quality/specs')}
                />
              </CardContent>
            </Card>

            {/* Help */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  About Specifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <p>
                    <strong>Test Name:</strong> The parameter being tested (e.g., pH, moisture,
                    assay).
                  </p>
                  <p>
                    <strong>Test Method:</strong> Reference to the standard method used (e.g., USP,
                    EP, in-house).
                  </p>
                  <p>
                    <strong>Min/Max Values:</strong> Numeric acceptance limits. Results outside
                    these limits will fail.
                  </p>
                  <p>
                    <strong>Specification:</strong> Text description for non-numeric tests like
                    appearance, odor.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Common Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Common Test Parameters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    'Appearance',
                    'Color',
                    'Odor',
                    'pH',
                    'Moisture Content',
                    'Loss on Drying',
                    'Assay',
                    'Total Aerobic Count',
                    'Yeast & Mold',
                    'E. coli',
                    'Salmonella',
                    'Heavy Metals',
                  ].map((test) => (
                    <button
                      key={test}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, testName: test }))}
                      className="block w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-100 text-gray-600"
                    >
                      {test}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Item Selection Dialog */}
      <DxPopup
        visible={itemDialogOpen}
        onHiding={() => setItemDialogOpen(false)}
        title=""
        width={1000}
        height={700}
        showCloseButton
        showTitle={false}
      >
        {renderItemDialogContent()}
      </DxPopup>
    </MainLayout>
  );
}
