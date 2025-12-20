# Research: VMI Portal Vendor Integration

**Feature**: 006-vmi-vendor-integration
**Date**: 2025-12-20
**Status**: Complete

## Research Tasks

### 1. API Key Encryption at Rest

**Question**: How to securely store VMI Portal API keys in the database?

**Decision**: Use Node.js crypto module with AES-256-GCM encryption

**Rationale**:
- AES-256-GCM provides authenticated encryption (confidentiality + integrity)
- Built into Node.js, no additional dependencies required
- Industry standard for encrypting sensitive data at rest
- Encryption key stored in environment variable (`VMI_ENCRYPTION_KEY`)

**Alternatives Considered**:
- **bcrypt**: Rejected - designed for hashing (one-way), not encryption (two-way)
- **External KMS (AWS/Azure)**: Rejected - adds complexity and cloud dependency for self-hosted deployment
- **HSM**: Rejected - overkill for this use case, significant infrastructure requirement

**Implementation Pattern**:
```typescript
// src/lib/crypto/encrypt.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encrypt(plaintext: string): string {
  const key = Buffer.from(process.env.VMI_ENCRYPTION_KEY!, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(':');
  const key = Buffer.from(process.env.VMI_ENCRYPTION_KEY!, 'hex');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

---

### 2. Background Job Scheduling for Sync

**Question**: How to implement scheduled sync for items, prices, inventory, and order polling?

**Decision**: Use Next.js API routes with external cron trigger (system cron or hosted cron service)

**Rationale**:
- Next.js 15 App Router doesn't have built-in cron capabilities
- External cron is simple, reliable, and doesn't require additional dependencies
- Works with any deployment environment (Docker, VPS, cloud)
- Existing pattern used in similar enterprise applications

**Alternatives Considered**:
- **node-cron in custom server**: Rejected - requires custom Next.js server, complicates deployment
- **Vercel Cron Jobs**: Rejected - platform-specific, not available for self-hosted
- **BullMQ/Redis**: Rejected - adds Redis dependency, overkill for simple scheduled tasks
- **setInterval in API route**: Rejected - doesn't survive server restarts, not production-ready

**Implementation Pattern**:
```bash
# System crontab or hosted cron service
# Poll for orders every 15 minutes
*/15 * * * * curl -X POST http://localhost:3000/api/purchasing/vmi/cron/poll-orders -H "X-Cron-Secret: $CRON_SECRET"

# Sync inventory daily at 6 AM
0 6 * * * curl -X POST http://localhost:3000/api/purchasing/vmi/cron/sync-inventory -H "X-Cron-Secret: $CRON_SECRET"
```

```typescript
// src/app/api/purchasing/vmi/cron/poll-orders/route.ts
export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = request.headers.get('X-Cron-Secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Execute polling for all VMI vendors
  const results = await pollAllVmiOrders();
  return NextResponse.json({ success: true, results });
}
```

---

### 3. VMI Portal API Client Design

**Question**: How to structure the VMI Portal API client for maintainability and testability?

**Decision**: Create a dedicated service class with typed methods for each API endpoint

**Rationale**:
- Single responsibility: one service handles all VMI Portal communication
- Easy to mock for unit testing
- Centralized error handling and retry logic
- Type-safe with Zod validation for responses

**Implementation Pattern**:
```typescript
// src/lib/services/vmi-portal.service.ts
export class VmiPortalService {
  private baseUrl: string;
  private apiKey: string;

  constructor(vendorConfig: VmiVendorConfig) {
    this.baseUrl = process.env.VMI_PORTAL_BASE_URL || 'https://vmi-portal.bmscloud.in.th/api/external/vendor';
    this.apiKey = decrypt(vendorConfig.encryptedApiKey);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new VmiPortalError(error.code, error.message);
    }

