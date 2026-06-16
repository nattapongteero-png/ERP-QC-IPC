'use client';

/**
 * OrganicGridTheme — one reusable scoped stylesheet that applies the
 * "Organic Biophilic" green theme to all DevExtreme building blocks inside an
 * element marked with the `organic-grid` class.
 *
 * Drop `<OrganicGridTheme />` once inside a module layout's wrapper:
 *
 *   <div className="organic-grid">
 *     <OrganicGridTheme />
 *     {children}
 *   </div>
 *
 * CSS only — no logic. See [[devextreme-organic-theme]]: editors render as
 * dx-editor-FILLED (not outlined); per-column funnel / filter row / export-
 * column-chooser are handled per-page, this only styles the visual surface.
 */
export function OrganicGridTheme() {
  return (
    <style jsx global>{`
      /* ── DevExtreme filled inputs → organic ── */
      .organic-grid .dx-texteditor.dx-editor-filled {
        border: 1px solid #D9EFE4;
        border-radius: 11px;
        background-color: #FBFEFC;
        box-shadow: 0 1px 2px rgba(6,78,59,0.04);
      }
      .organic-grid .dx-texteditor.dx-editor-filled::before,
      .organic-grid .dx-texteditor.dx-editor-filled::after {
        display: none !important;
      }
      .organic-grid .dx-texteditor.dx-editor-filled.dx-state-hover {
        border-color: #A7F3D0;
        background-color: #F4FBF7;
      }
      .organic-grid .dx-texteditor.dx-editor-filled.dx-state-focused {
        border-color: #10B981;
        background-color: #fff;
        box-shadow: 0 0 0 3px rgba(16,185,129,.12);
      }
      .organic-grid .dx-texteditor.dx-editor-filled.dx-state-disabled {
        background-color: #F1F5F4;
        border-color: #E5EFEA;
      }
      .organic-grid .dx-texteditor-input { color: #0F2E22; }
      .organic-grid .dx-placeholder::before { color: #8AA79B; }
      .organic-grid .dx-dropdowneditor-icon,
      .organic-grid .dx-numberbox-spin-icon { color: #4B7163; }

      /* ── DataGrid → organic headers, rows, pager ── */
      .organic-grid .dx-datagrid-headers {
        background: linear-gradient(180deg, #F1FAF5, #E9F6F0);
        border-bottom: 2px solid #DCEFE6;
      }
      .organic-grid .dx-datagrid-headers .dx-header-row td {
        font-weight: 600;
        color: #065F46;
      }
      .organic-grid .dx-datagrid-headers .dx-header-row > td,
      .organic-grid .dx-datagrid-headers .dx-header-row > td .dx-datagrid-text-content {
        white-space: nowrap !important;
        overflow: visible;
        text-overflow: clip;
      }
      .organic-grid .dx-datagrid .dx-row-alt > td { background-color: #FAFDFB; }
      .organic-grid .dx-datagrid .dx-data-row:hover > td { background-color: #FFFBEB !important; }
      /* Show full cell text — let columnAutoWidth size to content instead of
         clipping with an ellipsis (data cells wrap rather than truncate). */
      .organic-grid .dx-datagrid .dx-data-row > td {
        white-space: normal;
        text-overflow: clip;
        word-break: break-word;
      }
      /* Smooth, theme-aligned DxTabs: animated emerald indicator + hover */
      .organic-grid .dx-tabs { background: transparent; border-bottom: 1px solid #DCEFE6; }
      .organic-grid .dx-tab { transition: color .2s ease, background-color .2s ease; }
      .organic-grid .dx-tab .dx-tab-text { color: #4B7163; }
      .organic-grid .dx-tab.dx-state-hover { background-color: #F0FBF5; }
      .organic-grid .dx-tab.dx-tab-selected .dx-tab-text { color: #064E3B; font-weight: 600; }
      .organic-grid .dx-tabs .dx-tab-selected::after,
      .organic-grid .dx-tabs .dx-tab.dx-tab-selected::before {
        background: linear-gradient(90deg, #10B981, #059669) !important;
        transition: all .25s ease;
      }
      .organic-grid .dx-pager {
        border-top: 1px solid #EEF7F2;
        background: #FBFEFC;
      }
      .organic-grid .dx-pager .dx-page.dx-selection {
        background: linear-gradient(135deg, #10B981, #059669);
        color: #fff;
        border-radius: 9px;
      }

      /* ── Grid search panel ── */
      .organic-grid .dx-datagrid-search-panel.dx-texteditor.dx-editor-filled {
        background-color: #FBFEFC;
        border: 1px solid #D9EFE4;
        border-radius: 11px;
      }
      .organic-grid .dx-datagrid-search-panel .dx-icon-search { color: #4B7163; }
    `}</style>
  );
}

export default OrganicGridTheme;
