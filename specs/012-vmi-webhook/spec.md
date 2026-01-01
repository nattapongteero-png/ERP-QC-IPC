# Feature Specification: VMI Webhook Integration

**Feature Branch**: `012-vmi-webhook`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Modify current VMI integration from pull-based to webhook-based as specified in VMI-VENDOR-API.md"

## Overview

This feature modifies the existing VMI (Vendor Managed Inventory) integration from a polling-based (pull) approach to a webhook-based (push) approach. Currently, the system polls VMI portals every 5-15 minutes to check for new orders and receipt updates. With webhooks, the VMI portal will notify our system in real-time when events occur (new orders, cancellations, receipt confirmations), eliminating polling latency and reducing unnecessary API calls.

### Current State (Pull-Based)
- System polls VMI portals at configurable intervals (5-15 minutes)
- Cron jobs call `GET /api/external/vendor/orders?status=submitted` periodically
- Receipt status checked manually via `GET /api/external/vendor/orders/{id}/receipt-status`
- Delays between event occurrence and system awareness

### Target State (Webhook-Based)
- VMI Portal sends HTTP POST to our webhook endpoint when events occur
- Real-time notification of new orders, cancellations, and receipt updates
- HMAC-SHA256 signature validation for security
- Fallback polling retained for reliability

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive Real-Time Order Notifications (Priority: P1)

As a vendor administrator, I want to receive immediate notifications when a hospital submits a new order through the VMI portal, so that I can process orders faster and improve customer satisfaction.

**Why this priority**: This is the core value proposition of webhooks - eliminating the 5-15 minute polling delay for new orders directly impacts order processing time and customer experience.

**Independent Test**: Can be fully tested by registering a webhook, having a hospital submit an order in the VMI portal, and verifying the system receives the notification within seconds and creates the order record.

**Acceptance Scenarios**:

1. **Given** a webhook is registered for `order.created` events, **When** a hospital submits a new order in the VMI portal, **Then** the system receives the webhook notification within 5 seconds and creates a corresponding order record with status "submitted"

2. **Given** a webhook is registered and the system receives an `order.created` notification, **When** the notification signature is valid, **Then** the system acknowledges with HTTP 200 and processes the order

3. **Given** a webhook is registered and the system receives an `order.created` notification, **When** the notification signature is invalid, **Then** the system rejects with HTTP 401 and does not create any order

---

### User Story 2 - Register and Manage Webhooks (Priority: P1)

As a vendor administrator, I want to configure webhooks for each VMI portal connection, so that I can control which events trigger notifications and where they are sent.

**Why this priority**: Without webhook registration, no notifications can be received. This is a prerequisite for the entire webhook functionality.

**Independent Test**: Can be fully tested by accessing the VMI portal configuration screen, registering a webhook with selected events, and verifying the webhook is stored with the generated secret.

**Acceptance Scenarios**:

1. **Given** I am on the VMI portal configuration page, **When** I add a new webhook with a valid URL and at least one event type, **Then** the system registers the webhook with the VMI portal and displays the generated secret (shown only once)

2. **Given** I have an existing webhook, **When** I edit the webhook to change the URL or enabled events, **Then** the changes are saved and future notifications use the new configuration

3. **Given** I have an existing webhook, **When** I regenerate the secret, **Then** a new secret is generated and the old secret is invalidated

4. **Given** I have an existing webhook, **When** I delete the webhook, **Then** the VMI portal stops sending notifications to that endpoint

---

### User Story 3 - Receive Order Cancellation Notifications (Priority: P2)

As a vendor administrator, I want to be notified immediately when a hospital cancels an order, so that I can stop processing and update inventory plans.

**Why this priority**: Order cancellations need quick response to avoid wasted work, but occur less frequently than new orders.

**Independent Test**: Can be fully tested by having an active order in the system, cancelling it in the VMI portal, and verifying the system receives the cancellation within seconds and updates the order status.

**Acceptance Scenarios**:

1. **Given** a webhook is registered for `order.cancelled` events and an order exists with status "submitted", **When** the hospital cancels the order, **Then** the system receives the notification and updates the order status to "cancelled" with the cancellation reason

