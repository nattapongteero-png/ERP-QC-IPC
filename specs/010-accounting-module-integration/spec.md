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

### User Story 7 - Perform Period-End Closing (Priority: P3)

As an Accounting Manager, I need to perform month-end and year-end closing procedures to finalize financial periods, so that financial reports are accurate and the books are properly maintained.

**Why this priority**: Period closing ensures data integrity and prevents changes to closed periods. It's important for audit trails and financial control but is a control process that requires transaction processing to be stable first.

**Independent Test**: Can be fully tested by processing transactions, running closing procedures, and verifying the period is locked and balances are carried forward correctly. Delivers value through financial control.

**Acceptance Scenarios**:

1. **Given** a month's transactions are complete, **When** I initiate month-end close, **Then** the system runs validation checks for unposted entries, missing documents, and balance discrepancies
2. **Given** all validations pass, **When** I confirm the period close, **Then** the system prevents any further postings to that period and records the closing date and user
3. **Given** a fiscal year has ended, **When** I run year-end closing, **Then** the system transfers net income to Retained Earnings and creates opening balances for the new fiscal year
4. **Given** an error is discovered after period close, **When** a correction is needed, **Then** an authorized user can reopen the period with audit trail logging of the reopening

---

### User Story 8 - Integrate with HR for Payroll Accounting (Priority: P3)

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

**Data Integrity & Security**
- **FR-035**: System MUST integrate with existing HR authorization system for role-based access control
- **FR-036**: System MUST log all accounting transactions in the audit trail with user, timestamp, and source document reference

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

## Assumptions

- The existing HR module's authorization system will be used for accounting role-based access control
- The existing Purchase and Sales modules are stable and their transaction statuses (received, shipped) are reliable triggers
- The company uses Thai Baht (THB) as the primary functional currency
- Thai Accounting Standards (TAS/TFRS) for SMEs is the applicable framework unless specified otherwise
- The existing FIFO inventory valuation method will be maintained and extended to cost accounting
- Multi-branch/multi-company operations are not in initial scope but the design should not preclude future extension
- Bank of Thailand exchange rates will be used for any foreign currency transactions
- Electronic filing integration with Thai Revenue Department is not in initial scope (reports will be generated for manual upload)
