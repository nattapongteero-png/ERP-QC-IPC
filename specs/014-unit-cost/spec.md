# Feature Specification: Unit Cost Calculation System

**Feature Branch**: `014-unit-cost`
**Created**: 2026-01-15
**Status**: Draft
**Input**: Unit Cost Calculation System for Herbal Medicine ERP - comprehensive costing for financial reporting, pricing decisions, production efficiency analysis, and management reporting

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inventory Cost Tracking on Purchase Receipt (Priority: P1)

As a warehouse manager receiving goods from suppliers, I need the system to automatically calculate and track the weighted average cost (WAC) of inventory items when I receive purchase orders, so I can maintain accurate inventory valuations for financial reporting.

**Why this priority**: This is the foundation of all cost calculations. Without accurate inventory cost capture at receipt, no other costing features can work correctly. This directly impacts balance sheet valuation and COGS calculations.

**Independent Test**: Can be fully tested by receiving a purchase order and verifying the item's WAC is correctly calculated. Delivers accurate inventory valuation immediately upon receipt.

**Acceptance Scenarios**:

1. **Given** I have 100 units of Item A at ฿50 WAC (total value ฿5,000), **When** I receive 50 additional units at ฿60 per unit, **Then** the new WAC should be ฿53.33 ((฿5,000 + ฿3,000) / 150 units)
2. **Given** I have zero units of Item B in inventory, **When** I receive 100 units at ฿25 per unit, **Then** the WAC should be set directly to ฿25
3. **Given** I receive goods from a purchase order, **When** the receipt is confirmed, **Then** a cost layer record is created showing the transaction, quantity, unit cost, and running WAC

---

### User Story 2 - Landed Cost Allocation (Priority: P2)

As a purchasing manager, I need to allocate additional procurement costs (freight, duty, insurance, handling) to the items received so that the true cost of goods is reflected in inventory valuation.

**Why this priority**: Many imported items have significant additional costs beyond the purchase price. Without landed cost tracking, inventory is undervalued and margins are incorrectly calculated.

**Independent Test**: Can be tested by creating a landed cost entry against a received PO, allocating costs, and verifying the item WAC is updated correctly.

**Acceptance Scenarios**:

1. **Given** I received PO #001 with Item A (฿60,000 value, 60%) and Item B (฿40,000 value, 40%), **When** I allocate a ฿5,000 freight invoice using value-based allocation, **Then** Item A receives ฿3,000 (60%) and Item B receives ฿2,000 (40%)
2. **Given** I have allocated landed costs to items, **When** I post the landed cost document, **Then** the WAC of each affected item is recalculated to include the allocated amounts
3. **Given** I need to allocate freight costs for bulk items, **When** I select weight-based allocation, **Then** costs are distributed proportionally by item weight

---

### User Story 3 - Production Cost Aggregation (Priority: P3)

As a production manager, I need the system to calculate the total production cost of a work order including materials, labor, and overhead, so I know the true cost of manufactured products.

**Why this priority**: Manufacturing costing is essential for pricing decisions and profitability analysis. This enables full absorption costing for finished goods.

**Independent Test**: Can be tested by completing a work order and verifying the unit cost is correctly calculated from all cost components.

**Acceptance Scenarios**:

1. **Given** a work order with issued materials worth ฿10,000, labor hours of 20 at ฿150/hour, and overhead rate of ฿50/hour, **When** the work order is completed producing 100 units, **Then** the unit cost is ฿130 ((฿10,000 + ฿3,000 + ฿1,000) / 100)
2. **Given** I record actual labor hours for a production operation, **When** I save the time entry, **Then** the labor cost is calculated using the work center's labor rate
3. **Given** a work order is completed, **When** finished goods are transferred to inventory, **Then** the finished goods item's WAC is recalculated

---

### User Story 4 - Multiple Cost View Access (Priority: P4)

As a cost accountant, I need to view different cost perspectives for items (WAC, standard, last purchase, production cost, full cost) so I can make appropriate decisions for different purposes like pricing, budgeting, and variance analysis.

**Why this priority**: Different stakeholders need different cost views for different purposes. This enables informed decision-making across departments.

**Independent Test**: Can be tested by viewing an item's cost views and verifying all five cost types are displayed with their sources and dates.

**Acceptance Scenarios**:

1. **Given** an item with recent purchase and production activity, **When** I view the item's cost views, **Then** I see inventory cost (WAC), standard cost, last purchase cost, last production cost, and full cost with their respective values and dates
2. **Given** I need to set a selling price, **When** I view the full cost with SG&A allocation, **Then** I see the suggested price based on the full cost and target margin percentage
3. **Given** I want to understand cost history, **When** I view an item's cost layers, **Then** I see a chronological list of all transactions that affected the item's WAC

