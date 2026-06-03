# Feature Specification: Equipment Maintenance Notification System

**Branch**: `022-equipment-notifications`
**Created**: 2026-06-03
**Status**: Draft

## Problem

Maintenance + calibration schedules exist (`acct_maintenance_schedules`) and dates can be queried (`getOverdueMaintenance`, `getUpcomingMaintenance`), but there is no actual *notification delivery*: `sendCalibrationAlerts` returns a list of would-be alerts without persisting or surfacing them. Auditors expect a complete trail: due → notified → acknowledged → performed.

## User Stories (P1)

1. **Daily scan** — A background scan walks all active maintenance/calibration schedules and creates one `notification` per due/overdue item that doesn't already have an open one.
2. **Inbox + bell** — Authorized users see a bell icon with unread count in the top nav; clicking opens a dropdown with the latest N notifications; a full inbox page shows everything with filters.
3. **Acknowledge / snooze** — Users can mark notifications as acknowledged (signed) or snoozed (delayed N days).
4. **Calendar view** — A monthly calendar shows every due-soon and overdue item; click → equipment detail.
5. **F021 integration** — A FAIL scale verification auto-creates a high-severity notification.
6. **Maintenance plan templates** — Admin can create reusable plan templates and apply to one or many equipment in one click.

## Key Functional Requirements

- **FR-001**: System MUST maintain a `notifications` table (entityType, entityId, type, severity, title, body, dueAt, status, recipientUserId nullable, recipientRole nullable, acknowledgedAt, snoozedUntil, createdAt).
- **FR-002**: Scan MUST create one *open* notification per (equipmentId, scheduleId, dueWindow). Idempotent — re-scan MUST NOT create duplicates.
- **FR-003**: Severity: `overdue` (red), `due_today` (red), `due_in_7d` (amber), `due_in_30d` (blue).
- **FR-004**: Bell dropdown MUST show last 10 unacknowledged notifications, sorted by severity then dueAt.
- **FR-005**: Inbox page MUST list all notifications with filters: status, severity, type, dateRange, equipment.
- **FR-006**: Acknowledging captures user + timestamp + optional note.
- **FR-007**: Snoozing sets `snoozedUntil` and re-surfaces after that date.
- **FR-008**: Calendar renders due/overdue items per day.
- **FR-009**: F021 scale verification FAIL MUST create one `scale_failure` notification.
- **FR-010**: Maintenance plan templates contain: name, maintenanceType, intervalType, intervalValue, alertDaysBefore, description.
- **FR-011**: Admin can apply a template to N equipment in one transaction.
- **FR-012**: 2 new permissions: `equipment:notifications:view` + `equipment:notifications:acknowledge`.

## Success Criteria

- **SC-001**: 10 equipment + 5 due schedules → after scan → exactly 5 notifications created.
- **SC-002**: Re-scan within same hour → 0 new notifications.
- **SC-003**: Bell shows correct unread count within 30 s of new notification.
- **SC-004**: Acknowledging persists user + timestamp.
- **SC-005**: F021 FAIL → ≤ 1 second to notification visible in bell.
- **SC-006**: Template applied to 5 equipment → 5 schedule rows in one transaction.

## Out of Scope

- Email / SMS / Slack / Line delivery (no infra) — UI-only delivery.
- File attachments on maintenance records.
- Equipment qualification (OQ/PQ).
- Per-equipment per-user notification preferences.
