# Quickstart Guide: DevExpress Reports Integration

**Feature Branch**: `005-devexpress-reports`
**Created**: 2025-12-19

## Prerequisites

Before starting, ensure you have:

- [ ] Node.js 18.17 or later
- [ ] .NET 8.0 SDK or later
- [ ] MySQL 8.0 running (or Docker with MySQL container)
- [ ] DevExpress license (required for Reporting components)
- [ ] DevExpress NuGet feed configured

---

## 1. Configure DevExpress NuGet Feed

Before creating the .NET backend, configure access to DevExpress packages:

```bash
# Add DevExpress NuGet source (replace YOUR_FEED_URL with your licensed URL)
dotnet nuget add source https://nuget.devexpress.com/YOUR_FEED_URL/api -n DevExpress
```

Or edit `~/.nuget/NuGet/NuGet.Config`:
```xml
<configuration>
  <packageSources>
    <add key="DevExpress" value="https://nuget.devexpress.com/YOUR_FEED_URL/api" />
  </packageSources>
</configuration>
```

---

## 2. Create the ASP.NET Core Reporting Backend

### Option A: Using DevExpress CLI Templates (Recommended)

```bash
# Install DevExpress project templates
dotnet new install DevExpress.AspNetCore.ProjectTemplates

# Create backend in the reporting-backend folder
cd /home/manoi/docker/herbal-medicine-erp
dotnet new dx.aspnetcore.reporting.backend -n ReportingBackend -o reporting-backend --add-designer true

# Navigate to the project
cd reporting-backend
```

### Option B: Manual Setup

```bash
# Create empty ASP.NET Core Web API
cd /home/manoi/docker/herbal-medicine-erp
dotnet new webapi -n ReportingBackend -o reporting-backend
cd reporting-backend

# Add DevExpress Reporting packages
dotnet add package DevExpress.AspNetCore.Reporting --version 25.1.*
```

---

## 3. Configure the .NET Backend

### 3.1 Update Program.cs

```csharp
using DevExpress.AspNetCore;
using DevExpress.AspNetCore.Reporting;
using DevExpress.XtraReports.Web.Extensions;
using ReportingBackend.Services;

var builder = WebApplication.CreateBuilder(args);

// Add DevExpress Reporting services
builder.Services.AddDevExpressControls();
builder.Services.AddScoped<ReportStorageWebExtension, DatabaseReportStorage>();
builder.Services.AddMvc();

// Configure CORS for Next.js frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowNextJS", policy =>
    {
        policy.WithOrigins(
            "http://localhost:3000",  // Next.js dev
            "http://localhost:3001"   // Alternative port
        )
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials();
    });
});

// Add database connection
builder.Services.AddDbContext<ReportDbContext>(options =>
    options.UseMySql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        ServerVersion.AutoDetect(builder.Configuration.GetConnectionString("DefaultConnection"))
    ));

var app = builder.Build();

app.UseRouting();
app.UseCors("AllowNextJS");

// DevExpress middleware
app.UseDevExpressControls();

app.MapControllers();

app.Run();
```

### 3.2 Create Database Report Storage

Create `Services/DatabaseReportStorage.cs`:

```csharp
using DevExpress.XtraReports.UI;
using DevExpress.XtraReports.Web.Extensions;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace ReportingBackend.Services;

public class DatabaseReportStorage : ReportStorageWebExtension
{
    private readonly ReportDbContext _db;
    private readonly ILogger<DatabaseReportStorage> _logger;

    public DatabaseReportStorage(ReportDbContext db, ILogger<DatabaseReportStorage> logger)
    {
        _db = db;
        _logger = logger;
    }

    public override bool CanSetData(string url) => true;

    public override bool IsValidUrl(string url)
    {
        return _db.ReportTemplates.Any(r => r.Code == url);
    }

    public override byte[] GetData(string url)
    {
        var template = _db.ReportTemplates.FirstOrDefault(r => r.Code == url);
        if (template == null)
        {
            _logger.LogWarning("Report template not found: {Url}", url);
            throw new InvalidOperationException($"Report template '{url}' not found");
        }
        return Encoding.UTF8.GetBytes(template.Definition);
    }

    public override Dictionary<string, string> GetUrls()
    {
        return _db.ReportTemplates
            .Where(r => r.IsPublished)
            .ToDictionary(r => r.Code, r => r.Name);
    }

    public override void SetData(XtraReport report, string url)
    {
        var template = _db.ReportTemplates.FirstOrDefault(r => r.Code == url);
        if (template == null)
        {
            throw new InvalidOperationException($"Report template '{url}' not found");
        }

        using var stream = new MemoryStream();
        report.SaveLayoutToXml(stream);
        template.Definition = Encoding.UTF8.GetString(stream.ToArray());
        template.Version += 1;
        template.UpdatedAt = DateTime.UtcNow;
        _db.SaveChanges();
    }

    public override string SetNewData(XtraReport report, string defaultUrl)
    {
        var code = GenerateUniqueCode(defaultUrl);
        using var stream = new MemoryStream();
        report.SaveLayoutToXml(stream);

        var template = new ReportTemplate
        {
            Name = report.DisplayName ?? defaultUrl,
            Code = code,
            Definition = Encoding.UTF8.GetString(stream.ToArray()),
            Version = 1,
            IsPublished = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.ReportTemplates.Add(template);
        _db.SaveChanges();
        return code;
    }

    private string GenerateUniqueCode(string baseName)
    {
        var code = baseName.ToLowerInvariant().Replace(" ", "-");
        var counter = 1;
        var originalCode = code;
        while (_db.ReportTemplates.Any(r => r.Code == code))
        {
            code = $"{originalCode}-{counter++}";
        }
        return code;
    }
}
```

