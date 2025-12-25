# Feature Specification: Accounting Module Integration

**Feature Branch**: `010-accounting-module-integration`
**Created**: 2025-12-25
**Status**: Draft
**Input**: User description: "currently our erp system has hr/purchase/sale module but still no accounting module, i want all these system integrated to accounting module the accounting module should has feature to support all business logic in manufacturing control and comply with Thai regulation and standard"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Manage Chart of Accounts (Priority: P1)

As a Finance Manager, I need to set up and manage a Chart of Accounts (COA) that follows Thai Accounting Standards (TAS) so that all financial transactions are properly categorized and reported according to Thai regulatory requirements.

**Why this priority**: The COA is the foundation of the entire accounting system. Without a proper chart of accounts that complies with Thai standards, no other accounting functions can operate correctly. All journal entries, financial reports, and regulatory filings depend on this structure.

**Independent Test**: Can be fully tested by creating a COA, adding accounts, and verifying the account structure matches Thai standard account categories. Delivers immediate value as the foundation for all accounting operations.

**Acceptance Scenarios**:

1. **Given** I am a Finance Manager with accounting permissions, **When** I access the Chart of Accounts setup, **Then** I see a pre-defined structure based on Thai Accounting Standards with 5 main categories (Assets, Liabilities, Equity, Revenue, Expenses)
2. **Given** the default COA template is loaded, **When** I add a new GL account, **Then** the system validates the account code follows the standard numbering scheme and requires both Thai and English names
3. **Given** an active GL account exists, **When** I try to deactivate it that has posted transactions, **Then** the system prevents deactivation and shows the account balance
4. **Given** I am viewing the COA, **When** I export the chart, **Then** the export includes account codes, names (Thai and English), types, and current balances in a format suitable for auditor review

---

### User Story 2 - Record Purchase-to-Pay Transactions (Priority: P1)

As an Accountant, I need purchase orders to automatically generate Accounts Payable (AP) entries when goods are received, so that the accounting records stay synchronized with purchasing activities and I can track vendor obligations accurately.

**Why this priority**: This is a core integration point with the existing Purchase module. Manufacturing businesses depend heavily on timely and accurate AP tracking for cash flow management and vendor relationships. This directly impacts the ability to pay vendors on time and maintain supply chain continuity.

**Independent Test**: Can be fully tested by creating a PO, receiving goods, and verifying that AP invoice and corresponding journal entries are automatically created. Delivers value by automating the manual accounting work currently required.

**Acceptance Scenarios**:

1. **Given** a Purchase Order is marked as received, **When** the system processes the receipt, **Then** an AP Invoice is automatically created with line items matching the PO, linked to the vendor and PO number
2. **Given** an AP Invoice exists in draft status, **When** an Accountant reviews and approves it, **Then** a journal entry is created debiting Inventory/Expense accounts and crediting AP account
3. **Given** an approved AP Invoice, **When** a payment is recorded, **Then** the system creates a payment journal entry debiting AP and crediting Cash/Bank account, and updates the invoice status to paid or partially paid
4. **Given** VAT is applicable on a purchase, **When** the AP Invoice is created, **Then** the system correctly calculates and records Input VAT (7%) as required by Thai Revenue Department

---

### User Story 3 - Record Order-to-Cash Transactions (Priority: P1)

As an Accountant, I need sales orders to automatically generate Accounts Receivable (AR) entries when goods are shipped, so that revenue is properly recognized and customer balances are tracked accurately.

**Why this priority**: This is the revenue side of the business and a core integration with the Sales module. Accurate AR tracking is essential for cash flow forecasting, credit management, and financial reporting. Revenue recognition must comply with Thai accounting standards.

**Independent Test**: Can be fully tested by creating a SO, shipping goods, and verifying that AR invoice and revenue recognition journal entries are automatically created. Delivers value by automating sales accounting.

**Acceptance Scenarios**:

1. **Given** a Sales Order is marked as shipped, **When** the system processes the shipment, **Then** an AR Invoice is automatically created with line items matching the SO, linked to the customer and SO number
2. **Given** an AR Invoice is created, **When** it is confirmed, **Then** a journal entry is created debiting AR account and crediting Revenue account(s)
3. **Given** an outstanding AR Invoice, **When** a payment is received from customer, **Then** the system creates a receipt journal entry debiting Cash/Bank and crediting AR, and updates the invoice status
4. **Given** VAT is applicable on a sale, **When** the AR Invoice is created, **Then** the system correctly calculates and records Output VAT (7%) and generates a tax invoice number as required by Thai Revenue Department

