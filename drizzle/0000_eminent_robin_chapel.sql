CREATE TABLE `approved_vendor_list` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`vendor_id` integer NOT NULL,
	`approval_date` text,
	`expiry_date` text,
	`is_preferred` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_trail` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`table_name` text,
	`record_id` integer,
	`old_value` text,
	`new_value` text,
	`ip_address` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bom` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`product_id` integer NOT NULL,
	`version` text DEFAULT '1.0' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`batch_size` real NOT NULL,
	`batch_unit` text NOT NULL,
	`yield_target` real,
	`loss_allowance` real,
	`effective_date` text,
	`expiry_date` text,
	`approved_by` integer,
	`approved_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bom_code_unique` ON `bom` (`code`);--> statement-breakpoint
CREATE TABLE `bom_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bom_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`sequence` integer DEFAULT 1 NOT NULL,
	`is_optional` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `batch_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`operation_id` integer NOT NULL,
	`sequence` integer NOT NULL,
	`step_name` text NOT NULL,
	`instructions` text,
	`parameters` text,
	`actual_values` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`start_time` text,
	`end_time` text,
	`performed_by` integer,
	`verified_by` integer,
	`verified_at` text,
	`notes` text,
	`attachments` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operation_id`) REFERENCES `operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact_person` text,
	`phone` text,
	`email` text,
	`address` text,
	`tax_id` text,
	`customer_type` text DEFAULT 'hospital' NOT NULL,
	`credit_limit` real,
	`credit_term_days` integer,
	`payment_terms` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_code_unique` ON `customers` (`code`);--> statement-breakpoint
CREATE TABLE `deviations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deviation_number` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`source_type` text,
	`source_id` integer,
	`severity` text DEFAULT 'minor' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`root_cause` text,
	`corrective_action` text,
	`preventive_action` text,
	`reported_by` integer,
	`assigned_to` integer,
	`due_date` text,
	`closed_by` integer,
	`closed_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deviations_deviation_number_unique` ON `deviations` (`deviation_number`);--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`location` text,
	`manufacturer` text,
	`model` text,
	`serial_number` text,
	`installation_date` text,
	`last_maintenance_date` text,
	`next_maintenance_date` text,
	`last_calibration_date` text,
	`next_calibration_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_code_unique` ON `equipment` (`code`);--> statement-breakpoint
CREATE TABLE `herbal_attributes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`botanical_name` text,
	`part_used` text,
	`origin_country` text,
	`origin_province` text,
	`harvest_date` text,
	`drying_method` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory_lots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`lot_number` text NOT NULL,
	`batch_number` text,
	`warehouse_id` integer NOT NULL,
	`location_id` integer,
	`quantity` real DEFAULT 0 NOT NULL,
	`reserved_quantity` real DEFAULT 0 NOT NULL,
	`unit` text NOT NULL,
	`status` text DEFAULT 'quarantine' NOT NULL,
	`manufacturing_date` text,
	`expiry_date` text,
	`received_date` text,
	`vendor_id` integer,
	`po_number` text,
	`coa_number` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `warehouse_locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lot_id` integer NOT NULL,
	`transaction_type` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`reference_type` text,
	`reference_id` integer,
	`reference_number` text,
	`from_warehouse_id` integer,
	`to_warehouse_id` integer,
	`reason` text,
	`performed_by` integer,
	`approved_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `item_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_categories_code_unique` ON `item_categories` (`code`);--> statement-breakpoint
