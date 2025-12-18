'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { PageHeader } from '@/components/ui/page-header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Trash2,
  Plus,
  Search,
  Package,
  ChevronRight,
  Loader2,
  BoxSelect,
  Check,
} from 'lucide-react';

interface Product {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  primaryUnit: string;
  category: string | null;
}

interface Item {
  id: number;
  code: string;
  nameTh: string;
  primaryUnit: string;
  type: string;
}

interface BOMLine {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  isOptional: boolean;
  notes: string;
}

export default function NewBOMPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [version, setVersion] = useState('1.0');
  const [batchSize, setBatchSize] = useState('');
  const [batchUnit, setBatchUnit] = useState('');
  const [yieldTarget, setYieldTarget] = useState('95');
  const [lossAllowance, setLossAllowance] = useState('5');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [lines, setLines] = useState<BOMLine[]>([]);

  // Product Dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductTemp, setSelectedProductTemp] = useState<Product | null>(null);

  // Item/Material Dialog state
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Line counter for temporary IDs
  const [lineCounter, setLineCounter] = useState(1);

  // Debounced product search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch.length >= 1 && productDialogOpen) {
        searchProducts();
      } else if (productSearch.length === 0 && productDialogOpen) {
        // Load recent products when dialog opens
        loadRecentProducts();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, productDialogOpen]);

  // Load recent products when dialog opens
  useEffect(() => {
    if (productDialogOpen && products.length === 0) {
      loadRecentProducts();
    }
  }, [productDialogOpen]);

  // Debounced item search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (itemSearch.length >= 1 && materialDialogOpen) {
        searchItems();
      } else if (itemSearch.length === 0 && materialDialogOpen) {
        loadRecentMaterials();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch, materialDialogOpen]);

  // Load recent materials when dialog opens
  useEffect(() => {
    if (materialDialogOpen && items.length === 0) {
      loadRecentMaterials();
    }
  }, [materialDialogOpen]);

  const loadRecentProducts = async () => {
    setProductsLoading(true);
    try {
      const response = await fetch(`/api/items?type=finished_product&limit=20`);
      const result = await response.json();
      if (result.success) {
        setProducts(result.data.items || []);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setProductsLoading(false);
    }
  };

  const searchProducts = async () => {
    setProductsLoading(true);
    try {
      const response = await fetch(`/api/items?search=${encodeURIComponent(productSearch)}&type=finished_product&limit=20`);
      const result = await response.json();
      if (result.success) {
        setProducts(result.data.items || []);
      }
    } catch (error) {
      console.error('Failed to search products:', error);
    } finally {
      setProductsLoading(false);
    }
  };

  const loadRecentMaterials = async () => {
    setItemsLoading(true);
    try {
      const response = await fetch(`/api/items?limit=20`);
      const result = await response.json();
      if (result.success) {
        // Filter out finished products (they shouldn't be BOM ingredients)
        const filteredItems = (result.data.items || []).filter((item: Item) => item.type !== 'finished_product');
        setItems(filteredItems);
      }
    } catch (error) {
      console.error('Failed to load materials:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const searchItems = async () => {
    setItemsLoading(true);
    try {
      const response = await fetch(`/api/items?search=${encodeURIComponent(itemSearch)}&limit=20`);
      const result = await response.json();
      if (result.success) {
        // Filter out finished products (they shouldn't be BOM ingredients)
        const filteredItems = (result.data.items || []).filter((item: Item) => item.type !== 'finished_product');
        setItems(filteredItems);
      }
    } catch (error) {
      console.error('Failed to search items:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProductTemp(product);
  };

  const handleConfirmProduct = () => {
    if (selectedProductTemp) {
      setSelectedProduct(selectedProductTemp);
      setBatchUnit(selectedProductTemp.primaryUnit);
      // Auto-generate BOM code based on product code
      if (!code) {
        setCode(`BOM-${selectedProductTemp.code}`);
      }
      if (!name) {
        setName(`BOM for ${selectedProductTemp.nameTh}`);
      }
      setProductDialogOpen(false);
      setProductSearch('');
      setSelectedProductTemp(null);
    }
  };

  const handleOpenProductDialog = () => {
    setSelectedProductTemp(selectedProduct);
    setProductDialogOpen(true);
  };

  const handleAddItem = (item: Item) => {
    // Check if item already exists in lines
    if (lines.some(line => line.itemId === item.id)) {
      alert('This item is already in the BOM');
      return;
    }

    const newLine: BOMLine = {
      id: lineCounter,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.nameTh,
      quantity: 0,
      unit: item.primaryUnit,
      isOptional: false,
      notes: '',
    };

    setLines([...lines, newLine]);
    setLineCounter(lineCounter + 1);
    setItemSearch('');
    setItems([]);
    setMaterialDialogOpen(false);
  };

  const handleUpdateLine = (id: number, field: keyof BOMLine, value: any) => {
    setLines(lines.map(line =>
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const handleRemoveLine = (id: number) => {
    setLines(lines.filter(line => line.id !== id));
  };

  const handleSubmit = async () => {
    if (!code || !name || !selectedProduct || !batchSize || !batchUnit) {
      alert('Please fill in all required fields');
      return;
    }

    if (lines.length === 0) {
      alert('Please add at least one material to the BOM');
      return;
    }

    // Validate all lines have quantities
    const invalidLines = lines.filter(line => !line.quantity || line.quantity <= 0);
    if (invalidLines.length > 0) {
      alert('Please enter valid quantities for all materials');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          productId: selectedProduct.id,
          version,
          batchSize: parseFloat(batchSize),
          batchUnit,
          yieldTarget: yieldTarget ? parseFloat(yieldTarget) : null,
          lossAllowance: lossAllowance ? parseFloat(lossAllowance) : null,
          effectiveDate: effectiveDate || null,
          lines: lines.map((line, index) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            unit: line.unit,
            sequence: index + 1,
            isOptional: line.isOptional,
            notes: line.notes,
          })),
        }),
      });

      const result = await response.json();
      if (result.success) {
        router.push(`/production/bom/${result.data.id}`);
      }
      // Error is handled by global error handler - no need for alert
    } catch (error) {
      console.error('Failed to create BOM:', error);
      // Network error is handled by global error handler
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Create New BOM"
          description="Define a new Bill of Materials / Recipe"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product <span className="text-red-500">*</span>
                  </label>
                  {selectedProduct ? (
                    <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <Package className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-800">{selectedProduct.code}</p>
                          <p className="text-sm text-emerald-600">{selectedProduct.nameTh}</p>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={handleOpenProductDialog}>
                        Change
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenProductDialog}
                      className="w-full flex items-center justify-between p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 text-gray-500 group-hover:text-emerald-600">
                        <BoxSelect className="h-5 w-5" />
                        <span>Click to select a product...</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-500" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      BOM Code <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g., BOM-PROD001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Version
                    </label>
                    <Input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    BOM Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., BOM for Product ABC"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Batch Size <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      step="0.001"
                      value={batchSize}
                      onChange={(e) => setBatchSize(e.target.value)}
                      placeholder="e.g., 1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Batch Unit <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={batchUnit}
                      onChange={(e) => setBatchUnit(e.target.value)}
                      placeholder="e.g., kg, L, pcs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Yield Target (%)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={yieldTarget}
                      onChange={(e) => setYieldTarget(e.target.value)}
                      placeholder="95"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Loss Allowance (%)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={lossAllowance}
                      onChange={(e) => setLossAllowance(e.target.value)}
                      placeholder="5"
                    />
                  </div>
                </div>

                <DatePicker
                  label="Effective Date"
                  value={effectiveDate}
                  onChange={(value) => setEffectiveDate(value)}
                  showQuickActions={false}
                  size="sm"
                />
              </CardContent>
            </Card>

            {/* BOM Lines */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Materials / Ingredients</CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setMaterialDialogOpen(true)}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Add Material
                  </Button>
                </div>
              </CardHeader>
              <CardContent>

                {/* Lines Table */}
                {lines.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">#</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Item</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Quantity</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Unit</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Optional</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Notes</th>
                          <th className="px-4 py-2 text-center text-sm font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, index) => (
                          <tr key={line.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 text-center">{index + 1}</td>
                            <td className="px-4 py-2">
                              <p className="font-medium">{line.itemCode}</p>
                              <p className="text-sm text-gray-500">{line.itemName}</p>
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                step="0.001"
                                value={line.quantity || ''}
                                onChange={(e) => handleUpdateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-24"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={line.unit}
                                onChange={(e) => handleUpdateLine(line.id, 'unit', e.target.value)}
                                className="w-20"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={line.isOptional}
                                onChange={(e) => handleUpdateLine(line.id, 'isOptional', e.target.checked)}
                                className="h-4 w-4 text-emerald-600 rounded border-gray-300"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                value={line.notes}
                                onChange={(e) => handleUpdateLine(line.id, 'notes', e.target.value)}
                                placeholder="Notes..."
                                className="w-32"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleRemoveLine(line.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No materials added yet</p>
                    <p className="text-sm">Click &quot;Add Material&quot; to add ingredients to this BOM</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Product</p>
                  <p className="font-medium">{selectedProduct?.nameTh || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Batch Size</p>
                  <p className="font-medium">{batchSize ? `${batchSize} ${batchUnit}` : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Materials</p>
                  <p className="font-medium">{lines.length} items</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge variant="secondary">Draft</Badge>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={saving || !code || !name || !selectedProduct || !batchSize || lines.length === 0}
                  >
                    {saving ? 'Creating...' : 'Create BOM'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => router.push('/production/bom')}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Product Selection Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              Select Product
            </DialogTitle>
            <DialogDescription>
              Search and select a finished product for this BOM
            </DialogDescription>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative">
            <Input
              placeholder="Search by product code or name..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              leftIcon={productsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              autoFocus
            />
          </div>

          {/* Product List */}
          <div className="flex-1 overflow-auto min-h-[300px] border rounded-lg">
            {productsLoading && products.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading products...
              </div>
            ) : products.length > 0 ? (
              <div className="divide-y">
                {products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${
                      selectedProductTemp?.id === product.id ? 'bg-emerald-50 border-l-4 border-emerald-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        selectedProductTemp?.id === product.id ? 'bg-emerald-100' : 'bg-gray-100'
                      }`}>
                        <Package className={`h-5 w-5 ${
                          selectedProductTemp?.id === product.id ? 'text-emerald-600' : 'text-gray-500'
                        }`} />
                      </div>
                      <div>
                        <p className={`font-semibold ${
                          selectedProductTemp?.id === product.id ? 'text-emerald-800' : 'text-gray-900'
                        }`}>
                          {product.code}
                        </p>
                        <p className={`text-sm ${
                          selectedProductTemp?.id === product.id ? 'text-emerald-600' : 'text-gray-500'
                        }`}>
                          {product.nameTh}
                        </p>
                        {product.nameEn && (
                          <p className="text-xs text-gray-400">{product.nameEn}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" size="sm">{product.primaryUnit}</Badge>
                      {selectedProductTemp?.id === product.id && (
                        <Check className="h-5 w-5 text-emerald-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : productSearch.length > 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                <Search className="h-12 w-12 text-gray-300 mb-3" />
                <p className="font-medium">No products found</p>
                <p className="text-sm text-center mt-1">
                  Try a different search term or check if the product exists in the system
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                <Package className="h-12 w-12 text-gray-300 mb-3" />
                <p className="font-medium">No finished products available</p>
                <p className="text-sm text-center mt-1">
                  Create finished products in the Items module first
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-500">
              {selectedProductTemp ? (
                <>Selected: <span className="font-medium text-emerald-600">{selectedProductTemp.code}</span></>
              ) : (
                'Click on a product to select it'
              )}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setProductDialogOpen(false);
                  setProductSearch('');
                  setSelectedProductTemp(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmProduct}
                disabled={!selectedProductTemp}
              >
                Select Product
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Material Selection Dialog */}
      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BoxSelect className="h-5 w-5 text-emerald-600" />
              Select Material
            </DialogTitle>
            <DialogDescription>
              Search and select materials/ingredients to add to this BOM
            </DialogDescription>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative">
            <Input
              placeholder="Search by material code or name..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              leftIcon={itemsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              autoFocus
            />
          </div>

          {/* Material List */}
          <div className="flex-1 overflow-auto min-h-[300px] border rounded-lg">
            {itemsLoading && items.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading materials...
              </div>
            ) : items.length > 0 ? (
              <div className="divide-y">
                {items.map((item) => {
                  const isAlreadyAdded = lines.some(line => line.itemId === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => !isAlreadyAdded && handleAddItem(item)}
                      disabled={isAlreadyAdded}
                      className={`w-full p-4 text-left transition-colors flex items-center justify-between ${
                        isAlreadyAdded
                          ? 'bg-gray-50 cursor-not-allowed opacity-60'
                          : 'hover:bg-emerald-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          isAlreadyAdded ? 'bg-gray-100' : 'bg-emerald-100'
                        }`}>
                          <BoxSelect className={`h-5 w-5 ${
                            isAlreadyAdded ? 'text-gray-400' : 'text-emerald-600'
                          }`} />
                        </div>
                        <div>
                          <p className={`font-semibold ${
                            isAlreadyAdded ? 'text-gray-400' : 'text-gray-900'
                          }`}>
                            {item.code}
                          </p>
                          <p className={`text-sm ${
                            isAlreadyAdded ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {item.nameTh}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" size="sm">
                          {item.type.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" size="sm">{item.primaryUnit}</Badge>
                        {isAlreadyAdded && (
                          <Badge variant="success" size="sm">
                            <Check className="h-3 w-3 mr-1" />
                            Added
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : itemSearch.length > 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                <Search className="h-12 w-12 text-gray-300 mb-3" />
                <p className="font-medium">No materials found</p>
                <p className="text-sm text-center mt-1">
                  Try a different search term or check if the material exists in the system
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                <BoxSelect className="h-12 w-12 text-gray-300 mb-3" />
                <p className="font-medium">No materials available</p>
                <p className="text-sm text-center mt-1">
                  Create raw materials or packaging items in the Items module first
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-500">
              Click on a material to add it to the BOM
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setMaterialDialogOpen(false);
                setItemSearch('');
                setItems([]);
              }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
