CREATE TABLE `ap_invoice_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ap_invoice_id` integer NOT NULL,
	`line_number` integer NOT NULL,
	`description` text NOT NULL,
	`item_id` integer,
	`gl_account_id` integer NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price` real NOT NULL,
	`amount` real NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`is_capitalizable` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`ap_invoice_id`) REFERENCES `ap_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gl_account_id`) REFERENCES `gl_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ap_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_number` text NOT NULL,
	`vendor_id` integer NOT NULL,
	`purchase_order_id` integer,
	`invoice_date` text NOT NULL,
	`due_date` text NOT NULL,
	`received_date` text NOT NULL,
	`description` text,
	`subtotal` real DEFAULT 0 NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`wht_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'THB' NOT NULL,
	`exchange_rate` real DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`approved_by` integer,
	`approved_at` text,
	`journal_entry_id` integer,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ap_invoices_invoice_number_unique` ON `ap_invoices` (`invoice_number`);--> statement-breakpoint
CREATE TABLE `ar_invoice_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ar_invoice_id` integer NOT NULL,
	`line_number` integer NOT NULL,
	`description` text NOT NULL,
	`item_id` integer,
	`gl_account_id` integer NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price` real NOT NULL,
	`amount` real NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`lot_id` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`ar_invoice_id`) REFERENCES `ar_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gl_account_id`) REFERENCES `gl_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ar_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_number` text NOT NULL,
	`tax_invoice_number` text NOT NULL,
	`customer_id` integer NOT NULL,
	`sales_order_id` integer,
	`invoice_date` text NOT NULL,
	`due_date` text NOT NULL,
	`description` text,
	`subtotal` real DEFAULT 0 NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'THB' NOT NULL,
	`exchange_rate` real DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`confirmed_by` integer,
	`confirmed_at` text,
	`journal_entry_id` integer,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ar_invoices_invoice_number_unique` ON `ar_invoices` (`invoice_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `ar_invoices_tax_invoice_number_unique` ON `ar_invoices` (`tax_invoice_number`);--> statement-breakpoint
CREATE TABLE `accounting_equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fixed_asset_id` integer NOT NULL,
	`serial_number` text,
	`manufacturer` text,
	`model` text,
	`specifications` text,
	`warranty_start_date` text,
	`warranty_end_date` text,
	`operating_hours` real DEFAULT 0 NOT NULL,
	`operating_units` real DEFAULT 0 NOT NULL,
	`last_meter_reading` real DEFAULT 0 NOT NULL,
	`last_meter_reading_date` text,
	`assigned_operator_id` integer,
	`production_line_id` integer,
	`is_available` integer DEFAULT true NOT NULL,
	`last_maintenance_date` text,
	`next_maintenance_due` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`fixed_asset_id`) REFERENCES `fixed_assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_operator_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounting_equipment_fixed_asset_id_unique` ON `accounting_equipment` (`fixed_asset_id`);--> statement-breakpoint
