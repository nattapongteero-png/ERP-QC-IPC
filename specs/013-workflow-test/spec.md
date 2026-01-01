# Feature Specification: Workflow Test Page

**Feature Branch**: `013-workflow-test`
**Created**: 2026-01-01
**Status**: Draft
**Input**: User description: "Create a workflow test page at /settings/workflow-test to automate end-to-end testing of ERP processes including inventory setup, HR data, BOM creation, purchasing, receiving, work orders, QC testing, sales orders, accounting validation, and VMI status updates"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visual Workflow Pathway with Real-Time Status (Priority: P1)

As a system administrator, I want to see a graphic pathway diagram showing all test steps as connected nodes, with real-time visual updates as each step executes, so that I can instantly understand the test progress and see exactly where in the workflow the system is currently operating.

**Why this priority**: The visual pathway is the primary interface for understanding test execution. Without it, users cannot effectively monitor the automated test or quickly identify problem areas.

**Independent Test**: Can be fully tested by loading the page, observing the pathway diagram renders all 31 steps organized in 8 phases, running a test, and watching nodes animate/change color in real-time.

**Acceptance Scenarios**:

1. **Given** the workflow test page is loaded, **When** the page renders, **Then** I see a graphic pathway diagram showing all 31 test steps organized into 8 phases with visual grouping
2. **Given** a test is running, **When** a step begins executing, **Then** the corresponding node visually highlights (e.g., pulsing animation, color change to "in progress")
3. **Given** a step is executing, **When** I look at the current step node, **Then** I see a live activity indicator showing what action is being performed (e.g., "Creating inventory item...", "Calling /api/items POST...")
4. **Given** a step completes successfully, **When** the step finishes, **Then** the node changes to a "passed" state (e.g., green with checkmark) and the connector to the next step animates
5. **Given** a step fails, **When** the error occurs, **Then** the node changes to a "failed" state (e.g., red with X icon) and displays a brief error summary on hover
6. **Given** steps are pending, **When** I view the pathway, **Then** pending nodes appear in a neutral/inactive state showing they haven't executed yet

---

### User Story 2 - Run Basic End-to-End Workflow Test (Priority: P1)

As a system administrator, I want to run an automated end-to-end workflow test that exercises the complete ERP process from inventory setup through sales order completion, so that I can verify all integrated modules are functioning correctly after system updates or configuration changes.

**Why this priority**: This is the core execution feature. The visual pathway (Story 1) displays the test, but this story covers actually running it.

**Independent Test**: Can be fully tested by navigating to /settings/workflow-test, clicking "Run Basic Test", and observing the step-by-step execution with pass/fail status for each step.

**Acceptance Scenarios**:

1. **Given** the workflow test page is loaded, **When** I click "Run Basic Workflow Test", **Then** the system executes each step sequentially and the pathway updates in real-time
2. **Given** a workflow test is running, **When** all steps complete successfully, **Then** the system shows a summary with "All tests passed" and execution time
3. **Given** a workflow test is running, **When** any step fails, **Then** the system immediately stops, highlights the failed step in the pathway, and displays detailed error information
4. **Given** test data already exists from a previous run, **When** I start a new test, **Then** the system cleans up previous test data before starting

---

### User Story 3 - View Detailed Step Results (Priority: P2)

As a system administrator, I want to view detailed results for each step in the workflow test, so that I can understand exactly what data was created and verify the integration between modules.

**Why this priority**: Understanding what happened in each step is essential for debugging and verification, but only valuable after the basic test flow works.

**Independent Test**: Can be tested by running a test and then clicking on any completed step to view its details.

**Acceptance Scenarios**:

1. **Given** a workflow step has completed, **When** I click on the step, **Then** I see the API call details (endpoint, request payload, response)
2. **Given** a step created entities, **When** I view the step details, **Then** I see the IDs of all created records and links to view them in the ERP
3. **Given** a step failed, **When** I view the failed step, **Then** I see the full error message, stack trace if available, and the state of the system at failure

---

### User Story 4 - Configure Test Parameters (Priority: P3)

As a system administrator, I want to configure test parameters (like product names, quantities, vendor names) before running, so that I can create meaningful test data that matches our business scenarios.

**Why this priority**: Configuration enhances usability but the test can work with sensible defaults. This is a nice-to-have improvement.

