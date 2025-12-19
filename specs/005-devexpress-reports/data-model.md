# Data Model: DevExpress Reports Integration

**Feature Branch**: `005-devexpress-reports`
**Created**: 2025-12-19

## Overview

This document defines the database schema for storing report templates, categories, and permissions. The schema integrates with the existing Herbal Medicine ERP database and supports both the Next.js application (for management UI) and the ASP.NET Core reporting backend (for report storage).

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REPORT DOMAIN                                   │
│                                                                             │
│  ┌──────────────────┐         ┌──────────────────┐                         │
│  │ report_categories│◄────────│ report_templates │                         │
│  │                  │  1:N    │                  │                         │
│  │ - id             │         │ - id             │                         │
│  │ - name           │         │ - name           │                         │
│  │ - description    │         │ - description    │                         │
│  │ - parent_id ─────┼─┐       │ - category_id    │                         │
│  │ - sort_order     │ │       │ - definition     │──────────────────┐      │
│  │ - created_at     │ │       │ - version        │                  │      │
│  │ - updated_at     │ │       │ - is_published   │                  │      │
│  └────────┬─────────┘ │       │ - created_by     │                  │      │
│           │           │       │ - created_at     │                  │      │
│           └───────────┘       │ - updated_at     │                  │      │
│           (self-ref)          └────────┬─────────┘                  │      │
│                                        │                            │      │
│                                        │ 1:N                        │      │
│                                        ▼                            │      │
│                               ┌──────────────────┐                  │      │
│                               │report_permissions│                  │      │
│                               │                  │                  │      │
│                               │ - id             │                  │      │
│                               │ - template_id    │                  │      │
│                               │ - role           │                  │      │
│                               │ - can_view       │                  │      │
│                               │ - can_design     │                  │      │
│                               │ - can_export     │                  │      │
│                               │ - created_at     │                  │      │
│                               └──────────────────┘                  │      │
│                                                                     │      │
│                               ┌──────────────────┐                  │      │
│                               │report_executions │◄─────────────────┘      │
│                               │ (audit trail)    │                         │
│                               │                  │                         │
│                               │ - id             │                         │
│                               │ - template_id    │                         │
│                               │ - user_id        │                         │
│                               │ - action         │                         │
│                               │ - parameters     │                         │
│                               │ - export_format  │                         │
│                               │ - executed_at    │                         │
│                               │ - duration_ms    │                         │
│                               │ - status         │                         │
│                               └──────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘

INTEGRATION WITH EXISTING TABLES:
┌─────────────────┐
│ users (existing)│
│                 │
│ - id            │◄─────── report_templates.created_by
│ - name          │◄─────── report_executions.user_id
│ - role          │◄─────── report_permissions.role
└─────────────────┘
```

---

## Table Definitions

### 1. report_categories

Hierarchical organization structure for report templates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `name` | VARCHAR(100) | NOT NULL | Category display name |
| `description` | VARCHAR(500) | NULL | Optional description |
| `parent_id` | INT | FK → report_categories.id, NULL | Parent category for hierarchy |
| `sort_order` | INT | NOT NULL, DEFAULT 0 | Display order within parent |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Soft delete flag |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() ON UPDATE | Last update timestamp |

**Indexes**:
- `idx_report_categories_parent` on `parent_id`
- `idx_report_categories_active` on `is_active`

**Sample Data**:
```sql
INSERT INTO report_categories (name, description, sort_order) VALUES
('Inventory Reports', 'Stock levels, valuations, and movements', 1),
('Production Reports', 'Work orders, batch records, and yields', 2),
('Quality Reports', 'COAs, test results, and deviations', 3),
('Purchasing Reports', 'Purchase orders and vendor analysis', 4),
('Sales Reports', 'Sales orders and customer analysis', 5);
```

---

### 2. report_templates

Core table storing report definitions and metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `name` | VARCHAR(200) | NOT NULL | Report display name |
| `description` | VARCHAR(1000) | NULL | Report purpose and usage notes |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | URL-safe identifier (e.g., "inventory-valuation") |
| `category_id` | INT | FK → report_categories.id, NULL | Optional category assignment |
| `definition` | LONGTEXT | NOT NULL | DevExpress report XML definition |
| `data_source_config` | JSON | NULL | Data source connection settings |
| `parameters_schema` | JSON | NULL | Report parameter definitions |
| `version` | INT | NOT NULL, DEFAULT 1 | Template version for tracking changes |
| `is_published` | BOOLEAN | NOT NULL, DEFAULT FALSE | Published = available to users |
| `is_system` | BOOLEAN | NOT NULL, DEFAULT FALSE | System reports cannot be deleted |
| `thumbnail` | MEDIUMBLOB | NULL | Preview image for report listing |
| `created_by` | INT | FK → users.id | Creator user ID |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_by` | INT | FK → users.id, NULL | Last editor user ID |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() ON UPDATE | Last update timestamp |