2. **Given** an order has already been shipped, **When** a cancellation notification arrives, **Then** the system records the cancellation attempt but flags it for manual review (cannot cancel shipped orders)

---

### User Story 4 - Receive Receipt Notifications (Priority: P2)

As a vendor administrator, I want to be notified when a hospital receives goods from my shipment, so that I can record the receivable and update accounts.

**Why this priority**: Receipt notifications trigger financial processes (accounts receivable) and need timely processing, but the current manual check workflow provides an adequate fallback.

**Independent Test**: Can be fully tested by having a shipped order, recording a goods receipt in the hospital ERP, and verifying the system receives the notification and updates quantities received.

**Acceptance Scenarios**:

1. **Given** a webhook is registered for `receipt.created` events and an order has been shipped, **When** the hospital records a partial receipt, **Then** the system receives the notification with item quantities received and updates the order line items

2. **Given** a webhook is registered for `receipt.completed` events, **When** all items in an order are fully received, **Then** the system receives the notification and updates the order status to "received"

3. **Given** a receipt notification arrives, **When** the order ID is not found in the system, **Then** the system logs an error and queues the event for manual investigation

---

### User Story 5 - Monitor Webhook Health and Delivery History (Priority: P3)

As a vendor administrator, I want to view webhook delivery history and health status, so that I can diagnose connectivity issues and ensure notifications are being received.

**Why this priority**: Important for troubleshooting but not critical for core functionality.

**Independent Test**: Can be fully tested by accessing the webhook management screen and viewing delivery history with timestamps, status codes, and error messages.

**Acceptance Scenarios**:

1. **Given** webhooks have been active, **When** I view the webhook delivery history, **Then** I see a list of recent deliveries with event type, timestamp, status (success/failed), and response code

2. **Given** a webhook has consecutive failures, **When** the failure count exceeds 10, **Then** the system displays a warning that the webhook has been auto-disabled and provides a button to re-enable

3. **Given** I am viewing delivery history, **When** I filter by status or date range, **Then** only matching deliveries are shown

---

### User Story 6 - Fallback to Polling (Priority: P3)

As a system administrator, I want the system to maintain polling capability as a fallback, so that orders are not missed if webhook delivery fails.

**Why this priority**: Provides reliability but is a safety net rather than primary functionality.

**Independent Test**: Can be fully tested by disabling webhooks, waiting for polling interval, and verifying orders are still retrieved via the existing polling mechanism.

**Acceptance Scenarios**:

1. **Given** webhooks are configured but temporarily failing, **When** the polling interval elapses, **Then** the system still polls for orders to catch any missed webhook notifications

2. **Given** webhooks are working, **When** polling runs, **Then** the system detects duplicate orders (already received via webhook) and skips creating duplicates

---

### Edge Cases

- What happens when a webhook notification arrives out of order (e.g., `receipt.completed` before `receipt.created`)? System processes based on event timestamp, not arrival order.
- How does the system handle duplicate webhook deliveries (retry attempts)? System tracks delivery IDs and skips duplicates.
- What happens when the webhook endpoint is temporarily unavailable during a delivery? VMI portal retries with exponential backoff; polling catches missed events.
- How does the system handle webhook notifications for orders that don't exist in the system? System logs error and queues for manual investigation.
- What happens when signature validation fails due to clock skew between systems? System allows 5-minute tolerance window for timestamp validation.

## Requirements *(mandatory)*

### Functional Requirements

#### Webhook Registration (FR-1xx)

- **FR-101**: System MUST allow registering webhooks with the VMI portal, specifying endpoint URL and event types
- **FR-102**: System MUST support all event types defined in VMI-VENDOR-API.md: `order.created`, `order.cancelled`, `receipt.created`, `receipt.completed`
- **FR-103**: System MUST securely store the webhook secret returned by the VMI portal (encrypted at rest)
- **FR-104**: System MUST allow updating webhook configuration (URL, events, active status)
- **FR-105**: System MUST allow regenerating webhook secrets
- **FR-106**: System MUST allow deleting webhooks
- **FR-107**: System MUST enforce maximum 5 webhooks per VMI portal connection (as per API spec)