CREATE TABLE `acct_maintenance_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`equipment_id` integer NOT NULL,
	`maintenance_schedule_id` integer,
	`maintenance_date` text NOT NULL,
	`maintenance_type` text NOT NULL,
	`description` text NOT NULL,
	`hours_at_maintenance` real,
	`parts_used` text,
	`parts_cost` real DEFAULT 0 NOT NULL,
	`labor_hours` real DEFAULT 0 NOT NULL,
	`labor_cost` real DEFAULT 0 NOT NULL,
	`external_service_cost` real DEFAULT 0 NOT NULL,
	`total_cost` real NOT NULL,
	`downtime_hours` real DEFAULT 0 NOT NULL,
	`is_critical` integer DEFAULT false NOT NULL,
	`root_cause` text,
	`is_capitalized` integer DEFAULT false NOT NULL,
	`journal_entry_id` integer,
	`performed_by` text,
	`approved_by` integer,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `accounting_equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`maintenance_schedule_id`) REFERENCES `acct_maintenance_schedules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `acct_maintenance_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`equipment_id` integer NOT NULL,
	`maintenance_type` text NOT NULL,
	`description` text,
	`interval_type` text NOT NULL,
	`interval_value` integer NOT NULL,
	`last_performed` text,
	`last_performed_hours` real,
	`next_due` text NOT NULL,
	`next_due_hours` real,
	`alert_days_before` integer DEFAULT 7 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `accounting_equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approval_delegations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`delegator_id` integer NOT NULL,
	`delegate_id` integer NOT NULL,
	`document_type` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`reason` text,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`delegator_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`delegate_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approval_flows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`document_type` text NOT NULL,
	`priority` integer DEFAULT 100 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approval_request_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`step_id` integer NOT NULL,
	`step_order` integer NOT NULL,
	`assigned_to` integer NOT NULL,
	`delegated_from` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`action_date` text,
	`comments` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `approval_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`step_id`) REFERENCES `approval_steps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`delegated_from`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approval_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`flow_id` integer NOT NULL,
	`document_type` text NOT NULL,
	`document_id` integer NOT NULL,
	`current_step_order` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` integer NOT NULL,
	`requested_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`flow_id`) REFERENCES `approval_flows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approval_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`flow_id` integer NOT NULL,
	`rule_order` integer NOT NULL,
	`field_name` text NOT NULL,
	`operator` text NOT NULL,
	`value` text NOT NULL,
	`value_to` text,
	`logic_operator` text DEFAULT 'and' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`flow_id`) REFERENCES `approval_flows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approval_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`flow_id` integer NOT NULL,
	`step_order` integer NOT NULL,
	`step_name` text NOT NULL,
	`approver_type` text NOT NULL,
	`approver_id` integer,
	`can_delegate` integer DEFAULT false NOT NULL,
	`timeout_days` integer DEFAULT 3 NOT NULL,
	`escalation_step_id` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`flow_id`) REFERENCES `approval_flows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`escalation_step_id`) REFERENCES `approval_steps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `asset_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text NOT NULL,
	`default_useful_life_months` integer NOT NULL,
	`default_depreciation_method` text NOT NULL,
	`max_depreciation_rate` real NOT NULL,
	`asset_gl_account_id` integer NOT NULL,
	`depreciation_expense_gl_account_id` integer NOT NULL,
	`accumulated_depreciation_gl_account_id` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`asset_gl_account_id`) REFERENCES `gl_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`depreciation_expense_gl_account_id`) REFERENCES `gl_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accumulated_depreciation_gl_account_id`) REFERENCES `gl_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_categories_code_unique` ON `asset_categories` (`code`);--> statement-breakpoint
CREATE TABLE `asset_depreciations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fixed_asset_id` integer NOT NULL,
	`fiscal_period_id` integer NOT NULL,
	`depreciation_date` text NOT NULL,
	`opening_book_value` real NOT NULL,
	`depreciation_amount` real NOT NULL,
	`accumulated_depreciation` real NOT NULL,
	`closing_book_value` real NOT NULL,
	`journal_entry_id` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`fixed_asset_id`) REFERENCES `fixed_assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fiscal_period_id`) REFERENCES `fiscal_periods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `asset_disposals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fixed_asset_id` integer NOT NULL,
	`disposal_date` text NOT NULL,
	`disposal_type` text NOT NULL,
	`disposal_reason` text,
	`sale_proceeds` real DEFAULT 0 NOT NULL,
	`book_value_at_disposal` real NOT NULL,
	`gain_loss` real NOT NULL,
	`buyer_name` text,
	`journal_entry_id` integer,
	`approved_by` integer,
	`approved_at` text,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`fixed_asset_id`) REFERENCES `fixed_assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `asset_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fixed_asset_id` integer NOT NULL,
	`movement_date` text NOT NULL,
	`from_location` text,
	`to_location` text,
	`from_department_id` integer,
	`to_department_id` integer,
	`from_responsible_person_id` integer,
	`to_responsible_person_id` integer,
	`reason` text,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`fixed_asset_id`) REFERENCES `fixed_assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_department_id`) REFERENCES `hr_org_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_department_id`) REFERENCES `hr_org_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_responsible_person_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_responsible_person_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bom_environmental_conditions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bom_id` integer NOT NULL,
	`condition_id` integer NOT NULL,
	`phase` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`condition_id`) REFERENCES `environmental_conditions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bom_equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bom_id` integer NOT NULL,
	`equipment_id` integer NOT NULL,
	`phase` text NOT NULL,
	`sequence` integer DEFAULT 1 NOT NULL,
	`is_required` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `production_equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bom_packaging_qc` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bom_id` integer NOT NULL,
	`criteria_id` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criteria_id`) REFERENCES `packaging_qc_criteria`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bom_rooms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bom_id` integer NOT NULL,
	`room_id` integer NOT NULL,
	`phase` text NOT NULL,
	`sequence` integer DEFAULT 1 NOT NULL,
	`is_required` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `production_rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bom_sop_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bom_id` integer NOT NULL,
	`template_id` integer,
	`sequence` integer NOT NULL,
	`step_name` text NOT NULL,
	`step_name_th` text,
	`instructions` text,
	`instructions_th` text,
	`parameters` text,
	`equipment_ids` text,
	`requires_verification` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `sop_step_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bank_statement_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`statement_id` integer NOT NULL,
	`line_number` integer NOT NULL,
	`transaction_date` text NOT NULL,
	`value_date` text,
	`reference` text,
	`description` text NOT NULL,
	`debit_amount` real,
	`credit_amount` real,
	`running_balance` real,
	`status` text DEFAULT 'imported' NOT NULL,
	`match_confidence` real,
	`matched_by` integer,
	`matched_at` text,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`statement_id`) REFERENCES `bank_statements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_by`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bank_statements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`statement_number` text NOT NULL,
	`bank_account_id` integer NOT NULL,
	`statement_date` text NOT NULL,
	`opening_balance` real NOT NULL,
	`closing_balance` real NOT NULL,
	`total_debits` real DEFAULT 0 NOT NULL,
	`total_credits` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'imported' NOT NULL,
	`imported_file_name` text,
	`imported_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`reconciled_by` integer,
	`reconciled_at` text,
	`notes` text,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`bank_account_id`) REFERENCES `gl_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reconciled_by`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `credit_debit_note_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` integer NOT NULL,
	`line_number` integer NOT NULL,
	`reference_invoice_line_id` integer,
	`item_id` integer,
	`description` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price` real NOT NULL,
	`line_total` real NOT NULL,
	`gl_account_id` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `credit_debit_notes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gl_account_id`) REFERENCES `gl_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `credit_debit_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_number` text NOT NULL,
	`note_type` text NOT NULL,
	`reference_type` text NOT NULL,
	`reference_invoice_id` integer NOT NULL,
	`customer_id` integer,
	`vendor_id` integer,
	`note_date` text NOT NULL,
	`reason_code` text NOT NULL,
	`reason_description` text,
	`subtotal` real DEFAULT 0 NOT NULL,
	`vat_rate` real DEFAULT 0.07 NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`wht_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`journal_entry_id` integer,
	`vat_transaction_id` integer,
	`approved_by` integer,
	`approved_at` text,
	`posted_at` text,
	`notes` text,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vat_transaction_id`) REFERENCES `vat_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_debit_notes_note_number_unique` ON `credit_debit_notes` (`note_number`);--> statement-breakpoint