---

### User Story 4 - Process Manufacturing Cost Accounting (Priority: P2)

As a Cost Accountant, I need to track and allocate manufacturing costs including raw materials, direct labor, and overhead to finished goods, so that I can determine accurate product costs for pricing decisions and financial reporting.

**Why this priority**: Manufacturing cost control is essential for profitability analysis and pricing strategy. This is a key differentiator from basic accounting systems and directly supports the manufacturing control requirement. However, it builds upon the basic AP/AR functionality.

**Independent Test**: Can be fully tested by processing a production order, allocating costs (materials, labor, overhead), and verifying the finished goods inventory is valued correctly. Delivers value through accurate product costing.

**Acceptance Scenarios**:

1. **Given** a production batch is completed, **When** the system processes the completion, **Then** material costs from consumed raw materials are calculated based on FIFO valuation and recorded as Work-in-Progress (WIP)
2. **Given** labor hours are recorded for a production batch, **When** the cost allocation runs, **Then** direct labor costs are allocated to the batch based on standard or actual labor rates from HR module
3. **Given** manufacturing overhead rates are configured, **When** a batch is completed, **Then** overhead is allocated based on the configured allocation basis (labor hours, machine hours, or units produced)
4. **Given** a finished goods batch is completed, **When** the final costing is done, **Then** the total cost (materials + labor + overhead) is transferred from WIP to Finished Goods inventory account

---

### User Story 5 - Generate Financial Statements (Priority: P2)

As a Finance Manager, I need to generate standard financial statements (Balance Sheet, Income Statement, Cash Flow Statement) that comply with Thai Financial Reporting Standards (TFRS), so that I can report to management, stakeholders, and regulatory bodies.

**Why this priority**: Financial reporting is the ultimate output of the accounting system and required for management decisions, bank loans, investor relations, and regulatory compliance. However, it requires the transaction processing capabilities from P1 stories to be meaningful.

**Independent Test**: Can be fully tested by processing sample transactions and generating each financial statement, verifying the reports balance and follow Thai accounting standards format. Delivers value for management reporting.

**Acceptance Scenarios**:

1. **Given** transactions have been posted for a period, **When** I request a Trial Balance, **Then** the system generates a report showing all GL account balances with debits equaling credits
2. **Given** a reporting period is selected, **When** I generate an Income Statement, **Then** the report shows revenues minus expenses in the format prescribed by TFRS for SMEs or full TFRS based on company classification
3. **Given** a reporting date is selected, **When** I generate a Balance Sheet, **Then** the report shows Assets = Liabilities + Equity in the Thai standard format with comparative prior period
4. **Given** a reporting period is selected, **When** I generate a Cash Flow Statement, **Then** the report categorizes cash flows into Operating, Investing, and Financing activities following the indirect method

---

### User Story 6 - Manage VAT and Withholding Tax (Priority: P2)

As a Tax Accountant, I need to calculate, track, and report VAT and Withholding Tax according to Thai Revenue Department requirements, so that the company can file accurate tax returns and avoid penalties.

**Why this priority**: Thai tax compliance is mandatory and carries significant penalties for non-compliance. VAT must be filed monthly (Por Por 30) and withholding tax must be submitted with payments. This is essential for legal compliance but builds on the AP/AR transaction foundation.

**Independent Test**: Can be fully tested by processing transactions with VAT and WHT, then generating the tax reports for a period. Delivers value through automated tax compliance.

**Acceptance Scenarios**:

1. **Given** purchases with Input VAT are recorded, **When** I run the VAT report for a month, **Then** the system generates a Purchase VAT Report (Ror-Gor 36.4) listing all Input VAT transactions with tax invoice details
2. **Given** sales with Output VAT are recorded, **When** I run the VAT report for a month, **Then** the system generates a Sales VAT Report (Ror-Gor 36.4) listing all Output VAT transactions with tax invoice numbers
3. **Given** both Input and Output VAT are recorded, **When** I calculate the VAT payable/refundable, **Then** the system correctly computes Output VAT minus Input VAT and indicates the net amount for Por Por 30 filing
4. **Given** a payment to a vendor requires withholding tax, **When** I process the payment, **Then** the system calculates the correct WHT rate based on payment type, records the WHT liability, and generates a WHT certificate (Por Ngor Dor 3/53)

