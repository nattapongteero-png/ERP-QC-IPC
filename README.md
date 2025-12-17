# Herbal Medicine ERP System

ระบบบริหารจัดการการผลิตยาสมุนไพร (Herbal Medicine ERP) สำหรับโรงงานผลิตยาสมุนไพรตามมาตรฐาน GMP PIC/S

## Features

### Core Modules

1. **Inventory Management (ระบบคลังสินค้า)**
   - Item Master (ข้อมูลสินค้า)
   - Lot/Batch Management (จัดการ Lot)
   - FEFO (First Expiry First Out)
   - Warehouse Management (คลังสินค้า)
   - Stock Transactions (รายการเคลื่อนไหว)

2. **Production Management (ระบบการผลิต)**
   - Work Orders (ใบสั่งผลิต)
   - Bill of Materials (BOM)
   - Batch Production Records (BPR)
   - Production Planning

3. **Quality Control (ระบบควบคุมคุณภาพ)**
   - QC Tests (การทดสอบคุณภาพ)
   - Specifications (ข้อกำหนด)
   - Deviations (รายงานความเบี่ยงเบน)
   - Certificate of Analysis (COA)

4. **Purchasing (ระบบจัดซื้อ)**
   - Purchase Orders (ใบสั่งซื้อ)
   - Vendor Management (ผู้ขาย)
   - Approved Vendor List (AVL)

5. **Sales (ระบบขาย)**
   - Sales Orders (ใบสั่งขาย)
   - Customer Management (ลูกค้า)
   - Delivery Management

6. **Reports (รายงาน)**
   - Inventory Summary
   - Lot Traceability
   - Expiry Report
   - Production Summary
   - Quality Summary
   - Purchase/Sales Summary

## Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Backend**: Next.js API Routes
- **Database ORM**: Drizzle ORM
- **Database**: 
  - SQLite (Development/Testing)
  - MySQL (Production)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Authentication**: JWT (JSON Web Tokens)
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- MySQL (for production)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/manoi-bms/herbal-medicine-erp.git
cd herbal-medicine-erp
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
```bash
cp .env.example .env.local
```

4. Edit `.env.local`:
```env
# Database Configuration
DB_TYPE=sqlite  # Use 'sqlite' for development, 'mysql' for production

# MySQL Configuration (for production)
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=herbal_erp

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

5. Seed the database:
```bash
pnpm db:seed
```

6. Run the development server:
```bash
pnpm dev
```

7. Open [http://localhost:3000](http://localhost:3000)

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@herbal-erp.com | admin123 |
| Production | production@herbal-erp.com | prod123 |
| QC | qc@herbal-erp.com | qc123 |
| Warehouse | warehouse@herbal-erp.com | wh123 |
| Purchasing | purchasing@herbal-erp.com | po123 |
| Sales | sales@herbal-erp.com | sales123 |

## Testing

Run unit tests with SQLite in-memory database:

```bash
pnpm test        # Watch mode
pnpm test:run    # Single run
```

### Test Coverage

- **Database Tests**: Schema validation, CRUD operations
- **Authentication Tests**: Password hashing, JWT tokens, session management
- **API Tests**: Items CRUD, Inventory lots, Transactions

## Project Structure

```
herbal-medicine-erp/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── items/         # Items CRUD
│   │   │   ├── inventory/     # Inventory management
│   │   │   ├── production/    # Work orders
│   │   │   ├── purchasing/    # Purchase orders
│   │   │   ├── sales/         # Sales orders
│   │   │   └── quality/       # QC tests
│   │   ├── dashboard/         # Dashboard page
│   │   ├── inventory/         # Inventory pages
│   │   ├── production/        # Production pages
│   │   ├── quality/           # Quality pages
│   │   ├── purchasing/        # Purchasing pages
│   │   ├── sales/             # Sales pages
│   │   ├── reports/           # Reports page
│   │   ├── users/             # User management
│   │   └── settings/          # Settings page
│   ├── components/            # React components
│   │   ├── layout/            # Layout components
│   │   └── ui/                # UI components
│   └── lib/                   # Utilities
│       ├── db/                # Database configuration
│       │   ├── index.ts       # DB connection
│       │   ├── schema.ts      # Drizzle schema
│       │   └── seed.ts        # Seed data
│       ├── auth/              # Authentication utilities
│       ├── api-utils.ts       # API helpers
│       └── audit.ts           # Audit trail
├── tests/                     # Test files
│   ├── api/                   # API tests
│   ├── db.test.ts            # Database tests
│   └── auth.test.ts          # Auth tests
├── data/                      # SQLite database files
├── drizzle.config.ts         # Drizzle configuration
├── vitest.config.ts          # Vitest configuration
└── package.json
```

## Database Schema

### Core Tables

- **users** - User accounts and authentication
- **items** - Product/material master data
- **warehouses** - Warehouse locations
- **inventory_lots** - Lot/batch tracking
- **inventory_transactions** - Stock movements
- **vendors** - Supplier information
- **customers** - Customer information
- **purchase_orders** - Purchase order headers
- **purchase_order_lines** - PO line items
- **sales_orders** - Sales order headers
- **sales_order_lines** - SO line items
- **work_orders** - Production work orders
- **work_order_lines** - WO line items
- **quality_tests** - QC test records
- **deviations** - Quality deviations
- **audit_logs** - System audit trail

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/session` - Check session

### Items
- `GET /api/items` - List items
- `POST /api/items` - Create item
- `GET /api/items/:id` - Get item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

### Inventory
- `GET /api/inventory/lots` - List lots
- `POST /api/inventory/lots` - Create lot
- `PUT /api/inventory/lots/:id/status` - Update lot status

### Production
- `GET /api/production/work-orders` - List work orders
- `POST /api/production/work-orders` - Create work order
- `PUT /api/production/work-orders/:id/status` - Update status

### Quality
- `GET /api/quality/tests` - List QC tests
- `POST /api/quality/tests` - Create test
- `PUT /api/quality/tests/:id/result` - Submit result

## Production Deployment

### MySQL Setup

1. Create database:
```sql
CREATE DATABASE herbal_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Update `.env.local`:
```env
DB_TYPE=mysql
DATABASE_HOST=your-mysql-host
DATABASE_PORT=3306
DATABASE_USER=your-user
DATABASE_PASSWORD=your-password
DATABASE_NAME=herbal_erp
```

3. Run migrations:
```bash
pnpm db:push
```

### Build for Production

```bash
pnpm build
pnpm start
```

## GMP Compliance Features

- **Lot Traceability**: Full forward and backward traceability
- **FEFO Management**: First Expiry First Out inventory control
- **Audit Trail**: Complete logging of all changes
- **Quality Control**: Integrated QC testing and release workflow
- **Deviation Management**: Track and resolve quality issues
- **Document Control**: Batch records and certificates

## License

MIT License

## Support

For support, please contact the development team or create an issue on GitHub.
