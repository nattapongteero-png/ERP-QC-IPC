'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { ArrowLeft, Save, FlaskConical, Search } from 'lucide-react';

interface InventoryLot {
  id: number;
  lotNumber: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  status: string;
  expiryDate: string;
}

interface QualitySpec {
  id: number;
  itemId: number;
  testName: string;
  testMethod: string;
  specification: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string;
  isCritical: boolean;
}

const testTypeOptions = [
  { value: 'incoming', label: 'Incoming QC' },
  { value: 'in_process', label: 'In-Process QC' },
  { value: 'final', label: 'Final QC' },
];

function NewQualityTestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lotIdParam = searchParams.get('lotId');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Search states
  const [lotSearch, setLotSearch] = useState('');
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [isSearchingLots, setIsSearchingLots] = useState(false);

  // Selected states
  const [selectedLot, setSelectedLot] = useState<InventoryLot | null>(null);
  const [specs, setSpecs] = useState<QualitySpec[]>([]);
  const [selectedSpec, setSelectedSpec] = useState<QualitySpec | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    testType: 'incoming',
    sampleNumber: '',
  });

  // Fetch lot from URL parameter if provided
  useEffect(() => {
    if (lotIdParam && !selectedLot) {
      fetchLotById(parseInt(lotIdParam));
    }
  }, [lotIdParam]);

  const fetchLotById = async (lotId: number) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/inventory/lots/${lotId}`);
      const data = await res.json();
      if (data.success && data.data) {
        const lot: InventoryLot = {
          id: data.data.id,
          lotNumber: data.data.lotNumber,
          itemId: data.data.itemId,
          itemCode: data.data.itemCode,
          itemName: data.data.itemNameTh || data.data.itemName,
          quantity: data.data.quantity,
          unit: data.data.unit,
          status: data.data.status,
          expiryDate: data.data.expiryDate,
        };
        setSelectedLot(lot);
        fetchSpecsForItem(lot.itemId);
      }
    } catch (error) {
      console.error('Failed to fetch lot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchLots = async () => {
    if (!lotSearch.trim()) return;
    setIsSearchingLots(true);
    try {
      const res = await fetch(`/api/inventory/lots?search=${encodeURIComponent(lotSearch)}&limit=10`);
      const data = await res.json();
      if (data.success) {
        setLots(data.data?.items || []);
      }
    } catch (error) {
      console.error('Failed to search lots:', error);
    } finally {
      setIsSearchingLots(false);
    }
  };

  const fetchSpecsForItem = async (itemId: number) => {
    try {
      const res = await fetch(`/api/quality/specs?itemId=${itemId}`);
      const data = await res.json();
      if (data.success) {
        setSpecs(data.data?.items || data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch specs:', error);
      setSpecs([]);
    }
  };

  const handleSelectLot = (lot: InventoryLot) => {
    setSelectedLot(lot);
    setSelectedSpec(null);
    setLots([]);
    setLotSearch('');
    fetchSpecsForItem(lot.itemId);
  };

  const handleSelectSpec = (specId: string) => {
    const spec = specs.find((s) => s.id === parseInt(specId));
    setSelectedSpec(spec || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLot || !selectedSpec) {
      alert('Please select a lot and a test specification');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/quality/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: selectedLot.id,
          specId: selectedSpec.id,
          testType: formData.testType,
          sampleNumber: formData.sampleNumber || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/quality/tests/${data.data.id}`);
      }
      // API errors handled by global error handler
    } catch (error) {
      console.error('Failed to create test:', error);
      // API errors handled by global error handler
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="New Quality Test"
          description="Create a new quality control test"
          backButton={
            <Button variant="ghost" size="sm" onClick={() => router.push('/quality/tests')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          }
        />

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Lot Selection */}
              <Card elevation="raised">
                <CardHeader>
                  <CardTitle>Select Lot</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedLot ? (
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            placeholder="Search by lot number..."
                            value={lotSearch}
                            onChange={(e) => setLotSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchLots())}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={searchLots}
                          disabled={isSearchingLots}
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>

                      {isSearchingLots && (
                        <div className="text-center py-4 text-gray-500">Searching...</div>
                      )}

                      {lots.length > 0 && (
                        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                          {lots.map((lot) => (
                            <button
                              key={lot.id}
                              type="button"
                              onClick={() => handleSelectLot(lot)}
                              className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{lot.lotNumber}</p>
                                  <p className="text-sm text-gray-500">
                                    {lot.itemCode} - {lot.itemName}
                                  </p>
                                </div>
                                <div className="text-right text-sm">
                                  <p>
                                    {lot.quantity} {lot.unit}
                                  </p>
                                  <p className="text-gray-500">Exp: {formatDate(lot.expiryDate)}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-green-800">{selectedLot.lotNumber}</p>
                          <p className="text-sm text-green-600">
                            {selectedLot.itemCode} - {selectedLot.itemName}
                          </p>
                          <p className="text-sm text-green-600">
                            Qty: {selectedLot.quantity} {selectedLot.unit} | Exp:{' '}
                            {formatDate(selectedLot.expiryDate)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedLot(null);
                            setSelectedSpec(null);
                            setSpecs([]);
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Test Specification Selection */}
              <Card elevation="raised">
                <CardHeader>
                  <CardTitle>Test Specification</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedLot ? (
                    <p className="text-gray-500 text-center py-4">
                      Please select a lot first to see available test specifications
                    </p>
                  ) : specs.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      No test specifications found for this item
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <Select
                        label="Select Test"
                        value={selectedSpec?.id.toString() || ''}
                        onChange={(e) => handleSelectSpec(e.target.value)}
                        options={[
                          { value: '', label: 'Select a test specification...' },
                          ...specs.map((spec) => ({
                            value: spec.id.toString(),
                            label: `${spec.testName}${spec.isCritical ? ' (Critical)' : ''}`,
                          })),
                        ]}
                      />

                      {selectedSpec && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-blue-800">{selectedSpec.testName}</p>
                            {selectedSpec.isCritical && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                                Critical
                              </span>
                            )}
                          </div>
                          {selectedSpec.testMethod && (
                            <p className="text-sm text-blue-600">
                              Method: {selectedSpec.testMethod}
                            </p>
                          )}
                          {selectedSpec.specification && (
                            <p className="text-sm text-blue-600">
                              Spec: {selectedSpec.specification}
                            </p>
                          )}
                          {(selectedSpec.minValue !== null || selectedSpec.maxValue !== null) && (
                            <p className="text-sm text-blue-600">
                              Range: {selectedSpec.minValue ?? '-'} to {selectedSpec.maxValue ?? '-'}{' '}
                              {selectedSpec.unit}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Test Details */}
              <Card elevation="raised">
                <CardHeader>
                  <CardTitle>Test Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Test Type"
                      value={formData.testType}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, testType: e.target.value }))
                      }
                      options={testTypeOptions}
                    />
                    <Input
                      label="Sample Number"
                      placeholder="Enter sample number (optional)"
                      value={formData.sampleNumber}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, sampleNumber: e.target.value }))
                      }
                    />
                  </div>
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
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!selectedLot || !selectedSpec || isSaving}
                    leftIcon={<Save className="h-4 w-4" />}
                  >
                    {isSaving ? 'Creating...' : 'Create Test'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => router.push('/quality/tests')}
                  >
                    Cancel
                  </Button>
                </CardContent>
              </Card>

              {/* Help */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FlaskConical className="h-4 w-4" />
                    About Quality Tests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-gray-600">
                    <p>
                      <strong>Incoming QC:</strong> Tests performed on received materials before
                      acceptance into inventory.
                    </p>
                    <p>
                      <strong>In-Process QC:</strong> Tests performed during manufacturing to ensure
                      quality at each stage.
                    </p>
                    <p>
                      <strong>Final QC:</strong> Tests performed on finished products before release.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

export default function NewQualityTestPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </MainLayout>
    }>
      <NewQualityTestContent />
    </Suspense>
  );
}