**Indexes**:
- `idx_report_templates_code` on `code` (UNIQUE)
- `idx_report_templates_category` on `category_id`
- `idx_report_templates_published` on `is_published`
- `idx_report_templates_created_by` on `created_by`

**Field Details**:

**`code`**: Used as the report identifier in URLs and API calls. Format: lowercase alphanumeric with hyphens (e.g., `inventory-valuation-summary`).

**`definition`**: XML format as generated by DevExpress Report Designer. Example structure:
```xml
<?xml version="1.0" encoding="utf-8"?>
<XtraReportsLayoutSerializer>
  <Item1 Ref="1" ControlType="XRLabel" Name="label1" Text="Report Title" />
  <Item2 Ref="2" ControlType="XRTable" Name="table1" DataMember="Items" />
  ...
</XtraReportsLayoutSerializer>
```

**`data_source_config`**: JSON defining data source(s) for the report:
```json
{
  "sources": [
    {
      "name": "InventoryData",
      "type": "json",
      "endpoint": "/api/reports/data/inventory-valuation",
      "parameters": ["warehouseId", "asOfDate"]
    }
  ]
}
```

**`parameters_schema`**: JSON defining user-configurable report parameters:
```json
{
  "parameters": [
    {
      "name": "warehouseId",
      "label": "Warehouse",
      "type": "select",
      "dataSource": "/api/warehouses",
      "required": false
    },
    {
      "name": "asOfDate",
      "label": "As of Date",
      "type": "date",
      "default": "today",
      "required": true
    }
  ]
}
```

---

### 3. report_permissions

Role-based access control for individual report templates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `template_id` | INT | FK → report_templates.id, NOT NULL | Associated report |
| `role` | VARCHAR(50) | NOT NULL | Role name (matches existing roles) |
| `can_view` | BOOLEAN | NOT NULL, DEFAULT TRUE | Permission to view/run report |
| `can_design` | BOOLEAN | NOT NULL, DEFAULT FALSE | Permission to edit template |
| `can_export` | BOOLEAN | NOT NULL, DEFAULT TRUE | Permission to export report |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Indexes**:
- `idx_report_permissions_template` on `template_id`
- `idx_report_permissions_role` on `role`
- `uk_report_permissions_template_role` on (`template_id`, `role`) UNIQUE

**Valid Roles** (from existing system):
- `admin` - Full access to all reports
- `manager` - View and export all, design assigned
- `production` - View production reports
- `qc` - View quality reports
- `warehouse` - View inventory reports
- `purchasing` - View purchasing reports
- `sales` - View sales reports
- `user` - View basic reports only

**Default Permissions** (applied when no specific permission exists):
- If `is_published = TRUE` and no permission row exists → check category defaults
- `admin` role always has full access (enforced in application layer)

---

### 4. report_executions

