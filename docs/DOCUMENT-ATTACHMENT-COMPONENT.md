# DocumentAttachment Component - Technical Specification

## Overview

`DocumentAttachment` is a reusable React component for uploading, previewing, and managing file attachments. It uses a **polymorphic design** allowing any module to attach files by specifying `moduleName` and `entityId`.

**Key Features:**
- Upload multiple files (PDF, Word, Excel, Images, CSV)
- Inline preview for PDF and images
- Download any file type
- Edit metadata (description, category)
- Delete with confirmation
- Read-only mode support
- Thai language labels
- DevExtreme UI integration
- Full audit trail

---

## Installation

The component is exported from the UI component library:

```typescript
import { DocumentAttachment } from '@/components/ui/document-attachment';
// or
import { DocumentAttachment } from '@/components/ui';
```

---

## Props API

```typescript
interface DocumentAttachmentProps {
  moduleName: string;           // Required: Module identifier (e.g., 'capa', 'deviation')
  entityId: number;             // Required: ID of the parent record
  title?: string;               // Optional: Section title (default: 'เอกสารแนบ')
  readOnly?: boolean;           // Optional: Disable upload/edit/delete (default: false)
  maxFiles?: number;            // Optional: Maximum attachments allowed (default: 20)
  maxFileSize?: number;         // Optional: Max file size in bytes (default: 10MB)
  allowedExtensions?: string[]; // Optional: Restrict file types (default: all supported)
  categories?: string[];        // Optional: Available categories (default: all)
  showPreview?: boolean;        // Optional: Enable inline preview (default: true)
  className?: string;           // Optional: Additional CSS classes
}
```

### Prop Details

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `moduleName` | `string` | *required* | Identifies the module (see Supported Modules) |
| `entityId` | `number` | *required* | ID of the parent record to link attachments |
| `title` | `string` | `'เอกสารแนบ'` | Header title displayed above the attachment list |
| `readOnly` | `boolean` | `false` | When `true`, hides upload/edit/delete buttons |
| `maxFiles` | `number` | `20` | Maximum number of attachments per entity |
| `maxFileSize` | `number` | `10485760` | Max file size (10MB = 10 * 1024 * 1024) |
| `allowedExtensions` | `string[]` | All supported | Array of extensions like `['.pdf', '.jpg']` |
| `categories` | `string[]` | All categories | Categories available in the dropdown |
| `showPreview` | `boolean` | `true` | Enable/disable inline preview button |
| `className` | `string` | `undefined` | Additional Tailwind CSS classes |

---

## Supported Modules

The following module names are supported:

### Quality/GMP Modules

| Module Name | Description |
|------------|-------------|
| `capa` | Corrective and Preventive Actions |
| `deviation` | Quality Deviations |
| `complaint` | Customer Complaints |
| `recall` | Product Recalls |
| `change_control` | Change Control Requests |
| `internal_audit` | Internal Audit Records |
| `audit_finding` | Audit Findings |
| `work_order` | Production Work Orders |
| `batch_record` | Batch Production Records |
| `stability_study` | Stability Studies |
| `sanitation` | Sanitation Records |
| `contract` | GMP Contracts |
| `pqr` | Product Quality Reviews |
| `training` | Training Records |
| `health_record` | Employee Health Records |

### HR Modules

| Module Name | Description |
|------------|-------------|
| `employee` | Employee Records (ID documents, contracts, photos) |
| `training_course` | Training Course Materials |
| `training_session` | Training Session Documents |
| `authorization` | Personnel Authorization Records |
| `delegation` | Authority Delegation Documents |
| `job_description` | Job Description Documents |
| `position` | Position-related Documents |
| `org_unit` | Organization Unit Documents |

### Procurement Modules

| Module Name | Description |
|------------|-------------|
| `purchase_order` | Purchase Order Documents |
| `vendor` | Vendor/Supplier Records |
| `goods_receiving` | Goods Receiving Notes (GRN) |

### Sales Modules

| Module Name | Description |
|------------|-------------|
| `sales_order` | Sales Order Documents |
| `customer` | Customer Records |
| `sales_quotation` | Sales Quotation Documents |

---

## Supported File Types

### MIME Types
```
application/pdf
application/msword
application/vnd.openxmlformats-officedocument.wordprocessingml.document
application/vnd.ms-excel
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
image/png
image/jpeg
image/gif
image/webp
text/plain
text/csv
```

