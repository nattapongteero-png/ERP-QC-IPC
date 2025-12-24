CREATE TABLE `attachments` (
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
	`uploaded_at` text DEFAULT '2025-12-24T06:03:34.719Z' NOT NULL,
	`updated_at` text DEFAULT '2025-12-24T06:03:34.719Z' NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_findings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_id` integer NOT NULL,
	`finding_number` text,
	`category` text NOT NULL,
	`gmp_chapter` integer,
	`gmp_requirement` text,
	`description` text NOT NULL,
	`evidence` text,
	`area_owner` integer,
	`capa_required` integer DEFAULT false,
	`capa_id` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`closed_date` text,
	`closed_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_owner`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`capa_id`) REFERENCES `capa`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_year` integer NOT NULL,
	`name` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`approved_by` integer,
	`approved_at` text,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_number` text NOT NULL,
	`plan_id` integer,
	`audit_type` text NOT NULL,
	`scope` text,
	`gmp_chapters` text,
	`scheduled_date` text,
	`actual_date` text,
	`lead_auditor_id` integer,
	`audit_team` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`summary` text,
	`report_path` text,
	`closed_date` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `audit_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_auditor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audits_audit_number_unique` ON `audits` (`audit_number`);--> statement-breakpoint
CREATE TABLE `capa` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`capa_number` text NOT NULL,
	`title` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` integer,
	`deviation_id` integer,
	`complaint_id` integer,
	`audit_finding_id` integer,
	`type` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`root_cause_analysis` text,
	`root_cause_category` text,
	`due_date` text,
	`closed_date` text,
	`owner_id` integer,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`risk_severity` text,
	`risk_probability` text,
	`risk_score` integer,
	`risk_justification` text,
	`impact_scope` text,
	`affected_products` text,
	`affected_batches` text,
	`affected_processes` text,
	`patient_impact` integer DEFAULT false,
	`regulatory_notification_required` integer DEFAULT false,
	`regulatory_notification_date` text,
	`regulatory_reference_number` text,
	`approval_status` text,
	`submitted_for_approval_at` text,
	`submitted_for_approval_by` integer,
	`current_approval_step` text,
	`closure_notes` text,
	FOREIGN KEY (`deviation_id`) REFERENCES `deviations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_for_approval_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `capa_capa_number_unique` ON `capa` (`capa_number`);--> statement-breakpoint
CREATE TABLE `capa_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`capa_id` integer NOT NULL,
	`action_number` integer NOT NULL,
	`description` text NOT NULL,
	`action_type` text NOT NULL,
	`assignee_id` integer,
	`due_date` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`completion_notes` text,
	`completed_at` text,
	`verified_by` integer,
	`verified_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`capa_id`) REFERENCES `capa`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `capa_approvals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`capa_id` integer NOT NULL,
	`approver_role` text NOT NULL,
	`approver_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`comments` text,
	`signed_at` text,
	`signature_hash` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`capa_id`) REFERENCES `capa`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `capa_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`capa_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`original_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`attachment_type` text NOT NULL,
	`description` text,
	`uploaded_by` integer NOT NULL,
	`uploaded_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`capa_id`) REFERENCES `capa`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `capa_effectiveness` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`capa_id` integer NOT NULL,
	`check_number` integer NOT NULL,
	`check_date` text,
	`verifier_id` integer,
	`criteria` text,
	`result` text,
	`evidence` text,
	`follow_up_required` integer DEFAULT false,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`capa_id`) REFERENCES `capa`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verifier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `change_approvals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`change_id` integer NOT NULL,
	`approver_id` integer,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`comments` text,
	`signed_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`change_id`) REFERENCES `change_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `change_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`change_number` text NOT NULL,
	`title` text NOT NULL,
	`change_type` text NOT NULL,
	`description` text,
	`justification` text,
	`impact_assessment` text,
	`risk_assessment` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`requester_id` integer,
	`owner_id` integer,
	`target_date` text,
	`implemented_date` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `change_requests_change_number_unique` ON `change_requests` (`change_number`);--> statement-breakpoint
CREATE TABLE `complaint_investigations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`complaint_id` integer NOT NULL,
	`investigator_id` integer,
	`start_date` text,
	`completion_date` text,
	`batch_record_review` text,
	`retain_sample_test` text,
	`root_cause` text,
	`conclusion` text,
	`recommendation` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`complaint_id`) REFERENCES `complaints`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`investigator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `complaints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`complaint_number` text NOT NULL,
	`received_date` text NOT NULL,
	`source` text NOT NULL,
	`customer_name` text,
	`customer_contact` text,
	`product_id` integer,
	`lot_id` integer,
	`category` text NOT NULL,
	`severity` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`regulatory_report_required` integer DEFAULT false,
	`regulatory_report_date` text,
	`capa_id` integer,
	`recall_required` integer DEFAULT false,
	`recall_id` integer,
	`closed_date` text,
	`closed_by` integer,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`capa_id`) REFERENCES `capa`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `complaints_complaint_number_unique` ON `complaints` (`complaint_number`);--> statement-breakpoint
