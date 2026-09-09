'use client';

/**
 * Panel-row dialog — the body of the add/edit popup on
 * `src/app/quality/test-panels/page.tsx`.
 *
 * Follows the QC & IPC criteria screen rather than the DevExtreme form it
 * replaced: three named steps instead of one flat list of nine controls, the
 * chosen criteria as chips carrying the sequence each will take, and a
 * sentence reading back what the row will match — including the
 * product-beats-category rule the old hint had to explain in small print.
 *
 * A component rather than JSX inside the page: the page is a list screen, and
 * the dialog is the only part of it anyone edits.
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, X, TriangleAlert } from 'lucide-react';
import { SearchableSelect } from '@/components/master-data/SearchableSelect';
import { InfoTip } from '@/components/shared/InfoTip';
import {
  SOFT_INPUT, SOFT_LABEL, SOFT_HELPER, SOFT_HEADING,
  SOFT_READBACK, SOFT_WARN, SOFT_PRIMARY_BTN, SOFT_SECONDARY_BTN,
} from '@/components/shared/soft-form';
import { cn } from '@/lib/utils/cn';

export interface PanelRowFormState {
  id: number | null;
  productId: number | null;
  productCategory: string;
  criteriaId: number | null;
  criteriaIds: number[];
  isRequired: boolean;
  sequence: number;
  isActive: boolean;
}

export interface PanelRowOption {
  id: number;
  label: string;
  /** Item type (วัตถุดิบ / บรรจุภัณฑ์ / …), used only to narrow the list. */
  productType?: string | null;
  /** The product's own category, so the category picker can follow it. */
  productCategory?: string | null;
  /** On criteria: the QC stage it was written for. */
  stage?: string | null;
}

/** See the note on the criteria list inside the dialog. */
const STAGE_OF_ITEM_TYPE: Record<string, string> = {
  raw_material: 'raw_material',
  finished_goods: 'fg_release',
};

