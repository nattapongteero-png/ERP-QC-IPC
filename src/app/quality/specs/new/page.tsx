'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { PageHeader } from '@/components/ui/page-header';
import { ItemSearchDialog, Item } from '@/components/ui/item-search-dialog';
import {
  FileCheck,
  AlertTriangle,
  Package,
  ChevronRight,
  BoxSelect,
} from 'lucide-react';

export default function NewQualitySpecPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Item dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
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

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setItemDialogOpen(false);
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

  return (
    
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
                      onClick={() => setItemDialogOpen(true)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setItemDialogOpen(true)}
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
      <ItemSearchDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSelect={handleSelectItem}
        title="Select Item"
        showStock
      />
    
  );
}
