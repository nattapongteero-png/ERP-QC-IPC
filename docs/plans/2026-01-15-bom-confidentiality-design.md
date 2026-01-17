# BOM Confidentiality Design

**Date:** 2026-01-15
**Status:** Draft
**Feature:** Protect confidential BOM items from unauthorized access

## Overview

Some items in Bills of Materials contain trade secrets that must be protected:
- Proprietary formulation ratios
- Key active ingredients
- Supplier-specific materials

This design implements item-level confidentiality controls with flexible access management.

## Requirements Summary

| Requirement | Decision |
|-------------|----------|
| What to protect | Item details, quantities, suppliers, costs |
| Confidentiality source | Item master default + BOM line override |
| Who can access | Configurable bypass roles + BOM owner + explicit grants |
| Unauthorized view | Placeholder "[Confidential Item]" |
| Cost handling | Hidden with item details |
| Access management | BOM-level grants with user groups |

---

## Data Model

### New Tables

#### `confidential_access_groups`

Groups of users who can access confidential BOM items.

| Column | Type | Description |
|--------|------|-------------|
| id | int | Primary key |
| code | varchar(50) | Unique group code (e.g., "RND_TEAM_A") |
| name | varchar(100) | Display name |
| description | text | Optional description |
| createdAt | datetime | Creation timestamp |
| updatedAt | datetime | Last update timestamp |

#### `confidential_access_group_members`

Links users to access groups.

| Column | Type | Description |
|--------|------|-------------|
| id | int | Primary key |
| groupId | int | FK to confidential_access_groups |
| userId | int | FK to users |
| addedAt | datetime | When user was added |
| addedBy | int | FK to users (who added them) |

**Unique constraint:** (groupId, userId)

#### `bom_confidential_access`

Explicit access grants to BOMs (users or groups).

| Column | Type | Description |
|--------|------|-------------|
| id | int | Primary key |
| bomId | int | FK to bom |
| userId | int | FK to users (nullable) |
| groupId | int | FK to confidential_access_groups (nullable) |
| grantedBy | int | FK to users |
| grantedAt | datetime | When access was granted |

**Constraint:** One of userId or groupId must be set (not both, not neither).

### Modified Tables

#### `items` (add columns)

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| confidentialityLevel | enum('public','internal','confidential') | 'public' | Item's base confidentiality |
| defaultConfidential | boolean | false | Whether item is confidential by default in BOMs |

#### `bom_lines` (add columns)

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| isConfidential | boolean | null | Explicit confidential flag (null = inherit) |
| confidentialityOverride | enum('inherit','public','confidential') | 'inherit' | Override item's default |

### System Settings

Add row to `system_settings`:

| Key | Value | Description |
|-----|-------|-------------|
| confidential_bypass_roles | `["ADMIN"]` | JSON array of roles that bypass all confidentiality checks |

---

## Access Control Logic

### Determining Line Confidentiality

```typescript
function isLineConfidential(bomLine: BOMLine, item: Item): boolean {
  // BOM line override takes precedence
  if (bomLine.confidentialityOverride === 'public') return false;
  if (bomLine.confidentialityOverride === 'confidential') return true;

  // Fall back to item default
  return item.defaultConfidential ||
         item.confidentialityLevel === 'confidential';
}
```

### Determining User Access

```typescript
function canViewConfidentialLine(
  userId: number,
  bomId: number
): boolean {
  // 1. Check bypass roles (from system_settings)
  const bypassRoles = getSystemSetting('confidential_bypass_roles');
  if (userHasAnyRole(userId, bypassRoles)) return true;

  // 2. Check if user is BOM creator/owner
  const bom = getBOM(bomId);
  if (bom.createdBy === userId) return true;

  // 3. Check explicit user grant
  const userGrant = db.select()
    .from(bomConfidentialAccess)
    .where(and(
      eq(bomConfidentialAccess.bomId, bomId),
      eq(bomConfidentialAccess.userId, userId)
    ))
    .get();
  if (userGrant) return true;

  // 4. Check group membership
  const userGroupIds = getUserGroupIds(userId);
  const groupGrant = db.select()
    .from(bomConfidentialAccess)
    .where(and(
      eq(bomConfidentialAccess.bomId, bomId),
      inArray(bomConfidentialAccess.groupId, userGroupIds)
    ))
    .get();
  if (groupGrant) return true;

  return false;
}
```