Audit trail for report viewing and export operations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGINT | PK, AUTO_INCREMENT | Unique identifier |
| `template_id` | INT | FK → report_templates.id, NOT NULL | Report that was executed |
| `user_id` | INT | FK → users.id, NOT NULL | User who ran the report |
| `action` | ENUM('view', 'export', 'print') | NOT NULL | Type of action |
| `parameters` | JSON | NULL | Parameters used for this execution |
| `export_format` | VARCHAR(20) | NULL | Export format (pdf, xlsx, docx, etc.) |
| `executed_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Execution timestamp |
| `duration_ms` | INT | NULL | Execution duration in milliseconds |
| `status` | ENUM('success', 'error', 'cancelled') | NOT NULL | Execution result |
| `error_message` | VARCHAR(1000) | NULL | Error details if status = 'error' |
| `ip_address` | VARCHAR(45) | NULL | Client IP address |

**Indexes**:
- `idx_report_executions_template` on `template_id`
- `idx_report_executions_user` on `user_id`
- `idx_report_executions_date` on `executed_at`

**Retention Policy**: Records older than 90 days may be archived or summarized.

---

## Validation Rules

### report_categories
- `name`: Required, 1-100 characters, unique within parent
- `parent_id`: Must reference existing category or be NULL
- Cannot create circular parent references

### report_templates
- `name`: Required, 1-200 characters
- `code`: Required, unique, lowercase alphanumeric with hyphens, 1-50 characters
- `definition`: Required, valid DevExpress XML
- `version`: Auto-incremented on save
- `is_system`: Cannot delete if TRUE

### report_permissions
- `template_id` + `role` must be unique
- `role` must be valid system role

---

## State Transitions

### Report Template Lifecycle

```
┌─────────┐     publish      ┌───────────┐
│  Draft  │ ───────────────► │ Published │
│         │                  │           │
└────┬────┘                  └─────┬─────┘
     │                             │
     │ edit                        │ unpublish
     │                             │
     ▼                             ▼
┌─────────┐                  ┌───────────┐
│  Draft  │ ◄─────────────── │   Draft   │
│ (v+1)   │    (new version) │           │
└─────────┘                  └───────────┘
```

**States**:
- **Draft** (`is_published = FALSE`): Only designers can access; not visible in report list for end users
- **Published** (`is_published = TRUE`): Available to users with appropriate permissions

**Versioning**:
- Each save increments `version`
- Definition history not stored (could be added via separate `report_template_versions` table if needed)

---

## Drizzle ORM Schema

```typescript
// src/lib/db/schema/reports.ts