CREATE TABLE `environmental_conditions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`temperature_min` real DEFAULT 20 NOT NULL,
	`temperature_max` real DEFAULT 30 NOT NULL,
	`humidity_max` real DEFAULT 60 NOT NULL,
	`monitoring_interval_minutes` integer DEFAULT 60 NOT NULL,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `environmental_conditions_code_unique` ON `environmental_conditions` (`code`);--> statement-breakpoint
CREATE TABLE `fiscal_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fiscal_year_id` integer NOT NULL,
	`period_number` integer NOT NULL,
	`period_name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`closed_by` integer,
	`closed_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fiscal_years` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year_code` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`closed_by` integer,
	`closed_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fiscal_years_year_code_unique` ON `fiscal_years` (`year_code`);--> statement-breakpoint
CREATE TABLE `fixed_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_code` text NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text NOT NULL,
	`category_id` integer NOT NULL,
	`acquisition_date` text NOT NULL,
	`acquisition_cost` real NOT NULL,
	`salvage_value` real DEFAULT 0 NOT NULL,
	`useful_life_months` integer NOT NULL,
	`depreciation_method` text NOT NULL,
	`depreciation_start_date` text NOT NULL,
	`accumulated_depreciation` real DEFAULT 0 NOT NULL,
	`net_book_value` real NOT NULL,
	`location` text,
	`department_id` integer,
	`responsible_person_id` integer,
	`purchase_order_id` integer,
	`ap_invoice_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`disposal_date` text,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `asset_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `hr_org_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`responsible_person_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ap_invoice_id`) REFERENCES `ap_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fixed_assets_asset_code_unique` ON `fixed_assets` (`asset_code`);--> statement-breakpoint
