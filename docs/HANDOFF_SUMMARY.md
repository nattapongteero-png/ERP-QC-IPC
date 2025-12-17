# Herbal Medicine ERP - Project Handoff Summary

## Project Overview

A comprehensive Herbal Medicine ERP system built with:
- **Frontend/Backend**: Next.js 16.0.10 + React 19 + TypeScript
- **Database ORM**: Drizzle ORM
- **Database**: SQLite (dev/test) / MySQL (production)
- **Styling**: Tailwind CSS
- **Authentication**: JWT
- **Testing**: Vitest

**GitHub Repository**: https://github.com/manoi-bms/herbal-medicine-erp

---

## Current Status: ✅ COMPLETED

### Build & Test Status
- **Build**: ✅ Successful (Next.js 16.0.10 Turbopack)
- **TypeScript**: ✅ No errors
- **Tests**: ✅ 72/72 tests passing
- **Dev Server**: ✅ Working

### Latest Commit
```
34f8ddd - Fix build errors and improve UI components
- Fix detail API routes to use correct schema column names
- Update Badge component to support primary and secondary variants
- Update Select component to support both options prop and children
- Update Table component to support both header and title, plus renderRow
- Fix items.unit to items.primaryUnit references
```

---

## What Has Been Completed

### 1. Core Infrastructure ✅
- Next.js project setup with TypeScript and Tailwind CSS
- Drizzle ORM configuration supporting both SQLite and MySQL
- Database schema with 25+ tables covering all ERP modules
- JWT-based authentication system
- Audit trail logging system
- API utilities (withAuth, createPaginatedResponse, etc.)

### 2. Database Schema ✅
All tables created in `/src/lib/db/schema.ts`:
- Users, AuditTrail
- Items, HerbalAttributes
- Vendors, ApprovedVendorList
- Warehouses, WarehouseLocations
- InventoryLots, InventoryTransactions
- BOM, BOMLines, Operations
- WorkOrders, WorkOrderMaterials, BatchRecords
- QualitySpecs, QualityTests, Deviations
- PurchaseOrders, PurchaseOrderLines
- SalesOrders, SalesOrderLines
- Equipment, MaintenanceRecords
- VMITransactions, Settings

### 3. Service Layer ✅
Business logic services in `/src/lib/services/`:
- `inventory.service.ts` - FEFO algorithm, lot traceability, expiry alerts
- `production.service.ts` - BOM explosion, yield calculation, work order workflows
- `quality.service.ts` - QC workflows, sampling plans, COA generation, deviation management
- `purchasing.service.ts` - VMI integration, vendor performance tracking
- `sales.service.ts` - ATP calculation, order fulfillment
- `reports.service.ts` - Traceability, analytics, GMP compliance reports

### 4. API Routes ✅
All API routes in `/src/app/api/`:
- `/api/auth/*` - Login, logout, session
- `/api/users/*` - User CRUD
- `/api/items/*` - Item CRUD + detail
- `/api/inventory/lots/*` - Lot CRUD + status + detail
- `/api/inventory/transactions/*` - Stock movements
- `/api/inventory/fefo/*` - FEFO allocation
- `/api/inventory/traceability/*` - Lot tracing
- `/api/inventory/expiry-alerts/*` - Expiry notifications
- `/api/warehouses/*` - Warehouse CRUD + detail
- `/api/production/work-orders/*` - Work order CRUD + detail
- `/api/production/bom-explosion/*` - BOM explosion
- `/api/production/yield/*` - Yield calculation
- `/api/purchasing/orders/*` - PO CRUD + detail
- `/api/sales/orders/*` - SO CRUD + detail
- `/api/quality/tests/*` - QC test CRUD + detail
- `/api/quality/deviations/*` - Deviation CRUD + detail
- `/api/quality/coa/*` - COA generation
- `/api/quality/sampling/*` - Sampling plans
- `/api/reports/*` - Various reports
- `/api/dashboard/*` - Dashboard statistics

### 5. Frontend Pages ✅
All pages in `/src/app/`:

**Dashboard**
- `/dashboard/page.tsx` - Main dashboard with statistics

**Inventory Module**
- `/inventory/items/page.tsx` - Items list with CRUD
- `/inventory/items/[id]/page.tsx` - Item detail with stock levels, BOM
- `/inventory/lots/page.tsx` - Lots list with QC actions
- `/inventory/lots/[id]/page.tsx` - Lot detail with transactions, QC, traceability
- `/inventory/warehouses/page.tsx` - Warehouses list with CRUD
- `/inventory/warehouses/[id]/page.tsx` - Warehouse detail with inventory
- `/inventory/transactions/page.tsx` - Stock movements
- `/inventory/expiry-alerts/page.tsx` - Expiry alerts dashboard

**Production Module**
- `/production/work-orders/page.tsx` - Work orders list
- `/production/work-orders/[id]/page.tsx` - Work order detail with eBMR, materials

**Quality Module**
- `/quality/page.tsx` - Quality dashboard
- `/quality/tests/[id]/page.tsx` - QC test detail with result entry
- `/quality/deviations/[id]/page.tsx` - Deviation detail with CAPA