import { mysqlTable, int, varchar, text, boolean, timestamp, json, bigint, mysqlEnum } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const reportCategories = mysqlTable('report_categories', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  parentId: int('parent_id').references(() => reportCategories.id),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const reportTemplates = mysqlTable('report_templates', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 200 }).notNull(),
  description: varchar('description', { length: 1000 }),
  code: varchar('code', { length: 50 }).notNull().unique(),
  categoryId: int('category_id').references(() => reportCategories.id),
  definition: text('definition').notNull(),
  dataSourceConfig: json('data_source_config'),
  parametersSchema: json('parameters_schema'),
  version: int('version').notNull().default(1),
  isPublished: boolean('is_published').notNull().default(false),
  isSystem: boolean('is_system').notNull().default(false),
  thumbnail: binary('thumbnail'),
  createdBy: int('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedBy: int('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const reportPermissions = mysqlTable('report_permissions', {
  id: int('id').primaryKey().autoincrement(),
  templateId: int('template_id').notNull().references(() => reportTemplates.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull(),
  canView: boolean('can_view').notNull().default(true),
  canDesign: boolean('can_design').notNull().default(false),
  canExport: boolean('can_export').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const reportExecutions = mysqlTable('report_executions', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  templateId: int('template_id').notNull().references(() => reportTemplates.id),
  userId: int('user_id').notNull().references(() => users.id),
  action: mysqlEnum('action', ['view', 'export', 'print']).notNull(),
  parameters: json('parameters'),
  exportFormat: varchar('export_format', { length: 20 }),
  executedAt: timestamp('executed_at').notNull().defaultNow(),
  durationMs: int('duration_ms'),
  status: mysqlEnum('status', ['success', 'error', 'cancelled']).notNull(),
  errorMessage: varchar('error_message', { length: 1000 }),
  ipAddress: varchar('ip_address', { length: 45 }),
});

// Relations
export const reportCategoriesRelations = relations(reportCategories, ({ one, many }) => ({
  parent: one(reportCategories, {
    fields: [reportCategories.parentId],
    references: [reportCategories.id],
    relationName: 'categoryHierarchy',
  }),
  children: many(reportCategories, { relationName: 'categoryHierarchy' }),
  templates: many(reportTemplates),
}));

export const reportTemplatesRelations = relations(reportTemplates, ({ one, many }) => ({
  category: one(reportCategories, {
    fields: [reportTemplates.categoryId],
    references: [reportCategories.id],
  }),
  createdByUser: one(users, {
    fields: [reportTemplates.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [reportTemplates.updatedBy],
    references: [users.id],
  }),
  permissions: many(reportPermissions),
  executions: many(reportExecutions),
}));

export const reportPermissionsRelations = relations(reportPermissions, ({ one }) => ({
  template: one(reportTemplates, {
    fields: [reportPermissions.templateId],
    references: [reportTemplates.id],
  }),
}));

export const reportExecutionsRelations = relations(reportExecutions, ({ one }) => ({
  template: one(reportTemplates, {
    fields: [reportExecutions.templateId],
    references: [reportTemplates.id],
  }),
  user: one(users, {
    fields: [reportExecutions.userId],
    references: [users.id],
  }),
}));
```

---

## Migration SQL

```sql
-- Migration: 005_create_report_tables.sql

-- Create report_categories table
CREATE TABLE report_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  parent_id INT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_category_parent FOREIGN KEY (parent_id) REFERENCES report_categories(id) ON DELETE SET NULL,
  INDEX idx_report_categories_parent (parent_id),
  INDEX idx_report_categories_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create report_templates table
CREATE TABLE report_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  description VARCHAR(1000),
  code VARCHAR(50) NOT NULL UNIQUE,
  category_id INT,
  definition LONGTEXT NOT NULL,
  data_source_config JSON,
  parameters_schema JSON,
  version INT NOT NULL DEFAULT 1,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  thumbnail MEDIUMBLOB,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_template_category FOREIGN KEY (category_id) REFERENCES report_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_template_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_template_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  INDEX idx_report_templates_category (category_id),
  INDEX idx_report_templates_published (is_published),
  INDEX idx_report_templates_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create report_permissions table
CREATE TABLE report_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_id INT NOT NULL,
  role VARCHAR(50) NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_design BOOLEAN NOT NULL DEFAULT FALSE,
  can_export BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_permission_template FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE CASCADE,
  INDEX idx_report_permissions_template (template_id),
  INDEX idx_report_permissions_role (role),
  UNIQUE KEY uk_report_permissions_template_role (template_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create report_executions table
CREATE TABLE report_executions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_id INT NOT NULL,
  user_id INT NOT NULL,
  action ENUM('view', 'export', 'print') NOT NULL,
  parameters JSON,
  export_format VARCHAR(20),
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_ms INT,
  status ENUM('success', 'error', 'cancelled') NOT NULL,
  error_message VARCHAR(1000),
  ip_address VARCHAR(45),
  CONSTRAINT fk_execution_template FOREIGN KEY (template_id) REFERENCES report_templates(id),
  CONSTRAINT fk_execution_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_report_executions_template (template_id),
  INDEX idx_report_executions_user (user_id),
  INDEX idx_report_executions_date (executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default categories
INSERT INTO report_categories (name, description, sort_order) VALUES
('Inventory Reports', 'Stock levels, valuations, and inventory movements', 1),
('Production Reports', 'Work orders, batch records, and production yields', 2),
('Quality Reports', 'Certificates of Analysis, test results, and deviations', 3),
('Purchasing Reports', 'Purchase orders and vendor analysis', 4),
('Sales Reports', 'Sales orders and customer analysis', 5);
```

---

## Notes

1. **LONGTEXT for definition**: DevExpress report XML can be large (10KB - 1MB+). LONGTEXT supports up to 4GB.

2. **JSON columns**: MySQL 8.0+ has native JSON support. Use for flexible schema where structure may evolve.

3. **Thumbnail storage**: Stored as MEDIUMBLOB (16MB max). Consider moving to file storage for production if thumbnails are large.

4. **Audit trail size**: `report_executions` table will grow rapidly. Plan for archival/purge strategy.

5. **Integration with .NET backend**: The ASP.NET Core `ReportStorageWebExtension` will query these tables directly using its own MySQL connection (same database, separate connection pool).
