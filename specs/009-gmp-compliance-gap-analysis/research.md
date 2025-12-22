# Research: GMP Compliance Gap Analysis

**Feature**: 009-gmp-compliance-gap-analysis
**Date**: 2025-12-22
**Purpose**: Resolve technical unknowns and establish design decisions for GMP compliance modules

## Research Tasks Completed

### 1. Document Control System Design

**Decision**: Hierarchical document structure with version chains

**Rationale**:
- GMP requires traceable document history with approval chains
- Thai FDA (เอกสาร 2) mandates current vs obsolete document separation
- Existing hr_job_descriptions table provides approval workflow pattern to follow

**Alternatives Considered**:
- Flat document table with version field → Rejected: harder to query "current" versions
- Git-like commit history → Rejected: over-engineering for document control
- External DMS integration → Rejected: compliance requires audit trail in same system

**Design Pattern**:
```
documents (master record)
  └── document_versions (version chain)
        └── document_approvals (approval signatures per version)
```

### 2. CAPA Workflow Integration with Existing Deviations

**Decision**: CAPA as separate table with foreign key to deviation source

**Rationale**:
- Existing `deviations` table has `correctiveAction` and `preventiveAction` text fields
- CAPA needs structured workflow: actions, owners, due dates, effectiveness checks
- Multiple sources (deviation, complaint, audit finding) can trigger CAPA

**Alternatives Considered**:
- Extend deviation table with CAPA fields → Rejected: CAPA lifecycle differs from deviation
- Embed CAPA in deviation as JSON → Rejected: poor queryability, no separate workflow
- Separate CAPA module → Selected: clean separation, multiple source types

**Integration Pattern**:
```
deviations (existing)
  └── capa (new, references deviation_id OR complaint_id OR audit_finding_id)
        └── capa_actions (individual action items)
              └── capa_effectiveness (verification records)
```

### 3. Recall Distribution Tracking

**Decision**: Leverage existing `inventory_transactions` + new `recall_distributions` view

**Rationale**:
- Existing inventory transactions track movements by lot
- Need to aggregate by customer for recall notification
- Thai FDA requires customer contact info + quantities

**Alternatives Considered**:
- Separate distribution ledger table → Rejected: duplicates existing data
- Real-time aggregation only → Rejected: slow for large datasets
- Materialized view/cache → Selected: pre-aggregate for recall speed (4-hour target)

**Design Pattern**:
```
recalls (new)
  └── recall_notifications (customer notification tracking)
  └── recall_reconciliation (returned vs distributed)

Query: inventory_transactions by lot_id, group by customer
```

### 4. Stability Program Protocol Design

**Decision**: Protocol-driven testing with timepoint scheduling

**Rationale**:
- ICH guidelines require predefined test schedules (0, 1, 2, 3, 6, 9, 12, 18, 24, 36 months)
- Need trend visualization for early detection
- OOS results must trigger investigation workflow

**Alternatives Considered**:
- Ad-hoc testing → Rejected: not GMP compliant
- Fixed schedule for all products → Rejected: different products have different requirements
- Flexible protocol → Selected: protocol defines tests and timepoints per product

**Design Pattern**:
```
stability_protocols (defines test schedule template)
  └── stability_studies (instance per batch)
        └── stability_samples (enrolled batches)
              └── stability_tests (linked to quality_tests for results)
```

### 5. Audit Trail Consistency

**Decision**: Reuse existing `audit_log` pattern from HR module

**Rationale**:
- HR module has proven audit trail implementation
- Consistent format across all modules
- Already handles before/after values, user ID, timestamp

**Pattern from HR**:
```typescript
// Existing pattern in src/lib/db/schema.ts
export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tableName: text('table_name').notNull(),
  recordId: integer('record_id').notNull(),
  action: text('action').notNull(), // 'create', 'update', 'delete'
  oldValues: text('old_values'), // JSON
  newValues: text('new_values'), // JSON
  userId: integer('user_id'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
```

### 6. DevExtreme Component Patterns

**Decision**: Follow inventory module grid/form patterns

**Rationale**:
- Constitution mandates DevExtreme exclusively
- Inventory module has mature patterns for grids, filters, forms
- Consistency aids user training

**Reference Patterns**:
- DataGrid: `src/app/inventory/lots/page.tsx`
- Form with validation: `src/app/quality/deviations/new/page.tsx`
- Master-detail: `src/app/production/work-orders/[id]/page.tsx`

### 7. Sanitation Schedule Design

**Decision**: Calendar-based recurring schedule with completion tracking

**Rationale**:
- Sanitation requires daily/weekly/monthly schedules by area
- Need trend analysis for compliance rates
- Simple pattern, no complex workflows

**Design Pattern**:
```
sanitation_schedules (recurring schedule definition)
  └── sanitation_logs (actual completion records)
        ├── area, method, operator
        ├── verifiedBy, verifiedAt
        └── notes, deviations
```

### 8. Internal Audit GMP Coverage

**Decision**: Checklist-based audits mapped to หมวด 1-10

**Rationale**:
- Thai FDA requires coverage of all GMP areas
- Auditors need structured checklists
- Findings must link to CAPA

**Design Pattern**:
```
audit_plans (annual plan covering all areas)
  └── audits (individual audit events)
        └── audit_checklists (items to verify)
        └── audit_findings (observations/findings)
              └── capa (linked corrective actions)
```

## Technology Decisions Summary

| Area | Decision | Rationale |
|------|----------|-----------|
| Database | Drizzle ORM dual-schema (SQLite/MySQL) | Existing pattern, test isolation |
| API | Next.js API routes with Zod validation | Existing pattern, type safety |
| UI | DevExtreme React grids/forms | Constitution mandate |
| State | TanStack Query for server state | Existing pattern |
| Workflow | Status enum with transition rules | Simple, auditable |
| Audit | Centralized audit_log table | Consistency |
| Authorization | Reuse hr_authorizations pattern | GMP separation of duties |

## Unresolved Items

None - all technical unknowns resolved through codebase analysis and GMP best practices.

## Next Steps

1. Generate data-model.md with detailed entity definitions
2. Generate API contracts in OpenAPI format
3. Create quickstart.md implementation guide