CREATE TABLE `contract_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contract_id` integer NOT NULL,
	`lot_id` integer,
	`activity_type` text NOT NULL,
	`activity_description` text,
	`performed_date` text,
	`certificate_path` text,
	`verified_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `manufacturing_contracts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `document_approvals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version_id` integer NOT NULL,
	`approver_id` integer,
	`approval_role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`comments` text,
	`signed_at` text,
	`delegated_from` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `document_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`delegated_from`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `document_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text,
	`approval_chain` text,
	`review_period_months` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_types_code_unique` ON `document_types` (`code`);--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`version_number` text NOT NULL,
	`content` text,
	`file_path` text,
	`file_data` blob,
	`file_name` text,
	`file_size` integer,
	`mime_type` text,
	`change_description` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`effective_date` text,
	`obsolete_date` text,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_number` text NOT NULL,
	`title` text NOT NULL,
	`type_id` integer,
	`department_id` integer,
	`current_version_id` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`retention_years` integer DEFAULT 7 NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`type_id`) REFERENCES `document_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `hr_org_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_document_number_unique` ON `documents` (`document_number`);--> statement-breakpoint
CREATE TABLE `electronic_signatures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`action` text NOT NULL,
	`user_id` integer NOT NULL,
	`username` text NOT NULL,
	`full_name` text NOT NULL,
	`title` text,
	`signed_at` text NOT NULL,
	`meaning` text NOT NULL,
	`password_verified` integer DEFAULT false NOT NULL,
	`signature_hash` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hr_app_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`module` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hr_app_permissions_code_unique` ON `hr_app_permissions` (`code`);--> statement-breakpoint