**Purchasing Module**
- `/purchasing/page.tsx` - Purchasing dashboard
- `/purchasing/orders/[id]/page.tsx` - PO detail with receiving

**Sales Module**
- `/sales/page.tsx` - Sales dashboard
- `/sales/orders/[id]/page.tsx` - SO detail with fulfillment (FEFO)

**Other**
- `/reports/page.tsx` - Reports dashboard
- `/settings/page.tsx` - Settings page
- `/users/page.tsx` - User management
- `/login/page.tsx` - Login page

### 6. UI Components ✅
All components in `/src/components/`:
- `/ui/button.tsx` - Button with primary, secondary, danger, ghost variants
- `/ui/input.tsx` - Input with label and error support
- `/ui/select.tsx` - Select with options prop and children support
- `/ui/card.tsx` - Card with CardHeader, CardTitle, CardContent
- `/ui/table.tsx` - Table with header/title and renderRow support
- `/ui/badge.tsx` - Badge with primary, secondary, success, warning, danger, info variants
- `/layout/sidebar.tsx` - Navigation with expandable menus
- `/layout/main-layout.tsx`

### 7. Tests ✅
Test files in `/tests/`:
- `setup.ts` - Test environment setup
- `db.test.ts` - Database schema tests (14 tests)
- `auth.test.ts` - Authentication tests (20 tests)
- `api/items.test.ts` - Items API tests (8 tests)
- `api/inventory.test.ts` - Inventory API tests (7 tests)
- `services/inventory.service.test.ts` - Inventory service tests (6 tests)
- `services/production.service.test.ts` - Production service tests (7 tests)
- `services/quality.service.test.ts` - Quality service tests (10 tests)

**Total: 72 tests passing**

---

## Recent Fixes (Latest Session)

1. **Fixed API detail routes to use correct schema column names**:
   - `items.unit` → `items.primaryUnit`
   - Various column name corrections across detail routes
   - Files fixed:
     - `/src/app/api/items/[id]/detail/route.ts`
     - `/src/app/api/production/work-orders/[id]/detail/route.ts`
     - `/src/app/api/purchasing/orders/[id]/detail/route.ts`
     - `/src/app/api/quality/tests/[id]/detail/route.ts`
     - `/src/app/api/quality/deviations/[id]/detail/route.ts`
     - `/src/app/api/sales/orders/[id]/detail/route.ts`
     - `/src/app/api/warehouses/[id]/detail/route.ts`

2. **Updated UI components for better flexibility**:
   - **Badge**: Added `primary` and `secondary` variants
   - **Select**: Now supports both `options` prop and `children`
   - **Table**: Supports both `header` and `title`, plus `renderRow`

---

## Running the Project

### Prerequisites
- Node.js 22+
- pnpm

### Quick Start
```bash
# Clone repository
gh repo clone manoi-bms/herbal-medicine-erp
cd herbal-medicine-erp

# Install dependencies
pnpm install

# Create .env.local
echo "DB_TYPE=sqlite
JWT_SECRET=your-super-secret-jwt-key-change-in-production" > .env.local

# Seed database
DB_TYPE=sqlite pnpm db:seed

# Run development server
DB_TYPE=sqlite pnpm dev
```

### Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@herbal-erp.com | admin123 |
| Production | production@herbal-erp.com | user123 |
| QC | qc@herbal-erp.com | user123 |
| Warehouse | warehouse@herbal-erp.com | user123 |
| Purchasing | purchasing@herbal-erp.com | user123 |
| Sales | sales@herbal-erp.com | user123 |

### Available Scripts
```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm test:run     # Run all tests
pnpm db:seed      # Seed database
pnpm db:push      # Push schema changes
```

---

## Known Issues

1. **Quality tests page route**: `/quality/tests` returns 404 (needs `/quality/tests/page.tsx`)
2. **Temperature/humidity values**: Showing as "undefined" in warehouse list (need default values in seed data)

---

## Next Steps (Suggested)

1. Create missing page routes (quality/tests list page)
2. Add default temperature/humidity values to warehouse seed data
3. Implement remaining detail pages
4. Add more comprehensive test coverage
5. Implement production deployment configuration

---

## Key Files Reference

| Purpose | File Path |
|---------|-----------|
| Database Schema | `/src/lib/db/schema.ts` |
| Database Connection | `/src/lib/db/index.ts` |
| Auth Utilities | `/src/lib/auth/index.ts` |
| API Utilities | `/src/lib/api-utils.ts` |
| Audit Trail | `/src/lib/audit.ts` |
| Seed Script | `/src/lib/db/seed.ts` |
| Vitest Config | `/vitest.config.ts` |
| Test Setup | `/tests/setup.ts` |

---

## Notes

1. All detail pages follow a consistent pattern with tabs, summary cards, and action buttons
2. FEFO algorithm is implemented in both inventory service and sales order fulfillment
3. GMP compliance features (audit trail, traceability, eBMR) are integrated throughout
4. The project supports dual database (SQLite for dev, MySQL for production)

---

*Last Updated: December 17, 2025*
*Status: Build Successful, 72 Tests Passing*
