# Feature 023 — Environmental Monitoring & Water Quality

**Branch**: `023-environmental-monitoring`
**Created**: 2026-06-03

## Problem

The existing system only logs environmental conditions during an active Work Order. Auditors expect facility-wide scheduled monitoring (rooms, storage, quarantine) AND water system testing (RO/PW/WFI) with out-of-spec alerts. GMP standards: PIC/S Annex 1 §10, 21 CFR 211.46-211.48, USP <1231>, EP 2.4.

## P1 User Stories

1. **Scheduled facility inspection** — Operator opens "Environmental Inspections" dashboard, sees rooms due for inspection today, picks one, runs a checklist (temp, humidity, particle count, visual cleanliness), signs.
2. **Water quality testing** — Lab tech logs water sample test results (pH, conductivity, TOC, microbial) per sample point; out-of-spec triggers deviation + notification.
3. **Auto-due notification** — Daily scan creates F022 notifications for overdue inspections.
4. **Out-of-spec auto-deviation** — Any reading outside spec creates a deviation linked to the inspection record.
5. **Trend chart** — Per-room or per-sample-point time series of readings.

## Functional Requirements

- **FR-001**: System MUST maintain `inspection_schedules` per area (room/water-point) with `frequency`, `nextDue`, `lastDone`.
- **FR-002**: System MUST maintain reusable `inspection_checklist_templates` (items with min/max specs, units, instructions).
- **FR-003**: System MUST capture `inspection_records` with operator + signature + per-item results.
- **FR-004**: System MUST flag any item outside its spec as `out_of_spec` and create deviation.
- **FR-005**: System MUST maintain `water_systems` (RO/PW/WFI/Tap) with `water_sample_points`.
- **FR-006**: System MUST maintain `water_quality_specs` per system/point (pH range, conductivity max, TOC max, microbial limit).
- **FR-007**: System MUST capture `water_quality_tests` linked to sample points + specs with pass/fail.
- **FR-008**: System MUST compute next-due dates from frequency (daily/weekly/monthly/quarterly).
- **FR-009**: Daily scan MUST create F022 notification for items overdue or due within `alertDaysBefore`.
- **FR-010**: All inspection writes MUST be e-signed.
- **FR-011**: Trend report MUST aggregate readings per (room/point, parameter, period) and render time series.
- **FR-012**: 3 new permissions: `environmental:inspect`, `environmental:approve`, `environmental:configure`.

## Success Criteria

- **SC-001**: Operator completes a 5-item room inspection in < 90 sec.
- **SC-002**: Out-of-spec result creates a deviation within 1 sec.
- **SC-003**: Overdue inspections appear in bell within 30 sec of scan.
- **SC-004**: Every test record has non-null signature ID.
- **SC-005**: Trend chart loads 30-day history in < 1 sec.

## Out of Scope

- Direct IoT sensor binding for water/environmental data (manual entry only).
- Particle counter automation.
- Microbial test plate readers.
- Email/SMS alert delivery (UI bell only).