CREATE TABLE `gl_account_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text NOT NULL,
	`category` text NOT NULL,
	`normal_balance` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gl_account_types_code_unique` ON `gl_account_types` (`code`);--> statement-breakpoint
CREATE TABLE `gl_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text NOT NULL,
	`account_type_id` integer NOT NULL,
	`parent_id` integer,
	`level` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_postable` integer DEFAULT true NOT NULL,
	`is_bank_account` integer DEFAULT false NOT NULL,
	`bank_name` text,
	`bank_account_number` text,
	`description` text,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`account_type_id`) REFERENCES `gl_account_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `gl_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gl_accounts_code_unique` ON `gl_accounts` (`code`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_number` text NOT NULL,
	`entry_date` text NOT NULL,
	`fiscal_period_id` integer,
	`description` text,
	`source_type` text,
	`source_id` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_debit` real DEFAULT 0 NOT NULL,
	`total_credit` real DEFAULT 0 NOT NULL,
	`posted_by` integer,
	`posted_at` text,
	`reversed_by` integer,
	`reversed_at` text,
	`reversal_entry_id` integer,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`fiscal_period_id`) REFERENCES `fiscal_periods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`posted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reversed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reversal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journal_entries_entry_number_unique` ON `journal_entries` (`entry_number`);--> statement-breakpoint
