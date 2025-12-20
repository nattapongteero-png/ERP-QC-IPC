# Feature Specification: VMI Portal Vendor Integration

**Feature Branch**: `006-vmi-vendor-integration`
**Created**: 2025-12-20
**Status**: Draft
**Input**: User description: "Read document VMI-VENDOR-API.md and modify settings to store API key and check that this system can interface VMI API in realtime and has necessary data to interface"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure VMI Portal API Credentials (Priority: P1)

As a system administrator, I want to configure VMI Portal API credentials for each VMI vendor so that the system can authenticate and communicate with the VMI Portal.

**Why this priority**: Without API credentials, no VMI communication is possible. This is the foundation for all other VMI functionality.

**Independent Test**: Can be fully tested by configuring API credentials for a vendor and verifying the connection status via a test API call to VMI Portal.

**Acceptance Scenarios**:

1. **Given** a vendor is marked as VMI vendor, **When** admin opens vendor settings, **Then** VMI configuration section is displayed with fields for API Key and Vendor ID.

2. **Given** admin enters valid VMI API credentials, **When** admin saves the configuration, **Then** credentials are securely stored and a connection test is performed automatically.

3. **Given** admin has configured VMI credentials, **When** admin clicks "Test Connection", **Then** system calls VMI Portal API and displays connection status (success/failure with error details).

4. **Given** VMI credentials are invalid or expired, **When** connection test fails, **Then** clear error message is displayed indicating the specific issue (invalid key, expired, revoked).

---

### User Story 2 - Sync Item Master to VMI Portal (Priority: P2)

As a purchasing manager, I want to sync our item master data to the VMI Portal so that vendors can see which products we need and maintain accurate catalog information.

**Why this priority**: Items must exist in VMI Portal before prices, inventory, or orders can be processed. This enables the vendor to know what products the hospital uses.

**Independent Test**: Can be fully tested by selecting items and triggering sync to VMI Portal, then verifying items appear in vendor's system via GET /items API.

**Acceptance Scenarios**:

1. **Given** items are associated with a VMI vendor through AVL (Approved Vendor List), **When** user initiates item sync, **Then** system sends item data to VMI Portal via POST /items API.

2. **Given** item sync is initiated, **When** sync completes, **Then** system displays summary showing inserted, updated, and failed counts.

3. **Given** an item already exists in VMI Portal, **When** item is synced again with updated information, **Then** VMI Portal updates the existing item (upsert behavior).

4. **Given** item sync encounters partial failure, **When** some items fail validation, **Then** successful items are processed and detailed error messages are shown for failed items.

---

### User Story 3 - Sync Price Offers to VMI Portal (Priority: P2)

As a purchasing manager, I want to sync our pricing information to VMI Portal so that hospitals can see accurate prices when creating orders.

**Why this priority**: Accurate pricing is essential for order creation. This enables hospitals to get real-time price verification before placing orders.

**Independent Test**: Can be fully tested by creating price offers and syncing to VMI Portal, then verifying prices are returned when hospitals query.

**Acceptance Scenarios**:

1. **Given** items exist in VMI Portal, **When** user syncs price offers, **Then** system sends current prices via POST /prices API with effective dates.

2. **Given** prices are synced, **When** sync completes, **Then** summary shows inserted/updated/failed counts with details.

3. **Given** price offers have effective and expiry dates, **When** synced, **Then** VMI Portal only shows prices valid for current date.

4. **Given** price sync is scheduled, **When** scheduled time arrives, **Then** system automatically syncs price updates without manual intervention.

---

### User Story 4 - Sync Inventory Availability to VMI Portal (Priority: P2)

As a warehouse manager, I want to share our current inventory levels with VMI Portal so that hospitals can see product availability when ordering.

**Why this priority**: Hospitals need visibility into vendor inventory to make informed purchasing decisions. This enables accurate availability information.

**Independent Test**: Can be fully tested by syncing current inventory quantities to VMI Portal and verifying via API that quantities are updated.

**Acceptance Scenarios**:

1. **Given** items are managed via VMI, **When** inventory sync is triggered, **Then** system sends current available quantities via POST /inventory API.

2. **Given** inventory quantities change, **When** threshold-based sync is configured, **Then** system automatically syncs when changes exceed threshold.

3. **Given** daily inventory sync is scheduled, **When** scheduled time arrives, **Then** system sends inventory snapshot for all VMI-managed items.

---

### User Story 5 - Receive and Manage Orders from Hospitals (Priority: P1)

As a purchasing manager, I want to receive orders created by hospitals through VMI Portal so that I can fulfill purchase commitments.

**Why this priority**: Orders are the core business transaction. Hospitals create orders in VMI Portal and this system needs to receive and process them.

**Independent Test**: Can be fully tested by polling for new orders from VMI Portal and verifying they appear as pending orders in the local system.

**Acceptance Scenarios**:

1. **Given** VMI Portal has new orders with status "submitted", **When** order polling runs, **Then** new orders are retrieved and displayed for review.

2. **Given** a new VMI order is received, **When** order details are viewed, **Then** all line items with quantities, prices, TPP codes, and TTMT codes are displayed.

3. **Given** user confirms a VMI order, **When** confirmation is sent via PATCH /orders/{id}, **Then** order status in VMI Portal changes to "confirmed".

4. **Given** order is ready to ship, **When** user marks order as shipped with expected delivery date, **Then** VMI Portal status updates to "shipped".

5. **Given** hospital has received goods, **When** checking receipt status via GET /orders/{id}/receipt-status, **Then** system shows which items have been received and quantities pending.

---

### User Story 6 - VMI Dashboard and Monitoring (Priority: P3)

As a system administrator, I want to monitor VMI integration health and transaction history so that I can troubleshoot issues and ensure reliable data exchange.