#### Webhook Endpoint (FR-2xx)

- **FR-201**: System MUST expose an HTTP POST endpoint to receive webhook notifications from VMI portals
- **FR-202**: System MUST validate webhook signatures using HMAC-SHA256 with the stored secret
- **FR-203**: System MUST validate timestamp to prevent replay attacks (reject if timestamp is more than 5 minutes old)
- **FR-204**: System MUST return HTTP 200 immediately upon successful signature validation
- **FR-205**: System MUST return HTTP 401 for invalid signatures
- **FR-206**: System MUST process webhook payloads asynchronously after acknowledging receipt
- **FR-207**: System MUST track delivery IDs to prevent duplicate processing (idempotency)

#### Event Processing (FR-3xx)

- **FR-301**: System MUST create new order records when receiving `order.created` events
- **FR-302**: System MUST update order status to "cancelled" when receiving `order.cancelled` events
- **FR-303**: System MUST update order line quantities when receiving `receipt.created` events
- **FR-304**: System MUST update order status to "received" when receiving `receipt.completed` events
- **FR-305**: System MUST log all received webhook events for audit purposes
- **FR-306**: System MUST handle events for unknown orders gracefully (log error, queue for investigation)
- **FR-307**: System MUST handle out-of-order events by processing based on event timestamp, not arrival time

#### Webhook Monitoring (FR-4xx)

- **FR-401**: System MUST display webhook health status (active, failing, disabled)
- **FR-402**: System MUST display delivery history including event type, timestamp, status, and response details
- **FR-403**: System MUST display consecutive failure count for each webhook
- **FR-404**: System MUST provide ability to manually re-enable webhooks disabled due to failures
- **FR-405**: System MUST provide ability to filter delivery history by status and date range

#### Fallback and Reliability (FR-5xx)

- **FR-501**: System MUST retain existing polling mechanism as fallback
- **FR-502**: System MUST detect and skip duplicate orders received via both webhook and polling
- **FR-503**: System MUST continue polling at configured interval regardless of webhook status
- **FR-504**: System MUST log when webhook and polling results differ (for monitoring purposes)

### Key Entities

- **VmiWebhook**: Represents a registered webhook configuration
  - Portal connection reference
  - Endpoint URL (our receiving endpoint on VMI portal side)
  - Events subscribed (array)
  - Secret (encrypted)
  - Active status
  - Auto-disabled flag (due to failures)
  - Consecutive failure count
  - Last success/failure timestamps

- **VmiWebhookDelivery**: Represents a received webhook notification
  - Webhook reference
  - Delivery ID (from VMI portal, for idempotency)
  - Event type
  - Payload (JSON)
  - Signature validation status
  - Processing status (received, processed, failed)
  - Response code returned
  - Received timestamp
  - Processed timestamp
  - Error message (if failed)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Order notifications are received within 10 seconds of event occurrence (compared to 5-15 minute polling delay) *[Operational metric - measured via delivery history timestamps, not code-enforced]*
- **SC-002**: 99.9% of webhook notifications are successfully processed on first delivery attempt *[Operational metric - calculated from vmi_webhook_deliveries success/fail ratio]*
- **SC-003**: System correctly validates and rejects 100% of invalid webhook signatures
- **SC-004**: Zero duplicate orders are created from receiving both webhook and polling notifications for the same order
- **SC-005**: Administrators can view complete webhook delivery history within 2 clicks from the portal configuration screen
- **SC-006**: System automatically detects and flags webhook connectivity issues within 3 failed deliveries

## Assumptions

- VMI portals support the webhook API as documented in VMI-VENDOR-API.md (section 10)
- Our system has a publicly accessible HTTPS endpoint that VMI portals can reach
- Clock synchronization between systems is within 5 minutes (standard NTP)
- Existing polling infrastructure will remain in place for reliability

## Out of Scope

- Sending webhooks to external systems (this feature is about receiving webhooks)
- Custom webhook payload transformations
- Webhook event filtering beyond event type (e.g., filtering by hospital)
- Real-time dashboard/push notifications to browser (webhooks update database only)