CREATE TABLE `journal_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`journal_entry_id` integer NOT NULL,
	`line_number` integer NOT NULL,
	`gl_account_id` integer NOT NULL,
	`debit` real DEFAULT 0 NOT NULL,
	`credit` real DEFAULT 0 NOT NULL,
	`description` text,
	`cost_center_id` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gl_account_id`) REFERENCES `gl_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cost_center_id`) REFERENCES `hr_org_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matching_exceptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`matching_result_id` integer NOT NULL,
	`exception_type` text NOT NULL,
	`variance_amount` real NOT NULL,
	`variance_pct` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolution_action` text,
	`resolution_notes` text,
	`resolved_by` integer,
	`resolved_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`matching_result_id`) REFERENCES `matching_results`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matching_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ap_invoice_id` integer NOT NULL,
	`ap_invoice_line_id` integer NOT NULL,
	`po_line_id` integer NOT NULL,
	`grn_lot_id` integer,
	`tolerance_profile_id` integer NOT NULL,
	`po_quantity` real NOT NULL,
	`grn_quantity` real,
	`invoice_quantity` real NOT NULL,
	`quantity_variance` real DEFAULT 0 NOT NULL,
	`quantity_variance_pct` real DEFAULT 0 NOT NULL,
	`po_unit_price` real NOT NULL,
	`invoice_unit_price` real NOT NULL,
	`price_variance` real DEFAULT 0 NOT NULL,
	`price_variance_pct` real DEFAULT 0 NOT NULL,
	`match_status` text DEFAULT 'pending' NOT NULL,
	`matched_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`ap_invoice_id`) REFERENCES `ap_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ap_invoice_line_id`) REFERENCES `ap_invoice_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`po_line_id`) REFERENCES `purchase_order_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grn_lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tolerance_profile_id`) REFERENCES `matching_tolerances`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matching_tolerances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`quantity_tolerance_pct` real DEFAULT 5 NOT NULL,
	`quantity_tolerance_abs` real DEFAULT 10 NOT NULL,
	`price_tolerance_pct` real DEFAULT 2 NOT NULL,
	`price_tolerance_abs` real DEFAULT 100 NOT NULL,
	`total_tolerance_pct` real DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matching_tolerances_name_unique` ON `matching_tolerances` (`name`);--> statement-breakpoint
CREATE TABLE `packaging_qc_criteria` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`weight_min` real NOT NULL,
	`weight_max` real NOT NULL,
	`sample_size` integer DEFAULT 20 NOT NULL,
	`max_failures` integer DEFAULT 2 NOT NULL,
	`check_interval_minutes` integer DEFAULT 30 NOT NULL,
	`units_per_pack` integer DEFAULT 12 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `packaging_qc_criteria_code_unique` ON `packaging_qc_criteria` (`code`);--> statement-breakpoint
CREATE TABLE `payment_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payment_id` integer NOT NULL,
	`ap_invoice_id` integer,
	`ar_invoice_id` integer,
	`allocated_amount` real NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ap_invoice_id`) REFERENCES `ap_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ar_invoice_id`) REFERENCES `ar_invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payment_number` text NOT NULL,
	`payment_type` text NOT NULL,
	`payment_date` text NOT NULL,
	`vendor_id` integer,
	`customer_id` integer,
	`bank_account_id` integer NOT NULL,
	`payment_method` text NOT NULL,
	`reference_number` text,
	`amount` real NOT NULL,
	`wht_amount` real DEFAULT 0 NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`journal_entry_id` integer,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bank_account_id`) REFERENCES `gl_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_payment_number_unique` ON `payments` (`payment_number`);--> statement-breakpoint
CREATE TABLE `production_equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`name_th` text NOT NULL,
	`equipment_type` text NOT NULL,
	`capacity` text,
	`room_id` integer,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `production_rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_equipment_code_unique` ON `production_equipment` (`code`);--> statement-breakpoint
CREATE TABLE `production_rooms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`name_th` text NOT NULL,
	`room_type` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_rooms_code_unique` ON `production_rooms` (`code`);--> statement-breakpoint
CREATE TABLE `purchase_requisition_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_id` integer NOT NULL,
	`line_number` integer NOT NULL,
	`item_id` integer,
	`description` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`estimated_price` real DEFAULT 0 NOT NULL,
	`line_total` real DEFAULT 0 NOT NULL,
	`preferred_vendor_id` integer,
	`notes` text,
	`status` text DEFAULT 'open' NOT NULL,
	`converted_po_line_id` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`pr_id`) REFERENCES `purchase_requisitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`preferred_vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`converted_po_line_id`) REFERENCES `purchase_order_lines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_requisitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_number` text NOT NULL,
	`requester_id` integer NOT NULL,
	`department_id` integer,
	`required_date` text NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`justification` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`approved_by` integer,
	`approved_at` text,
	`rejection_reason` text,
	`notes` text,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`requester_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `hr_org_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_requisitions_pr_number_unique` ON `purchase_requisitions` (`pr_number`);--> statement-breakpoint
CREATE TABLE `reconciliation_matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`statement_line_id` integer NOT NULL,
	`payment_id` integer,
	`journal_entry_id` integer,
	`match_type` text NOT NULL,
	`match_amount` real NOT NULL,
	`variance_amount` real DEFAULT 0 NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`statement_line_id`) REFERENCES `bank_statement_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sop_step_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`name_th` text NOT NULL,
	`category` text NOT NULL,
	`instructions` text,
	`instructions_th` text,
	`default_parameters` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sop_step_templates_code_unique` ON `sop_step_templates` (`code`);--> statement-breakpoint
