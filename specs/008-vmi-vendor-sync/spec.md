# Feature Specification: VMI Vendor Sync (Correction)

**Feature Branch**: `008-vmi-vendor-sync`
**Created**: 2025-12-21
**Status**: Draft
**Input**: User description: "Current implementation VMI sync is wrong - it links to purchasing vendor data which is incorrect. This system itself IS the vendor of external VMI portals. The VMI integration should sync OUR inventory data to external VMI portals, and incoming orders from VMI portals should come to OUR sales system. There should be VMI portal API key settings in the settings module."

## Problem Statement

The existing VMI integration (006-vmi-vendor-integration) was designed with an incorrect assumption: it treats this system as a **customer** that purchases from external vendors via VMI portals.

**The reality**: This herbal medicine ERP system IS the vendor/supplier. External hospitals connect to VMI portals, and this system needs to:
1. **Push OUR inventory data** to VMI portals so hospitals can see what we have in stock
2. **Receive orders FROM VMI portals** into OUR sales system (not purchasing)
3. **Manage API keys** for connecting to external VMI portals in system settings

This specification corrects the data flow direction and integrates VMI orders with the sales module instead of purchasing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure VMI Portal API Credentials in Settings (Priority: P1)

As a system administrator, I want to configure VMI Portal API credentials in the settings module so that our system can authenticate with external VMI portals and share our inventory data.

**Why this priority**: Without API credentials stored in settings, no VMI communication is possible. This is the foundation for all VMI functionality and corrects the current per-vendor configuration approach.

**Independent Test**: Can be fully tested by adding VMI portal credentials in system settings and verifying connection status via test API call.

**Acceptance Scenarios**:

1. **Given** user opens system settings, **When** user navigates to VMI Integration section, **Then** VMI Portal configuration form is displayed with fields for Portal URL, API Key, and Vendor ID (our vendor ID in the portal).

2. **Given** user enters valid VMI Portal credentials, **When** user saves the configuration, **Then** credentials are securely stored and a connection test is performed automatically.

3. **Given** user has configured VMI credentials, **When** user clicks "Test Connection", **Then** system calls VMI Portal API and displays connection status (success/failure with error details).

4. **Given** multiple VMI portals exist, **When** user adds a new portal configuration, **Then** each portal has its own API key, URL, and vendor ID configuration.

5. **Given** VMI credentials are invalid or expired, **When** connection test fails, **Then** clear error message is displayed indicating the specific issue.

---

### User Story 2 - Sync Our Inventory to VMI Portal (Priority: P1)

As a warehouse manager, I want to sync our inventory levels to VMI portals so that hospitals can see our product availability and place orders.

**Why this priority**: This is the core value proposition - hospitals need to see what we have in stock. This corrects the current implementation which syncs vendor inventory to us instead of our inventory to them.

**Independent Test**: Can be fully tested by triggering inventory sync and verifying our stock levels appear correctly in VMI Portal.

**Acceptance Scenarios**:

1. **Given** items are marked for VMI sync, **When** inventory sync is triggered, **Then** system sends our current inventory quantities to VMI Portal via API.

2. **Given** inventory sync is configured for automatic schedule, **When** scheduled time arrives, **Then** system automatically syncs inventory levels without manual intervention.

3. **Given** inventory quantities change significantly (threshold-based), **When** change exceeds configured threshold, **Then** real-time inventory update is sent to VMI Portal.

4. **Given** sync is triggered, **When** sync completes, **Then** summary shows items synced, quantities updated, and any failures with reasons.

5. **Given** an item exists in our system but not in VMI Portal, **When** inventory sync runs, **Then** item is created in VMI Portal before quantity is updated (or flagged for manual item setup).

---

### User Story 3 - Sync Our Item Catalog to VMI Portal (Priority: P2)

As a product manager, I want to sync our product catalog to VMI portals so that hospitals can see our available products with proper Thai standard codes (TPP/TTMT).

**Why this priority**: Items must exist in VMI Portal before inventory or prices can be synced. This enables hospitals to browse our product catalog.

**Independent Test**: Can be fully tested by syncing item master to VMI Portal and verifying items appear with correct TPP/TTMT codes.