    return response.json();
  }

  async syncItems(items: VmiItem[]): Promise<VmiSyncResult> { ... }
  async syncPrices(offers: VmiPriceOffer[]): Promise<VmiSyncResult> { ... }
  async syncInventory(inventory: VmiInventory[]): Promise<VmiSyncResult> { ... }
  async getOrders(params: VmiOrderQuery): Promise<VmiOrderListResponse> { ... }
  async getOrderDetail(orderId: number): Promise<VmiOrderDetail> { ... }
  async confirmOrder(orderId: number): Promise<VmiOrderActionResult> { ... }
  async shipOrder(orderId: number, expectedDeliveryDate: string): Promise<VmiOrderActionResult> { ... }
  async getReceiptStatus(orderId: number): Promise<VmiReceiptStatus> { ... }
  async testConnection(): Promise<boolean> { ... }
}
```

---

### 4. Vendor Item Mapping Strategy

**Question**: How to map local item codes to VMI Portal localCode format?

**Decision**: Use the existing item `code` field as `localCode` for VMI sync

**Rationale**:
- The existing `items.code` field is unique and serves as the primary identifier
- No additional mapping table needed - simpler implementation
- VMI API uses `localCode` as the vendor's internal product code, which aligns with our `code` field
- TPP and TTMT codes are stored directly on items table (new fields to be added)

**Alternatives Considered**:
- **Separate mapping table**: Rejected - adds complexity, vendor items already link via AVL
- **Vendor-specific code prefix**: Rejected - unnecessary, each vendor has isolated namespace in VMI Portal

**Data Flow**:
```
Local System                     VMI Portal
-----------                      ----------
items.code         →             localCode
items.tpp_code     →             tppCode (optional)
items.ttmt_code    →             ttmtCode (optional)
items.name_th      →             name
items.primary_unit →             unit
items.pack_size    →             packSize (use 1 if null)
items.pack_unit    →             packUnit (use primary_unit if null)
```

---

### 5. Transaction Logging Strategy

**Question**: How to log all VMI API transactions for audit and troubleshooting?

**Decision**: Extend existing `vmi_transactions` table with request/response logging

**Rationale**:
- Table already exists in schema with appropriate structure
- Add new fields for request/response payloads (JSON)
- Use existing audit trail pattern from constitution
- 90-day retention via scheduled cleanup job

**Schema Extension**:
```sql
-- Existing vmi_transactions table with new fields
ALTER TABLE vmi_transactions ADD COLUMN request_payload TEXT;
ALTER TABLE vmi_transactions ADD COLUMN response_payload TEXT;
ALTER TABLE vmi_transactions ADD COLUMN http_status INT;
ALTER TABLE vmi_transactions ADD COLUMN duration_ms INT;
```

**Alternatives Considered**:
- **New logging table**: Rejected - existing table is designed for VMI transactions
- **External logging service**: Rejected - adds dependency, existing table sufficient
- **File-based logging**: Rejected - harder to query and correlate

---

### 6. Order Status Mapping

**Question**: How to map VMI Portal order statuses to local system?

**Decision**: Store VMI Portal status directly, create local PO only on confirm

**Rationale**:
- VMI orders are external, keep them separate from internal POs until confirmed
- On confirm, create linked local PO for internal tracking
- Maintain bi-directional reference (vmi_order_id ↔ po_id)

**Status Flow**:
```
VMI Portal Status    Local System Action
-----------------    -------------------
submitted            Display in VMI Orders list (no local PO yet)
confirmed            Create local PO with status 'approved', link to VMI order
shipped              Update local PO status to 'sent'
received             Update local PO status to 'received'
cancelled            Mark VMI order as cancelled (no local PO or cancel existing)
```

---

### 7. Error Handling Strategy

**Question**: How to handle VMI Portal API errors gracefully?

**Decision**: Map VMI error codes to user-friendly Thai/English messages

**Error Code Mapping**:
| VMI Code | HTTP Status | User Message (TH) | User Message (EN) |
|----------|-------------|-------------------|-------------------|
| UNAUTHORIZED | 401 | API Key ไม่ถูกต้อง | Invalid API Key |
| API_KEY_EXPIRED | 401 | API Key หมดอายุ | API Key expired |
| API_KEY_REVOKED | 401 | API Key ถูกยกเลิก | API Key revoked |
| VALIDATION_ERROR | 400 | ข้อมูลไม่ถูกต้อง | Invalid data |
| ORDER_NOT_FOUND | 404 | ไม่พบคำสั่งซื้อ | Order not found |
| INVALID_STATUS_TRANSITION | 409 | ไม่สามารถเปลี่ยนสถานะได้ | Cannot change status |
| INTERNAL_ERROR | 500 | ระบบ VMI Portal มีปัญหา | VMI Portal system error |

**Retry Strategy**:
- Network errors: Retry 3 times with exponential backoff (1s, 2s, 4s)
- 5xx errors: Retry 2 times with 5s delay
- 4xx errors: No retry (client error)

---

## Summary

All technical decisions are resolved. Key architectural choices:
1. **Encryption**: AES-256-GCM with env-based key
2. **Scheduling**: External cron calling secure API endpoints
3. **API Client**: Typed service class with centralized error handling
4. **Item Mapping**: Direct use of items.code as localCode
5. **Logging**: Extend existing vmi_transactions table
6. **Order Flow**: Create local PO on confirm, maintain bidirectional link
7. **Errors**: Map to user-friendly messages, implement retry for transient failures