CREATE TABLE `sales_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`so_id` integer NOT NULL,
	`so_line_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`lot_id` integer NOT NULL,
	`lot_number` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`delivery_date` text NOT NULL,
	`delivery_number` text NOT NULL,
	`status` text DEFAULT 'shipped' NOT NULL,
	`notes` text,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`so_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`so_line_id`) REFERENCES `sales_order_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `standard_costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`effective_date` text NOT NULL,
	`material_cost` real DEFAULT 0 NOT NULL,
	`labor_cost` real DEFAULT 0 NOT NULL,
	`overhead_cost` real DEFAULT 0 NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`standard_hours` real DEFAULT 0 NOT NULL,
	`standard_labor_rate` real DEFAULT 0 NOT NULL,
	`notes` text,
	`is_current` integer DEFAULT false NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `template_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text,
	`description` text,
	`color` text DEFAULT '#3B82F6' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_categories_code_unique` ON `template_categories` (`code`);--> statement-breakpoint
CREATE TABLE `template_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text,
	`description` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`category_id` integer,
	`quantity` real DEFAULT 0 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`total_value` real DEFAULT 0 NOT NULL,
	`due_date` text,
	`due_time` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	FOREIGN KEY (`category_id`) REFERENCES `template_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_items_code_unique` ON `template_items` (`code`);--> statement-breakpoint
CREATE TABLE `vat_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_type` text NOT NULL,
	`tax_invoice_number` text NOT NULL,
	`tax_invoice_date` text NOT NULL,
	`tax_period` text NOT NULL,
	`vendor_id` integer,
	`customer_id` integer,
	`party_name` text NOT NULL,
	`party_tax_id` text NOT NULL,
	`branch_code` text DEFAULT '00000' NOT NULL,
	`taxable_amount` real NOT NULL,
	`vat_rate` real NOT NULL,
	`vat_amount` real NOT NULL,
	`total_amount` real NOT NULL,
	`ap_invoice_id` integer,
	`ar_invoice_id` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ap_invoice_id`) REFERENCES `ap_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ar_invoice_id`) REFERENCES `ar_invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `variance_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`variance_type` text NOT NULL,
	`variance_date` text NOT NULL,
	`standard_value` real NOT NULL,
	`actual_value` real NOT NULL,
	`variance_amount` real NOT NULL,
	`quantity` real,
	`is_favorable` integer NOT NULL,
	`journal_entry_id` integer,
	`posted_at` text,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vendor_api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`name` text NOT NULL,
	`permissions` text DEFAULT 'read' NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`created_by` integer,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vmi_webhook_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`webhook_id` integer NOT NULL,
	`delivery_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_id` text,
	`payload` text NOT NULL,
	`signature` text NOT NULL,
	`signature_valid` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`response_code` integer,
	`error_message` text,
	`processing_duration_ms` integer,
	`received_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`processed_at` text,
	FOREIGN KEY (`webhook_id`) REFERENCES `vmi_webhooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vmi_webhook_deliveries_delivery_id_unique` ON `vmi_webhook_deliveries` (`delivery_id`);--> statement-breakpoint
CREATE TABLE `vmi_webhooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portal_id` integer NOT NULL,
	`vmi_webhook_id` integer,
	`name` text NOT NULL,
	`description` text,
	`url` text NOT NULL,
	`secret_encrypted` text NOT NULL,
	`events` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_disabled_by_failures` integer DEFAULT false NOT NULL,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`last_success_at` text,
	`last_failure_at` text,
	`last_error_message` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`created_by` integer,
	FOREIGN KEY (`portal_id`) REFERENCES `vmi_portal_config`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wht_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`certificate_number` text NOT NULL,
	`certificate_type` text NOT NULL,
	`payment_id` integer NOT NULL,
	`vendor_id` integer NOT NULL,
	`payment_date` text NOT NULL,
	`tax_period` text NOT NULL,
	`wht_type` text NOT NULL,
	`wht_description` text NOT NULL,
	`payment_amount` real NOT NULL,
	`wht_rate` real NOT NULL,
	`wht_amount` real NOT NULL,
	`net_amount` real NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wht_transactions_certificate_number_unique` ON `wht_transactions` (`certificate_number`);--> statement-breakpoint