### 3.3 Create Database Context

Create `Data/ReportDbContext.cs`:

```csharp
using Microsoft.EntityFrameworkCore;

namespace ReportingBackend.Data;

public class ReportDbContext : DbContext
{
    public ReportDbContext(DbContextOptions<ReportDbContext> options) : base(options) { }

    public DbSet<ReportTemplate> ReportTemplates => Set<ReportTemplate>();
    public DbSet<ReportCategory> ReportCategories => Set<ReportCategory>();
    public DbSet<ReportPermission> ReportPermissions => Set<ReportPermission>();
    public DbSet<ReportExecution> ReportExecutions => Set<ReportExecution>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ReportTemplate>(entity =>
        {
            entity.ToTable("report_templates");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Code).HasMaxLength(50).IsRequired();
            entity.HasIndex(e => e.Code).IsUnique();
            entity.Property(e => e.Definition).HasColumnType("LONGTEXT");
        });

        // Add other entity configurations...
    }
}
```

### 3.4 Configure appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=herbal_erp;User=root;Password=your_password;"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

---

## 4. Install Frontend Dependencies

In the Next.js project root:

```bash
cd /home/manoi/docker/herbal-medicine-erp

# Install DevExpress Reporting React packages
npm install devexpress-reporting-react@25.1-stable
npm install devexpress-reporting@25.1-stable
npm install @devexpress/analytics-core@25.1-stable
npm install ace-builds
```

Verify versions match:
```bash
npm list devextreme devexpress-reporting
# Both should show 25.1.x
```

---

## 5. Create Report Viewer Component

Create `src/components/reports/ReportViewer.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import ReportViewer, { RequestOptions, Callbacks } from 'devexpress-reporting-react/dx-report-viewer';

// Import required CSS
import 'devextreme/dist/css/dx.light.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.common.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.light.css';
import 'devexpress-reporting/dist/css/dx-webdocumentviewer.css';

interface ReportViewerProps {
  reportUrl: string;
  parameters?: Record<string, unknown>;
  onReportReady?: () => void;
  onError?: (error: Error) => void;
}

export default function DxReportViewer({
  reportUrl,
  parameters,
  onReportReady,
  onError
}: ReportViewerProps) {
  const BACKEND_URL = process.env.NEXT_PUBLIC_REPORTING_BACKEND_URL || 'http://localhost:5000';

  return (
    <div className="h-full w-full min-h-[600px]">
      <ReportViewer reportUrl={reportUrl}>
        <RequestOptions
          host={BACKEND_URL}
          invokeAction="DXXRDV"
        />
        <Callbacks
          DocumentReady={() => onReportReady?.()}
          OnServerError={(args: { Error?: Error }) => onError?.(args.Error || new Error('Unknown error'))}
        />
      </ReportViewer>
    </div>
  );
}
```

---

## 6. Create Report Designer Component

Create `src/components/reports/ReportDesigner.tsx`:

```tsx
'use client';

import ReportDesigner, { RequestOptions, Callbacks } from 'devexpress-reporting-react/dx-report-designer';

// Import required CSS
import 'devextreme/dist/css/dx.light.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.common.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.light.css';
import 'devexpress-reporting/dist/css/dx-webdocumentviewer.css';
import 'devexpress-reporting/dist/css/dx-reportdesigner.css';
import '@devexpress/analytics-core/dist/css/dx-querybuilder.css';
import 'ace-builds/css/ace.css';
import 'ace-builds/css/theme/dreamweaver.css';

interface ReportDesignerProps {
  reportUrl: string;
  onSaved?: (url: string) => void;
  onError?: (error: Error) => void;
}

export default function DxReportDesigner({
  reportUrl,
  onSaved,
  onError
}: ReportDesignerProps) {
  const BACKEND_URL = process.env.NEXT_PUBLIC_REPORTING_BACKEND_URL || 'http://localhost:5000';

  return (
    <div className="h-full w-full min-h-[800px]">
      <ReportDesigner reportUrl={reportUrl}>
        <RequestOptions
          host={BACKEND_URL}
          getDesignerModelAction="DXXRD/GetDesignerModel"
        />
        <Callbacks
          ReportSaved={(args: { Url?: string }) => onSaved?.(args.Url || reportUrl)}
          OnServerError={(args: { Error?: Error }) => onError?.(args.Error || new Error('Unknown error'))}
        />
      </ReportDesigner>
    </div>
  );
}
```