**Independent Test**: Can be tested by modifying test parameters, running the test, and verifying the created data uses the configured values.

**Acceptance Scenarios**:

1. **Given** I am on the workflow test page, **When** I click "Configure Test", **Then** I see a form with editable parameters for each major entity
2. **Given** I have modified test parameters, **When** I run the test, **Then** the created entities use my configured values
3. **Given** I have not modified parameters, **When** I run the test, **Then** sensible default values are used

---

### Edge Cases

- What happens when an API returns a 500 error? System should display the error response body and stop execution
- How does the system handle database constraint violations? Should show the specific constraint that failed
- What happens if a required entity reference is missing (e.g., BOM references non-existent item)? Should show which entity lookup failed
- How does system handle API timeout? Should display timeout error with the endpoint and retry suggestion
- What happens when user navigates away during test execution? Test should continue in background; status available on return
- What happens when QC test fails (step 11, 17, or 20)? System should mark lot as rejected and show the QC failure reason
- What happens when material tolerance check fails (step 15)? System should show the expected vs actual quantity and tolerance threshold
- What happens when line clearance fails (step 14)? System should show which line clearance checks failed
- What happens when 3-way matching fails (step 29)? System should show the mismatched values (PO vs receipt vs invoice)
- What happens when VMI portal is unreachable (steps 30-31)? System should show connection error and continue with partial success

## Requirements *(mandatory)*

### Functional Requirements

#### Visual Pathway Display

- **FR-001**: System MUST provide a workflow test page accessible at `/settings/workflow-test`
- **FR-002**: System MUST display a graphic pathway diagram showing all 31 test steps organized into 8 phases, arranged in a logical flow
- **FR-003**: Each phase MUST be visually grouped with:
  - Phase header (e.g., "Phase 1: Master Data Setup")
  - Distinct background color or border per phase
  - Collapsed/expanded state option for large phases
- **FR-004**: Each pathway node MUST display:
  - Step number and name
  - Current status indicator (pending, running, passed, failed)
  - Module/category icon (e.g., inventory icon, HR icon, production icon)
- **FR-005**: Pathway connectors between nodes MUST visually indicate flow direction with arrows
- **FR-006**: System MUST support the following visual states for each node:
  - **Pending**: Neutral/gray appearance indicating not yet executed
  - **Running**: Highlighted with animation (pulse or glow) indicating active execution
  - **Passed**: Green with checkmark indicating successful completion
  - **Failed**: Red with X icon indicating error occurred
- **FR-007**: Phase headers MUST show aggregate status (e.g., "4/4 passed", "2/7 in progress")

#### Real-Time Status Updates

- **FR-008**: System MUST update the pathway visualization in real-time as each step executes (no page refresh required)
- **FR-009**: The currently executing step MUST display a live activity message showing what action is being performed (e.g., "Creating vendor record...", "Posting to /api/vendors...")
- **FR-010**: System MUST display elapsed time for the current step and total test duration
- **FR-011**: When a step completes, the connector to the next step MUST animate to show progression
- **FR-012**: System MUST display a real-time log panel alongside the pathway showing detailed execution messages

#### Test Execution

- **FR-013**: System MUST support a "Basic Workflow Test" that executes the following steps organized into phases:

**Phase 1: Master Data Setup** (Foundation)
  1. Setup warehouse and storage locations
  2. Setup item categories and units of measure
  3. Setup inventory items (raw materials, packaging materials, finished goods definitions)
  4. Setup HR employees with production roles and training records

**Phase 2: BOM & Production Planning**
  5. Create Bill of Materials (BOM) with raw materials and packaging
  6. Execute BOM explosion to calculate material requirements

**Phase 3: Purchasing Flow**
  7. Setup vendor with Approved Vendor List (AVL) qualification
  8. Create purchase requisition for BOM materials
  9. Convert purchase requisition to purchase order
  10. Receive goods into quarantine warehouse
  11. Perform incoming QC testing on received materials
  12. Release QC-passed lots from quarantine (or reject failed lots)

**Phase 4: Production Flow**
  13. Create work order from BOM
  14. Complete line clearance (pre-production verification)
  15. Issue/dispense materials to work order (with tolerance check)
  16. Execute work order steps with employee stamps and timestamps
  17. Perform in-process QC testing
  18. Complete production and record yield
  19. Receive finished goods to inventory (quarantine status)