---

### User Story 5 - COGS Calculation on Sales (Priority: P5)

As a sales accountant, I need the system to automatically calculate the cost of goods sold when products are shipped, so I can determine gross margin and generate accurate financial reports.

**Why this priority**: COGS is fundamental to income statement accuracy. This closes the cost flow loop from purchasing through sales.

**Independent Test**: Can be tested by shipping a sales order and verifying COGS is calculated at the current WAC with correct margin calculations.

**Acceptance Scenarios**:

1. **Given** I ship 50 units of Item A with WAC of ฿100, **When** the shipment is confirmed, **Then** COGS of ฿5,000 is recorded and margin is calculated against the selling price
2. **Given** a sales order line with unit price ฿150 and unit cost ฿100, **When** the order is shipped, **Then** the margin amount (฿50) and margin percent (33.3%) are calculated and stored
3. **Given** I need to analyze profitability, **When** I view sales order details, **Then** I can see the COGS and margin for each line item

---

### User Story 6 - Work Center and Rate Configuration (Priority: P6)

As a production planning manager, I need to set up work centers with labor rates and overhead rates so that production costs are calculated correctly based on where work is performed.

**Why this priority**: Work centers are the foundation for labor and overhead allocation. This must be configured before production costing can work.

**Independent Test**: Can be tested by creating a work center with rates and verifying operations at that work center use the configured rates.

**Acceptance Scenarios**:

1. **Given** I create a work center "Mixing Station", **When** I set labor rate to ฿150/hour and overhead rate to ฿50/hour, **Then** operations performed at this work center use these rates for cost calculation
2. **Given** a work center is linked to an organizational unit (cost center), **When** costs are allocated to the work center, **Then** they roll up to the correct cost center for reporting
3. **Given** I update a work center's rates, **When** new work orders use this work center, **Then** they use the updated rates (existing work order costs are not retroactively changed)

---

### User Story 7 - Cost Reports and Dashboard (Priority: P7)

As a finance manager, I need cost management reports and dashboards to monitor inventory values, cost trends, production efficiency, and margin analysis for management decision-making.

**Why this priority**: Reporting provides visibility into cost data for stakeholders. This enables data-driven management decisions.

**Independent Test**: Can be tested by viewing the cost dashboard and verifying KPIs display current and accurate data.

**Acceptance Scenarios**:

1. **Given** I access the cost management dashboard, **When** the dashboard loads, **Then** I see total inventory value, WIP value, average material cost change, and gross margin percentage
2. **Given** I run the production cost report, **When** I filter by date range, **Then** I see work orders with their material, labor, overhead, and total costs with variances from standard
3. **Given** I need to analyze margin trends, **When** I view the margin analysis report, **Then** I can drill down from product to customer to individual sales order lines

---

### Edge Cases

- What happens when receiving goods with zero quantity on hand and zero cost? The WAC is set to the receipt unit cost.
- What happens when a landed cost is posted but some items have already been issued? The WAC is recalculated for remaining inventory; already-issued items are not retroactively adjusted.
- What happens when a work order produces fewer units than planned (scrap/waste)? The total cost is divided by actual good output, increasing the per-unit cost.
- What happens when inventory quantity goes to zero and new goods are received? The next receipt sets the WAC directly without averaging.
- What happens when a work order has no labor hours recorded? Labor cost is zero; overhead may still be allocated if using a different basis.
- What happens when attempting a negative inventory adjustment? System prevents adjustment that would result in negative on-hand quantity.

## Requirements *(mandatory)*

### Functional Requirements

**Core WAC Calculation**
- **FR-001**: System MUST calculate weighted average cost on every inventory receipt using the formula: New WAC = (Existing Total Cost + New Receipt Cost) / (Existing Qty + New Receipt Qty)
- **FR-002**: System MUST maintain a cost layer audit trail recording every transaction that affects an item's WAC
- **FR-003**: System MUST prevent WAC calculations that would result in negative inventory quantities
- **FR-004**: System MUST use 4 decimal places for unit cost precision
- **FR-005**: System MUST set WAC directly from receipt cost when on-hand quantity is zero

**Landed Cost**
- **FR-006**: System MUST allow creation of landed cost documents linked to purchase orders or shipments
- **FR-007**: System MUST support four allocation bases: value, quantity, weight, and volume
- **FR-008**: System MUST calculate allocation amounts based on selected basis and distribute costs to receipt items
- **FR-009**: System MUST recalculate item WAC when landed costs are posted
- **FR-010**: System MUST track landed cost documents through draft, allocated, and posted statuses

