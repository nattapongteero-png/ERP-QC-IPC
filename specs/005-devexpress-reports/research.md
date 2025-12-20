# Research: DevExpress Reports Integration

**Feature Branch**: `005-devexpress-reports`
**Research Date**: 2025-12-19

## Executive Summary

DevExpress Reporting for Web requires a **hybrid architecture** with an ASP.NET Core backend service running alongside the existing Next.js application. The frontend React components connect to the .NET backend via REST APIs for report generation, storage, and export operations.

---

## Critical Architectural Decision

### Decision: Separate ASP.NET Core Reporting Backend

**Rationale**: DevExpress Web Reporting (Report Designer and Document Viewer) operates on a client-server model where:
- The **client** (React/Next.js) provides the UI components
- The **server** (ASP.NET Core) handles report processing, storage, data binding, and export

There is **no pure Node.js backend option** available for DevExpress Reporting. The server-side report processing must use .NET.

**Alternatives Considered**:

| Alternative | Evaluation | Rejected Because |
|-------------|------------|------------------|
| Pure Node.js reporting | Not supported by DevExpress | DevExpress Report Designer/Viewer require .NET backend |
| Third-party JS reporting (jsreport, Stimulsoft) | Would require complete library change | User specifically requested DevExpress integration; DevExpress already licensed and used in project |
| DevExpress Report Server (standalone) | Commercial product, separate deployment | Additional licensing cost; overkill for current needs |

**Selected Architecture**:
```
┌─────────────────────────────────────────────────────────────────┐
│                     User Browser                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Next.js Frontend (Port 3000)                               │ │
│  │  - Report Viewer Component (devexpress-reporting-react)     │ │
│  │  - Report Designer Component (devexpress-reporting-react)   │ │
│  │  - Report Management Pages                                  │ │
│  └───────────────────────┬─────────────────────────────────────┘ │
└──────────────────────────┼───────────────────────────────────────┘
                           │ HTTP/REST (CORS enabled)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           ASP.NET Core Reporting Backend (Port 5000)            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Controllers:                                               ││
│  │  - DXXRD (Report Designer endpoints)                        ││
│  │  - DXXRDV (Document Viewer endpoints)                       ││
│  │  - Custom Report API (management, permissions)              ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Services:                                                  ││
│  │  - ReportStorageWebExtension (template storage)             ││
│  │  - Data Source Providers (connect to ERP database)          ││
│  │  - Export Services (PDF, Excel, Word)                       ││
│  └───────────────────────┬─────────────────────────────────────┘│
└──────────────────────────┼───────────────────────────────────────┘
                           │ Database Connection
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MySQL Database                                │
│  - Existing ERP tables (items, lots, orders, etc.)              │
│  - New: report_templates table                                  │
│  - New: report_categories table                                 │
│  - New: report_permissions table                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Research Findings

### 1. Frontend: React Components (devexpress-reporting-react)

**Decision**: Use `devexpress-reporting-react` npm package v25.1.x

**Key Findings**:
- Package: `devexpress-reporting-react@25.1-stable`
- Requires matching versions between npm packages and NuGet packages on backend
- Components are client-side only (`'use client'` directive required in Next.js)

**Required Dependencies**:
```json
{
  "devexpress-reporting-react": "25.1-stable",
  "devexpress-reporting": "25.1-stable",
  "@devexpress/analytics-core": "25.1-stable",
  "ace-builds": "^1.32.0"
}
```

**Required CSS Imports**:
```javascript
import 'devextreme/dist/css/dx.light.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.common.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.light.css';
import 'devexpress-reporting/dist/css/dx-webdocumentviewer.css';
import 'devexpress-reporting/dist/css/dx-reportdesigner.css';
import 'ace-builds/css/ace.css';
import '@devexpress/analytics-core/dist/css/dx-querybuilder.css';
```

**Sources**:
- [Reporting for React Documentation](https://docs.devexpress.com/XtraReports/401915/web-reporting/react-reporting)
- [Report Designer Next.js Integration](https://docs.devexpress.com/XtraReports/119339/web-reporting/react-reporting/report-designer/report-designer-integration-react-nextjs)

---

### 2. Backend: ASP.NET Core Reporting Service

**Decision**: Create separate ASP.NET Core 8.0 backend service

**Key Findings**:
- Use DevExpress CLI templates: `dotnet new dx.aspnetcore.reporting.backend`
- Required NuGet packages: `DevExpress.AspNetCore.Reporting` v25.1.x
- Controllers auto-generated: `DXXRD` (designer), `DXXRDV` (viewer)

**CORS Configuration Required**:
```csharp
builder.Services.AddCors(options => {
    options.AddPolicy("AllowNextJS", policy => {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});
```

**Controller Endpoints**:
| Endpoint | Purpose |
|----------|---------|
| `/DXXRD/GetDesignerModel` | Initialize Report Designer |
| `/DXXRD/GetReport` | Load report template |
| `/DXXRD/SaveReport` | Save report template |
| `/DXXRDV` | Document Viewer invoke action |
| `/api/reports/*` | Custom management endpoints |

**Sources**:
- [Report Designer Server-Side Configuration](https://docs.devexpress.com/XtraReports/400196/web-reporting/asp-net-core-reporting/server-side-configuration/report-designer-server-side-configuration-asp-net-core)
- [Add a Report Storage](https://docs.devexpress.com/XtraReports/400211/web-reporting/asp-net-core-reporting/end-user-report-designer-in-asp-net-applications/add-a-report-storage)

---

### 3. Report Storage Strategy

**Decision**: Database storage using custom `ReportStorageWebExtension`

**Rationale**:
- Consistent with existing ERP data model
- Enables permission-based access control
- Supports versioning and audit trail

**Storage Format**:
- Report templates stored as XML (DevExpress native format)
- Stored in `report_templates.definition` column (TEXT/LONGTEXT)

**Implementation Pattern**:
```csharp
public class DatabaseReportStorage : ReportStorageWebExtension
{
    public override byte[] GetData(string url) { /* Load from DB */ }
    public override void SetData(XtraReport report, string url) { /* Save to DB */ }
    public override string SetNewData(XtraReport report, string defaultUrl) { /* Create new */ }
    public override bool IsValidUrl(string url) { /* Validate template exists */ }
    public override Dictionary<string, string> GetUrls() { /* List all templates */ }
}
```

**Sources**:
- [Custom Report Storage](https://docs.devexpress.com/XtraReports/10001/detailed-guide-to-devexpress-reporting/store-and-distribute-reports/store-report-layouts-and-documents/custom-report-storage)

---

### 4. Data Source Binding

**Decision**: Use JSON Data Sources connecting to existing Next.js API endpoints

**Rationale**:
- Reuses existing API infrastructure and business logic
- Maintains consistent authentication/authorization
- Avoids direct database connection from .NET backend (simpler security)

**Architecture**:
```
Report Designer → .NET Backend → Next.js API → MySQL
```

**Implementation**:
- Register JSON data connections in .NET backend
- Configure data source endpoints pointing to Next.js API
- Pass authentication tokens for secure data access

**Alternative Considered**: Direct MySQL connection from .NET
- Rejected: Would bypass existing business logic and permissions
- Rejected: Creates dual database connection management

**Sources**:
- [JSON Data Source](https://docs.devexpress.com/XtraReports/400377/detailed-guide-to-devexpress-reporting/bind-reports-to-data/json-data)

---

### 5. Authentication Integration

**Decision**: JWT token passthrough from Next.js to .NET backend

**Implementation**:
- Next.js frontend includes JWT token in requests to .NET backend
- .NET backend validates token (shared secret or public key)
- .NET backend includes token when calling Next.js API for data

**Token Flow**:
```
1. User authenticates via Next.js → JWT issued
2. Report Viewer/Designer includes JWT in header to .NET backend
3. .NET validates JWT, extracts user/permissions
4. .NET calls Next.js API with JWT for report data
5. Data returned, report rendered
```

---

### 6. Export Functionality

**Decision**: Use built-in DevExpress export capabilities

**Supported Formats** (built-in):
- PDF (with accurate layout preservation)
- Excel (XLS, XLSX)
- Word (DOCX, RTF)
- Image (PNG, JPEG, TIFF, GIF)
- HTML
- CSV

**No additional libraries needed** - DevExpress handles all export processing on the .NET backend.

---

### 7. Version Compatibility

**Critical Requirement**: Frontend and backend versions MUST match exactly.

**Selected Versions**:
| Component | Version |
|-----------|---------|
| DevExpress npm packages | 25.1-stable (25.1.7) |
| DevExpress NuGet packages | 25.1.x |
| .NET SDK | 8.0+ |
| Node.js | 18.17+ |

**Existing Project Compatibility**:
- Project already uses `devextreme: 25.1.7` and `devextreme-react: 25.1.7`
- Reporting packages will match at 25.1.x

---

## Deployment Considerations

### Development Environment
- Next.js: `http://localhost:3000`
- .NET Reporting: `http://localhost:5000`
- MySQL: existing connection