### Filtering BOM Response

```typescript
interface FilteredBOMLine {
  id: number;
  sequence: number;
  isConfidential: boolean;
  isHidden: boolean;
  placeholder?: string;
  // Original fields (null if hidden)
  itemId?: number;
  itemCode?: string;
  itemName?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  totalCost?: number;
}

function filterBOMLines(
  lines: BOMLine[],
  userId: number,
  bomId: number
): FilteredBOMLine[] {
  const canViewConfidential = canViewConfidentialLine(userId, bomId);

  return lines.map(line => {
    const confidential = isLineConfidential(line, line.item);

    if (!confidential || canViewConfidential) {
      return {
        ...line,
        isConfidential: confidential,
        isHidden: false,
      };
    }

    // Return placeholder for hidden confidential items
    return {
      id: line.id,
      sequence: line.sequence,
      isConfidential: true,
      isHidden: true,
      placeholder: '[Confidential Item]',
    };
  });
}
```

---

## API Design

### Modified Endpoints

#### `GET /api/bom/[id]`

Response includes filtered lines and metadata:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "BOM-001",
    "name": "Herbal Formula A",
    "lines": [
      { "id": 1, "itemCode": "RM-001", "itemName": "Base Powder", "quantity": 100 },
      { "id": 2, "isHidden": true, "placeholder": "[Confidential Item]" },
      { "id": 3, "itemCode": "RM-003", "itemName": "Filler", "quantity": 50 }
    ],
    "confidentialityInfo": {
      "hasConfidentialItems": true,
      "visibleLineCount": 2,
      "totalLineCount": 3,
      "userHasFullAccess": false
    }
  }
}
```

#### `GET /api/bom/[id]/cost`

Returns partial cost when items are hidden:

```json
{
  "success": true,
  "data": {
    "visibleCost": 1500.00,
    "totalCost": null,
    "includesHiddenItems": true,
    "breakdown": [
      { "itemCode": "RM-001", "cost": 1000.00 },
      { "itemCode": "[Confidential]", "cost": null },
      { "itemCode": "RM-003", "cost": 500.00 }
    ]
  }
}
```

When user has full access, `totalCost` is populated and all breakdown items are visible.

#### `GET /api/bom/[id]/explosion`

Filters exploded materials through same visibility logic. Nested confidential items are also hidden.

### New Endpoints

#### Confidential Access Groups

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/admin/confidential-groups` | admin:read | List all groups with member count |
| POST | `/api/admin/confidential-groups` | admin:write | Create group |
| GET | `/api/admin/confidential-groups/[id]` | admin:read | Get group with members |
| PUT | `/api/admin/confidential-groups/[id]` | admin:write | Update group |
| DELETE | `/api/admin/confidential-groups/[id]` | admin:write | Delete group (fails if in use) |
| POST | `/api/admin/confidential-groups/[id]/members` | admin:write | Add member |
| DELETE | `/api/admin/confidential-groups/[id]/members/[userId]` | admin:write | Remove member |

#### BOM Access Grants

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/bom/[id]/access` | production:read + access | List access grants |
| POST | `/api/bom/[id]/access` | production:write + access | Grant access |
| DELETE | `/api/bom/[id]/access/[grantId]` | production:write + access | Revoke access |

**Access requirement:** User must be BOM owner or have bypass role.

#### Bypass Roles Configuration

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/admin/settings/confidential-bypass-roles` | admin:read | Get bypass roles |
| PUT | `/api/admin/settings/confidential-bypass-roles` | admin:write | Update bypass roles |