**Production Costing**
- **FR-011**: System MUST calculate material cost for work orders using the WAC at time of material issue
- **FR-012**: System MUST calculate labor cost based on actual hours recorded multiplied by work center labor rate
- **FR-013**: System MUST calculate overhead cost based on direct labor hours multiplied by work center overhead rate
- **FR-014**: System MUST aggregate all costs and calculate unit cost when work order is completed
- **FR-015**: System MUST update finished goods item WAC when work order production is completed

**Work Center Management**
- **FR-016**: System MUST allow configuration of work centers with labor rate per hour, overhead rate per hour, and machine rate per hour
- **FR-017**: System MUST link work centers to organizational units (cost centers)
- **FR-018**: System MUST copy operation rates to work order operations at time of work order creation

**Multiple Cost Views**
- **FR-019**: System MUST track and display inventory cost (WAC) for items
- **FR-020**: System MUST track and display last purchase cost with date and PO reference
- **FR-021**: System MUST track and display last production cost with date and work order reference
- **FR-022**: System MUST calculate full cost including SG&A allocation percentage
- **FR-023**: System MUST provide a suggested selling price based on full cost and target margin

**COGS and Margin**
- **FR-024**: System MUST calculate COGS using current WAC when goods are shipped against sales orders
- **FR-025**: System MUST calculate and store margin amount and margin percentage on sales order lines
- **FR-026**: System MUST record unit cost on sales order lines at time of shipment

**Reporting**
- **FR-027**: System MUST provide a cost management dashboard with inventory value, WIP value, cost trends, and margin KPIs
- **FR-028**: System MUST provide item cost summary report showing all cost views per item
- **FR-029**: System MUST provide production cost report with work order cost breakdowns
- **FR-030**: System MUST provide margin analysis report with drill-down capability from product to sales order line

### Key Entities

- **Item Cost Layer**: Records each transaction affecting an item's cost - transaction type, date, quantity, unit cost, running totals, and resulting WAC. Provides full audit trail of cost changes.
- **Landed Cost Document**: Captures additional procurement costs (freight, duty, insurance, handling) with header information (vendor, invoice, currency) and detail lines for each cost type with allocation basis.
- **Landed Cost Allocation**: Records the distribution of landed costs to specific items/lots with allocated amount and calculation basis value.
- **Work Center**: Production location with configured labor rate, overhead rate, and machine rate. Links to organizational unit for cost center reporting.
- **Work Order Operation**: Instance of a BOM operation for a specific work order, tracking planned vs actual hours, labor cost, and overhead cost.
- **Work Order Cost**: Aggregated cost summary for a work order showing material, labor, overhead, total cost, and calculated unit cost.
- **Overhead Rate**: Configuration for overhead allocation including type (fixed/variable/mixed), allocation basis, rate per unit, and effective dates.
- **Cost GL Mapping**: Mapping of transaction types and item types to general ledger accounts for automatic journal entry generation.

## Assumptions

- The existing inventory module tracks on-hand quantities at the item level.
- The existing purchase order module captures receipt quantities and unit prices.
- The existing work order module tracks material issues and finished goods transfers.
- The existing BOM module defines operations with standard times and work center assignments.
- Labor hours will be entered manually for production operations (no time clock integration initially).
- All costs are tracked in Thai Baht (THB) as the base currency; exchange rate conversion happens at document entry.
- Retroactive cost adjustments (changing historical WAC) are not supported to maintain audit integrity.
- Period-end close procedures will be handled separately from this core costing engine.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Warehouse staff can receive purchase orders and see updated inventory values within 5 seconds of confirming receipt
- **SC-002**: Purchasing staff can complete landed cost allocation and posting for a typical shipment in under 10 minutes
- **SC-003**: Production staff can record operation times and complete work orders with full cost visibility in under 5 minutes per work order
- **SC-004**: Cost accountants can view all 5 cost perspectives for any item in a single screen without navigating to multiple modules
- **SC-005**: Finance managers can generate cost reports covering 12 months of data in under 30 seconds
- **SC-006**: 100% of inventory transactions create corresponding cost layer records for audit trail
- **SC-007**: COGS and margin calculations are completed automatically on 100% of sales shipments without manual intervention
- **SC-008**: Cost dashboard KPIs refresh with current data within 10 seconds of page load
- **SC-009**: System maintains accurate WAC through 10,000+ inventory transactions per month without calculation errors
- **SC-010**: Users report 90%+ satisfaction with cost visibility for pricing and profitability decisions