CREATE TABLE `hr_app_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_system_role` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hr_app_roles_code_unique` ON `hr_app_roles` (`code`);--> statement-breakpoint
CREATE TABLE `hr_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` integer NOT NULL,
	`old_value` text,
	`new_value` text,
	`ip_address` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hr_authorizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`auth_type` text NOT NULL,
	`scope_site_id` integer,
	`scope_org_unit_id` integer,
	`scope_product_lines` text,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`granted_by` integer NOT NULL,
	`granted_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`revoked_by` integer,
	`revoked_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scope_org_unit_id`) REFERENCES `hr_org_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hr_delegations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`authorization_id` integer NOT NULL,
	`delegator_id` integer NOT NULL,
	`delegate_id` integer NOT NULL,
	`reason` text,
	`effective_from` text NOT NULL,
	`effective_to` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`authorization_id`) REFERENCES `hr_authorizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`delegator_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`delegate_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hr_employee_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`position_id` integer,
	`org_unit_id` integer,
	`is_primary` integer DEFAULT false NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`reason` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`position_id`) REFERENCES `hr_positions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`org_unit_id`) REFERENCES `hr_org_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hr_employee_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`scope_site_id` integer,
	`scope_org_unit_id` integer,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`assigned_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `hr_app_roles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scope_org_unit_id`) REFERENCES `hr_org_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hr_employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`employee_code` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`first_name_en` text,
	`last_name_en` text,
	`nickname` text,
	`email` text,
	`phone` text,
	`thai_cid` text,
	`thai_cid_hash` text,
	`date_of_birth` text,
	`gender` text,
	`blood_type` text,
	`religion` text,
	`marital_status` text,
	`nationality_code` text DEFAULT 'TH',
	`photo_url` text,
	`photo_thumbnail_url` text,
	`sso_number` text,
	`tax_id` text,
	`address_line1` text,
	`address_line2` text,
	`sub_district` text,
	`district` text,
	`province` text,
	`postal_code` text,
	`permanent_address_line1` text,
	`permanent_address_line2` text,
	`permanent_sub_district` text,
	`permanent_district` text,
	`permanent_province` text,
	`permanent_postal_code` text,
	`use_same_address` integer DEFAULT false,
	`emergency_contact_name` text,
	`emergency_contact_relation` text,
	`emergency_contact_phone` text,
	`bank_name` text,
	`bank_branch` text,
	`bank_account_number` text,
	`bank_account_name` text,
	`education_level` text,
	`education_field` text,
	`education_institution` text,
	`military_status` text,
	`medical_notes` text,
	`position_id` integer,
	`org_unit_id` integer,
	`site_id` integer,
	`hire_date` text NOT NULL,
	`termination_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`position_id`) REFERENCES `hr_positions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`org_unit_id`) REFERENCES `hr_org_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hr_employees_employee_code_unique` ON `hr_employees` (`employee_code`);--> statement-breakpoint
CREATE TABLE `hr_health_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`examination_type` text NOT NULL,
	`examination_date` text NOT NULL,
	`next_exam_due` text,
	`fitness_status` text NOT NULL,
	`restrictions` text,
	`affected_areas` text,
	`medical_details` text,
	`examiner_name` text,
	`examiner_notes` text,
	`recorded_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hr_job_descriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`position_id` integer NOT NULL,
	`version` text NOT NULL,
	`responsibilities` text,
	`authorities` text,
	`qualifications` text,
	`document_path` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`effective_from` text,
	`effective_to` text,
	`approved_by` integer,
	`approved_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`position_id`) REFERENCES `hr_positions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hr_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text,
	`reference_type` text,
	`reference_id` integer,
	`is_read` integer DEFAULT false NOT NULL,
	`read_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hr_org_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`type` text NOT NULL,
	`parent_id` integer,
	`site_id` integer,
	`is_gmp_critical` integer DEFAULT false NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hr_org_units_code_unique` ON `hr_org_units` (`code`);--> statement-breakpoint
CREATE TABLE `hr_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`title_en` text,
	`org_unit_id` integer NOT NULL,
	`job_grade` text,
	`is_gmp_critical` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`org_unit_id`) REFERENCES `hr_org_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hr_positions_code_unique` ON `hr_positions` (`code`);--> statement-breakpoint
CREATE TABLE `hr_role_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role_id` integer NOT NULL,
	`permission_id` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `hr_app_roles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`permission_id`) REFERENCES `hr_app_permissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hr_training_courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`description` text,
	`category` text,
	`validity_days` integer,
	`is_mandatory` integer DEFAULT false NOT NULL,
	`target_positions` text,
	`target_roles` text,
	`duration_hours` real,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hr_training_courses_code_unique` ON `hr_training_courses` (`code`);--> statement-breakpoint