---

## 7. Create Report Pages

### Report Viewer Page

Create `src/app/reports/view/[code]/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamic import to avoid SSR issues
const ReportViewer = dynamic(
  () => import('@/components/reports/ReportViewer'),
  { ssr: false, loading: () => <div>Loading viewer...</div> }
);

export default function ReportViewPage() {
  const params = useParams();
  const reportCode = params.code as string;

  return (
    <div className="container mx-auto p-4 h-screen">
      <h1 className="text-2xl font-bold mb-4">Report Viewer</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <ReportViewer
          reportUrl={reportCode}
          onReportReady={() => console.log('Report ready')}
          onError={(err) => console.error('Report error:', err)}
        />
      </Suspense>
    </div>
  );
}
```

### Report Designer Page

Create `src/app/reports/design/[code]/page.tsx`:

```tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const ReportDesigner = dynamic(
  () => import('@/components/reports/ReportDesigner'),
  { ssr: false, loading: () => <div>Loading designer...</div> }
);

export default function ReportDesignPage() {
  const params = useParams();
  const router = useRouter();
  const reportCode = params.code as string;

  return (
    <div className="container mx-auto p-4 h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Report Designer</h1>
        <button
          onClick={() => router.push('/reports')}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Back to Reports
        </button>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <ReportDesigner
          reportUrl={reportCode}
          onSaved={(url) => {
            console.log('Report saved:', url);
            router.push(`/reports/view/${url}`);
          }}
          onError={(err) => console.error('Designer error:', err)}
        />
      </Suspense>
    </div>
  );
}
```

---

## 8. Environment Variables

Create/update `.env.local`:

```bash
# DevExpress Reporting Backend URL
NEXT_PUBLIC_REPORTING_BACKEND_URL=http://localhost:5000
```

---

## 9. Run the Application

### Terminal 1: Start Next.js Frontend

```bash
cd /home/manoi/docker/herbal-medicine-erp
npm run dev
# Available at http://localhost:3000
```

### Terminal 2: Start .NET Reporting Backend

```bash
cd /home/manoi/docker/herbal-medicine-erp/reporting-backend
dotnet run
# Available at http://localhost:5000
```

### Terminal 3: Start MySQL (if using Docker)

```bash
docker-compose up -d mysql
```

---

## 10. Verify Setup

1. **Check .NET Backend**:
   ```bash
   curl http://localhost:5000/DXXRD/GetDesignerModel?reportUrl=test
   # Should return JSON (may show error about missing report, which is expected)
   ```

2. **Check CORS**:
   - Open browser DevTools Network tab
   - Navigate to `http://localhost:3000/reports/view/test-report`
   - Verify no CORS errors in console

3. **Run Database Migrations**:
   ```bash
   cd /home/manoi/docker/herbal-medicine-erp
   npm run db:push  # or appropriate Drizzle command
   ```

---

## 11. Create a Test Report

1. Navigate to `http://localhost:3000/reports/design/new-report`
2. Use the Report Designer to create a simple report:
   - Add a text label: "Hello World"
   - Save the report
3. View the report at `http://localhost:3000/reports/view/new-report`

---

## Troubleshooting

### CORS Errors
- Verify `AllowedOrigins` in .NET backend matches Next.js URL
- Check that `UseCors()` is called before `MapControllers()`

### Version Mismatch Errors
- Ensure npm package versions match NuGet package versions (both 25.1.x)
- Run `npm list devextreme devexpress-reporting` to verify

### Report Not Loading
- Check browser console for errors
- Verify .NET backend is running and accessible
- Check `NEXT_PUBLIC_REPORTING_BACKEND_URL` is set correctly

### Database Connection Issues
- Verify MySQL is running
- Check connection string in appsettings.json
- Ensure report tables are created

---

## Next Steps

1. **Run database migrations** to create report tables
2. **Create sample reports** for each category
3. **Implement report permissions** based on user roles
4. **Add authentication** to .NET backend endpoints
5. **Configure production deployment** (Docker, reverse proxy)
