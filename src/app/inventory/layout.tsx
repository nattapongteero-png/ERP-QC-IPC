'use client';

/**
 * Inventory module layout — applies the shared "Organic Biophilic" theme to
 * every page under /inventory via one scoped CSS block (CSS only, no logic,
 * no extra MainLayout — each page already wraps its own).
 *
 * Why a layout-level stylesheet: the inventory pages (items, lots, warehouses,
 * goods-receipt, requisitions, returns, transactions, expiry-alerts) all share
 * the same DevExtreme building blocks — filled-variant inputs, DataGrid,
 * status-tab rows, gray summary cards. Styling them once here keeps the module
 * visually consistent and avoids repeating the same overrides in 10+ files.
 *
 * Key facts encoded below (learned by inspecting the rendered DOM):
 *  - DevExtreme editors render as `.dx-editor-filled` (grey filled box with a
 *    top-only radius + an animated ::before/::after underline), NOT outlined.
 *  - DataGrid header captions wrap when wordWrapEnabled is on — force the
 *    header row to a single line while data rows keep wrapping.
 */
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="inventory-organic">
      <style jsx global>{`
        /* ── DevExtreme filled inputs → organic (TextBox/SelectBox/NumberBox/DateBox) ── */
        .inventory-organic .dx-texteditor.dx-editor-filled {
          border: 1px solid #D9EFE4;
          border-radius: 11px;
          background-color: #FBFEFC;
          box-shadow: 0 1px 2px rgba(6,78,59,0.04);
        }
        .inventory-organic .dx-texteditor.dx-editor-filled::before,
        .inventory-organic .dx-texteditor.dx-editor-filled::after {
          display: none !important;
        }
        .inventory-organic .dx-texteditor.dx-editor-filled.dx-state-hover {
          border-color: #A7F3D0;
          background-color: #F4FBF7;
        }
        .inventory-organic .dx-texteditor.dx-editor-filled.dx-state-focused {
          border-color: #10B981;
          background-color: #fff;
          box-shadow: 0 0 0 3px rgba(16,185,129,.12);
        }
        .inventory-organic .dx-texteditor.dx-editor-filled.dx-state-disabled {
          background-color: #F1F5F4;
          border-color: #E5EFEA;
        }
        .inventory-organic .dx-texteditor-input {
          color: #0F2E22;
        }
        .inventory-organic .dx-placeholder::before {
          color: #8AA79B;
        }
        .inventory-organic .dx-dropdowneditor-icon,
        .inventory-organic .dx-numberbox-spin-icon {
          color: #4B7163;
        }

        /* ── DataGrid → organic headers, hover, pager, search ── */
        .inventory-organic .dx-datagrid-headers {
          background: linear-gradient(180deg, #F1FAF5, #E9F6F0);
          border-bottom: 2px solid #DCEFE6;
        }
        .inventory-organic .dx-datagrid-headers .dx-header-row td {
          font-weight: 600;
          color: #065F46;
        }
        /* header captions on a single line (data rows keep wrapping) */
        .inventory-organic .dx-datagrid-headers .dx-header-row > td,
        .inventory-organic .dx-datagrid-headers .dx-header-row > td .dx-datagrid-text-content {
          white-space: nowrap !important;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .inventory-organic .dx-datagrid .dx-row-alt > td {
          background-color: #FAFDFB;
        }
        .inventory-organic .dx-datagrid .dx-data-row:hover > td {
          background-color: #FFFBEB !important;
        }
        .inventory-organic .dx-pager {
          border-top: 1px solid #EEF7F2;
          background: #FBFEFC;
        }
        .inventory-organic .dx-pager .dx-page.dx-selection {
          background: linear-gradient(135deg, #10B981, #059669);
          color: #fff;
          border-radius: 9px;
        }

        /* ── Grid search panel (renders as dx-editor-filled too) ── */
        .inventory-organic .dx-datagrid-search-panel.dx-texteditor.dx-editor-filled {
          background-color: #FBFEFC;
          border: 1px solid #D9EFE4;
          border-radius: 11px;
        }
        .inventory-organic .dx-datagrid-search-panel .dx-icon-search {
          color: #4B7163;
        }
      `}</style>
      {children}
    </div>
  );
}