---

### User Story 7 - Manage Fixed Assets and Depreciation (Priority: P2)

As an Asset Accountant, I need to register, track, and depreciate fixed assets according to Thai Revenue Code and Thai Accounting Standards, so that the company's asset values are accurately reflected in financial statements and tax filings.

**Why this priority**: Fixed assets represent significant capital investments in manufacturing (machinery, equipment, buildings). Proper tracking ensures accurate balance sheet reporting, correct depreciation expense recognition, and compliance with Thai tax regulations for asset write-offs.

**Independent Test**: Can be fully tested by registering a fixed asset, running depreciation calculations, and verifying the asset value and accumulated depreciation are correctly recorded. Delivers value through automated depreciation and asset tracking.

**Acceptance Scenarios**:

1. **Given** a capital purchase is received (e.g., machinery from PO), **When** I choose to capitalize it as a fixed asset, **Then** the system creates an asset record with acquisition cost, acquisition date, and assigns it to the appropriate asset category
2. **Given** a fixed asset is registered, **When** the monthly depreciation process runs, **Then** the system calculates depreciation based on the configured method (straight-line or declining balance) and Thai Revenue Code useful life limits
3. **Given** depreciation is calculated, **When** journal entries are posted, **Then** the system debits Depreciation Expense and credits Accumulated Depreciation for each asset
4. **Given** a fixed asset needs to be disposed, **When** I record the disposal (sale, write-off, or scrapping), **Then** the system calculates gain/loss on disposal, removes the asset from active register, and creates appropriate journal entries
5. **Given** I need to review asset status, **When** I generate the Fixed Asset Register report, **Then** I see all assets with acquisition cost, accumulated depreciation, net book value, location, and responsible person

---

### User Story 8 - Track Equipment and Maintenance Costs (Priority: P2)

As a Plant Manager, I need to track manufacturing equipment, maintenance schedules, and maintenance costs, so that I can plan preventive maintenance, control repair expenses, and ensure equipment availability for production.

**Why this priority**: In manufacturing, equipment uptime directly affects production capacity and product quality. Tracking maintenance costs helps with budgeting, identifying problematic equipment, and making repair-vs-replace decisions. This integrates with production planning and cost accounting.

**Independent Test**: Can be fully tested by registering equipment, scheduling maintenance, recording maintenance events, and generating equipment cost reports. Delivers value through maintenance visibility and cost control.

**Acceptance Scenarios**:

1. **Given** a piece of manufacturing equipment is registered as a fixed asset, **When** I access its equipment profile, **Then** I can view and edit equipment-specific details (serial number, manufacturer, model, warranty info, location, assigned operator)
2. **Given** equipment requires regular maintenance, **When** I set up a maintenance schedule, **Then** the system generates maintenance tasks at the specified intervals (daily, weekly, monthly, or by operating hours)
3. **Given** maintenance is performed, **When** I record the maintenance event, **Then** the system captures the maintenance type (preventive, corrective, emergency), parts used, labor hours, and total cost
4. **Given** maintenance costs are recorded, **When** the cost is linked to an asset, **Then** the system either expenses minor repairs or capitalizes major improvements based on configured thresholds
5. **Given** I need to analyze equipment performance, **When** I generate the Equipment Maintenance History report, **Then** I see maintenance frequency, downtime, total costs, and mean time between failures (MTBF) for each piece of equipment

---

### User Story 9 - Perform Period-End Closing (Priority: P3)

As an Accounting Manager, I need to perform month-end and year-end closing procedures to finalize financial periods, so that financial reports are accurate and the books are properly maintained.

**Why this priority**: Period closing ensures data integrity and prevents changes to closed periods. It's important for audit trails and financial control but is a control process that requires transaction processing to be stable first.

**Independent Test**: Can be fully tested by processing transactions, running closing procedures, and verifying the period is locked and balances are carried forward correctly. Delivers value through financial control.

**Acceptance Scenarios**:

1. **Given** a month's transactions are complete, **When** I initiate month-end close, **Then** the system runs validation checks for unposted entries, missing documents, and balance discrepancies
2. **Given** all validations pass, **When** I confirm the period close, **Then** the system prevents any further postings to that period and records the closing date and user
3. **Given** a fiscal year has ended, **When** I run year-end closing, **Then** the system transfers net income to Retained Earnings and creates opening balances for the new fiscal year
4. **Given** an error is discovered after period close, **When** a correction is needed, **Then** an authorized user can reopen the period with audit trail logging of the reopening