**Phase 5: Finished Goods QC**
  20. Perform finished goods QC testing
  21. Release finished goods lot (or reject if failed)

**Phase 6: Sales Flow**
  22. Setup customer master data
  23. Create sales order with ATP (Available to Promise) check
  24. Pick and pack order (FEFO lot selection)
  25. Ship order and create delivery

**Phase 7: Accounting Verification**
  26. Verify AP invoice created from purchase receipt
  27. Verify AR invoice created from sales shipment
  28. Verify journal entries (inventory, COGS, revenue)
  29. Verify 3-way matching (PO, receipt, invoice)

**Phase 8: VMI Integration**
  30. Sync inventory levels to VMI portal
  31. Verify VMI order status update

- **FR-014**: System MUST execute all test steps via API calls (not direct database manipulation) to simulate real user data entry
- **FR-015**: System MUST stop test execution immediately when any step fails and preserve the failure state
- **FR-016**: System MUST display detailed error information when a step fails, including:
  - API endpoint that failed
  - HTTP status code
  - Response body/error message
  - Request payload that was sent
- **FR-017**: System MUST clean up test data from previous runs before starting a new test (using a consistent test data prefix/marker)
- **FR-018**: System MUST log all test execution details for debugging (API calls, responses, timing)
- **FR-019**: System MUST provide a summary report at test completion showing pass/fail status for each step and total execution time
- **FR-020**: System MUST allow viewing details of each completed step (request/response data, created entity IDs)
- **FR-021**: System MUST use test data that is clearly identifiable (e.g., prefixed with "WORKFLOW_TEST_" or similar marker)
- **FR-022**: System MUST validate that accounting journal entries exist after relevant steps (purchase receipt, sales order, production completion)
- **FR-023**: System MUST verify VMI status can be updated after the complete workflow

#### Step Detail Panel

- **FR-024**: Clicking on any pathway node MUST open a detail panel showing step information
- **FR-025**: The detail panel MUST show for completed steps: API endpoint, request payload, response data, created entity IDs, execution time
- **FR-026**: The detail panel MUST provide links to view created entities in their respective ERP modules

### Key Entities

- **WorkflowTest**: A test execution session with start time, end time, overall status, and collection of phases
- **WorkflowPhase**: A logical grouping of related steps (e.g., "Purchasing Flow") with phase number, name, aggregate status, and collection of steps
- **WorkflowTestStep**: Individual step within a phase with sequence number, name, status (pending/running/passed/failed), timing, API calls made, and result details
- **TestConfiguration**: Optional user-defined parameters for test entities (item names, quantities, vendor names, customer names)
- **TestDataMarker**: Identifier pattern used to mark test data for cleanup (e.g., "WFT_{timestamp}_" prefix)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Complete basic workflow test executes all 31 steps (8 phases) in under 120 seconds on standard hardware
- **SC-002**: 100% of test steps produce verifiable results (created entity IDs, API responses)
- **SC-003**: Test cleanup removes 100% of previously created test data before new test run
- **SC-004**: Failed tests display actionable error information within 1 second of failure
- **SC-005**: Administrators can identify and resolve test failures within 5 minutes using provided error details
- **SC-006**: Test execution log contains complete audit trail of all API calls for post-mortem analysis
- **SC-007**: Visual pathway updates reflect step status changes within 500ms of actual status change
- **SC-008**: Users can identify the current executing step and current phase at a glance without reading detailed logs
- **SC-009**: Pathway visualization clearly shows test progress (steps completed vs total, phases completed vs total)
- **SC-010**: Each phase completion is visually distinguishable (all steps in phase turn green, phase header shows complete)

## Assumptions

- All required API endpoints are already implemented and functional (verified: 439 API routes exist covering all required modules)
- The system has the necessary permissions/authentication to execute API calls internally
- Test data cleanup can be safely performed using identifiable markers without affecting production data
- The database supports the existing transaction patterns for multi-step operations
- Users accessing this page have administrator-level permissions
- The existing ERP modules (inventory, HR, BOM, purchasing, production, QC, sales, accounting, VMI) are stable and functional