### Production Environment
Options:
1. **Docker Compose**: Both services in containers, shared network
2. **Kubernetes**: Separate deployments with service mesh
3. **Single VM**: Both services on same server, nginx reverse proxy

**Recommendation**: Docker Compose for simplicity, matching current ERP deployment pattern.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Version mismatch between npm/NuGet | High - Components won't work | Lock versions in package.json and .csproj |
| CORS misconfiguration | High - Requests blocked | Comprehensive CORS policy; test in development |
| JWT validation differences | Medium - Auth failures | Share JWT secret; use standard JWT libraries |
| Report storage corruption | Medium - Data loss | Database transactions; backup strategy |
| Performance under load | Medium - Slow reports | Caching; async export; pagination |

---

## Next Steps

1. **Phase 1: Data Model** - Define database schema for report storage
2. **Phase 1: Contracts** - Define API contracts for .NET backend
3. **Phase 1: Quickstart** - Create setup guide for development environment
4. **Phase 2: Tasks** - Generate implementation tasks

---

## References

- [DevExpress Reporting for React](https://docs.devexpress.com/XtraReports/401915/web-reporting/react-reporting)
- [Report Designer Next.js Tutorial](https://docs.devexpress.com/XtraReports/119339/web-reporting/react-reporting/report-designer/report-designer-integration-react-nextjs)
- [Document Viewer Next.js Tutorial](https://docs.devexpress.com/XtraReports/119338/web-reporting/react-reporting/document-viewer/document-viewer-integration-react-nextjs)
- [ASP.NET Core Reporting Backend](https://docs.devexpress.com/XtraReports/119717/web-reporting/aspnet-core-reporting)
- [Best Practices GitHub Repository](https://github.com/DevExpress-Examples/AspNetCore.Reporting.BestPractices)
- [Report Storage Implementation](https://docs.devexpress.com/XtraReports/400211/web-reporting/asp-net-core-reporting/end-user-report-designer-in-asp-net-applications/add-a-report-storage)