---

### User Story 10 - Integrate with HR for Payroll Accounting (Priority: P3)

As a Payroll Accountant, I need payroll expenses from the HR module to automatically create journal entries, so that labor costs are accurately recorded and can be allocated to production or cost centers.

**Why this priority**: Integrating HR payroll with accounting ensures labor costs are properly recorded. This supports manufacturing cost accounting and ensures all expenses are captured. However, it depends on both accounting and HR modules being functional.

**Independent Test**: Can be fully tested by processing a payroll run and verifying the correct journal entries are created for salary expense, tax withholdings, and social security contributions. Delivers value through automated payroll accounting.

**Acceptance Scenarios**:

1. **Given** a payroll run is completed in HR, **When** the payroll is approved for payment, **Then** the system creates journal entries debiting Salary Expense and crediting Payroll Payable
2. **Given** payroll includes statutory deductions, **When** journal entries are created, **Then** separate liability accounts are credited for Employee Income Tax (PND 1), Social Security (employee and employer portions), and Provident Fund
3. **Given** employees are assigned to cost centers or production batches, **When** payroll is processed, **Then** labor costs are allocated to the appropriate cost center or WIP accounts based on employee assignments
4. **Given** payroll payments are processed, **When** bank payments are made, **Then** the system clears the Payroll Payable and statutory liability accounts

---

### Edge Cases

- What happens when an AP or AR invoice is cancelled after journal entry is posted? The system must create a reversing entry and update invoice status.
- How does the system handle foreign currency transactions? Transactions must be recorded at exchange rate on transaction date, and unrealized gain/loss calculated at period end using Bank of Thailand reference rates.
- What happens when goods are returned after invoice is posted? Credit memo must be created with corresponding reversing entries.
- How are advance payments from customers or to vendors handled? Advance payments are recorded to separate advance accounts and cleared against invoices when issued.
- What happens when a fiscal year structure needs to change? System must support flexible fiscal year definitions (calendar year or Thai government fiscal year Oct-Sep).
- What happens when a fixed asset is fully depreciated but still in use? Asset remains in register with zero net book value; no further depreciation is recorded.
- How are asset improvements vs repairs distinguished? System uses configurable capitalization threshold; amounts above threshold are capitalized and added to asset value.
- What happens when an asset is transferred between locations or departments? System tracks asset movement history and updates responsible cost center for depreciation allocation.
- How does the system handle asset impairment? Impairment losses can be recorded when asset's recoverable amount is less than book value, per Thai Accounting Standard 36.
- What happens when equipment breaks down unexpectedly? Emergency maintenance is recorded with downtime tracking; if repair cost exceeds threshold, triggers review for asset write-down or replacement decision.

## Requirements *(mandatory)*

### Functional Requirements

**Core Accounting Engine**
- **FR-001**: System MUST maintain a Chart of Accounts with account codes following Thai Accounting Standards structure
- **FR-002**: System MUST support double-entry bookkeeping with automatic validation that debits equal credits for each journal entry
- **FR-003**: System MUST allow journal entries to be created manually or automatically from source transactions (PO receipt, SO shipment, payments)
- **FR-004**: System MUST maintain an audit trail logging all journal entry creations, modifications, and reversals with user, timestamp, and reason

**Accounts Payable Integration**
- **FR-005**: System MUST automatically create an AP Invoice when a Purchase Order is marked as received
- **FR-006**: System MUST allow AP Invoice to be created manually for non-PO expenses (utilities, services, etc.)
- **FR-007**: System MUST track invoice approval workflow with at least draft, approved, and posted statuses
- **FR-008**: System MUST record payment transactions and update invoice paid amounts, supporting partial payments
- **FR-009**: System MUST calculate and record Input VAT (7%) on applicable purchases

**Accounts Receivable Integration**
- **FR-010**: System MUST automatically create an AR Invoice when a Sales Order is marked as shipped
- **FR-011**: System MUST generate tax invoice numbers in the format required by Thai Revenue Department
- **FR-012**: System MUST track invoice status through draft, confirmed, and paid states
- **FR-013**: System MUST record customer payment receipts and update invoice balances
- **FR-014**: System MUST calculate and record Output VAT (7%) on applicable sales