export interface PanelRowDialogSoftProps {
  form: PanelRowFormState;
  onChange: (form: PanelRowFormState) => void;
  /** Products as "code — name", already formatted by the page. */
  productItems: PanelRowOption[];
  /** Distinct categories found on the products. */
  productCategories: { value: string; label: string }[];
  /** Item types to narrow the product list by — the same five the item form
   *  offers, limited to the ones some product actually carries. */
  productTypes: { value: string; label: string }[];
  /** Already narrowed to the criteria a QC sample can be tested against. */
  criteriaItems: PanelRowOption[];
  /** Product records, for naming the target in the read-back. */
  products: { id: number; code: string; nameTh: string }[];
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

/**
 * On/off switch, drawn like the ones on the QC & IPC criteria screen.
 *
 * A switch rather than a checkbox or a pressed chip: both of these settings
 * are states the row is left in, not actions, and a switch is the control
 * that says so — its own track colour reads at a glance across a list.
 */
function SoftToggle({
  on,
  onToggle,
  label,
  hint,
  testId,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  /** Explains what the switch governs — shown on an info icon, not inline. */
  hint: string;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[13px] font-medium text-slate-800">{label}</span>
        <InfoTip text={hint} testId={`${testId}-info`} />
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        data-testid={testId}
        onClick={onToggle}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors',
          on ? 'bg-[#2f6fd0]' : 'bg-[#ebebec]',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-transform',
            on ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

export function PanelRowDialogSoft({
  form,
  onChange,
  productItems,
  productCategories,
  productTypes,
  criteriaItems,
  products,
  submitting,
  onCancel,
  onSubmit,
}: PanelRowDialogSoftProps) {
  const t = useTranslations('quality');

  /**
   * The QC stage each item type is sampled at.
   *
   * A raw material is tested on the way in; a finished batch is tested on the
   * way out. Offering a release test on a herb delivery, or an identity test on
   * a packed batch, is a panel nobody can execute — so the criteria list
   * follows whatever the target above says.
   *
   * The three types with no single answer — packaging, work in progress and
   * consumables — are left unmapped on purpose rather than guessed at, and
   * simply see everything.
   */
  // Narrowing only — deliberately not part of `form`, since it decides what the
  // person can see, not what the row will mean once saved.
  const [productFilter, setProductFilter] = React.useState('');

  const filteredProducts = React.useMemo(
    () =>
      productFilter ? productItems.filter((p) => p.productType === productFilter) : productItems,
    [productItems, productFilter],
  );

  /** The chosen product's type, else whatever the filter above is set to. */
  const activeType =
    productItems.find((p) => p.id === form.productId)?.productType ?? productFilter ?? '';

  /**
   * Categories that belong to the target, not every category in the plant.
   * With a product chosen the field is a fallback the row will never reach, so
   * it simply follows that product; with only a type chosen it offers the
   * categories found under it.
   */
  const filteredCategories = React.useMemo(() => {
    const chosen = productItems.find((p) => p.id === form.productId);
    if (chosen?.productCategory) {
      return productCategories.filter((c) => c.value === chosen.productCategory);
    }
    if (!activeType) return productCategories;
    const within = new Set(
      productItems.filter((p) => p.productType === activeType).map((p) => p.productCategory),
    );
    const narrowed = productCategories.filter((c) => within.has(c.value));
    // A type whose products carry no category at all would leave an empty
    // picker; the full list is more use than none.
    return narrowed.length > 0 ? narrowed : productCategories;
  }, [productItems, productCategories, form.productId, activeType]);

  /** Criteria written for the stage this target is sampled at. */
  const stageWanted = STAGE_OF_ITEM_TYPE[activeType] ?? null;
  const filteredCriteria = React.useMemo(() => {
    if (!stageWanted) return criteriaItems;
    // A criterion saved before stages existed has none recorded, and is kept
    // rather than hidden — it may well still be the right test.
    return criteriaItems.filter((c) => !c.stage || c.stage === stageWanted);
  }, [criteriaItems, stageWanted]);

  // Opening the dialog on a row that already names a product should show that
  // product, so the filter starts on whichever type it belongs to.
  React.useEffect(() => {
    const chosen = productItems.find((p) => p.id === form.productId);
    setProductFilter(chosen?.productType ?? '');
    // Only when the dialog is pointed at a different row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id]);

  // A product left selected under a filter that excludes it would be invisible
  // but still saved, so narrowing past it clears the choice.
  React.useEffect(() => {
    if (form.productId == null) return;
    if (filteredProducts.some((p) => p.id === form.productId)) return;
    onChange({ ...form, productId: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProducts]);

  /**
   * What this row will match, in one sentence. Product beats category when
   * both are filled — a rule two empty dropdowns cannot show on their own.
   */
  const targetSummary = React.useMemo(() => {
    const product = products.find((p) => p.id === form.productId);
    const category = form.productCategory.trim();
    const name = product ? `${product.code} — ${product.nameTh}` : '';
    if (product && category) return { ok: true, text: t('testPanels.dialog.targetBoth', { name }) };
    if (product) return { ok: true, text: t('testPanels.dialog.targetProduct', { name }) };
    if (category) return { ok: true, text: t('testPanels.dialog.targetCategory', { name: category }) };
    return { ok: false, text: t('testPanels.dialog.targetNone') };
  }, [products, form.productId, form.productCategory, t]);

  const saveDisabled =
    submitting || (form.id == null ? form.criteriaIds.length === 0 : !form.criteriaId);

  return (
    <>
      {/*
        The popup chrome lives outside this React tree, so it is reached by the
        class put on its wrapper. 4px corners and an emerald rule under the
        title are DevExtreme's defaults and this app's global override; neither
        belongs on this dialog, and both are scoped here rather than changed
        app-wide, where every other popup would move with them.
      */}
      <style>{`
        .panel-row-popup .dx-overlay-content { border-radius: 24px; }
        .panel-row-popup .dx-popup-title { border-bottom-color: #f1f3f5 !important; }
        /* Clicking anywhere in the dialog lands focus on the popup shell,
           which the app's global :focus-visible then rings in emerald. The
           shell is not a control — nothing is being operated by focusing it —
           so the ring says nothing and is dropped. The fields and buttons
           inside keep theirs, which is the ring keyboard users need. */
        .panel-row-popup .dx-overlay-content:focus,
        .panel-row-popup .dx-overlay-content:focus-visible,
        .panel-row-popup .dx-overlay-content.dx-state-focused {
          outline: none !important;
          box-shadow: 0 8px 40px 6px rgba(0, 0, 0, 0.4) !important;
        }
      `}</style>
      {/* -m-6 cancels the 24px the popup pads its content with: left in place
          it doubled up with this dialog's own 24px gutter, so every field sat
          48px from the edge. */}
      <div className="-m-6 flex flex-col">
      {/*
        Only this middle band scrolls. The popup's own content box was the
        scroller before, which carried the whole dialog — title bar aside —
        past the top of the window and left the actions to be chased down the
        page. Capping the band instead keeps the popup itself short enough
        never to scroll, so the footer below simply stays where it is.
      */}
      <div className="flex max-h-[52vh] flex-col overflow-y-auto" data-testid="panel-scroll">
      {/* ── ① what it applies to ─────────────────────────────── */}
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-col gap-1">
          <h4 className={SOFT_HEADING}>{t('testPanels.dialog.sectionTarget')}</h4>
          <p className={SOFT_HELPER}>
            {t.rich('testPanels.dialog.hint', { em: (c) => <em>{c}</em> })}
          </p>
        </div>

        {/* Product type narrows the list beside it and is not saved with the
            row — a plant carries thousands of items, and scrolling all of them
            to find one is the whole reason this control is here. It sits in the
            same row so the pair reads as filter-then-pick. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={SOFT_LABEL}>{t('testPanels.dialog.productFilterLabel')}</span>
            <SearchableSelect
              testId="panel-product-filter"
              value={productFilter}
              onChange={setProductFilter}
              options={[
                { value: '', label: t('testPanels.dialog.productFilterAll') },
                ...productTypes,
              ]}
              placeholder={t('testPanels.dialog.productFilterPlaceholder')}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={SOFT_LABEL}>{t('testPanels.dialog.productLabel')}</span>
            <SearchableSelect
              testId="panel-product"
              value={form.productId == null ? '' : String(form.productId)}
              onChange={(v) => onChange({ ...form, productId: v ? Number(v) : null })}
              options={filteredProducts.map((o) => ({ value: String(o.id), label: o.label }))}
              placeholder={t('testPanels.dialog.productLabel')}
            />
            {filteredProducts.length === 0 && (
              <span className={SOFT_HELPER}>{t('testPanels.dialog.productNoneInFilter')}</span>
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={SOFT_LABEL}>{t('testPanels.dialog.categoryLabel')}</span>
            <SearchableSelect
              testId="panel-category"
              value={form.productCategory}
              onChange={(v) => onChange({ ...form, productCategory: v })}
              options={filteredCategories}
              placeholder={t('testPanels.dialog.categoryLabel')}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={SOFT_LABEL}>{t('testPanels.dialog.categoryManualLabel')}</span>
            <input
              className={SOFT_INPUT}
              data-testid="panel-category-manual"
              value={form.productCategory}
              onChange={(e) => onChange({ ...form, productCategory: e.target.value })}
            />
          </label>
        </div>

        <p
          className={targetSummary.ok ? SOFT_READBACK : SOFT_WARN}
          data-testid="panel-target-summary"
        >
          {targetSummary.ok ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{targetSummary.text}</span>
        </p>
      </div>

      {/* ── ② the criteria ───────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-t border-[#f1f3f5] px-6 py-5">
        <h4 className={SOFT_HEADING}>{t('testPanels.dialog.sectionCriteria')}</h4>

        {form.id == null ? (
          <>
            {/* Picked one at a time and shown as chips: a tag box hid the
                selection inside a control the user had to open to read. */}
            <SearchableSelect
              testId="panel-criteria-add"
              value=""
              showClear={false}
              onChange={(v) => {
                const id = Number(v);
                if (!v || form.criteriaIds.includes(id)) return;
                onChange({ ...form, criteriaIds: [...form.criteriaIds, id] });
              }}
              options={filteredCriteria
                .filter((c) => !form.criteriaIds.includes(c.id))
                .map((c) => ({ value: String(c.id), label: c.label }))}
              placeholder={t('testPanels.dialog.criteriaAddPlaceholder')}
            />

            {/* The list above is shorter than the full set, so it says so —
                a picker that silently hides options reads as missing data. */}
            {stageWanted && (
              <p className={SOFT_HELPER}>
                {t('testPanels.dialog.criteriaStageHint', {
                  stage: t(`testPanels.dialog.stage.${stageWanted}`),
                })}
              </p>
            )}

            {form.criteriaIds.length === 0 ? (
              <p className={SOFT_WARN}>
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t('testPanels.dialog.criteriaEmpty')}</span>
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2" data-testid="panel-criteria-chips">
                  {form.criteriaIds.map((id, i) => (
                    <span
                      key={id}
                      className="flex items-center gap-2 rounded-full bg-[#eef3fc] py-1 pl-3 pr-1.5 text-[12px] font-medium text-[#1f4e9c]"
                    >
                      {/* The sequence this chip will take, so the order is
                          visible before the rows exist. */}
                      <span className="text-[10px] text-[#2f6fd0]/70">{form.sequence + i}</span>
                      <span className="max-w-[220px] truncate">
                        {criteriaItems.find((c) => c.id === id)?.label ?? id}
                      </span>
                      <button
                        type="button"
                        aria-label={t('testPanels.dialog.criteriaRemove')}
                        data-testid={`panel-criteria-remove-${id}`}
                        onClick={() =>
                          onChange({
                            ...form,
                            criteriaIds: form.criteriaIds.filter((x) => x !== id),
                          })
                        }
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[#2f6fd0] transition hover:bg-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <p className={SOFT_READBACK} data-testid="panel-will-create">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {t.rich('testPanels.dialog.willCreate', {
                      count: form.criteriaIds.length,
                      from: form.sequence,
                      to: form.sequence + form.criteriaIds.length - 1,
                      strong: (c) => <strong>{c}</strong>,
                    })}
                  </span>
                </p>
              </>
            )}
          </>
        ) : (
          <label className="flex flex-col gap-2">
            <span className={SOFT_LABEL}>
              {t('testPanels.dialog.criteriaLabel')} <span className="text-[#e32727]">*</span>
            </span>
            <SearchableSelect
              testId="panel-criteria"
              value={form.criteriaId == null ? '' : String(form.criteriaId)}
              onChange={(v) => onChange({ ...form, criteriaId: v ? Number(v) : null })}
              options={criteriaItems.map((c) => ({ value: String(c.id), label: c.label }))}
              placeholder={t('testPanels.dialog.criteriaLabel')}
            />
          </label>
        )}
      </div>

      {/* ── ③ settings ───────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-t border-[#f1f3f5] px-6 py-5">
        <h4 className={SOFT_HEADING}>{t('testPanels.dialog.sectionSettings')}</h4>
        <label className="flex flex-col gap-2 sm:max-w-[220px]">
          <span className={SOFT_LABEL}>
            {form.id == null
              ? t('testPanels.dialog.startSequence')
              : t('testPanels.dialog.sequence')}
          </span>
          <input
            type="number"
            min={1}
            max={999}
            className={SOFT_INPUT}
            data-testid="panel-sequence"
            value={form.sequence}
            onChange={(e) => onChange({ ...form, sequence: Number(e.target.value) || 1 })}
          />
        </label>

        {/* Both switches describe the row (or, when creating, every row this
            dialog is about to create) — not the sequence above them. The hint
            under each says which, since "จำเป็น" and "ใช้งาน" on their own do
            not say what they are required for or active in. */}
        <div className="flex flex-col gap-4 rounded-[12px] border border-[#e1e4e8] p-4">
          <SoftToggle
            on={form.isRequired}
            onToggle={() => onChange({ ...form, isRequired: !form.isRequired })}
            label={t('testPanels.required')}
            hint={t('testPanels.dialog.requiredHint')}
            testId="panel-isRequired"
          />
          <div className="border-t border-[#f1f3f5]" />
          <SoftToggle
            on={form.isActive}
            onToggle={() => onChange({ ...form, isActive: !form.isActive })}
            label={t('testPanels.active')}
            hint={t('testPanels.dialog.activeHint')}
            testId="panel-isActive"
          />
        </div>
      </div>

      </div>

      {/* ── actions — outside the scroller, so they never move ── */}
      <div className="flex shrink-0 justify-end gap-3 border-t border-[#f1f3f5] bg-white px-6 py-4">
        <button
          type="button"
          className={SOFT_SECONDARY_BTN}
          data-testid="panel-cancel"
          onClick={onCancel}
          disabled={submitting}
        >
          {t('testPanels.dialog.cancel')}
        </button>
        <button
          type="button"
          className={SOFT_PRIMARY_BTN}
          data-testid="panel-save"
          onClick={onSubmit}
          disabled={saveDisabled}
        >
          {submitting ? t('testPanels.dialog.saving') : t('testPanels.dialog.save')}
        </button>
      </div>
      </div>
    </>
  );
}

export default PanelRowDialogSoft;
