# Implementation Plan: DevExpress Reports Integration

**Branch**: `005-devexpress-reports` | **Date**: 2025-12-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-devexpress-reports/spec.md`

## Summary

Integrate DevExpress Reports for Web and Mobile into the existing Next.js Herbal Medicine ERP application to provide:
- A web-based **Report Viewer** for viewing, exporting (PDF/Excel/Word), and printing reports
- A web-based **Report Designer** for creating and editing report templates visually
- A **Report Management** system for organizing templates with categories and role-based permissions

**Technical Approach**: Hybrid architecture with React frontend components (`devexpress-reporting-react`) connecting to a separate ASP.NET Core backend service for report processing. The .NET backend handles report rendering, storage, and export while connecting to the existing MySQL database for report data.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 15 frontend) + C# / .NET 8.0 (ASP.NET Core backend)
**Primary Dependencies**:
- Frontend: `devexpress-reporting-react@25.1-stable`, `devexpress-reporting@25.1-stable`, `@devexpress/analytics-core@25.1-stable`
- Backend: `DevExpress.AspNetCore.Reporting 25.1.x`
**Storage**: MySQL (existing ERP database) - new tables for report templates, categories, permissions
**Testing**: Vitest (frontend), xUnit (.NET backend)
**Target Platform**: Web browser (Chrome, Firefox, Safari, Edge - last 2 versions), responsive for desktop/tablet/mobile
**Project Type**: Web application with separate frontend/backend services
**Performance Goals**: Report pages load in <2s, export completes in <30s for 50-page reports
**Constraints**: 50 concurrent users, <500ms API response time, requires DevExpress commercial license
**Scale/Scope**: ~10-20 initial report templates, 5 user roles

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Type Safety | ✅ PASS | TypeScript strict mode (frontend), C# with nullable enabled (backend) |
| Linting Compliance | ✅ PASS | ESLint for frontend, built-in analyzers for .NET |
| Code Review | ✅ PASS | Standard PR workflow applies |
| Single Responsibility | ✅ PASS | Clear separation: React components (UI), .NET services (processing) |
| No Hardcoded Values | ✅ PASS | Configuration via environment variables |
| Error Handling | ✅ PASS | Standard API error responses, DevExpress error callbacks |
| Error Verification | ✅ PASS | `pnpm tsc --noEmit` + `pnpm lint` for frontend, `dotnet build` for backend |
| Frequent Commits | ✅ PASS | Atomic commits per task |
| Test Coverage | ✅ PASS | Unit tests for services, integration tests for API |
| Responsive Design | ✅ PASS | DevExpress components have built-in responsive support |
| Loading States | ✅ PASS | DevExpress provides loading indicators |
| Security/Auth | ✅ PASS | JWT token passthrough, role-based permissions |
| Audit Trail | ✅ PASS | `report_executions` table logs all access |

**Post-Phase 1 Re-check**: All gates continue to pass. The hybrid architecture maintains separation of concerns while leveraging existing authentication.

## Project Structure

### Documentation (this feature)

```text
specs/005-devexpress-reports/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: Technology research findings
├── data-model.md        # Phase 1: Database schema for reports
├── quickstart.md        # Phase 1: Developer setup guide
├── contracts/
│   └── openapi.yaml     # Phase 1: API contracts (Next.js + .NET)
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
# Next.js Frontend (existing project)
src/
├── app/
│   ├── reports/
│   │   ├── page.tsx                    # Report listing/dashboard
│   │   ├── view/
│   │   │   └── [code]/page.tsx         # Report viewer page
│   │   └── design/
│   │       └── [code]/page.tsx         # Report designer page
│   └── api/
│       └── reports/
│           ├── categories/route.ts     # Category CRUD
│           ├── templates/route.ts      # Template CRUD
│           ├── templates/[code]/
│           │   ├── route.ts            # Template detail
│           │   ├── permissions/route.ts
│           │   ├── publish/route.ts
│           │   └── unpublish/route.ts
│           ├── data/                   # Data endpoints for reports
│           │   ├── inventory-valuation/route.ts
│           │   ├── lot-status/route.ts
│           │   └── production-summary/route.ts
│           └── executions/route.ts     # Audit log
├── components/
│   └── reports/
│       ├── ReportViewer.tsx            # DevExpress Document Viewer wrapper
│       ├── ReportDesigner.tsx          # DevExpress Report Designer wrapper
│       ├── ReportList.tsx              # Template listing component
│       └── ReportCategoryTree.tsx      # Category navigation
├── lib/
│   ├── db/
│   │   └── schema/
│   │       └── reports.ts              # Drizzle schema for report tables
│   └── services/
│       └── reports.service.ts          # Existing - extend with new methods
└── types/
    └── reports.ts                      # TypeScript types for reports