### File Extensions
```
.pdf, .doc, .docx, .xls, .xlsx, .png, .jpg, .jpeg, .gif, .webp, .txt, .csv
```

### Inline Preview Support
Only these file types can be previewed inline:
- PDF (`.pdf`)
- Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`)

Other file types will trigger a download instead.

---

## Categories

Available categories for organizing attachments:

### Quality/GMP Categories

| Category | Thai Label | Description |
|----------|-----------|-------------|
| `evidence` | หลักฐาน | Evidence documents |
| `report` | รายงาน | Reports |
| `photo` | รูปภาพ | Photographs |
| `investigation` | การสอบสวน | Investigation documents |
| `root_cause` | สาเหตุราก | Root cause analysis |
| `sop_revision` | แก้ไข SOP | SOP revision documents |
| `training_record` | บันทึกการฝึกอบรม | Training records |
| `lab_result` | ผลห้องปฏิบัติการ | Laboratory results |
| `certificate` | ใบรับรอง | Certificates |
| `specification` | สเปค | Specifications |

### HR Categories

| Category | Thai Label | Description |
|----------|-----------|-------------|
| `id_document` | เอกสารประจำตัว | ID cards, passports |
| `contract` | สัญญา | Employment contracts |
| `qualification` | คุณวุฒิ | Degree certificates, transcripts |
| `resume` | ประวัติ | Resumes/CVs |
| `medical_certificate` | ใบรับรองแพทย์ | Medical certificates |
| `training_material` | เอกสารฝึกอบรม | Training materials |
| `authorization_doc` | เอกสารอนุมัติ | Authorization documents |

### Procurement Categories

| Category | Thai Label | Description |
|----------|-----------|-------------|
| `quotation` | ใบเสนอราคา | Price quotations |
| `invoice` | ใบแจ้งหนี้ | Invoices |
| `delivery_note` | ใบส่งของ | Delivery notes |
| `coa` | ใบ COA | Certificate of Analysis |
| `vendor_qualification` | คุณสมบัติผู้ขาย | Vendor qualification documents |
| `purchase_contract` | สัญญาซื้อขาย | Purchase contracts |

### Sales Categories

| Category | Thai Label | Description |
|----------|-----------|-------------|
| `sales_quotation` | ใบเสนอราคาขาย | Sales quotations |
| `sales_invoice` | ใบกำกับภาษี | Tax invoices |
| `receipt` | ใบเสร็จรับเงิน | Payment receipts |
| `shipping_doc` | เอกสารจัดส่ง | Shipping documents |
| `sales_contract` | สัญญาขาย | Sales contracts |
| `customer_po` | ใบสั่งซื้อลูกค้า | Customer purchase orders |
| `other` | อื่นๆ | Other documents |

---

## Usage Examples

### Basic Usage

```tsx
import { DocumentAttachment } from '@/components/ui/document-attachment';

function DeviationDetailPage({ deviationId }: { deviationId: number }) {
  return (
    <div>
      <h1>Deviation Details</h1>

      {/* Basic attachment section */}
      <DocumentAttachment
        moduleName="deviation"
        entityId={deviationId}
      />
    </div>
  );
}
```

### With Custom Title and Categories

```tsx
<DocumentAttachment
  moduleName="capa"
  entityId={capaId}
  title="เอกสารแนบ (Attachments)"
  categories={['evidence', 'root_cause', 'investigation', 'report', 'training_record', 'other']}
/>
```

### Read-Only Mode (for Closed Records)

```tsx
<DocumentAttachment
  moduleName="complaint"
  entityId={complaintId}
  title="Complaint Documents"
  readOnly={complaint.status === 'closed'}
/>
```

### Restricted File Types

```tsx
<DocumentAttachment
  moduleName="training"
  entityId={trainingId}
  title="Training Materials"
  allowedExtensions={['.pdf', '.doc', '.docx']}
  categories={['training_record', 'certificate']}
/>
```

### Custom File Limits

```tsx
<DocumentAttachment
  moduleName="batch_record"
  entityId={batchId}
  title="Batch Documents"
  maxFiles={50}
  maxFileSize={5 * 1024 * 1024}  // 5MB