---

## UI Design

### Item Master Modifications

**Page:** `/master-data/items/[id]`

Add "Confidentiality" section to edit form:

```
┌─ Confidentiality ─────────────────────────────┐
│                                               │
│  Confidentiality Level: [Public      ▼]      │
│                                               │
│  ☐ Default Confidential in BOMs              │
│                                               │
│  ℹ️ When checked, this item will be hidden    │
│    from unauthorized users in all BOMs        │
│    unless explicitly overridden.              │
│                                               │
└───────────────────────────────────────────────┘
```

### BOM Detail Page Modifications

**Page:** `/production/bom/[id]`

#### Materials DataGrid Changes

For unauthorized users viewing confidential items:

```
┌──────────┬────────────────────┬──────┬──────┬────────┐
│ Sequence │ Item               │ Qty  │ Unit │ Cost   │
├──────────┼────────────────────┼──────┼──────┼────────┤
│ 1        │ RM-001 Base Powder │ 100  │ kg   │ 1,000  │
│ 2        │ 🔒 [Confidential]  │ -    │ -    │ -      │
│ 3        │ RM-003 Filler      │ 50   │ kg   │ 500    │
└──────────┴────────────────────┴──────┴──────┴────────┘

⚠️ This BOM contains 1 confidential item you cannot view.
   Visible cost: ฿1,500 (partial)
```

For authorized users:

```
┌──────────┬────────────────────┬──────┬──────┬────────┬──────────────┐
│ Sequence │ Item               │ Qty  │ Unit │ Cost   │ Confidential │
├──────────┼────────────────────┼──────┼──────┼────────┼──────────────┤
│ 1        │ RM-001 Base Powder │ 100  │ kg   │ 1,000  │              │
│ 2        │ 🔒 RM-002 Secret X │ 25   │ kg   │ 2,500  │ ✓            │
│ 3        │ RM-003 Filler      │ 50   │ kg   │ 500    │              │
└──────────┴────────────────────┴──────┴──────┴────────┴──────────────┘

Total cost: ฿4,000
```

#### New "Access Control" Tab

Visible only to BOM owner and users with bypass roles:

```
┌─ Access Control ──────────────────────────────────────────────────┐
│                                                                   │
│  Users and groups who can view confidential items in this BOM:   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Type  │ Name              │ Granted By    │ Date       │    │ │
│  ├───────┼───────────────────┼───────────────┼────────────┼────┤ │
│  │ User  │ john@example.com  │ Admin         │ 2026-01-10 │ ✕  │ │
│  │ Group │ R&D Team A        │ Admin         │ 2026-01-08 │ ✕  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  [+ Add User]  [+ Add Group]                                     │
│                                                                   │
│  ℹ️ The BOM owner (creator) always has access.                   │
│  ℹ️ Users with bypass roles (ADMIN) always have access.          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### New Admin Pages

#### Confidential Access Groups

**Page:** `/admin/confidential-groups`

```
┌─ Confidential Access Groups ──────────────────────────────────────┐
│                                                                   │
│  Manage groups of users who can access confidential BOM items.   │
│                                                        [+ New]    │
│                                                                   │
│  ┌───────────────┬─────────────────┬─────────┬─────────────────┐ │
│  │ Code          │ Name            │ Members │ Actions         │ │
│  ├───────────────┼─────────────────┼─────────┼─────────────────┤ │
│  │ RND_TEAM_A    │ R&D Team A      │ 5       │ [Edit] [Delete] │ │
│  │ FORMULA_REVIEW│ Formula Review  │ 3       │ [Edit] [Delete] │ │
│  │ EXT_AUDITORS  │ External Audit  │ 2       │ [Edit] [Delete] │ │
│  └───────────────┴─────────────────┴─────────┴─────────────────┘ │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

Click on a group to manage members:

