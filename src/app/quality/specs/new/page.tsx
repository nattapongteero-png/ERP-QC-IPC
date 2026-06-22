'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
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

// Master test parameter — loaded from /api/master-data/ipc-criteria.
// Each row carries one name + one unit. Multiple rows may share the same
// name (with different units), which is how a test name can map to more
// than one valid unit option in the form.
interface TestParameterMaster {
  id: number;
  code: string;
  name: string;         // English name (used as Test Name value)
  nameTh: string | null;
  unit: string | null;
  testMethod: string | null;
  specification: string | null;
  minValue: number | null;
  maxValue: number | null;
}

export default function NewQualitySpecPage() {
  const router = useRouter();
  const t = useTranslations('quality');
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

  // Master test parameters (from /api/master-data/ipc-criteria)
  const [testMaster, setTestMaster] = useState<TestParameterMaster[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setMasterLoading(true);
        const res = await fetch('/api/master-data/ipc-criteria');
        const data = await res.json();
        if (cancelled) return;
        if (data.success && Array.isArray(data.data)) {
          setTestMaster(data.data as TestParameterMaster[]);
        }
      } catch (err) {
        console.error('Failed to load test parameter master:', err);
      } finally {
        if (!cancelled) setMasterLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Distinct test names for the Test Name dropdown. Each entry includes TH
  // name where available so search matches both languages.
  const testNameOptions = useMemo(() => {
    const seen = new Map<string, { value: string; label: string; nameTh: string | null }>();
    for (const t of testMaster) {
      if (!t.name) continue;
      if (!seen.has(t.name)) {
        seen.set(t.name, {
          value: t.name,
          label: t.nameTh ? `${t.name} — ${t.nameTh}` : t.name,
          nameTh: t.nameTh,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.value.localeCompare(b.value));
  }, [testMaster]);

  // Units available for the currently-selected Test Name. If the same test
  // name exists in the master with multiple distinct units, all show up.
  const unitOptions = useMemo(() => {
    if (!formData.testName) return [] as { value: string; label: string }[];
    const units = new Set<string>();
    for (const t of testMaster) {
      if (t.name === formData.testName && t.unit) units.add(t.unit);
    }
    return Array.from(units)
      .sort()
      .map((u) => ({ value: u, label: u }));
  }, [testMaster, formData.testName]);

  // When Test Name changes:
  // - Reset unit if the new selection doesn't offer it.
  // - Auto-select the unit if there's exactly one choice (nicer UX).
  const handleTestNameChange = (newName: string) => {
    const matching = testMaster.filter((t) => t.name === newName && t.unit);
    const validUnits = Array.from(new Set(matching.map((t) => t.unit))) as string[];
    let nextUnit = formData.unit;
    if (!validUnits.includes(nextUnit)) {
      nextUnit = validUnits.length === 1 ? validUnits[0] : '';
    }
    // Also auto-fill testMethod / specification if master has one and the
    // form is still empty (don't clobber user edits).
    const first = matching[0];
    setFormData((prev) => ({
      ...prev,
      testName: newName,
      unit: nextUnit,
      testMethod: prev.testMethod || first?.testMethod || prev.testMethod,
      specification: prev.specification || first?.specification || prev.specification,
    }));
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setItemDialogOpen(false);
  };

  const handleSubmit = async () => {
    if (!selectedItem) {
      alert(t('specs.new.validation.selectItem'));
      return;
    }

    if (!formData.testName.trim()) {
      alert(t('specs.new.validation.enterTestName'));
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
    <>
      <div className="space-y-6">
        <PageHeader
          title={t('specifications.title')}
          description={t('specifications.description')}
          backButton={
            <DxButton
              text={t('specs.new.back')}
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
                <CardTitle>{t('specs.new.selectItem.title')}</CardTitle>
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
                      text={t('specs.new.selectItem.change')}
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
                      <span>{t('specs.new.selectItem.clickToSelect')}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-green-500" />
                  </button>
                )}
              </CardContent>
            </Card>

            {/* Test Details */}
            <Card elevation="raised">
              <CardHeader>
                <CardTitle>{t('specs.new.testDetails.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                        <span>
                          {t('specs.new.testDetails.testName')} <span className="text-red-500">*</span>
                        </span>
                        <a
                          href="/master-data/ipc-criteria"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-600 hover:text-green-800 hover:underline font-normal"
                        >
                          {t('specs.new.testDetails.manageMaster')}
                        </a>
                      </label>
                      {/* Search + dropdown: user can type to filter or pick
                          from the master list (from /api/master-data/ipc-criteria).
                          Selecting resets Unit to a matching option (or the
                          single valid one). */}
                      <DxSelectBox
                        dataSource={testNameOptions}
                        value={formData.testName}
                        onValueChange={(value) => handleTestNameChange((value as string) || '')}
                        valueExpr="value"
                        displayExpr="label"
                        searchEnabled
                        searchExpr={['value', 'label', 'nameTh']}
                        showClearButton
                        placeholder={
                          masterLoading
                            ? t('specs.new.testDetails.testNameLoading')
                            : testNameOptions.length === 0
                            ? t('specs.new.testDetails.testNameNoMaster')
                            : t('specs.new.testDetails.testNamePlaceholder')
                        }
                        disabled={masterLoading}
                        noDataText={t('specs.new.testDetails.testNameNoData')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('specs.new.testDetails.testMethod')}
                      </label>
                      <DxTextBox
                        placeholder={t('specs.new.testDetails.testMethodPlaceholder')}
                        value={formData.testMethod}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, testMethod: value }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('specs.new.testDetails.specification')}
                    </label>
                    <DxTextBox
                      placeholder={t('specs.new.testDetails.specificationPlaceholder')}
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
                <CardTitle>{t('specs.new.acceptance.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('specs.new.acceptance.minValue')}
                      </label>
                      <DxTextBox
                        placeholder={t('specs.new.acceptance.minValuePlaceholder')}
                        value={formData.minValue?.toString() || ''}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, minValue: value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('specs.new.acceptance.maxValue')}
                      </label>
                      <DxTextBox
                        placeholder={t('specs.new.acceptance.maxValuePlaceholder')}
                        value={formData.maxValue?.toString() || ''}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, maxValue: value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('specs.new.acceptance.unit')}
                      </label>
                      {/* Unit dropdown — strictly driven by the selected
                          Test Name. Disabled until a test is chosen so the
                          user cannot pick a unit that doesn't match the test
                          definition in master data. */}
                      <DxSelectBox
                        dataSource={unitOptions}
                        value={formData.unit}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, unit: (value as string) || '' }))
                        }
                        valueExpr="value"
                        displayExpr="label"
                        showClearButton
                        disabled={!formData.testName || unitOptions.length === 0}
                        placeholder={
                          !formData.testName
                            ? t('specs.new.acceptance.unitSelectTestFirst')
                            : unitOptions.length === 0
                            ? t('specs.new.acceptance.unitNone')
                            : t('specs.new.acceptance.unitPlaceholder')
                        }
                        noDataText={t('specs.new.acceptance.unitNoData')}
                      />
                      {formData.testName && unitOptions.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          {t('specs.new.acceptance.unitNoMasterHint')} <a href="/master-data/ipc-criteria" target="_blank" className="underline">Master Data</a>
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    {t('specs.new.acceptance.note')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Critical Test */}
            <Card elevation="raised">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  {t('specs.new.critical.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <DxCheckBox
                    value={formData.isCritical}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, isCritical: value }))
                    }
                    text={t('specs.new.critical.checkbox')}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2 ml-6">
                  {t('specs.new.critical.description')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('specs.new.actions.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DxButton
                  text={isSaving ? t('specs.new.actions.creating') : t('specs.new.actions.create')}
                  icon="save"
                  type="success"
                  width="100%"
                  onClick={handleSubmit}
                  disabled={!selectedItem || !formData.testName || isSaving}
                />
                <DxButton
                  text={t('specs.new.actions.cancel')}
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
                  {t('specs.new.help.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <p>{t.rich('specs.new.help.testName', { strong: (c) => <strong>{c}</strong> })}</p>
                  <p>{t.rich('specs.new.help.testMethod', { strong: (c) => <strong>{c}</strong> })}</p>
                  <p>{t.rich('specs.new.help.minMax', { strong: (c) => <strong>{c}</strong> })}</p>
                  <p>{t.rich('specs.new.help.specification', { strong: (c) => <strong>{c}</strong> })}</p>
                </div>
              </CardContent>
            </Card>

            {/* Test Parameter Master info card.
                The sidebar previously listed hardcoded "Common Test
                Parameters" which duplicated the searchable Test Name
                dropdown. Replace it with a pointer to Master Data so
                users know where to add new parameters. */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">📋 Master Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">
                  {t('specs.new.masterData.intro')}
                </p>
                <div className="text-xs text-gray-500 space-y-1 mb-3">
                  <p>{t('specs.new.masterData.bulletTestName')}</p>
                  <p>{t('specs.new.masterData.bulletUnit')}</p>
                  <p>{t('specs.new.masterData.bulletMissing')}</p>
                </div>
                <a
                  href="/master-data/ipc-criteria"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-800 hover:underline font-medium"
                >
                  {t('specs.new.masterData.goToLink')}
                  <ChevronRight className="h-3 w-3" />
                </a>
                {testMaster.length > 0 && (
                  <p className="text-xs text-gray-400 mt-3">
                    {t('specs.new.masterData.loaded', { count: testMaster.length })}
                  </p>
                )}
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
        title={t('specs.new.selectItem.dialogTitle')}
        showStock
      />
    </>
  );
}