CREATE TABLE `hr_training_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`session_id` integer,
	`course_id` integer NOT NULL,
	`completion_date` text NOT NULL,
	`expiry_date` text,
	`result` text NOT NULL,
	`score` real,
	`assessed_by` integer,
	`certificate_number` text,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `hr_training_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `hr_training_courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assessed_by`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hr_training_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`session_date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`location` text,
	`instructor_id` integer,
	`instructor_external` text,
	`max_participants` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `hr_training_courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `hr_employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `item_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`image_data` blob NOT NULL,
	`thumbnail_data` blob,
	`is_primary` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`description` text,
	`uploaded_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `label_verifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`batch_record_id` integer,
	`label_type` text NOT NULL,
	`image_attachment_id` integer,
	`product_name` text,
	`batch_number` text,
	`expiry_date` text,
	`is_correct` integer,
	`operator_id` integer,
	`operator_signature_id` integer,
	`witness_id` integer,
	`witness_signature_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`rejection_reason` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`verified_at` text,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_record_id`) REFERENCES `batch_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_attachment_id`) REFERENCES `attachments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_signature_id`) REFERENCES `electronic_signatures`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`witness_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`witness_signature_id`) REFERENCES `electronic_signatures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `line_clearance_checklists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_order_id` integer NOT NULL,
	`previous_product_cleared` integer DEFAULT false,
	`area_clean` integer DEFAULT false,
	`equipment_clean` integer DEFAULT false,
	`no_contamination_risk` integer DEFAULT false,
	`labels_removed` integer DEFAULT false,
	`docs_ready` integer DEFAULT false,
	`performed_by` integer,
	`performed_at` text,
	`performed_signature_id` integer,
	`verified_by` integer,
	`verified_at` text,
	`verified_signature_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_signature_id`) REFERENCES `electronic_signatures`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_signature_id`) REFERENCES `electronic_signatures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `manufacturing_contracts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contract_number` text NOT NULL,
	`contractor_name` text NOT NULL,
	`contractor_type` text NOT NULL,
	`scope` text,
	`effective_date` text,
	`expiration_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`quality_agreement_path` text,
	`last_audit_date` text,
	`next_audit_due` text,
	`contact_person` text,
	`contact_email` text,
	`contact_phone` text,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manufacturing_contracts_contract_number_unique` ON `manufacturing_contracts` (`contract_number`);--> statement-breakpoint
CREATE TABLE `pest_control_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service_date` text NOT NULL,
	`contractor_name` text,
	`technician_name` text,
	`service_type` text NOT NULL,
	`areas_serviced` text,
	`treatment_method` text,
	`findings_count` integer DEFAULT 0,
	`findings` text,
	`recommendations` text,
	`follow_up_required` integer DEFAULT false,
	`follow_up_date` text,
	`verified_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pqr_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pqr_id` integer NOT NULL,
	`metric_type` text,
	`metric_value` real,
	`target` real,
	`status` text,
	`details` text,
	`calculated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`pqr_id`) REFERENCES `pqr_reports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pqr_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_number` text NOT NULL,
	`product_id` integer,
	`review_year` integer NOT NULL,
	`period_start` text,
	`period_end` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`batches_produced` integer DEFAULT 0,
	`deviation_count` integer DEFAULT 0,
	`capa_count` integer DEFAULT 0,
	`complaint_count` integer DEFAULT 0,
	`oos_count` integer DEFAULT 0,
	`recall_count` integer DEFAULT 0,
	`stability_status` text,
	`conclusions` text,
	`recommendations` text,
	`approved_by` integer,
	`approved_at` text,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pqr_reports_report_number_unique` ON `pqr_reports` (`report_number`);--> statement-breakpoint