**Acceptance Scenarios**:

1. **Given** items are configured for VMI sync, **When** item catalog sync is triggered, **Then** system sends item details including name, description, unit, and standard codes (TPP or TTMT) to VMI Portal.

2. **Given** an item is updated locally, **When** next sync runs, **Then** VMI Portal item is updated with latest information.

3. **Given** item sync is triggered, **When** sync completes, **Then** summary shows items created, updated, and failed with details.

4. **Given** an item lacks required standard code (TPP or TTMT), **When** sync is attempted, **Then** item is skipped with clear error message indicating missing code.

---

### User Story 4 - Sync Our Prices to VMI Portal (Priority: P2)

As a sales manager, I want to sync our product prices to VMI portals so that hospitals can see accurate pricing when creating orders.

**Why this priority**: Accurate pricing is essential for hospitals to place orders. Prices should reflect our sales prices, not vendor purchase costs.

**Independent Test**: Can be fully tested by syncing sales prices to VMI Portal and verifying prices match in portal.

**Acceptance Scenarios**:

1. **Given** items have configured sales prices, **When** price sync is triggered, **Then** system sends our selling prices to VMI Portal.

2. **Given** prices have effective and expiry dates, **When** synced, **Then** VMI Portal only shows prices valid for current date.

3. **Given** price sync completes, **When** viewing results, **Then** summary shows prices synced and any validation errors.

4. **Given** scheduled price sync is configured, **When** schedule triggers, **Then** prices are synced automatically.

---

### User Story 5 - Receive Orders from VMI Portal into Sales System (Priority: P1)

As a sales representative, I want to receive orders from VMI Portal into our sales system so that I can process and fulfill customer orders.

**Why this priority**: This is the core business transaction. Orders from hospitals via VMI Portal must flow into our sales system for fulfillment - NOT into purchasing.

**Independent Test**: Can be fully tested by polling for orders from VMI Portal and verifying they appear as sales orders ready for processing.

**Acceptance Scenarios**:

1. **Given** VMI Portal has new orders from hospitals, **When** order polling runs, **Then** new orders are retrieved and created as sales orders in our system.

2. **Given** a new VMI order is received, **When** order is created locally, **Then** order includes customer (hospital) information, line items, quantities, prices, and delivery requirements.

3. **Given** user confirms a sales order from VMI, **When** confirmation is sent to VMI Portal, **Then** order status in VMI Portal changes to "confirmed".

4. **Given** order is ready to ship, **When** user marks order as shipped, **Then** VMI Portal status updates with shipment details and expected delivery date.

5. **Given** customer receives goods, **When** receipt confirmation comes from VMI Portal, **Then** sales order is marked as delivered/completed.

---

### User Story 6 - VMI Integration Dashboard (Priority: P3)

As a system administrator, I want to monitor VMI integration health and sync status so that I can ensure reliable data exchange with VMI portals.

**Why this priority**: Operational visibility supports troubleshooting but doesn't block core functionality.

**Independent Test**: Can be fully tested by viewing dashboard showing sync status, recent transactions, and any alerts.

**Acceptance Scenarios**:

1. **Given** VMI integration is active, **When** user opens VMI dashboard, **Then** connection status, last sync times, and pending orders are displayed.

2. **Given** sync or order operations occur, **When** viewing transaction history, **Then** all operations with timestamps and outcomes are logged.

3. **Given** a sync or API call fails, **When** error occurs, **Then** error is logged and administrator notification is triggered.

---

### Edge Cases

- What happens when VMI Portal is unreachable during scheduled sync?
  - System retries with exponential backoff, logs failure, and alerts administrator after max retries.

- How does system handle orders for items not in our catalog?
  - Order is received but flagged for manual review; item must be mapped before fulfillment.

- What happens when inventory sync shows zero stock?
  - Zero quantity is synced; hospitals see item as out of stock in VMI Portal.

- How does system handle API key rotation?
  - Administrator updates key in settings; system re-validates connection before resuming sync.

- What happens when order confirmation fails?
  - Error is logged, order remains pending locally, retry is scheduled with exponential backoff.