**Manufacturing Cost Accounting**
- **FR-015**: System MUST track raw material costs using FIFO valuation method consistent with existing inventory module
- **FR-016**: System MUST allow configuration of standard labor rates and overhead allocation bases
- **FR-017**: System MUST allocate manufacturing costs (materials, labor, overhead) to production batches
- **FR-018**: System MUST transfer completed production costs from Work-in-Progress to Finished Goods inventory

**Tax Compliance (Thai Regulations)**
- **FR-019**: System MUST maintain VAT transaction registers for both purchases (Input VAT) and sales (Output VAT)
- **FR-020**: System MUST generate VAT reports in the format required for Por Por 30 filing (Monthly VAT Return)
- **FR-021**: System MUST calculate Withholding Tax based on payment type and Thai Revenue Code rates (1%, 2%, 3%, 5% etc.)
- **FR-022**: System MUST generate Withholding Tax certificates (Por Ngor Dor 3 for individuals, Por Ngor Dor 53 for companies)
- **FR-023**: System MUST support tax invoice numbering with branch codes for multi-branch operations

**Financial Reporting**
- **FR-024**: System MUST generate Trial Balance report showing all GL account balances as of a specified date
- **FR-025**: System MUST generate Income Statement (Profit and Loss) for a specified period following TFRS format
- **FR-026**: System MUST generate Balance Sheet as of a specified date following TFRS format
- **FR-027**: System MUST generate Cash Flow Statement using indirect method for a specified period
- **FR-028**: System MUST support comparative reports showing current vs prior period

**Period Management**
- **FR-029**: System MUST support flexible fiscal year definition (calendar year or Oct-Sep Thai government year)
- **FR-030**: System MUST prevent posting to closed periods unless explicitly reopened by authorized user
- **FR-031**: System MUST perform year-end closing to transfer net income to Retained Earnings

**HR/Payroll Integration**
- **FR-032**: System MUST create journal entries from approved payroll runs in HR module
- **FR-033**: System MUST allocate labor costs to cost centers or production batches based on employee assignments
- **FR-034**: System MUST track statutory liabilities (Income Tax, Social Security, Provident Fund) from payroll deductions

**Fixed Assets Management**
- **FR-035**: System MUST maintain a Fixed Asset Register with asset categories following Thai Accounting Standards (Land, Buildings, Machinery, Equipment, Vehicles, Furniture, Intangible Assets)
- **FR-036**: System MUST allow capitalization of purchases from AP Invoices when cost exceeds the configured capitalization threshold
- **FR-037**: System MUST calculate depreciation using straight-line or declining balance methods based on Thai Revenue Code useful life limits (5-20 years by asset type)
- **FR-038**: System MUST automatically generate monthly depreciation journal entries debiting Depreciation Expense and crediting Accumulated Depreciation
- **FR-039**: System MUST track asset location, responsible person/department, and movement history
- **FR-040**: System MUST record asset disposals (sale, write-off, transfer) with automatic calculation of gain/loss and corresponding journal entries
- **FR-041**: System MUST generate Fixed Asset Register report showing cost, accumulated depreciation, and net book value as of any date
- **FR-042**: System MUST support asset revaluation and impairment recording per Thai Accounting Standard 36

**Equipment and Maintenance Management**
- **FR-043**: System MUST maintain equipment master data including serial number, manufacturer, model, warranty information, and specifications
- **FR-044**: System MUST support preventive maintenance scheduling based on calendar intervals or operating hours/units
- **FR-045**: System MUST record maintenance events with type (preventive, corrective, emergency), parts used, labor hours, downtime, and costs
- **FR-046**: System MUST distinguish between expense repairs and capital improvements based on configurable threshold
- **FR-047**: System MUST track equipment operating hours and maintenance history for reliability analysis
- **FR-048**: System MUST generate equipment maintenance cost reports and mean time between failures (MTBF) analysis

**Data Integrity & Security**
- **FR-049**: System MUST integrate with existing HR authorization system for role-based access control
- **FR-050**: System MUST log all accounting transactions in the audit trail with user, timestamp, and source document reference

### Key Entities *(include if feature involves data)*

