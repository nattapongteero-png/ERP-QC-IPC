'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { PageHeader } from '@/components/ui/page-header';
import { LotSearchDialog, Lot } from '@/components/ui/lot-search-dialog';
import { FlaskConical, Search } from 'lucide-react';

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

function NewQualityTestContent() {
  const router = useRouter();
  const t = useTranslations('quality');
  const searchParams = useSearchParams();

  const testTypeOptions = [
    { value: 'incoming', label: t('tests.new.testType.incoming') },
    { value: 'in_process', label: t('tests.new.testType.in_process') },
    { value: 'final', label: t('tests.new.testType.final') },
  ];
  const lotIdParam = searchParams.get('lotId');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Lot search dialog state
  const [lotDialogOpen, setLotDialogOpen] = useState(false);

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
  }, [lotIdParam, selectedLot]);

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

  const handleSelectLot = (lot: Lot) => {
    const inventoryLot: InventoryLot = {
      id: lot.id,
      lotNumber: lot.lotNumber,
      itemId: lot.itemId,
      itemCode: lot.itemCode,
      itemName: lot.itemName,
      quantity: lot.quantity,
      unit: lot.unit,
      status: lot.status,
      expiryDate: lot.expiryDate || '',
    };
    setSelectedLot(inventoryLot);
    setSelectedSpec(null);
    fetchSpecsForItem(lot.itemId);
  };

  const handleSelectSpec = (specId: string) => {
    const spec = specs.find((s) => s.id === parseInt(specId));
    setSelectedSpec(spec || null);
  };

  const handleSubmit = async () => {
    if (!selectedLot || !selectedSpec) {
      alert(t('tests.new.selectLotAndSpec'));
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
    } catch (error) {
      console.error('Failed to create test:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  const specOptions = [
    { value: '', label: t('tests.new.specPlaceholder') },
    ...specs.map((spec) => ({
      value: spec.id.toString(),
      label: `${spec.testName}${spec.isCritical ? ` (${t('tests.new.critical')})` : ''}`,
    })),
  ];

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={t('inspections.actions.createInspection')}
          description={t('inspections.description')}
          backButton={
            <DxButton
              text={t('tests.new.back')}
              icon="back"
              type="normal"
              stylingMode="text"
              onClick={() => router.push('/quality/tests')}
            />
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Lot Selection */}
            <Card elevation="raised">
              <CardHeader>
                <CardTitle>{t('tests.new.lotSelection.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-4 text-gray-500">{t('tests.new.loading')}</div>
                ) : !selectedLot ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <p className="text-gray-600">{t('tests.new.lotSelection.prompt')}</p>
                      <DxButton
                        text={t('tests.new.lotSelection.selectButton')}
                        icon="search"
                        type="default"
                        onClick={() => setLotDialogOpen(true)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-green-800">{selectedLot.lotNumber}</p>
                        <p className="text-sm text-green-700">
                          {selectedLot.itemCode} - {selectedLot.itemName}
                        </p>
                        <p className="text-sm text-green-700">
                          {t('tests.new.lotSelection.quantityExpiry', { quantity: selectedLot.quantity, unit: selectedLot.unit, expiry: formatDate(selectedLot.expiryDate) })}
                        </p>
                      </div>
                      <DxButton
                        text={t('tests.new.lotSelection.changeButton')}
                        type="normal"
                        stylingMode="outlined"
                        onClick={() => setLotDialogOpen(true)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Test Specification Selection */}
            <Card elevation="raised">
              <CardHeader>
                <CardTitle>{t('tests.new.specSelection.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedLot ? (
                  <p className="text-gray-500 text-center py-4">
                    {t('tests.new.specSelection.selectLotFirst')}
                  </p>
                ) : specs.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    {t('tests.new.specSelection.noSpecs')}
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('tests.new.specSelection.selectTestLabel')}
                      </label>
                      <DxSelectBox
                        items={specOptions}
                        value={selectedSpec?.id.toString() || ''}
                        onValueChange={handleSelectSpec}
                        placeholder={t('tests.new.specPlaceholder')}
                      />
                    </div>

                    {selectedSpec && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-blue-800">{selectedSpec.testName}</p>
                          {selectedSpec.isCritical && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                              {t('tests.new.critical')}
                            </span>
                          )}
                        </div>
                        {selectedSpec.testMethod && (
                          <p className="text-sm text-blue-600">
                            {t('tests.new.specSelection.method', { method: selectedSpec.testMethod })}
                          </p>
                        )}
                        {selectedSpec.specification && (
                          <p className="text-sm text-blue-600">
                            {t('tests.new.specSelection.specification', { spec: selectedSpec.specification })}
                          </p>
                        )}
                        {(selectedSpec.minValue !== null || selectedSpec.maxValue !== null) && (
                          <p className="text-sm text-blue-600">
                            {t('tests.new.specSelection.range', { min: selectedSpec.minValue ?? '-', max: selectedSpec.maxValue ?? '-', unit: selectedSpec.unit })}
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
                <CardTitle>{t('tests.new.testDetails.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('tests.new.testDetails.testTypeLabel')}
                    </label>
                    <DxSelectBox
                      items={testTypeOptions}
                      value={formData.testType}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, testType: value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('tests.new.testDetails.sampleNumberLabel')}
                    </label>
                    <DxTextBox
                      placeholder={t('tests.new.testDetails.sampleNumberPlaceholder')}
                      value={formData.sampleNumber}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, sampleNumber: value }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('tests.new.actionsTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DxButton
                  text={isSaving ? t('tests.new.creating') : t('tests.new.submit')}
                  icon="save"
                  type="success"
                  width="100%"
                  onClick={handleSubmit}
                  disabled={!selectedLot || !selectedSpec || isSaving}
                />
                <DxButton
                  text={t('tests.new.cancel')}
                  type="normal"
                  stylingMode="outlined"
                  width="100%"
                  onClick={() => router.push('/quality/tests')}
                />
              </CardContent>
            </Card>

            {/* Help */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  {t('tests.new.help.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <p>
                    <strong>{t('tests.new.help.incomingLabel')}</strong> {t('tests.new.help.incomingText')}
                  </p>
                  <p>
                    <strong>{t('tests.new.help.inProcessLabel')}</strong> {t('tests.new.help.inProcessText')}
                  </p>
                  <p>
                    <strong>{t('tests.new.help.finalLabel')}</strong> {t('tests.new.help.finalText')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Lot Search Dialog.
          Per GMP workflow, QC tests are only created for lots that are
          still in Quarantine (waiting for release). Released lots are
          already approved and shouldn't be retested from this screen. */}
      <LotSearchDialog
        open={lotDialogOpen}
        onOpenChange={setLotDialogOpen}
        onSelect={handleSelectLot}
        title={t('tests.new.lotDialogTitle')}
        filterStatus="quarantine"
      />
    </>
  );
}

export default function NewQualityTestPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    }>
      <NewQualityTestContent />
    </Suspense>
  );
}