- How does system handle multiple VMI portals with same customer ordering from different portals?
  - Each order includes portal identifier; sales orders are tagged with source portal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store VMI Portal configuration in the settings module, including Portal URL, API Key, and our Vendor ID.

- **FR-002**: System MUST support multiple VMI portal configurations with separate API keys per portal.

- **FR-003**: System MUST encrypt API keys at rest before storing in database.

- **FR-004**: System MUST provide connection test functionality to validate VMI portal credentials.

- **FR-005**: System MUST sync OUR inventory quantities to VMI Portal (outbound sync, not inbound).

- **FR-006**: System MUST support both manual and scheduled inventory sync with configurable intervals.

- **FR-007**: System MUST support threshold-based real-time inventory updates when stock changes significantly.

- **FR-008**: System MUST sync OUR product catalog (items) to VMI Portal including TPP/TTMT standard codes.

- **FR-009**: System MUST sync OUR sales prices to VMI Portal (not vendor purchase costs).

- **FR-010**: System MUST poll VMI Portal for new orders at configurable intervals.

- **FR-011**: System MUST create orders from VMI Portal as SALES ORDERS in the sales module (not purchase orders).

- **FR-012**: System MUST support order lifecycle: confirm, ship, and track delivery status.

- **FR-013**: System MUST update VMI Portal with order status changes (confirmed, shipped, delivered).

- **FR-014**: System MUST log all VMI API transactions for audit and troubleshooting.

- **FR-015**: System MUST handle partial sync failures gracefully, processing successful items while reporting failures.

- **FR-016**: System MUST display clear error messages for VMI API failures.

- **FR-017**: System MUST link VMI orders to existing customers (hospitals) or create new customer records.

### Key Entities

- **VMI Portal Configuration** (Settings): System-level settings for VMI portal connections including Portal URL, API Key (encrypted), Vendor ID (our ID in the portal), sync intervals, and connection status.

- **VMI Inventory Sync**: Our inventory data (item code + quantity available) pushed to VMI portal, with sync timestamps and status.

- **VMI Item Sync**: Our product catalog synced to VMI portal including item details, TPP/TTMT codes, and unit information.

- **VMI Price Sync**: Our sales prices synced to VMI portal including unit price, effective dates, and pricing tiers if applicable.

- **VMI Sales Order**: Sales order received from VMI portal, linked to customer (hospital), containing order details, line items, and status tracking.

- **VMI Transaction Log**: Audit trail of all API calls with timestamps, request/response data, and outcomes.

- **Customer (Hospital)**: External hospitals that order through VMI portal, linked to VMI portal customer identifiers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure VMI portal credentials in settings and verify connection within 2 minutes.

- **SC-002**: Inventory sync to VMI Portal completes for 500 items in under 60 seconds.

- **SC-003**: New orders from VMI Portal appear as sales orders within 5 minutes of polling interval.

- **SC-004**: 99% of VMI API calls complete successfully under normal network conditions.

- **SC-005**: System retains 90-day transaction log for audit purposes without performance degradation.

- **SC-006**: Users can track order status from receipt through delivery in sales order view.

- **SC-007**: System administrators are notified within 5 minutes of critical VMI integration failures.

- **SC-008**: All incoming VMI orders are correctly attributed to the source VMI portal.

## Assumptions

- VMI Portal API follows standard REST conventions for inventory, catalog, and order endpoints.
- API Key is obtained from VMI Portal administrator through out-of-band process.
- This system operates as a **Vendor/Supplier** in the VMI ecosystem, selling products to hospitals.
- Existing sales module can be extended to receive VMI-originated orders.
- Existing items table already has TPP and TTMT code fields from previous implementation.
- Customers (hospitals) in VMI portal map to customer records in our sales system.
- All monetary values are in Thai Baht (THB) by default.
- The settings module already exists and can be extended to store VMI configuration.
- Network connectivity to VMI Portal endpoints is available from the application server.

## Out of Scope

- VMI Portal administration (this is managed by the portal provider).
- Customer/hospital onboarding to VMI portal.
- Integration with purchasing module (this is specifically for sales).
- Payment processing (handled separately from order fulfillment).
- Advanced analytics and reporting beyond basic dashboard.