- **GL Account**: Represents a general ledger account (code, Thai name, English name, type, subtype, active status, current balance)
- **Journal Entry**: Represents a complete accounting transaction (entry number, date, description, status, total debit/credit, source reference)
- **Journal Line**: Individual debit or credit line within a journal entry (account, amount, description)
- **AP Invoice**: Vendor invoice linked to purchase order and vendor (invoice number, vendor, PO reference, amounts, VAT, status, payment tracking)
- **AR Invoice**: Customer invoice linked to sales order and customer (invoice number, customer, SO reference, amounts, VAT, tax invoice number, status)
- **Payment**: Record of payment made (vendor) or received (customer) with bank/cash account reference
- **Cost Allocation**: Manufacturing cost allocation record linking production batch to material, labor, and overhead costs
- **VAT Transaction**: Individual VAT transaction for tax reporting (type, invoice reference, taxable amount, VAT amount, tax invoice number)
- **Fiscal Period**: Accounting period definition (year, month/quarter, start date, end date, status: open/closed)
- **Fixed Asset**: Capital asset record (asset code, description Thai/English, category, acquisition date, acquisition cost, useful life, depreciation method, salvage value, location, responsible person, status)
- **Asset Category**: Classification of fixed assets (category code, name, default useful life, default depreciation method, asset GL account, depreciation expense GL account, accumulated depreciation GL account)
- **Asset Depreciation**: Monthly depreciation record (asset, period, depreciation amount, accumulated depreciation, net book value)
- **Asset Disposal**: Record of asset disposal (asset, disposal date, disposal type, proceeds, gain/loss, journal entry reference)
- **Asset Movement**: History of asset location/department transfers (asset, from location, to location, transfer date, reason)
- **Equipment**: Extended asset information for manufacturing equipment (asset reference, serial number, manufacturer, model, specifications, warranty start/end, operating hours, assigned operator)
- **Maintenance Schedule**: Preventive maintenance plan (equipment, maintenance type, interval type, interval value, last performed, next due)
- **Maintenance Record**: Individual maintenance event (equipment, maintenance date, type, description, parts used, labor hours, downtime hours, cost, performed by)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the Chart of Accounts setup for a new company within 30 minutes using the Thai standard template
- **SC-002**: 100% of Purchase Order receipts automatically generate corresponding AP Invoices without manual data entry
- **SC-003**: 100% of Sales Order shipments automatically generate corresponding AR Invoices with valid tax invoice numbers
- **SC-004**: Monthly VAT filing preparation time is reduced by 80% compared to manual compilation
- **SC-005**: Trial Balance and financial statements can be generated within 1 minute for any specified period
- **SC-006**: All journal entries maintain debit = credit balance with zero unbalanced entries
- **SC-007**: Manufacturing product costs include all three cost elements (materials, labor, overhead) with full traceability to source transactions
- **SC-008**: Period-end closing completes within 5 minutes for a typical month's transaction volume
- **SC-009**: 100% of accounting transactions have audit trail entries with user, timestamp, and source reference
- **SC-010**: Withholding Tax certificates can be generated immediately upon payment processing
- **SC-011**: Monthly depreciation for all assets is calculated and posted automatically with zero manual intervention
- **SC-012**: Fixed Asset Register report accurately reflects 100% of assets with correct net book values at any point in time
- **SC-013**: Equipment maintenance scheduling generates alerts at least 7 days before preventive maintenance is due
- **SC-014**: Equipment downtime and maintenance costs are tracked with 100% of maintenance events recorded
- **SC-015**: Asset disposal transactions automatically calculate gain/loss and generate correct journal entries

## Assumptions

- The existing HR module's authorization system will be used for accounting role-based access control
- The existing Purchase and Sales modules are stable and their transaction statuses (received, shipped) are reliable triggers
- The company uses Thai Baht (THB) as the primary functional currency
- Thai Accounting Standards (TAS/TFRS) for SMEs is the applicable framework unless specified otherwise
- The existing FIFO inventory valuation method will be maintained and extended to cost accounting
- Multi-branch/multi-company operations are not in initial scope but the design should not preclude future extension
- Bank of Thailand exchange rates will be used for any foreign currency transactions
- Electronic filing integration with Thai Revenue Department is not in initial scope (reports will be generated for manual upload)
- Fixed asset depreciation will follow Thai Revenue Code standard useful lives (Buildings: 20 years, Machinery: 5-10 years, Vehicles: 5 years, Furniture/Equipment: 5 years) unless specifically configured otherwise
- Equipment maintenance integration with external CMMS (Computerized Maintenance Management System) is not in initial scope
- Barcode/RFID asset tracking hardware integration is not in initial scope but data model should support future extension