CREATE TABLE `recall_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recall_id` integer NOT NULL,
	`customer_id` integer,
	`customer_name` text,
	`contact_info` text,
	`quantity_distributed` real DEFAULT 0,
	`notification_method` text,
	`notified_at` text,
	`acknowledged_at` text,
	`response_status` text DEFAULT 'pending',
	`quantity_returned` real DEFAULT 0,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`recall_id`) REFERENCES `recalls`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recall_reconciliation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recall_id` integer NOT NULL,
	`lot_id` integer,
	`distributed_qty` real DEFAULT 0,
	`returned_qty` real DEFAULT 0,
	`destroyed_qty` real DEFAULT 0,
	`accounted_qty` real DEFAULT 0,
	`unaccounted_qty` real DEFAULT 0,
	`reconciliation_notes` text,
	`verified_by` integer,
	`verified_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`recall_id`) REFERENCES `recalls`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recalls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recall_number` text NOT NULL,
	`initiated_date` text NOT NULL,
	`recall_class` text NOT NULL,
	`reason` text NOT NULL,
	`product_id` integer,
	`affected_lots` text,
	`status` text DEFAULT 'initiated' NOT NULL,
	`distributed_quantity` real DEFAULT 0,
	`returned_quantity` real DEFAULT 0,
	`reconciled_quantity` real DEFAULT 0,
	`effectiveness_rate` real DEFAULT 0,
	`regulatory_report_date` text,
	`closure_date` text,
	`coordinator_id` integer,
	`complaint_id` integer,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`coordinator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`complaint_id`) REFERENCES `complaints`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recalls_recall_number_unique` ON `recalls` (`recall_number`);--> statement-breakpoint
CREATE TABLE `sanitation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`schedule_id` integer,
	`scheduled_date` text,
	`performed_date` text,
	`performed_by` integer,
	`method` text,
	`chemicals_used` text,
	`status` text NOT NULL,
	`verified_by` integer,
	`verified_at` text,
	`deviation_id` integer,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `sanitation_schedules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deviation_id`) REFERENCES `deviations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sanitation_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`area_type` text NOT NULL,
	`area_id` integer,
	`equipment_id` integer,
	`frequency` text NOT NULL,
	`day_of_week` integer,
	`day_of_month` integer,
	`method` text,
	`verification_required` integer DEFAULT true,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stability_protocols` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`protocol_number` text NOT NULL,
	`name` text NOT NULL,
	`product_id` integer,
	`study_type` text NOT NULL,
	`storage_condition` text,
	`timepoints` text,
	`tests_required` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`approved_by` integer,
	`approved_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stability_protocols_protocol_number_unique` ON `stability_protocols` (`protocol_number`);--> statement-breakpoint
CREATE TABLE `stability_samples` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`study_id` integer NOT NULL,
	`sample_number` text,
	`timepoint` integer NOT NULL,
	`scheduled_date` text,
	`actual_date` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`quality_test_id` integer,
	`oos_detected` integer DEFAULT false,
	`oos_investigation_id` integer,
	`sampled_by` integer,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `stability_studies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quality_test_id`) REFERENCES `quality_tests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`oos_investigation_id`) REFERENCES `deviations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sampled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stability_studies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`study_number` text NOT NULL,
	`protocol_id` integer,
	`lot_id` integer,
	`start_date` text NOT NULL,
	`end_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`chamber_location` text,
	`notes` text,
	`created_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`protocol_id`) REFERENCES `stability_protocols`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stability_studies_study_number_unique` ON `stability_studies` (`study_number`);--> statement-breakpoint
CREATE TABLE `stability_trends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`study_id` integer NOT NULL,
	`test_parameter` text,
	`data_points` text,
	`trend_slope` real,
	`projected_failure_month` integer,
	`last_updated` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`study_id`) REFERENCES `stability_studies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stock_alert_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer,
	`warehouse_id` integer,
	`alert_type` text NOT NULL,
	`threshold` real NOT NULL,
	`warning_days` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`notify_emails` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vmi_portal_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`portal_url` text NOT NULL,
	`api_key_encrypted` text NOT NULL,
	`vendor_id` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`sync_inventory_enabled` integer DEFAULT true NOT NULL,
	`sync_inventory_interval` integer DEFAULT 60 NOT NULL,
	`sync_items_enabled` integer DEFAULT true NOT NULL,
	`sync_items_interval` integer DEFAULT 1440 NOT NULL,
	`sync_prices_enabled` integer DEFAULT true NOT NULL,
	`sync_prices_interval` integer DEFAULT 1440 NOT NULL,
	`order_polling_enabled` integer DEFAULT true NOT NULL,
	`order_polling_interval` integer DEFAULT 15 NOT NULL,
	`last_inventory_sync_at` text,
	`last_items_sync_at` text,
	`last_prices_sync_at` text,
	`last_orders_poll_at` text,
	`connection_status` text DEFAULT 'disconnected' NOT NULL,
	`last_error_message` text,
	`created_by` integer,
	`updated_by` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vmi_portal_config_name_unique` ON `vmi_portal_config` (`name`);--> statement-breakpoint