/>
```

### With Custom Styling

```tsx
<DocumentAttachment
  moduleName="stability_study"
  entityId={studyId}
  title="Study Documents"
  className="mt-6 shadow-lg"
/>
```

### Full Featured Example (CAPA Page)

```tsx
import { DocumentAttachment } from '@/components/ui/document-attachment';

function CapaDetailPage({ capa }: { capa: CapaRecord }) {
  return (
    <MainLayout>
      {/* CAPA Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>CAPA #{capa.capaNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* ... CAPA details ... */}
        </CardContent>
      </Card>

      {/* Actions Section */}
      <Card>
        {/* ... CAPA actions ... */}
      </Card>

      {/* Attachments Section */}
      <DocumentAttachment
        moduleName="capa"
        entityId={capa.id}
        title="เอกสารแนบ (Attachments)"
        categories={[
          'evidence',
          'root_cause',
          'investigation',
          'report',
          'training_record',
          'other'
        ]}
        readOnly={capa.status === 'closed'}
      />
    </MainLayout>
  );
}
```

---

## API Endpoints

The component communicates with these REST API endpoints:

### List Attachments
```
GET /api/attachments?moduleName={module}&entityId={id}&category={category}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "moduleName": "capa",
      "entityId": 123,
      "fileName": "evidence.pdf",
      "fileSize": 1024000,
      "mimeType": "application/pdf",
      "description": "Investigation evidence",
      "category": "evidence",
      "uploadedBy": 1,
      "uploadedByName": "John Doe",
      "uploadedAt": "2024-12-24T10:00:00Z",
      "updatedAt": "2024-12-24T10:00:00Z"
    }
  ]
}
```

### Upload Attachment
```
POST /api/attachments
Content-Type: application/json

{
  "moduleName": "capa",
  "entityId": 123,
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "mimeType": "application/pdf",
  "fileData": "<base64-encoded-content>",
  "description": "Optional description",
  "category": "evidence"
}
```

### Download/Preview
```
GET /api/attachments/{id}/download
GET /api/attachments/{id}/download?inline=1  // For preview
```

### Update Metadata
```
PUT /api/attachments/{id}
Content-Type: application/json

{
  "description": "Updated description",
  "category": "report"
}
```

### Delete Attachment
```
DELETE /api/attachments/{id}
```

---

## Database Schema

Attachments are stored in the `attachments` table with BLOB storage:

```sql
CREATE TABLE attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  module_name VARCHAR(50) NOT NULL,      -- e.g., 'capa', 'deviation'
  entity_id INT NOT NULL,                 -- ID of linked record
  file_name VARCHAR(255) NOT NULL,        -- Original filename
  file_size INT NOT NULL,                 -- Size in bytes
  mime_type VARCHAR(100) NOT NULL,        -- MIME type
  file_data LONGBLOB NOT NULL,            -- Binary file content
  description VARCHAR(500),               -- Optional description
  category VARCHAR(50),                   -- Optional category
  uploaded_by INT REFERENCES users(id),   -- Uploader user ID
  uploaded_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,

  INDEX idx_module_entity (module_name, entity_id)
);
```

---

## Service Layer API

For programmatic access, use the attachment service:

```typescript
import {
  getAttachments,
  getAttachmentById,
  getAttachmentFileData,
  createAttachment,
  updateAttachment,
  deleteAttachment,
  deleteAllAttachments,
  countAttachments,
} from '@/lib/services/attachment-service';

// List attachments
const attachments = await getAttachments('capa', capaId);

// Get single attachment (without file data)
const attachment = await getAttachmentById(attachmentId);

// Get file data for download
const fileData = await getAttachmentFileData(attachmentId);
// Returns: { data: Buffer, fileName, fileSize, mimeType }

// Create attachment
const newAttachment = await createAttachment({
  moduleName: 'capa',
  entityId: capaId,
  fileName: 'document.pdf',
  fileSize: 1024000,
  mimeType: 'application/pdf',
  fileData: Buffer.from(base64Data, 'base64'),
  description: 'Evidence document',
  category: 'evidence',
}, userId);

// Update metadata
const updated = await updateAttachment(attachmentId, {
  description: 'Updated description',
  category: 'report',
}, userId);

// Delete single attachment
await deleteAttachment(attachmentId, userId);

// Delete all attachments for an entity (cascade delete)
const deletedCount = await deleteAllAttachments('capa', capaId, userId);