# ASP.NET Core Reporting Backend (new project)
reporting-backend/
├── ReportingBackend.csproj
├── Program.cs                          # App configuration, CORS, DI
├── Controllers/
│   └── ReportDataController.cs         # Custom endpoints (optional)
├── Services/
│   ├── DatabaseReportStorage.cs        # ReportStorageWebExtension impl
│   └── JwtAuthenticationService.cs     # JWT validation service
├── Data/
│   ├── ReportDbContext.cs              # EF Core context
│   └── Models/                         # Entity classes
│       ├── ReportTemplate.cs
│       ├── ReportCategory.cs
│       ├── ReportPermission.cs
│       └── ReportExecution.cs
├── appsettings.json                    # Configuration
├── appsettings.Development.json
└── Dockerfile                          # Container deployment

# Tests
tests/
├── unit/
│   └── reports/                        # Frontend unit tests
└── integration/
    └── reports/                        # API integration tests

# Docker configuration
docker-compose.yml                      # Add reporting-backend service
```

**Structure Decision**: Hybrid web application with Next.js frontend and separate ASP.NET Core backend for DevExpress report processing. This structure is required because DevExpress Reporting components require a .NET server-side component - there is no pure Node.js option.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Separate .NET backend service | DevExpress Reporting requires ASP.NET Core for server-side processing | Pure Node.js solution not available from DevExpress; third-party alternatives would lose DevExpress ecosystem benefits |
| Two database connections (Node + .NET) | Both services need DB access | Proxying all DB calls through Next.js API would add latency and complexity for report operations |

## Phase Outputs Summary

### Phase 0: Research (Complete)

**Output**: [research.md](./research.md)

Key decisions made:
1. **Architecture**: Hybrid with ASP.NET Core backend (required by DevExpress)
2. **Data Sources**: JSON endpoints from Next.js API (reuses business logic)
3. **Storage**: Database storage via custom `ReportStorageWebExtension`
4. **Authentication**: JWT passthrough from frontend to .NET backend
5. **Versions**: DevExpress 25.1.x (matching existing devextreme packages)

### Phase 1: Design & Contracts (Complete)

**Outputs**:
- [data-model.md](./data-model.md) - 4 new tables: `report_categories`, `report_templates`, `report_permissions`, `report_executions`
- [contracts/openapi.yaml](./contracts/openapi.yaml) - API specifications for both Next.js and .NET endpoints
- [quickstart.md](./quickstart.md) - Developer setup guide

## Implementation Phases

### Phase 2: Core Infrastructure (Tasks to be generated)

1. Database migration for report tables
2. ASP.NET Core reporting backend setup
3. Basic DevExpress components integration
4. CORS and authentication configuration

### Phase 3: Report Viewer (P1 User Story)

1. Report Viewer component with paging/zoom
2. Report data API endpoints
3. Mobile-responsive viewer layout
4. Loading states and error handling

### Phase 4: Export & Print (P2 User Story)

1. PDF/Excel/Word export integration
2. Print functionality
3. Progress indication for large exports
4. Download handling

### Phase 5: Report Designer (P3 User Story)

1. Report Designer component integration
2. Template save/load functionality
3. Data source binding configuration
4. Preview functionality

### Phase 6: Template Management (P4 & P5 User Stories)

1. Template CRUD API endpoints
2. Category management
3. Permission management UI
4. Publishing workflow

### Phase 7: Security & Polish

1. Role-based access enforcement
2. Audit logging
3. Error handling improvements
4. Performance optimization

---

## Next Steps

Run `/speckit.tasks` to generate detailed implementation tasks for Phase 2 onwards.