CREATE TABLE `vmi_sales_order_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vmi_sales_order_id` integer NOT NULL,
	`item_id` integer,
	`vmi_line_id` text NOT NULL,
	`tpp_code` text,
	`ttmt_code` text,
	`local_code` text,
	`item_name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`unit_price` real NOT NULL,
	`line_total` real NOT NULL,
	`match_status` text DEFAULT 'unmatched' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`vmi_sales_order_id`) REFERENCES `vmi_sales_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vmi_sales_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portal_id` integer NOT NULL,
	`vmi_order_id` text NOT NULL,
	`sales_order_id` integer,
	`customer_id` integer,
	`vmi_status` text NOT NULL,
	`local_status` text DEFAULT 'pending' NOT NULL,
	`vmi_customer_id` text NOT NULL,
	`vmi_customer_name` text NOT NULL,
	`order_date` text NOT NULL,
	`required_date` text,
	`total_amount` real NOT NULL,
	`currency` text DEFAULT 'THB' NOT NULL,
	`order_data_json` text NOT NULL,
	`polled_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`confirmed_at` text,
	`shipped_at` text,
	`delivered_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`portal_id`) REFERENCES `vmi_portal_config`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vmi_sync_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portal_id` integer NOT NULL,
	`sync_type` text NOT NULL,
	`trigger_type` text NOT NULL,
	`status` text NOT NULL,
	`items_total` integer DEFAULT 0 NOT NULL,
	`items_processed` integer DEFAULT 0 NOT NULL,
	`items_failed` integer DEFAULT 0 NOT NULL,
	`error_details` text,
	`triggered_by` integer,
	`started_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`portal_id`) REFERENCES `vmi_portal_config`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`triggered_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_deviations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deviation_number` text NOT NULL,
	`title` text,
	`description` text NOT NULL,
	`type` text,
	`source_type` text,
	`source_id` integer,
	`lot_id` integer,
	`work_order_id` integer,
	`severity` text DEFAULT 'minor' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`root_cause` text,
	`corrective_action` text,
	`preventive_action` text,
	`reported_by` integer,
	`reported_at` text,
	`responsible_person` integer,
	`assigned_to` integer,
	`due_date` text,
	`closed_by` integer,
	`closed_at` text,
	`closure_notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`responsible_person`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_deviations`("id", "deviation_number", "title", "description", "type", "source_type", "source_id", "lot_id", "work_order_id", "severity", "status", "root_cause", "corrective_action", "preventive_action", "reported_by", "reported_at", "responsible_person", "assigned_to", "due_date", "closed_by", "closed_at", "closure_notes", "created_at", "updated_at") SELECT "id", "deviation_number", "title", "description", "type", "source_type", "source_id", "lot_id", "work_order_id", "severity", "status", "root_cause", "corrective_action", "preventive_action", "reported_by", "reported_at", "responsible_person", "assigned_to", "due_date", "closed_by", "closed_at", "closure_notes", "created_at", "updated_at" FROM `deviations`;--> statement-breakpoint
DROP TABLE `deviations`;--> statement-breakpoint
ALTER TABLE `__new_deviations` RENAME TO `deviations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `deviations_deviation_number_unique` ON `deviations` (`deviation_number`);--> statement-breakpoint
CREATE TABLE `__new_quality_tests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lot_id` integer NOT NULL,
	`spec_id` integer,
	`test_type` text NOT NULL,
	`sample_number` text,
	`sample_size` integer,
	`test_date` text,
	`result` text,
	`numeric_result` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` integer,
	`requested_at` text,
	`tested_by` integer,
	`approved_by` integer,
	`approved_at` text,
	`notes` text,
	`disposition` text,
	`disposition_by` integer,
	`disposition_at` text,
	`disposition_reason` text,
	`disposition_approved_by` integer,
	`disposition_approved_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spec_id`) REFERENCES `quality_specs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`disposition_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`disposition_approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_quality_tests`("id", "lot_id", "spec_id", "test_type", "sample_number", "sample_size", "test_date", "result", "numeric_result", "status", "requested_by", "requested_at", "tested_by", "approved_by", "approved_at", "notes", "disposition", "disposition_by", "disposition_at", "disposition_reason", "disposition_approved_by", "disposition_approved_at", "created_at", "updated_at") SELECT "id", "lot_id", "spec_id", "test_type", "sample_number", "sample_size", "test_date", "result", "numeric_result", "status", "requested_by", "requested_at", "tested_by", "approved_by", "approved_at", "notes", "disposition", "disposition_by", "disposition_at", "disposition_reason", "disposition_approved_by", "disposition_approved_at", "created_at", "updated_at" FROM `quality_tests`;--> statement-breakpoint
DROP TABLE `quality_tests`;--> statement-breakpoint
ALTER TABLE `__new_quality_tests` RENAME TO `quality_tests`;--> statement-breakpoint
ALTER TABLE `bom` ADD `theoretical_yield` real;--> statement-breakpoint
ALTER TABLE `bom_lines` ADD `percentage_in_formula` real;--> statement-breakpoint
ALTER TABLE `bom_lines` ADD `weighed_qty` real;--> statement-breakpoint
ALTER TABLE `bom_lines` ADD `weighed_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `bom_lines` ADD `verified_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `bom_lines` ADD `verified_at` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `vmi_customer_id` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `vmi_portal_id` integer;--> statement-breakpoint
ALTER TABLE `equipment` ADD `cleaning_status` text DEFAULT 'clean';--> statement-breakpoint
ALTER TABLE `inventory_lots` ADD `manufacturer_name` text;--> statement-breakpoint
ALTER TABLE `inventory_lots` ADD `manufacturer_id` integer REFERENCES vendors(id);--> statement-breakpoint
ALTER TABLE `inventory_lots` ADD `importer_name` text;--> statement-breakpoint
ALTER TABLE `inventory_lots` ADD `importer_id` integer REFERENCES vendors(id);--> statement-breakpoint
ALTER TABLE `inventory_lots` ADD `country_of_origin` text;--> statement-breakpoint
ALTER TABLE `inventory_lots` ADD `retest_date` text;--> statement-breakpoint
ALTER TABLE `inventory_lots` ADD `retest_interval_months` integer;--> statement-breakpoint
ALTER TABLE `inventory_lots` ADD `last_retest_date` text;--> statement-breakpoint
ALTER TABLE `inventory_lots` ADD `retest_status` text;--> statement-breakpoint
ALTER TABLE `items` ADD `quarantine_qty` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `tpp_name` text;--> statement-breakpoint
ALTER TABLE `items` ADD `ttmt_name` text;--> statement-breakpoint
ALTER TABLE `items` ADD `vmi_sync_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `last_vmi_sync_at` text;--> statement-breakpoint
ALTER TABLE `items` ADD `strength` text;--> statement-breakpoint
ALTER TABLE `sales_order_lines` ADD `allocated_quantity` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `vmi_sales_order_id` integer;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `source` text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouses` ADD `capacity` real;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `line_clearance_required` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `line_clearance_status` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `line_clearance_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `work_orders` ADD `line_clearance_at` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `line_clearance_checklist_id` integer;