CREATE TABLE `item_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text,
	`symbol` text,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_units_code_unique` ON `item_units` (`code`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_th` text NOT NULL,
	`name_en` text,
	`type` text NOT NULL,
	`category` text,
	`primary_unit` text NOT NULL,
	`secondary_unit` text,
	`conversion_rate` real,
	`shelf_life_days` integer,
	`storage_condition` text,
	`min_stock` real DEFAULT 0,
	`max_stock` real,
	`reorder_point` real,
	`on_hand` real DEFAULT 0 NOT NULL,
	`on_hand_cost` real DEFAULT 0 NOT NULL,
	`is_lot_controlled` integer DEFAULT true NOT NULL,
	`is_fefo` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`tpp_code` text,
	`ttmt_code` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_code_unique` ON `items` (`code`);--> statement-breakpoint
CREATE TABLE `maintenance_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`equipment_id` integer NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`scheduled_date` text,
	`completed_date` text,
	`performed_by` integer,
	`cost` real,
	`notes` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `operations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bom_id` integer NOT NULL,
	`sequence` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`work_center_id` integer,
	`standard_time` real,
	`setup_time` real,
	`cleaning_time` real,
	`instructions` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_order_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`po_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`quantity` real NOT NULL,
	`received_quantity` real DEFAULT 0 NOT NULL,
	`unit` text NOT NULL,
	`unit_price` real NOT NULL,
	`total_price` real NOT NULL,
	`expected_date` text,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`po_number` text NOT NULL,
	`vendor_id` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`order_date` text,
	`expected_date` text,
	`total_amount` real,
	`currency` text DEFAULT 'THB' NOT NULL,
	`payment_terms` text,
	`shipping_address` text,
	`notes` text,
	`created_by` integer,
	`approved_by` integer,
	`approved_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_po_number_unique` ON `purchase_orders` (`po_number`);--> statement-breakpoint
CREATE TABLE `quality_specs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`test_name` text NOT NULL,
	`test_method` text,
	`specification` text,
	`min_value` real,
	`max_value` real,
	`unit` text,
	`is_critical` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quality_tests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lot_id` integer NOT NULL,
	`spec_id` integer NOT NULL,
	`test_type` text NOT NULL,
	`sample_number` text,
	`test_date` text,
	`result` text,
	`numeric_result` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`tested_by` integer,
	`approved_by` integer,
	`approved_at` text,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spec_id`) REFERENCES `quality_specs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `report_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`parent_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `report_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`action` text NOT NULL,
	`parameters` text,
	`export_format` text,
	`executed_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`duration_ms` integer,
	`status` text NOT NULL,
	`error_message` text,
	`ip_address` text,
	FOREIGN KEY (`template_id`) REFERENCES `report_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `report_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer NOT NULL,
	`role` text NOT NULL,
	`can_view` integer DEFAULT true NOT NULL,
	`can_design` integer DEFAULT false NOT NULL,
	`can_export` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `report_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `report_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`code` text NOT NULL,
	`category_id` integer,
	`definition` text NOT NULL,
	`data_source_config` text,
	`parameters_schema` text,
	`version` integer DEFAULT 1 NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`thumbnail` text,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_by` integer,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `report_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_templates_code_unique` ON `report_templates` (`code`);--> statement-breakpoint
CREATE TABLE `sales_order_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`so_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`lot_id` integer,
	`quantity` real NOT NULL,
	`shipped_quantity` real DEFAULT 0 NOT NULL,
	`unit` text NOT NULL,
	`unit_price` real NOT NULL,
	`total_price` real NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`so_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`so_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_contact` text,
	`customer_address` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`order_date` text,
	`required_date` text,
	`shipped_date` text,
	`total_amount` real,
	`currency` text DEFAULT 'THB' NOT NULL,
	`payment_terms` text,
	`notes` text,
	`created_by` integer,
	`approved_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_orders_so_number_unique` ON `sales_orders` (`so_number`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`description` text,
	`category` text,
	`updated_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`department` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vmi_order_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vmi_order_id` integer NOT NULL,
	`item_id` integer,
	`local_code` text NOT NULL,
	`item_name` text NOT NULL,
	`quantity_ordered` real NOT NULL,
	`quantity_received` real DEFAULT 0 NOT NULL,
	`unit_price` real NOT NULL,
	`line_total` real NOT NULL,
	`unit` text NOT NULL,
	`tpp_code` text,
	`ttmt_code` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`vmi_order_id`) REFERENCES `vmi_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vmi_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`vmi_order_id` integer NOT NULL,
	`hospital_code` text NOT NULL,
	`hospital_name` text NOT NULL,
	`po_number` text NOT NULL,
	`warehouse_name` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`order_date` text NOT NULL,
	`expected_delivery_date` text,
	`total_value` real NOT NULL,
	`item_count` integer NOT NULL,
	`notes` text,
	`local_po_id` integer,
	`confirmed_at` text,
	`shipped_at` text,
	`received_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`local_po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vmi_price_offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`unit_price` real NOT NULL,
	`pack_price` real,
	`moq` integer,
	`lead_time_days` integer,
	`effective_date` text NOT NULL,
	`expiry_date` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_synced_at` text,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`sync_error` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vmi_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`transaction_type` text NOT NULL,
	`item_id` integer,
	`quantity` real,
	`unit` text,
	`data` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`request_payload` text,
	`response_payload` text,
	`http_status` integer,
	`duration_ms` integer,
	`endpoint` text,
	`method` text,
	`sent_at` text,
	`received_at` text,
	`error_message` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vmi_vendor_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`api_key_encrypted` text NOT NULL,
	`vmi_vendor_id` text,
	`base_url` text,
	`is_connected` integer DEFAULT false NOT NULL,
	`last_connection_at` text,
	`sync_items_enabled` integer DEFAULT true NOT NULL,
	`sync_prices_enabled` integer DEFAULT true NOT NULL,
	`sync_inventory_enabled` integer DEFAULT true NOT NULL,
	`order_poll_interval_minutes` integer DEFAULT 15 NOT NULL,
	`last_items_sync_at` text,
	`last_prices_sync_at` text,
	`last_inventory_sync_at` text,
	`last_orders_poll_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vmi_vendor_config_vendor_id_unique` ON `vmi_vendor_config` (`vendor_id`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact_person` text,
	`phone` text,
	`email` text,
	`address` text,
	`tax_id` text,
	`is_approved` integer DEFAULT false NOT NULL,
	`is_vmi` integer DEFAULT false NOT NULL,
	`lead_time_days` integer,
	`payment_terms` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_code_unique` ON `vendors` (`code`);--> statement-breakpoint
CREATE TABLE `warehouse_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`warehouse_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text,
	`zone` text,
	`rack` text,
	`shelf` text,
	`bin` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`location` text,
	`temperature_min` real,
	`temperature_max` real,
	`humidity_min` real,
	`humidity_max` real,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warehouses_code_unique` ON `warehouses` (`code`);--> statement-breakpoint
CREATE TABLE `work_order_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`lot_id` integer,
	`planned_quantity` real NOT NULL,
	`actual_quantity` real,
	`unit` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`issued_by` integer,
	`issued_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wo_number` text NOT NULL,
	`bom_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`batch_number` text NOT NULL,
	`planned_quantity` real NOT NULL,
	`actual_quantity` real,
	`unit` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`priority` integer DEFAULT 5 NOT NULL,
	`planned_start_date` text,
	`planned_end_date` text,
	`actual_start_date` text,
	`actual_end_date` text,
	`yield_percentage` real,
	`notes` text,
	`created_by` integer,
	`approved_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_orders_wo_number_unique` ON `work_orders` (`wo_number`);