```
┌─ R&D Team A - Members ────────────────────────────────────────────┐
│                                                                   │
│  ┌────────────────────┬─────────────┬────────────────┬─────────┐ │
│  │ User               │ Added By    │ Added Date     │         │ │
│  ├────────────────────┼─────────────┼────────────────┼─────────┤ │
│  │ john@example.com   │ Admin       │ 2026-01-05     │ [Remove]│ │
│  │ jane@example.com   │ Admin       │ 2026-01-05     │ [Remove]│ │
│  └────────────────────┴─────────────┴────────────────┴─────────┘ │
│                                                                   │
│  [+ Add Member]                                                   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

#### Bypass Roles Setting

**Page:** `/admin/settings` (add section)

```
┌─ Confidential Access Settings ────────────────────────────────────┐
│                                                                   │
│  Bypass Roles                                                     │
│  Users with these roles can view ALL confidential BOM items.     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ☑ ADMIN                                                      │ │
│  │ ☐ MANAGER                                                    │ │
│  │ ☐ PRODUCTION                                                 │ │
│  │ ☐ QC                                                         │ │
│  │ ...                                                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  [Save Changes]                                                   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

### Server-Side Enforcement

- **Never send confidential data to client** - Filter in API/service layer
- **Don't rely on UI hiding** - Enforce visibility in service functions
- **Validate on every request** - Don't cache access decisions client-side

### Audit Logging

Log all security-relevant actions:

| Action | What to Log |
|--------|-------------|
| Grant access | bomId, userId/groupId, grantedBy |
| Revoke access | bomId, userId/groupId, revokedBy |
| Modify bypass roles | oldRoles, newRoles, modifiedBy |
| View confidential item | (optional) bomId, lineId, userId, timestamp |

### Export Protection

BOM exports (Excel, PDF) must respect visibility:
- Apply same filtering logic
- Include "[Confidential Item]" placeholders
- Add watermark: "Contains hidden confidential items"

---

## Edge Cases

### BOM Copying

When copying a BOM:
- Confidentiality override flags ARE copied
- Access grants are NOT copied (new owner starts fresh)
- New owner becomes the creator of the copy

### Work Order Creation

When creating work order from BOM:
- Work order materials inherit visibility rules
- Production staff may need separate "production:confidential" permission
- Consider: show item for production but hide supplier/cost?

### Where-Used Queries

When searching "Where is item X used?":
- Hide BOMs the user cannot access entirely
- Or show BOM name but indicate "contains confidential usage"

### Cost Rollup

For finished goods pricing:
- Full cost calculated server-side (no visibility filter)
- Display to user respects their access level
- Pricing decisions use true cost, not partial

### Circular Reference Check

System-level validation runs with full visibility - security doesn't affect data integrity checks.

---

## Performance

### Caching Strategy

| Data | Cache Duration | Invalidation |
|------|----------------|--------------|
| User's group memberships | Session | On login, on group change |
| Bypass roles setting | 5 minutes | On setting update |
| BOM access grants | Per-request | N/A (cheap query) |

### Query Optimization

- Index on `bom_confidential_access(bomId)`
- Index on `confidential_access_group_members(userId)`
- Consider denormalizing user's group IDs into session

---

## Implementation Order

1. **Phase 1: Database** - Add tables and columns, migrate existing data
2. **Phase 2: Service Layer** - Implement visibility logic in bom service
3. **Phase 3: API Updates** - Modify existing endpoints, add new ones
4. **Phase 4: Admin UI** - Groups management, bypass roles setting
5. **Phase 5: BOM UI** - Access control tab, confidential indicators
6. **Phase 6: Item UI** - Confidentiality settings on item master
7. **Phase 7: Testing** - Unit tests, integration tests, manual QA

---

## Open Questions

1. Should production workers see confidential items during manufacturing? (Separate permission?)
2. Should there be an audit report for "who viewed what confidential items"?
3. Should confidentiality apply to other documents (work orders, purchase orders)?