**Why this priority**: Operational visibility is important but not blocking. Provides confidence that the integration is working correctly.

**Independent Test**: Can be fully tested by viewing the VMI dashboard to see sync status, recent transactions, and any error alerts.

**Acceptance Scenarios**:

1. **Given** VMI integration is active, **When** user opens VMI dashboard, **Then** connection status, last sync times, and pending orders are displayed.

2. **Given** VMI API calls have been made, **When** viewing transaction history, **Then** all API calls with request/response details and timestamps are logged.

3. **Given** a VMI API call fails, **When** error occurs, **Then** error is logged with details and administrator notification is triggered.

---

### Edge Cases

- What happens when VMI Portal is unreachable during scheduled sync?
  - System retries with exponential backoff, logs failure, and alerts administrator after max retries.

- How does system handle items without localCode mapping?
  - Items without vendor-specific localCode cannot be synced; user must configure mapping first.

- What happens when order confirmation fails midway?
  - Error is logged, order remains in "submitted" status locally, retry is scheduled.

- How does system handle API Key expiration during operation?
  - Failed requests return 401 error; system stops sync and notifies administrator to renew credentials.

- What happens when attempting to sync inactive or disabled items?
  - Only active items (isActive=true) are included in sync; inactive items are skipped with log entry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST securely store VMI Portal API credentials per vendor, including API Key (X-API-Key format).

- **FR-002**: System MUST provide API credential validation by testing connection to VMI Portal on save.

- **FR-003**: System MUST support manual and scheduled synchronization of item master data to VMI Portal.

- **FR-004**: System MUST map local item codes to vendor-specific localCode format for VMI API compatibility.

- **FR-005**: System MUST sync pricing data including unit price, pack price, MOQ, lead time, and effective/expiry dates.

- **FR-006**: System MUST sync current inventory quantities (available stock) to VMI Portal.

- **FR-007**: System MUST poll VMI Portal for new orders at configurable intervals (default: every 15 minutes).

- **FR-008**: System MUST support order lifecycle management: view details, confirm, ship, and check receipt status.

- **FR-009**: System MUST log all VMI API transactions with request/response data for audit and troubleshooting.

- **FR-010**: System MUST handle partial sync failures gracefully, processing successful items while reporting failures.

- **FR-011**: System MUST support idempotent operations to handle duplicate order confirmations safely.

- **FR-012**: System MUST encrypt API credentials at rest before storing in database.

- **FR-013**: System MUST display clear, user-friendly error messages based on VMI Portal error codes (UNAUTHORIZED, VALIDATION_ERROR, ORDER_NOT_FOUND, INVALID_STATUS_TRANSITION).

- **FR-014**: System MUST support both manual trigger and scheduled background sync for items, prices, and inventory.

- **FR-015**: System MUST include TPP codes and TTMT codes in item sync when available.

- **FR-016**: System MUST store TTMT code (Thai Traditional Medicine Terminology) in the items table for finished products to comply with Thai pharmaceutical standards.

- **FR-017**: System MUST store TPP code (Thai Pharmaceutical Product) in the items table for drug products to enable standard product identification.

### Key Entities

- **VMI Vendor Configuration**: Vendor-specific settings including API Key, connection status, sync preferences, and last sync timestamps.

- **Vendor Item Mapping**: Relationship between local item codes and vendor-specific localCode for VMI sync.

- **Item (Extended)**: Existing item master extended with tpp_code (Thai Pharmaceutical Product code, 13 digits) and ttmt_code (Thai Traditional Medicine Terminology, format A01234567) fields for standard product identification.

- **VMI Price Offer**: Price information to be synced including unit price, pack price, MOQ, lead time, effective/expiry dates.

- **VMI Inventory Sync**: Point-in-time inventory availability data (localCode + quantityAvailable) sent to portal.

- **VMI Order**: Purchase order received from hospital via VMI Portal with status tracking (submitted, confirmed, shipped, received).

- **VMI Transaction Log**: Audit trail of all API calls with timestamps, request/response data, and outcome status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure VMI credentials and verify connection within 2 minutes.

- **SC-002**: Item sync to VMI Portal completes for 100 items in under 30 seconds.

- **SC-003**: Order polling retrieves and displays new orders within 5 minutes of scheduled interval.

- **SC-004**: 99% of VMI API calls complete successfully under normal network conditions.

- **SC-005**: System retains 90-day transaction log for audit purposes without performance degradation.

- **SC-006**: Price and inventory sync can be scheduled to run automatically at least once daily.

- **SC-007**: Users can track order status from submission through delivery confirmation in a single view.

- **SC-008**: System administrators are notified within 5 minutes of critical VMI integration failures.

## Assumptions

- VMI Portal API follows the specification in docs/VMI-VENDOR-API.md version 1.2.
- API Key is obtained from VMI Portal administrator through out-of-band process.
- Network connectivity to VMI Portal endpoint (vmi-portal.bmscloud.in.th) is available from the application server.
- Existing vendor and item master data is maintained in the local system.
- This system operates as a "Vendor" in the VMI Portal ecosystem, supplying items to hospitals.
- TPP codes (Thai Pharmaceutical Product) and TTMT codes are required for VMI sync and will be added to the items table schema.
- TTMT code format: A followed by 8 digits (e.g., A01234567) - used for finished herbal/traditional medicine products.
- TPP code format: 13-digit number (e.g., 1100010001000) - used for pharmaceutical drug products.
- All monetary values are in Thai Baht (THB) by default.
- Order statuses follow the VMI Portal workflow: draft → submitted → confirmed → shipped → received.
- The existing Settings table can be extended to store encrypted API credentials.
- The existing VMI Transactions table will be used for logging all API interactions.