CREATE TABLE `wo_cleaning_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`phase` text NOT NULL,
	`item_type` text NOT NULL,
	`room_id` integer,
	`equipment_id` integer,
	`is_clean` integer NOT NULL,
	`operator_id` integer NOT NULL,
	`performed_at` text NOT NULL,
	`verifier_id` integer,
	`verified_at` text,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `production_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `production_equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verifier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wo_environmental_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`bom_condition_id` integer,
	`phase` text NOT NULL,
	`recorded_date` text NOT NULL,
	`recorded_time` text NOT NULL,
	`temperature` real NOT NULL,
	`humidity` real NOT NULL,
	`is_normal` integer NOT NULL,
	`operator_id` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bom_condition_id`) REFERENCES `bom_environmental_conditions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wo_finished_inspection` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`sample_date` text NOT NULL,
	`sampler_id` integer NOT NULL,
	`sample_qty_for_test` integer DEFAULT 50 NOT NULL,
	`sample_qty_for_retention` integer DEFAULT 3 NOT NULL,
	`checklist_results` text NOT NULL,
	`inspector_id` integer,
	`inspected_at` text,
	`re_inspector_id` integer,
	`re_inspected_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sampler_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inspector_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`re_inspector_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wo_packaging_integrity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`check_time` text NOT NULL,
	`tube_cap_complete` integer NOT NULL,
	`lot_number_correct` integer NOT NULL,
	`packing_correct` integer NOT NULL,
	`operator_id` integer NOT NULL,
	`inspector_id` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inspector_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wo_packaging_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`item_id` integer,
	`material_name` text NOT NULL,
	`qty_requisitioned` real NOT NULL,
	`qty_used` real,
	`qty_returned` real,
	`unit` text NOT NULL,
	`operator_id` integer,
	`verifier_id` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verifier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wo_packaging_weight_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`bom_qc_id` integer,
	`check_time` text NOT NULL,
	`sample_weights` text NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`is_pass` integer NOT NULL,
	`operator_id` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bom_qc_id`) REFERENCES `bom_packaging_qc`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wo_sop_execution` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`bom_step_id` integer NOT NULL,
	`sequence` integer NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`actual_parameters` text,
	`operator_id` integer,
	`started_at` text,
	`completed_at` text,
	`verifier_id` integer,
	`verified_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bom_step_id`) REFERENCES `bom_sop_steps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verifier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module_name` text NOT NULL,
	`entity_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`file_data` blob NOT NULL,
	`description` text,
	`category` text,
	`uploaded_by` integer,
	`uploaded_at` text DEFAULT '2025-12-30T01:03:32.645Z' NOT NULL,
	`updated_at` text DEFAULT '2025-12-30T01:03:32.645Z' NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_attachments`("id", "module_name", "entity_id", "file_name", "file_size", "mime_type", "file_data", "description", "category", "uploaded_by", "uploaded_at", "updated_at") SELECT "id", "module_name", "entity_id", "file_name", "file_size", "mime_type", "file_data", "description", "category", "uploaded_by", "uploaded_at", "updated_at" FROM `attachments`;--> statement-breakpoint
DROP TABLE `attachments`;--> statement-breakpoint
ALTER TABLE `__new_attachments` RENAME TO `attachments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `vmi_portal_config` ADD `webhook_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `vmi_portal_config` ADD `webhook_endpoint_url` text;--> statement-breakpoint
ALTER TABLE `work_order_materials` ADD `bom_line_id` integer REFERENCES bom_lines(id);--> statement-breakpoint
ALTER TABLE `work_order_materials` ADD `weighed_qty` real;--> statement-breakpoint
ALTER TABLE `work_order_materials` ADD `weighed_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `work_order_materials` ADD `weighed_at` text;--> statement-breakpoint
ALTER TABLE `work_order_materials` ADD `verified_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `work_order_materials` ADD `verified_at` text;--> statement-breakpoint
ALTER TABLE `work_order_materials` ADD `water_date` text;--> statement-breakpoint
ALTER TABLE `work_order_materials` ADD `water_conductivity` real;--> statement-breakpoint
ALTER TABLE `work_order_materials` ADD `water_temperature` real;