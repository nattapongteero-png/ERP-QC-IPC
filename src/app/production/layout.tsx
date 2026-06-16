'use client';

/**
 * Production Module Layout
 *
 * Wraps all Production pages with MainLayout for consistent navigation, and
 * applies the shared "Organic Biophilic" theme to every production page via
 * one scoped CSS block (CSS only — same approach as the inventory module).
 * See [[devextreme-organic-theme]]: editors render as dx-editor-FILLED, and
 * the per-column funnel / filter row / export-column-chooser toolbar are
 * removed for a single, consistent filter surface.
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MainLayout>
      <div className="production-organic">
        <style jsx global>{`
          /* ── DevExtreme filled inputs → organic ── */
          .production-organic .dx-texteditor.dx-editor-filled {
            border: 1px solid #D9EFE4;
            border-radius: 11px;
            background-color: #FBFEFC;
            box-shadow: 0 1px 2px rgba(6,78,59,0.04);
          }
          .production-organic .dx-texteditor.dx-editor-filled::before,
          .production-organic .dx-texteditor.dx-editor-filled::after {
            display: none !important;
          }
          .production-organic .dx-texteditor.dx-editor-filled.dx-state-hover {
            border-color: #A7F3D0;
            background-color: #F4FBF7;
          }
          .production-organic .dx-texteditor.dx-editor-filled.dx-state-focused {
            border-color: #10B981;
            background-color: #fff;
            box-shadow: 0 0 0 3px rgba(16,185,129,.12);
          }
          .production-organic .dx-texteditor.dx-editor-filled.dx-state-disabled {
            background-color: #F1F5F4;
            border-color: #E5EFEA;
          }
          .production-organic .dx-texteditor-input { color: #0F2E22; }
          .production-organic .dx-placeholder::before { color: #8AA79B; }
          .production-organic .dx-dropdowneditor-icon,
          .production-organic .dx-numberbox-spin-icon { color: #4B7163; }

          /* ── DataGrid → organic headers, rows, pager ── */
          .production-organic .dx-datagrid-headers {
            background: linear-gradient(180deg, #F1FAF5, #E9F6F0);
            border-bottom: 2px solid #DCEFE6;
          }
          .production-organic .dx-datagrid-headers .dx-header-row td {
            font-weight: 600;
            color: #065F46;
          }
          .production-organic .dx-datagrid-headers .dx-header-row > td,
          .production-organic .dx-datagrid-headers .dx-header-row > td .dx-datagrid-text-content {
            white-space: nowrap !important;
            overflow: visible;
            text-overflow: clip;
          }
          .production-organic .dx-datagrid .dx-row-alt > td { background-color: #FAFDFB; }
          .production-organic .dx-datagrid .dx-data-row:hover > td { background-color: #FFFBEB !important; }
          /* Show full cell text — wrap instead of ellipsis-clipping */
          .production-organic .dx-datagrid .dx-data-row > td {
            white-space: normal;
            text-overflow: clip;
            word-break: break-word;
          }
          .production-organic .dx-pager {
            border-top: 1px solid #EEF7F2;
            background: #FBFEFC;
          }
          .production-organic .dx-pager .dx-page.dx-selection {
            background: linear-gradient(135deg, #10B981, #059669);
            color: #fff;
            border-radius: 9px;
          }

          /* ── Grid search panel ── */
          .production-organic .dx-datagrid-search-panel.dx-texteditor.dx-editor-filled {
            background-color: #FBFEFC;
            border: 1px solid #D9EFE4;
            border-radius: 11px;
          }
          .production-organic .dx-datagrid-search-panel .dx-icon-search { color: #4B7163; }

          /* ── Tabs (DxTabs) → organic active + smooth transition ── */
          .production-organic .dx-tabs {
            background: transparent;
            border-bottom: 1px solid #DCEFE6;
          }
          .production-organic .dx-tab {
            transition: color .2s ease, background-color .2s ease;
          }
          .production-organic .dx-tab .dx-tab-text { color: #4B7163; }
          .production-organic .dx-tab.dx-state-hover { background-color: #F0FBF5; }
          .production-organic .dx-tab.dx-tab-selected .dx-tab-text {
            color: #064E3B;
            font-weight: 600;
          }
          /* the selected-tab underline indicator — emerald + animated slide */
          .production-organic .dx-tabs .dx-tab-selected::after,
          .production-organic .dx-tabs .dx-tab.dx-tab-selected::before {
            background: linear-gradient(90deg, #10B981, #059669) !important;
            transition: all .25s ease;
          }
          .production-organic .dx-tab.dx-state-focused {
            box-shadow: inset 0 0 0 1px rgba(16,185,129,.35);
          }
        `}</style>
        {children}
      </div>
    </MainLayout>
  );
}
