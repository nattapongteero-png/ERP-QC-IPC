'use client';

/**
 * Premises & Facilities Module Layout
 *
 * Wraps all "อาคารและสถานที่" pages with MainLayout for consistent navigation,
 * and applies the shared "Organic Biophilic" theme to every premises page (and
 * its sub-pages: sanitation, environmental, scale-verification,
 * storage-monitoring, notifications) via one scoped CSS block — same approach
 * as the production and inventory modules. See [[devextreme-organic-theme]]:
 * DevExtreme editors render as dx-editor-FILLED (grey filled box), so we
 * re-skin the filled variant to an organic white-green surface and hide its
 * underline.
 *
 * Table rows (header + data) are forced to a single line so registry data
 * never wraps onto a second line.
 */

import { MainLayout } from '@/components/layout/main-layout';

export default function PremisesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MainLayout>
      <div className="premises-organic">
        <style jsx global>{`
          /* ── DevExtreme filled inputs → organic ── */
          .premises-organic .dx-texteditor.dx-editor-filled {
            border: 1px solid #D9EFE4;
            border-radius: 11px;
            background-color: #FBFEFC;
            box-shadow: 0 1px 2px rgba(6,78,59,0.04);
          }
          .premises-organic .dx-texteditor.dx-editor-filled::before,
          .premises-organic .dx-texteditor.dx-editor-filled::after {
            display: none !important;
          }
          .premises-organic .dx-texteditor.dx-editor-filled.dx-state-hover {
            border-color: #A7F3D0;
            background-color: #F4FBF7;
          }
          .premises-organic .dx-texteditor.dx-editor-filled.dx-state-focused {
            border-color: #10B981;
            background-color: #fff;
            box-shadow: 0 0 0 3px rgba(16,185,129,.12);
          }
          .premises-organic .dx-texteditor.dx-editor-filled.dx-state-disabled {
            background-color: #F1F5F4;
            border-color: #E5EFEA;
          }
          .premises-organic .dx-texteditor-input { color: #0F2E22; }
          .premises-organic .dx-placeholder::before { color: #8AA79B; }
          .premises-organic .dx-dropdowneditor-icon,
          .premises-organic .dx-numberbox-spin-icon { color: #4B7163; }

          /* ── DataGrid → organic headers, rows, pager ── */
          .premises-organic .dx-datagrid-headers {
            background: linear-gradient(180deg, #F1FAF5, #E9F6F0);
            border-bottom: 2px solid #DCEFE6;
          }
          .premises-organic .dx-datagrid-headers .dx-header-row td {
            font-weight: 600;
            color: #065F46;
          }
          .premises-organic .dx-datagrid-headers .dx-header-row > td,
          .premises-organic .dx-datagrid-headers .dx-header-row > td .dx-datagrid-text-content {
            white-space: nowrap !important;
            overflow: visible;
            text-overflow: clip;
          }
          .premises-organic .dx-datagrid .dx-row-alt > td { background-color: #FAFDFB; }
          .premises-organic .dx-datagrid .dx-data-row:hover > td { background-color: #FFFBEB !important; }
          /* Data cells on a single line — no wrapping; clip overflow so rows
             stay one line tall (matches header which is also nowrap). */
          .premises-organic .dx-datagrid .dx-data-row > td {
            white-space: nowrap !important;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .premises-organic .dx-datagrid .dx-data-row > td .dx-datagrid-text-content {
            white-space: nowrap !important;
          }
          .premises-organic .dx-pager {
            border-top: 1px solid #EEF7F2;
            background: #FBFEFC;
          }
          .premises-organic .dx-pager .dx-page.dx-selection {
            background: linear-gradient(135deg, #10B981, #059669);
            color: #fff;
            border-radius: 9px;
          }

          /* ── Grid search panel ── */
          .premises-organic .dx-datagrid-search-panel.dx-texteditor.dx-editor-filled {
            background-color: #FBFEFC;
            border: 1px solid #D9EFE4;
            border-radius: 11px;
          }
          .premises-organic .dx-datagrid-search-panel .dx-icon-search { color: #4B7163; }

          /* ── Tabs (DxTabs) → organic active + smooth transition ── */
          .premises-organic .dx-tabs {
            background: transparent;
            border-bottom: 1px solid #DCEFE6;
          }
          .premises-organic .dx-tab {
            transition: color .2s ease, background-color .2s ease;
          }
          .premises-organic .dx-tab .dx-tab-text { color: #4B7163; }
          .premises-organic .dx-tab.dx-state-hover { background-color: #F0FBF5; }
          .premises-organic .dx-tab.dx-tab-selected .dx-tab-text {
            color: #064E3B;
            font-weight: 600;
          }
          .premises-organic .dx-tabs .dx-tab-selected::after,
          .premises-organic .dx-tabs .dx-tab.dx-tab-selected::before {
            background: linear-gradient(90deg, #10B981, #059669) !important;
            transition: all .25s ease;
          }
          .premises-organic .dx-tab.dx-state-focused {
            box-shadow: inset 0 0 0 1px rgba(16,185,129,.35);
          }
        `}</style>
        {children}
      </div>
    </MainLayout>
  );
}