// Count attachments
const count = await countAttachments('capa', capaId);
```

---

## Audit Trail

All attachment operations are logged to the audit trail:

| Action | Logged Data |
|--------|-------------|
| CREATE | moduleName, entityId, fileName, fileSize, category |
| UPDATE | Old and new description/category values |
| DELETE | moduleName, entityId, fileName, category |

Audit logs can be viewed in the system audit trail at `/hr/audit`.

---

## Validation Schema

For custom validation, import from the validation module:

```typescript
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  VALID_MODULES,
  ATTACHMENT_CATEGORIES,
  attachmentCreateSchema,
  attachmentUpdateSchema,
  isValidFileExtension,
  canPreviewInline,
  getFileTypeIcon,
} from '@/lib/validation/attachments';

// Check if file can be previewed
const canPreview = canPreviewInline('application/pdf'); // true

// Validate file extension
const isValid = isValidFileExtension('document.pdf'); // true

// Get icon name for UI
const icon = getFileTypeIcon('application/pdf'); // 'file-text'
```

---

## Best Practices

### 1. Always Specify Meaningful Categories

```tsx
// Good - helps users organize documents
<DocumentAttachment
  moduleName="deviation"
  entityId={id}
  categories={['evidence', 'investigation', 'root_cause', 'report']}
/>

// Avoid - too many irrelevant categories
<DocumentAttachment
  moduleName="deviation"
  entityId={id}
  // Uses all 11 categories by default - may confuse users
/>
```

### 2. Use Read-Only Mode for Closed Records

```tsx
// Good - prevents modifications to closed records
<DocumentAttachment
  moduleName="capa"
  entityId={id}
  readOnly={capa.status === 'closed' || capa.status === 'cancelled'}
/>
```

### 3. Set Appropriate File Limits

```tsx
// For large document collections (e.g., batch records)
<DocumentAttachment
  moduleName="batch_record"
  entityId={id}
  maxFiles={100}
  maxFileSize={20 * 1024 * 1024}  // 20MB for large PDFs
/>

// For simple attachments (e.g., training certificates)
<DocumentAttachment
  moduleName="training"
  entityId={id}
  maxFiles={5}
  maxFileSize={5 * 1024 * 1024}  // 5MB
  allowedExtensions={['.pdf']}
/>
```

### 4. Provide Bilingual Titles

```tsx
// Good - supports both Thai and English users
<DocumentAttachment
  moduleName="complaint"
  entityId={id}
  title="เอกสารร้องเรียน (Complaint Documents)"
/>
```

### 5. Cascade Delete When Deleting Parent Records

```typescript
// In your service when deleting a CAPA
import { deleteAllAttachments } from '@/lib/services/attachment-service';

async function deleteCapa(capaId: number, userId: number) {
  // Delete all attachments first
  await deleteAllAttachments('capa', capaId, userId);

  // Then delete the CAPA record
  await db.delete(capa).where(eq(capa.id, capaId));
}
```

---

## Troubleshooting

### File Upload Fails

1. **Check file size** - Default limit is 10MB
2. **Check file type** - Must be in allowed extensions list
3. **Check authentication** - User must be logged in
4. **Check network** - Large files may timeout

### Preview Not Working

1. **Check file type** - Only PDF and images support inline preview
2. **Check browser** - Some browsers block iframe content
3. **Use download** - Falls back to download for unsupported types

### Attachments Not Loading

1. **Check moduleName** - Must be one of the valid module names
2. **Check entityId** - Must be a valid positive integer
3. **Check API** - Verify `/api/attachments` endpoint is accessible

---

## Migration Guide

### Adding Attachments to a New Module

1. **Add module name to validation** (if not already supported):
   ```typescript
   // src/lib/validation/attachments.ts
   export const VALID_MODULES = [
     // ... existing modules
     'my_new_module',  // Add here
   ] as const;
   ```

2. **Add component to your page**:
   ```tsx
   <DocumentAttachment
     moduleName="my_new_module"
     entityId={recordId}
   />
   ```

3. **Handle cascade delete** in your service layer (optional but recommended)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12-24 | Initial release with full feature set |

---

## Related Documentation

- [DevExtreme React Components](https://js.devexpress.com/React/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Zod Validation](https://zod.dev/)
