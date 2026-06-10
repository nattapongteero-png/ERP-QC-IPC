-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: herbal_erp_uat
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `material_withdrawal_requests`
--

DROP TABLE IF EXISTS `material_withdrawal_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_withdrawal_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `work_order_id` int NOT NULL,
  `factory_code` varchar(40) DEFAULT NULL,
  `requested_by_user_id` int NOT NULL,
  `requested_at` datetime NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `reason_type` varchar(40) NOT NULL,
  `reason_detail` text,
  `machine_phase` varchar(80) DEFAULT NULL,
  `room_id` int NOT NULL,
  `cancelled_reason` text,
  `payload_hash` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_withdrawal_requests`
--

LOCK TABLES `material_withdrawal_requests` WRITE;
/*!40000 ALTER TABLE `material_withdrawal_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `material_withdrawal_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_withdrawal_request_items`
--

DROP TABLE IF EXISTS `material_withdrawal_request_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_withdrawal_request_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `material_id` int NOT NULL,
  `quantity_requested` decimal(18,4) NOT NULL,
  `quantity_approved` decimal(18,4) DEFAULT NULL,
  `unit` varchar(20) NOT NULL,
  `bom_planned_quantity` decimal(18,4) NOT NULL,
  `cumulative_extra_after_approve` decimal(18,4) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_withdrawal_request_items`
--

LOCK TABLES `material_withdrawal_request_items` WRITE;
/*!40000 ALTER TABLE `material_withdrawal_request_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `material_withdrawal_request_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_withdrawal_approvals`
--

DROP TABLE IF EXISTS `material_withdrawal_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_withdrawal_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `approver_user_id` int NOT NULL,
  `action` varchar(10) NOT NULL,
  `action_at` datetime NOT NULL,
  `reason` text,
  `comment` text,
  `signature_id` int NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_id` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_withdrawal_approvals`
--

LOCK TABLES `material_withdrawal_approvals` WRITE;
/*!40000 ALTER TABLE `material_withdrawal_approvals` DISABLE KEYS */;
/*!40000 ALTER TABLE `material_withdrawal_approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_withdrawal_attachments`
--

DROP TABLE IF EXISTS `material_withdrawal_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_withdrawal_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `file_url` varchar(500) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `mime_type` varchar(80) NOT NULL,
  `size_bytes` int NOT NULL,
  `uploaded_by_user_id` int NOT NULL,
  `uploaded_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_withdrawal_attachments`
--

LOCK TABLES `material_withdrawal_attachments` WRITE;
/*!40000 ALTER TABLE `material_withdrawal_attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `material_withdrawal_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_returns`
--

DROP TABLE IF EXISTS `material_returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_returns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `return_number` varchar(30) NOT NULL,
  `work_order_id` int DEFAULT NULL,
  `return_date` datetime NOT NULL,
  `returned_by` int NOT NULL,
  `receiving_warehouse_id` int NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_reason` text,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `return_number` (`return_number`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_returns`
--

LOCK TABLES `material_returns` WRITE;
/*!40000 ALTER TABLE `material_returns` DISABLE KEYS */;
INSERT INTO `material_returns` VALUES (1,'RET-2026-001',3,'2026-06-03 18:39:14',1,1,'received',1,'2026-06-07 15:42:25',NULL,'คืนวัตถุดิบเหลือจากการผลิต batch B25690004','2026-06-03 18:39:14','2026-06-07 15:42:25'),(2,'RET-2026-002',3,'2026-06-01 18:39:14',1,1,'received',1,'2026-06-02 18:39:14',NULL,'อนุมัติคืน RM-004 เหลือจากการผลิต','2026-06-01 18:39:14','2026-06-03 18:39:14'),(3,'RET-2026-003',3,'2026-05-29 18:39:14',1,4,'rejected',1,'2026-05-30 18:39:14','พบสิ่งปนเปื้อน — ส่งไปคลังปฏิเสธ ห้ามใช้ซ้ำ','พบเศษโลหะปนใน batch','2026-05-29 18:39:14','2026-06-03 18:39:14'),(4,'RET-2026-000004',13,'2026-06-10 01:23:37',1,1,'submitted',NULL,NULL,NULL,NULL,'2026-06-10 01:23:37','2026-06-10 01:23:37');
/*!40000 ALTER TABLE `material_returns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_return_lines`
--

DROP TABLE IF EXISTS `material_return_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_return_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `return_id` int NOT NULL,
  `source_lot_id` int NOT NULL,
  `item_id` int NOT NULL,
  `issued_qty` decimal(15,4) NOT NULL,
  `issued_unit` varchar(20) NOT NULL,
  `used_qty` decimal(15,4) NOT NULL,
  `used_unit` varchar(20) NOT NULL,
  `return_qty` decimal(15,4) NOT NULL,
  `return_unit` varchar(20) NOT NULL,
  `returned_lot_id` int DEFAULT NULL,
  `return_container_label` varchar(50) DEFAULT NULL,
  `return_container_type` varchar(50) DEFAULT NULL,
  `expected_variance_qty` decimal(15,4) DEFAULT NULL,
  `variance_qty` decimal(15,4) NOT NULL,
  `variance_pct` decimal(8,4) NOT NULL,
  `variance_reason` varchar(30) NOT NULL,
  `variance_explanation` text,
  `is_outside_tolerance` tinyint(1) NOT NULL DEFAULT '0',
  `deviation_id` int DEFAULT NULL,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_return_lines`
--

LOCK TABLES `material_return_lines` WRITE;
/*!40000 ALTER TABLE `material_return_lines` DISABLE KEYS */;
INSERT INTO `material_return_lines` VALUES (1,1,22,29,4.0000,'kg',3.5000,'kg',0.5000,'kg',138,NULL,NULL,NULL,0.0000,0.0000,'process_loss','เหลือจากการชั่งให้พอดี',0,NULL,NULL,'2026-06-03 18:39:14','2026-06-07 15:42:25'),(2,1,23,30,1.0000,'kg',0.8500,'kg',0.1500,'kg',139,NULL,NULL,NULL,0.0000,0.0000,'sampling','หักเก็บ retain sample 150g',0,NULL,NULL,'2026-06-03 18:39:14','2026-06-07 15:42:25'),(3,2,46,4,25.0000,'kg',23.0000,'kg',2.0000,'kg',NULL,NULL,NULL,NULL,0.0000,0.0000,'process_loss','เหลือจาก batch — สภาพปกติ',0,NULL,NULL,'2026-06-03 18:39:14','2026-06-03 18:39:14'),(4,3,22,29,4.0000,'kg',2.0000,'kg',2.0000,'kg',NULL,NULL,NULL,NULL,0.5000,12.5000,'other','พบเศษโลหะปน — reject',1,NULL,NULL,'2026-06-03 18:39:14','2026-06-03 18:39:14'),(5,4,19,26,24000.0000,'g',20000.0000,'g',4000.0000,'g',NULL,'RTN-2026-598374-A','bag',NULL,0.0000,0.0000,'measurement_error',NULL,0,NULL,NULL,'2026-06-10 01:23:37','2026-06-10 01:23:37');
/*!40000 ALTER TABLE `material_return_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_requisitions`
--

DROP TABLE IF EXISTS `purchase_requisitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_requisitions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pr_number` varchar(20) NOT NULL,
  `requester_id` int NOT NULL,
  `department_id` int DEFAULT NULL,
  `required_date` datetime DEFAULT NULL,
  `priority` varchar(20) NOT NULL DEFAULT 'normal',
  `description` text,
  `justification` text,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_reason` text,
  `notes` text,
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pr_number` (`pr_number`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_requisitions`
--

LOCK TABLES `purchase_requisitions` WRITE;
/*!40000 ALTER TABLE `purchase_requisitions` DISABLE KEYS */;
INSERT INTO `purchase_requisitions` VALUES (1,'PR2026-0001',1,NULL,'2026-06-10 00:00:00','normal','','','draft',28000.00,NULL,NULL,NULL,NULL,1,'2026-06-10 01:30:31','2026-06-10 03:08:09');
/*!40000 ALTER TABLE `purchase_requisitions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_requisition_lines`
--

DROP TABLE IF EXISTS `purchase_requisition_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_requisition_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pr_id` int NOT NULL,
  `line_number` int NOT NULL,
  `item_id` int DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `estimated_price` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `line_total` decimal(15,2) NOT NULL DEFAULT '0.00',
  `preferred_vendor_id` int DEFAULT NULL,
  `notes` text,
  `status` varchar(20) NOT NULL DEFAULT 'open',
  `converted_po_line_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_requisition_lines`
--

LOCK TABLES `purchase_requisition_lines` WRITE;
/*!40000 ALTER TABLE `purchase_requisition_lines` DISABLE KEYS */;
INSERT INTO `purchase_requisition_lines` VALUES (1,1,1,2,'ขิง',1000.0000,'kg',10.0000,10000.00,NULL,NULL,'pending',NULL,'2026-06-10 01:30:31'),(2,1,2,4,'กระชายขาว',1500.0000,'kg',12.0000,18000.00,NULL,NULL,'pending',NULL,'2026-06-10 01:30:31');
/*!40000 ALTER TABLE `purchase_requisition_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goods_receipts`
--

DROP TABLE IF EXISTS `goods_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods_receipts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `grn_number` varchar(20) NOT NULL,
  `source_type` varchar(2) NOT NULL,
  `po_id` int DEFAULT NULL,
  `wo_id` int DEFAULT NULL,
  `vendor_id` int DEFAULT NULL,
  `warehouse_id` int NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'in_progress',
  `receiver_user_id` int NOT NULL,
  `received_date` date NOT NULL,
  `notes` text,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `grn_number` (`grn_number`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goods_receipts`
--

LOCK TABLES `goods_receipts` WRITE;
/*!40000 ALTER TABLE `goods_receipts` DISABLE KEYS */;
INSERT INTO `goods_receipts` VALUES (1,'GRN-2026-00001','po',NULL,NULL,1,1,'in_progress',1,'2026-06-03','รับวัตถุดิบจาก Thai Herb Supply','2026-06-03 17:34:12','2026-06-03 17:34:12'),(2,'GRN-2026-00002','po',NULL,NULL,2,1,'in_progress',1,'2026-06-03','รับวัตถุดิบ Organic Farm','2026-06-03 17:34:12','2026-06-03 17:34:12'),(3,'GRN-2026-00003','po',NULL,NULL,1,1,'released',1,'2026-06-03','ปล่อยใช้งานแล้ว','2026-06-03 17:34:12','2026-06-03 17:34:12'),(4,'GRN-2026-00004','po',NULL,NULL,3,1,'in_progress',1,'2026-05-24','รอตรวจ QC นาน 10 วัน','2026-05-24 17:34:12','2026-06-03 17:34:12'),(9,'GRN-2026-00007','po',1,NULL,1,3,'in_progress',1,'2026-06-03',NULL,'2026-06-03 18:30:08','2026-06-03 18:30:08'),(10,'GRN-2026-00008','po',2,NULL,2,3,'in_progress',1,'2026-06-05',NULL,'2026-06-05 04:09:40','2026-06-05 04:09:40'),(11,'GRN-2026-00009','po',3,NULL,3,3,'in_progress',1,'2026-06-05',NULL,'2026-06-05 04:22:30','2026-06-05 04:22:30');
/*!40000 ALTER TABLE `goods_receipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goods_receipt_lines`
--

DROP TABLE IF EXISTS `goods_receipt_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods_receipt_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `grn_id` int NOT NULL,
  `line_number` int NOT NULL,
  `item_id` int NOT NULL,
  `expected_quantity` decimal(15,4) NOT NULL,
  `actual_quantity` decimal(15,4) DEFAULT NULL,
  `unit` varchar(20) NOT NULL,
  `vendor_lot_number` varchar(50) DEFAULT NULL,
  `batch_number` varchar(50) DEFAULT NULL,
  `manufacturing_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `variance_amount` decimal(15,4) DEFAULT NULL,
  `variance_percent` decimal(6,2) DEFAULT NULL,
  `variance_reason` text,
  `status` varchar(30) NOT NULL DEFAULT 'created',
  `inventory_lot_id` int DEFAULT NULL,
  `qc_sample_id` int DEFAULT NULL,
  `qc_sample_creation_failed` tinyint(1) NOT NULL DEFAULT '0',
  `receiver_signature_id` int DEFAULT NULL,
  `qa_signature_id` int DEFAULT NULL,
  `qa_decision_at` datetime DEFAULT NULL,
  `rejection_reason` text,
  `source_po_line_id` int DEFAULT NULL,
  `source_wo_output_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `sample_quantity` decimal(15,4) DEFAULT NULL,
  `qc_lot_id` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goods_receipt_lines`
--

LOCK TABLES `goods_receipt_lines` WRITE;
/*!40000 ALTER TABLE `goods_receipt_lines` DISABLE KEYS */;
INSERT INTO `goods_receipt_lines` VALUES (1,1,1,1,500.0000,500.0000,'kg','V-LOT-A001','B-RM001-001','2026-05-01','2028-05-01',NULL,NULL,NULL,'created',NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-03 17:34:12','2026-06-03 17:34:12',NULL,NULL),(2,1,2,2,200.0000,200.0000,'kg','V-LOT-A002','B-RM002-001','2026-05-15','2028-05-15',NULL,NULL,NULL,'created',NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-03 17:34:12','2026-06-03 17:34:12',NULL,NULL),(3,2,1,3,300.0000,300.0000,'kg','V-LOT-B001','B-RM003-001','2026-05-10','2028-05-10',NULL,NULL,NULL,'qc_approved',NULL,10,0,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-03 17:34:12','2026-06-03 17:34:12',NULL,NULL),(4,2,2,4,150.0000,150.0000,'kg','V-LOT-B002','B-RM004-001','2026-05-12','2028-05-12',NULL,NULL,NULL,'qc_approved',NULL,11,0,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-03 17:34:12','2026-06-03 17:34:12',NULL,NULL),(5,3,1,5,100.0000,100.0000,'kg','V-LOT-C001','B-EX001-001','2026-04-20','2028-04-20',NULL,NULL,NULL,'released_to_stock',NULL,NULL,0,NULL,NULL,'2026-06-03 17:34:12',NULL,NULL,NULL,'2026-06-03 17:34:12','2026-06-03 17:34:12',NULL,NULL),(6,4,1,6,80.0000,80.0000,'pcs','V-LOT-D001','B-PK001-001','2026-04-15','2030-04-15',NULL,NULL,NULL,'qc_pending',NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-24 17:34:12','2026-06-03 17:34:12',NULL,NULL),(7,5,1,8,1000.0000,980.0000,'bottle',NULL,'BATCH-FG001-008','2026-06-03','2028-06-04',NULL,NULL,NULL,'qc_approved',NULL,12,0,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-03 17:40:58','2026-06-03 17:40:58',NULL,NULL),(8,6,1,9,800.0000,800.0000,'bottle',NULL,'BATCH-FG002-007','2026-06-03','2028-06-04',NULL,NULL,NULL,'released_to_stock',NULL,NULL,0,NULL,NULL,'2026-06-03 17:40:58',NULL,NULL,NULL,'2026-06-03 17:40:58','2026-06-03 17:40:58',NULL,NULL),(9,9,1,1,500.0000,NULL,'kg',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'created',NULL,NULL,0,NULL,NULL,NULL,NULL,1,NULL,'2026-06-03 18:30:08','2026-06-03 18:30:08',NULL,NULL),(10,9,2,2,300.0000,NULL,'kg',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'created',NULL,NULL,0,NULL,NULL,NULL,NULL,2,NULL,'2026-06-03 18:30:08','2026-06-03 18:30:08',NULL,NULL),(11,9,3,3,200.0000,NULL,'kg',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'created',NULL,NULL,0,NULL,NULL,NULL,NULL,3,NULL,'2026-06-03 18:30:08','2026-06-03 18:30:08',NULL,NULL),(12,10,1,4,1000.0000,NULL,'kg',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'created',NULL,NULL,0,NULL,NULL,NULL,NULL,4,NULL,'2026-06-05 04:09:40','2026-06-05 04:09:40',NULL,NULL),(13,10,2,5,500.0000,NULL,'kg',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'created',NULL,NULL,0,NULL,NULL,NULL,NULL,5,NULL,'2026-06-05 04:09:40','2026-06-05 04:09:40',NULL,NULL),(14,11,1,6,60000.0000,NULL,'pcs',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'created',NULL,NULL,0,NULL,NULL,NULL,NULL,6,NULL,'2026-06-05 04:22:30','2026-06-05 04:22:30',NULL,NULL),(15,11,2,7,5000.0000,NULL,'pcs',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'created',NULL,NULL,0,NULL,NULL,NULL,NULL,7,NULL,'2026-06-05 04:22:30','2026-06-05 04:22:30',NULL,NULL),(16,11,3,45,5000.0000,NULL,'pcs',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'created',NULL,NULL,0,NULL,NULL,NULL,NULL,8,NULL,'2026-06-05 04:22:30','2026-06-05 04:22:30',NULL,NULL),(17,11,4,47,5000.0000,NULL,'pcs',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'created',NULL,NULL,0,NULL,NULL,NULL,NULL,9,NULL,'2026-06-05 04:22:30','2026-06-05 04:22:30',NULL,NULL);
/*!40000 ALTER TABLE `goods_receipt_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goods_receipt_checklists`
--

DROP TABLE IF EXISTS `goods_receipt_checklists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods_receipt_checklists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `line_id` int NOT NULL,
  `template_id` int NOT NULL,
  `template_version` int NOT NULL,
  `category` varchar(20) NOT NULL,
  `captured_items_json` json NOT NULL,
  `signed_at` datetime NOT NULL,
  `signature_id` int NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `line_id` (`line_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goods_receipt_checklists`
--

LOCK TABLES `goods_receipt_checklists` WRITE;
/*!40000 ALTER TABLE `goods_receipt_checklists` DISABLE KEYS */;
/*!40000 ALTER TABLE `goods_receipt_checklists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quality_tests`
--

DROP TABLE IF EXISTS `quality_tests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quality_tests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lot_id` int NOT NULL,
  `spec_id` int DEFAULT NULL,
  `test_type` varchar(50) NOT NULL,
  `sample_number` varchar(100) DEFAULT NULL,
  `sample_size` int DEFAULT NULL,
  `test_date` datetime DEFAULT NULL,
  `result` varchar(255) DEFAULT NULL,
  `numeric_result` decimal(15,4) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `requested_by` int DEFAULT NULL,
  `requested_at` datetime DEFAULT NULL,
  `tested_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `notes` text,
  `spec_min_value` decimal(15,4) DEFAULT NULL,
  `spec_max_value` decimal(15,4) DEFAULT NULL,
  `spec_specification` varchar(500) DEFAULT NULL,
  `spec_unit` varchar(50) DEFAULT NULL,
  `criteria_type` varchar(20) DEFAULT 'numeric',
  `tolerance_percent` decimal(5,2) DEFAULT '0.00',
  `spec_target` decimal(15,4) DEFAULT NULL,
  `spec_tolerance_percent` decimal(5,2) DEFAULT '0.00',
  `acceptance_stages` text,
  `ipc_phase` varchar(50) DEFAULT NULL,
  `retest_round` int NOT NULL DEFAULT '1',
  `retest_reason` varchar(20) DEFAULT NULL,
  `disposition` varchar(50) DEFAULT NULL,
  `disposition_by` int DEFAULT NULL,
  `disposition_at` datetime DEFAULT NULL,
  `disposition_reason` text,
  `disposition_approved_by` int DEFAULT NULL,
  `disposition_approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `warning_tolerance_percent` decimal(5,2) DEFAULT '0.00',
  `ipc_criteria_id` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=112 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quality_tests`
--

LOCK TABLES `quality_tests` WRITE;
/*!40000 ALTER TABLE `quality_tests` DISABLE KEYS */;
INSERT INTO `quality_tests` VALUES (69,93,NULL,'in_process','IPC-1',10,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:37',2,3,'2026-06-10 18:47:22','ตัวอย่าง seed',NULL,NULL,'ตามสเปคแต่ละสูตร ±5%','mg','weight',5.00,NULL,5.00,'[20,40]','production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:37','2026-06-10 18:33:37',0.00,1),(70,93,NULL,'in_process','IPC-2',10,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:37',2,3,'2026-06-10 18:47:22','ตัวอย่าง seed',NULL,NULL,'ตามสเปคสูตร ±7.5%','mg','weight',7.50,NULL,7.50,'[20]','production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:37','2026-06-10 18:33:37',0.00,2),(71,93,NULL,'in_process','IPC-3',20,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:37',2,3,'2026-06-10 18:47:22','ตัวอย่าง seed',NULL,NULL,'สีสม่ำเสมอ ไม่บุบ ไม่รั่ว',NULL,'checkbox',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:37','2026-06-10 18:33:37',0.00,5),(72,93,NULL,'in_process','IPC-4',20,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:37',2,3,'2026-06-10 18:47:22','ตัวอย่าง seed',NULL,NULL,'ฝาแคปซูลล็อกสนิททุกเม็ด',NULL,'checkbox',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:37','2026-06-10 18:33:37',0.00,6),(73,94,NULL,'in_process','IPC-1',10,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:38',2,3,'2026-06-10 18:47:22','ตัวอย่าง seed',NULL,NULL,'ตามสเปคแต่ละสูตร ±5%','mg','weight',5.00,NULL,5.00,'[20,40]','production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:38','2026-06-10 18:33:38',0.00,1),(74,94,NULL,'in_process','IPC-2',10,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:38',2,3,'2026-06-10 18:47:22','ตัวอย่าง seed',NULL,NULL,'ตามสเปคสูตร ±7.5%','mg','weight',7.50,NULL,7.50,'[20]','production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:38','2026-06-10 18:33:38',0.00,2),(75,94,NULL,'in_process','IPC-3',20,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:38',2,3,'2026-06-10 18:47:22','ตัวอย่าง seed',NULL,NULL,'สีสม่ำเสมอ ไม่บุบ ไม่รั่ว',NULL,'checkbox',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:38','2026-06-10 18:33:38',0.00,5),(76,94,NULL,'in_process','IPC-4',20,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:38',2,3,'2026-06-10 18:47:22','ตัวอย่าง seed',NULL,NULL,'ฝาแคปซูลล็อกสนิททุกเม็ด',NULL,'checkbox',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:38','2026-06-10 18:33:38',0.00,6),(77,95,NULL,'in_process','IPC-1',10,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:39',2,NULL,NULL,'ตัวอย่าง seed',NULL,NULL,'ตามสเปคแต่ละสูตร ±5%','mg','weight',5.00,NULL,5.00,'[20,40]','production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:39','2026-06-10 18:33:39',0.00,1),(78,95,NULL,'in_process','IPC-2',10,NULL,NULL,NULL,'pending',1,'2026-06-10 18:33:39',NULL,NULL,NULL,NULL,NULL,NULL,'ตามสเปคสูตร ±7.5%','mg','weight',7.50,NULL,7.50,'[20]','production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:39','2026-06-10 18:33:39',0.00,2),(79,95,NULL,'in_process','IPC-3',20,NULL,NULL,NULL,'pending',1,'2026-06-10 18:33:39',NULL,NULL,NULL,NULL,NULL,NULL,'สีสม่ำเสมอ ไม่บุบ ไม่รั่ว',NULL,'checkbox',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:39','2026-06-10 18:33:39',0.00,5),(80,96,NULL,'in_process','IPC-1',20,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:40',2,NULL,NULL,'ตัวอย่าง seed',NULL,NULL,'ตามสเปค ±5%','mg','weight',5.00,NULL,5.00,'[20,40]','production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:40','2026-06-10 18:33:40',0.00,7),(81,96,NULL,'in_process','IPC-2',10,NULL,NULL,NULL,'pending',1,'2026-06-10 18:33:40',NULL,NULL,NULL,NULL,4.0000,12.0000,'Tablet Hardness','kp','numeric',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:40','2026-06-10 18:33:40',0.00,8),(82,96,NULL,'in_process','IPC-3',10,NULL,NULL,NULL,'pending',1,'2026-06-10 18:33:40',NULL,NULL,NULL,NULL,NULL,1.0000,'Tablet Friability','%','numeric',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:40','2026-06-10 18:33:40',0.00,9),(83,96,NULL,'in_process','IPC-4',6,NULL,NULL,NULL,'pending',1,'2026-06-10 18:33:40',NULL,NULL,NULL,NULL,NULL,15.0000,'Tablet Disintegration','min','numeric',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:40','2026-06-10 18:33:40',0.00,10),(84,96,NULL,'in_process','IPC-5',10,NULL,NULL,NULL,'pending',1,'2026-06-10 18:33:40',NULL,NULL,NULL,NULL,3.0000,5.0000,'Tablet Thickness','mm','numeric',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:40','2026-06-10 18:33:40',0.00,11),(85,97,NULL,'in_process','IPC-1',3,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:40',2,3,'2026-06-10 18:47:22','ตัวอย่าง seed',NULL,10.0000,'Powder Moisture','%','numeric',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:40','2026-06-10 18:33:40',0.00,12),(86,97,NULL,'in_process','IPC-2',10,'2026-06-10 18:47:22','pass',0.0000,'pass',1,'2026-06-10 18:33:40',2,3,'2026-06-10 18:47:22','ตัวอย่าง seed',NULL,5.0000,'RSD ≤ 5%','%','numeric',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:40','2026-06-10 18:33:40',0.00,13),(87,97,NULL,'in_process','IPC-3',3,'2026-06-10 18:47:22','pass',95.0000,'pass',1,'2026-06-10 18:33:40',2,3,'2026-06-10 18:47:22','ตัวอย่าง seed',95.0000,NULL,'ผ่านตะแกรง 40 mesh ≥ 95%','%','numeric',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:40','2026-06-10 18:33:40',0.00,14),(88,98,NULL,'in_process','IPC-1',5,NULL,NULL,NULL,'pending',1,'2026-06-10 18:33:41',NULL,NULL,NULL,NULL,NULL,NULL,'ซีลสนิททุกหน่วย ไม่มีรอยรั่ว',NULL,'checkbox',0.00,NULL,0.00,NULL,'packaging',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:41','2026-06-10 18:33:41',0.00,15),(89,98,NULL,'in_process','IPC-2',5,NULL,NULL,NULL,'pending',1,'2026-06-10 18:33:41',NULL,NULL,NULL,NULL,NULL,NULL,'ฉลาก/Lot/วันหมดอายุ ถูกต้องครบถ้วน',NULL,'checkbox',0.00,NULL,0.00,NULL,'packaging',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:41','2026-06-10 18:33:41',0.00,16),(90,99,NULL,'in_process','IPC-1',5,NULL,NULL,NULL,'pending',1,'2026-06-10 18:33:43',NULL,NULL,NULL,NULL,NULL,NULL,'ซีลสนิททุกหน่วย ไม่มีรอยรั่ว',NULL,'checkbox',0.00,NULL,0.00,NULL,'packaging',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:43','2026-06-10 18:33:43',0.00,15),(91,99,NULL,'in_process','IPC-2',5,NULL,NULL,NULL,'pending',1,'2026-06-10 18:33:43',NULL,NULL,NULL,NULL,NULL,NULL,'ฉลาก/Lot/วันหมดอายุ ถูกต้องครบถ้วน',NULL,'checkbox',0.00,NULL,0.00,NULL,'packaging',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:43','2026-06-10 18:33:43',0.00,16),(92,100,NULL,'in_process','IPC-1',5,NULL,NULL,NULL,'pending',1,'2026-06-10 18:33:44',NULL,NULL,NULL,NULL,NULL,NULL,'ซีลสนิททุกหน่วย ไม่มีรอยรั่ว',NULL,'checkbox',0.00,NULL,0.00,NULL,'packaging',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:44','2026-06-10 18:33:44',0.00,15),(93,101,NULL,'in_process','IPC-1',5,'2026-06-10 18:47:23','pass',0.0000,'pass',1,'2026-06-10 18:33:45',2,3,'2026-06-10 18:47:23','ตัวอย่าง seed',NULL,NULL,'ฉลาก/Lot/วันหมดอายุ ถูกต้องครบถ้วน',NULL,'checkbox',0.00,NULL,0.00,NULL,'packaging',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:33:45','2026-06-10 18:33:45',0.00,16),(94,102,NULL,'in_process','IPC-1',5,NULL,NULL,NULL,'pending',1,'2026-06-10 18:39:05',NULL,NULL,NULL,NULL,NULL,NULL,'ซีลสนิททุกหน่วย ไม่มีรอยรั่ว',NULL,'checkbox',0.00,NULL,0.00,NULL,'packaging',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 18:39:05','2026-06-10 18:39:05',0.00,15),(95,93,NULL,'in_process','SOP-206-IPC-1',10,'2026-06-10 19:10:31','pass',NULL,'pass',2,'2026-06-10 19:10:31',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,NULL,NULL,'mg','weight',0.00,NULL,5.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:31','2026-06-10 19:10:31',0.00,1),(96,93,NULL,'in_process','SOP-206-IPC-2',10,'2026-06-10 19:10:31','pass',NULL,'pass',2,'2026-06-10 19:10:31',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,NULL,NULL,'mg','weight',0.00,NULL,7.50,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:31','2026-06-10 19:10:31',0.00,2),(97,93,NULL,'in_process','SOP-206-IPC-5',10,'2026-06-10 19:10:31','pass',NULL,'pass',2,'2026-06-10 19:10:31',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,NULL,NULL,NULL,'checkbox',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:31','2026-06-10 19:10:31',0.00,5),(98,93,NULL,'in_process','SOP-206-IPC-6',10,'2026-06-10 19:10:32','pass',NULL,'pass',2,'2026-06-10 19:10:32',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,NULL,NULL,NULL,'checkbox',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:32','2026-06-10 19:10:32',0.00,6),(99,94,NULL,'in_process','SOP-214-IPC-1',10,'2026-06-10 19:10:32','pass',NULL,'pass',2,'2026-06-10 19:10:32',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,NULL,NULL,'mg','weight',0.00,NULL,5.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:32','2026-06-10 19:10:32',0.00,1),(100,94,NULL,'in_process','SOP-214-IPC-2',10,'2026-06-10 19:10:32','pass',NULL,'pass',2,'2026-06-10 19:10:32',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,NULL,NULL,'mg','weight',0.00,NULL,7.50,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:32','2026-06-10 19:10:32',0.00,2),(101,94,NULL,'in_process','SOP-214-IPC-5',10,'2026-06-10 19:10:32','pass',NULL,'pass',2,'2026-06-10 19:10:32',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,NULL,NULL,NULL,'checkbox',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:32','2026-06-10 19:10:32',0.00,5),(102,94,NULL,'in_process','SOP-214-IPC-6',10,'2026-06-10 19:10:32','pass',NULL,'pass',2,'2026-06-10 19:10:32',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,NULL,NULL,NULL,'checkbox',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:32','2026-06-10 19:10:32',0.00,6),(103,95,NULL,'in_process','SOP-220-IPC-1',10,'2026-06-10 19:10:32','pass',NULL,'pass',2,'2026-06-10 19:10:32',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,NULL,NULL,'mg','weight',0.00,NULL,5.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:32','2026-06-10 19:10:32',0.00,1),(104,95,NULL,'in_process','SOP-220-IPC-2',10,'2026-06-10 19:10:32','pass',NULL,'pass',2,'2026-06-10 19:10:32',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,NULL,NULL,'mg','weight',0.00,NULL,7.50,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:32','2026-06-10 19:10:32',0.00,2),(105,97,NULL,'in_process','SOP-232-IPC-12',3,'2026-06-10 19:10:32','pass',NULL,'pass',2,'2026-06-10 19:10:32',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,10.0000,NULL,'%','numeric',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:32','2026-06-10 19:10:32',0.00,12),(106,97,NULL,'in_process','SOP-232-IPC-13',10,'2026-06-10 19:10:32','pass',NULL,'pass',2,'2026-06-10 19:10:32',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,5.0000,NULL,'%','numeric',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:32','2026-06-10 19:10:32',0.00,13),(108,101,NULL,'in_process','SOP-251-IPC-16',10,'2026-06-10 19:10:32','pass',NULL,'pass',2,'2026-06-10 19:10:32',2,NULL,NULL,'ตัวอย่าง seed: IPC ใน SOP',NULL,NULL,NULL,NULL,'checkbox',0.00,NULL,0.00,NULL,'packaging',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:10:32','2026-06-10 19:10:32',0.00,16),(109,103,NULL,'in_process','IPC-1',5,NULL,NULL,NULL,'pending',1,'2026-06-10 19:15:56',NULL,NULL,NULL,'ความชื้นผง',NULL,10.0000,'Powder Moisture','%','numeric',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:15:56','2026-06-10 19:15:56',0.00,12),(110,103,NULL,'in_process','IPC-2',5,NULL,NULL,NULL,'pending',1,'2026-06-10 19:15:56',NULL,NULL,NULL,'ความสม่ำเสมอของการผสม',NULL,5.0000,'RSD ≤ 5%','%','numeric',0.00,NULL,0.00,NULL,'production',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-10 19:15:56','2026-06-10 19:15:56',0.00,13);
/*!40000 ALTER TABLE `quality_tests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `qc_inspections`
--

DROP TABLE IF EXISTS `qc_inspections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `qc_inspections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `inspection_number` varchar(40) NOT NULL,
  `work_order_id` int DEFAULT NULL,
  `batch_number` varchar(100) DEFAULT NULL,
  `inspection_type` varchar(30) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `findings` text,
  `overall_result` varchar(20) NOT NULL DEFAULT 'pending',
  `inspector_id` int NOT NULL,
  `inspected_at` datetime NOT NULL,
  `notes` text,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inspection_number` (`inspection_number`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `qc_inspections`
--

LOCK TABLES `qc_inspections` WRITE;
/*!40000 ALTER TABLE `qc_inspections` DISABLE KEYS */;
INSERT INTO `qc_inspections` VALUES (4,'QCI-2569-00004',NULL,NULL,'ad_hoc','ตรวจสอบหลังลูกค้าร้องเรียน batch B25690005','พบเศษเล็กในแคปซูล 2 ตัว จาก sample 30 ตัว — ไม่ผ่านมาตรฐาน contamination','fail',1,'2026-06-02 02:04:26','แจ้งทำ Deviation + Investigation','2026-06-02 02:04:26','2026-06-04 02:04:26');
/*!40000 ALTER TABLE `qc_inspections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `qc_samples`
--

DROP TABLE IF EXISTS `qc_samples`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `qc_samples` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sample_number` varchar(50) NOT NULL,
  `source_type` varchar(30) NOT NULL,
  `source_ref_id` int DEFAULT NULL,
  `source_ref_text` varchar(255) DEFAULT NULL,
  `product_id` int NOT NULL,
  `lot_number` varchar(100) DEFAULT NULL,
  `manufacture_date` datetime DEFAULT NULL,
  `expiry_date` datetime DEFAULT NULL,
  `retest_date` datetime DEFAULT NULL,
  `quantity_received` decimal(15,3) DEFAULT NULL,
  `unit` varchar(20) DEFAULT NULL,
  `storage_conditions` text,
  `customer_id` int DEFAULT NULL,
  `sales_order_ref` varchar(50) DEFAULT NULL,
  `received_date` datetime NOT NULL,
  `received_by` int NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `source_grn_line_id` int DEFAULT NULL,
  `flag_for_qc_manager` tinyint(1) NOT NULL DEFAULT '0',
  `source_lot_id` int DEFAULT NULL,
  `sample_qty` decimal(15,4) DEFAULT NULL,
  `retain_sample_qty` decimal(15,4) DEFAULT NULL,
  `retain_lot_id` int DEFAULT NULL,
  `retain_expiry_date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sample_number` (`sample_number`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `qc_samples`
--

LOCK TABLES `qc_samples` WRITE;
/*!40000 ALTER TABLE `qc_samples` DISABLE KEYS */;
INSERT INTO `qc_samples` VALUES (1,'QC-2569-000001','raw_material_lot',NULL,'LOT-RM-001-001',1,'LOT-RM-001-001','2026-04-14 10:56:38','2028-04-13 10:56:38',NULL,100.000,'g',NULL,NULL,NULL,'2026-05-04 10:56:38',1,'released','ตรวจรับวัตถุดิบ ขมิ้นชัน','2026-05-14 10:56:38','2026-05-14 10:56:38',NULL,0,NULL,NULL,NULL,NULL,NULL),(2,'QC-2569-000002','work_order_batch',NULL,'B25690008',8,'B25690008','2026-04-14 10:56:38','2028-04-13 10:56:38',NULL,100.000,'g',NULL,NULL,NULL,'2026-05-04 10:56:38',1,'approved','ตรวจสอบสินค้าสำเร็จรูป รุ่นการผลิต','2026-05-14 10:56:38','2026-05-14 10:56:38',NULL,0,NULL,NULL,NULL,NULL,NULL),(3,'QC-2569-000003','customer_return',NULL,'CR-FG-002-01',9,'CR-FG-002-01','2026-04-14 10:56:38','2028-04-13 10:56:38',NULL,100.000,'g',NULL,NULL,NULL,'2026-05-04 10:56:38',1,'rejected','สินค้าคืนจากลูกค้า — สงสัยคุณภาพ','2026-05-14 10:56:38','2026-05-14 10:56:38',NULL,0,NULL,NULL,NULL,NULL,NULL),(4,'QC-2569-000004','stability',NULL,'STB-FG-003-01',53,'STB-FG-003-01','2026-04-14 10:56:38','2028-04-13 10:56:38',NULL,100.000,'g',NULL,NULL,NULL,'2026-05-04 10:56:38',1,'testing','การศึกษาความคงตัว 3 เดือน','2026-05-14 10:56:38','2026-05-14 10:56:38',NULL,0,NULL,NULL,NULL,NULL,NULL),(5,'QC-2569-000005','purchased_herb',NULL,'PH-RM-003-01',3,'PH-RM-003-01','2026-04-14 10:56:39','2028-04-13 10:56:39',NULL,100.000,'g',NULL,NULL,NULL,'2026-05-04 10:56:39',1,'reviewed','สมุนไพรซื้อเข้า ฟ้าทะลายโจร','2026-05-14 10:56:38','2026-05-14 10:56:38',NULL,0,NULL,NULL,NULL,NULL,NULL),(6,'QC-2569-000006','outgoing_shipment',NULL,'OUT-FG-004-01',54,'OUT-FG-004-01','2026-04-14 10:56:39','2028-04-13 10:56:39',NULL,100.000,'g',NULL,NULL,NULL,'2026-05-04 10:56:39',1,'released','ตรวจก่อนส่งออกให้ลูกค้า','2026-05-14 10:56:38','2026-05-14 10:56:38',NULL,0,NULL,NULL,NULL,NULL,NULL),(7,'QC-2569-000007','other',NULL,'OTH-EX-001-01',5,'OTH-EX-001-01','2026-04-14 10:56:39','2028-04-13 10:56:39',NULL,100.000,'g',NULL,NULL,NULL,'2026-05-04 10:56:39',1,'quarantine','ตัวอย่างพิเศษ รอกักกัน','2026-05-14 10:56:38','2026-05-14 10:56:38',NULL,0,NULL,NULL,NULL,NULL,NULL),(8,'QC-2569-000008','raw_material_lot',NULL,'LOT-RM-002-001',2,'LOT-RM-002-001','2026-04-14 10:56:39','2028-04-13 10:56:39',NULL,100.000,'g',NULL,NULL,NULL,'2026-05-04 10:56:39',1,'oos','ผลตรวจอยู่นอกเกณฑ์ (OOS) — รอสอบสวน','2026-05-14 10:56:38','2026-05-14 10:56:38',NULL,0,NULL,NULL,NULL,NULL,NULL),(9,'QC-2569-000009','work_order_batch',NULL,'B25690005',55,'B25690005','2026-04-14 10:56:39','2028-04-13 10:56:39',NULL,100.000,'g',NULL,NULL,NULL,'2026-05-04 10:56:39',1,'registered','ลงทะเบียนตัวอย่าง รอเริ่มทดสอบ','2026-05-14 10:56:38','2026-05-14 10:56:38',NULL,0,NULL,NULL,NULL,NULL,NULL),(10,'SMP-GRN-0002-1','incoming',2,'GRN-2026-00002 line 1',3,'V-LOT-B001',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-03 23:49:51',1,'received','ตัวอย่างสำหรับตรวจ QC วัตถุดิบขมิ้น','2026-06-03 23:49:51','2026-06-03 23:49:51',NULL,0,NULL,NULL,NULL,NULL,NULL),(11,'SMP-GRN-0002-2','incoming',2,'GRN-2026-00002 line 2',4,'V-LOT-B002',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-03 23:49:51',1,'received','ตัวอย่างฟ้าทะลาย','2026-06-03 23:49:51','2026-06-03 23:49:51',NULL,0,NULL,NULL,NULL,NULL,NULL),(12,'SMP-GRN-0004-1','incoming',4,'GRN-2026-00004',6,'V-LOT-D001',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-29 23:49:51',1,'received','ตัวอย่างกล่องบรรจุ - รอตรวจ','2026-06-03 23:49:51','2026-06-03 23:49:51',NULL,0,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `qc_samples` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `qc_sample_tests`
--

DROP TABLE IF EXISTS `qc_sample_tests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `qc_sample_tests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sample_id` int NOT NULL,
  `criteria_id` int NOT NULL,
  `sequence` int NOT NULL DEFAULT '1',
  `spec_min` decimal(15,4) DEFAULT NULL,
  `spec_max` decimal(15,4) DEFAULT NULL,
  `spec_target` decimal(15,4) DEFAULT NULL,
  `spec_text` varchar(500) DEFAULT NULL,
  `unit` varchar(20) DEFAULT NULL,
  `test_method` varchar(255) DEFAULT NULL,
  `numeric_result` decimal(15,4) DEFAULT NULL,
  `text_result` text,
  `result_status` varchar(20) NOT NULL DEFAULT 'pending',
  `tested_by` int DEFAULT NULL,
  `tested_at` datetime DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `notes` text,
  `attachment_path` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `qc_sample_tests`
--

LOCK TABLES `qc_sample_tests` WRITE;
/*!40000 ALTER TABLE `qc_sample_tests` DISABLE KEYS */;
INSERT INTO `qc_sample_tests` VALUES (1,1,2,1,0.0000,7.0000,NULL,'≤ 7%','%','Loss on Drying',6.2000,NULL,'pass',1,'2026-05-06 10:56:38',1,'2026-05-07 10:56:38',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(2,1,5,2,NULL,NULL,NULL,'ไม่มีตำหนิ/สีสม่ำเสมอ',NULL,'Visual Inspection',NULL,'ผ่าน — สีและลักษณะปกติ','pass',1,'2026-05-06 10:56:38',1,'2026-05-07 10:56:38',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(3,2,1,1,285.0000,315.0000,NULL,'300 ± 5%','mg','USP <905>',500.0000,NULL,'pass',1,'2026-05-06 10:56:38',1,'2026-05-07 10:56:38',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(4,2,3,2,0.0000,30.0000,NULL,'≤ 30 min','min','USP <701>',18.0000,NULL,'pass',1,'2026-05-06 10:56:38',1,'2026-05-07 10:56:38',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(5,2,5,3,NULL,NULL,NULL,'ไม่มีตำหนิ/สีสม่ำเสมอ',NULL,'Visual Inspection',NULL,'ผ่าน','pass',1,'2026-05-06 10:56:38',1,'2026-05-07 10:56:38',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(6,3,1,1,285.0000,315.0000,NULL,'300 ± 5%','mg','USP <905>',360.0000,NULL,'fail',1,'2026-05-06 10:56:38',1,'2026-05-07 10:56:38',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(7,3,5,2,NULL,NULL,NULL,'ไม่มีตำหนิ/สีสม่ำเสมอ',NULL,'Visual Inspection',NULL,'ไม่ผ่าน — พบความชื้นในแคปซูล','fail',1,'2026-05-06 10:56:38',1,'2026-05-07 10:56:38',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(8,4,2,1,0.0000,7.0000,NULL,'≤ 7%','%','Loss on Drying',NULL,NULL,'pending',NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(9,4,3,2,0.0000,30.0000,NULL,'≤ 30 min','min','USP <701>',NULL,NULL,'pending',NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(10,5,2,1,0.0000,7.0000,NULL,'≤ 7%','%','Loss on Drying',5.8000,NULL,'pass',1,'2026-05-06 10:56:39',1,'2026-05-07 10:56:39',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(11,5,5,2,NULL,NULL,NULL,'ไม่มีตำหนิ/สีสม่ำเสมอ',NULL,'Visual Inspection',NULL,'ผ่าน','pass',1,'2026-05-06 10:56:39',1,'2026-05-07 10:56:39',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(12,6,4,1,4.0000,8.0000,NULL,'4 - 8 kp','kp','USP <1217>',6.0000,NULL,'pass',1,'2026-05-06 10:56:39',1,'2026-05-07 10:56:39',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(13,6,3,2,0.0000,30.0000,NULL,'≤ 30 min','min','USP <701>',22.0000,NULL,'pass',1,'2026-05-06 10:56:39',1,'2026-05-07 10:56:39',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(14,6,6,3,NULL,NULL,NULL,'ซีลสมบูรณ์ ไม่รั่ว',NULL,'Visual / Leak Test',NULL,'ผ่าน — ซีลสมบูรณ์','pass',1,'2026-05-06 10:56:39',1,'2026-05-07 10:56:39',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(15,7,2,1,0.0000,7.0000,NULL,'≤ 7%','%','Loss on Drying',7.5000,NULL,'retest',1,'2026-05-06 10:56:39',1,'2026-05-07 10:56:39',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(16,8,2,1,0.0000,7.0000,NULL,'≤ 7%','%','Loss on Drying',9.8000,NULL,'fail',1,'2026-05-06 10:56:39',1,'2026-05-07 10:56:39',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(17,8,5,2,NULL,NULL,NULL,'ไม่มีตำหนิ/สีสม่ำเสมอ',NULL,'Visual Inspection',NULL,'ผ่าน','pass',1,'2026-05-06 10:56:39',1,'2026-05-07 10:56:39',NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(18,9,2,1,0.0000,7.0000,NULL,'≤ 7%','%','Loss on Drying',NULL,NULL,'pending',NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38'),(19,9,5,2,NULL,NULL,NULL,'ไม่มีตำหนิ/สีสม่ำเสมอ',NULL,'Visual Inspection',NULL,NULL,'pending',NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 10:56:38','2026-05-14 10:56:38');
/*!40000 ALTER TABLE `qc_sample_tests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `qc_sample_test_samples`
--

DROP TABLE IF EXISTS `qc_sample_test_samples`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `qc_sample_test_samples` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sample_test_id` int NOT NULL,
  `sample_number` int NOT NULL,
  `test_round` int NOT NULL DEFAULT '1',
  `numeric_value` decimal(15,4) DEFAULT NULL,
  `text_value` text,
  `result` varchar(20) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `qc_sample_test_samples`
--

LOCK TABLES `qc_sample_test_samples` WRITE;
/*!40000 ALTER TABLE `qc_sample_test_samples` DISABLE KEYS */;
/*!40000 ALTER TABLE `qc_sample_test_samples` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `qc_oos_investigations`
--

DROP TABLE IF EXISTS `qc_oos_investigations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `qc_oos_investigations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sample_test_id` int NOT NULL,
  `initiated_by` int NOT NULL,
  `initiated_at` datetime NOT NULL,
  `phase1_lab_error_check` text,
  `phase2_root_cause` text,
  `classification` varchar(30) DEFAULT NULL,
  `retest_authorized` tinyint(1) NOT NULL DEFAULT '0',
  `closed_by` int DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `conclusion` text,
  `capa_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `qc_oos_investigations`
--

LOCK TABLES `qc_oos_investigations` WRITE;
/*!40000 ALTER TABLE `qc_oos_investigations` DISABLE KEYS */;
/*!40000 ALTER TABLE `qc_oos_investigations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coa_documents`
--

DROP TABLE IF EXISTS `coa_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coa_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coa_number` varchar(30) NOT NULL,
  `sample_id` int NOT NULL,
  `template_id` int DEFAULT NULL,
  `product_id` int NOT NULL,
  `lot_number` varchar(100) NOT NULL,
  `customer_id` int DEFAULT NULL,
  `sales_order_ref` varchar(50) DEFAULT NULL,
  `issue_date` datetime NOT NULL,
  `expiry_date` datetime DEFAULT NULL,
  `retest_date` datetime DEFAULT NULL,
  `manufacture_date` datetime DEFAULT NULL,
  `conclusion` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `superseded_by` int DEFAULT NULL,
  `revoke_reason` text,
  `qr_code_token` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int NOT NULL,
  `approved_at` datetime DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `released_at` datetime DEFAULT NULL,
  `released_by` int DEFAULT NULL,
  `pdf_path` varchar(500) DEFAULT NULL,
  `pdf_generated_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coa_number` (`coa_number`),
  UNIQUE KEY `qr_code_token` (`qr_code_token`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coa_documents`
--

LOCK TABLES `coa_documents` WRITE;
/*!40000 ALTER TABLE `coa_documents` DISABLE KEYS */;
INSERT INTO `coa_documents` VALUES (1,'COA-2569-0001',1,3,1,'LOT-RM-001-001',NULL,NULL,'2026-05-09 10:56:39','2028-04-13 10:56:39','2027-04-29 10:56:39','2026-04-14 10:56:39','complies','draft',NULL,NULL,'qr-coa-2569-0001-uw61b9zj','2026-05-14 10:56:38',1,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 10:56:38'),(2,'COA-2569-0002',5,3,3,'PH-RM-003-01',NULL,NULL,'2026-05-09 10:56:39','2028-04-13 10:56:39','2027-04-29 10:56:39','2026-04-14 10:56:39','complies','review',NULL,NULL,'qr-coa-2569-0002-swcr1u5w','2026-05-14 10:56:38',1,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 10:56:38'),(3,'COA-2569-0003',2,2,8,'B25690008',NULL,NULL,'2026-05-09 10:56:39','2028-04-13 10:56:39','2027-04-29 10:56:39','2026-04-14 10:56:39','complies','approved',NULL,NULL,'qr-coa-2569-0003-wiak1eqr','2026-05-14 10:56:38',1,'2026-05-10 10:56:39',1,NULL,NULL,NULL,NULL,'2026-05-14 10:56:38'),(4,'COA-2569-0004',6,2,54,'OUT-FG-004-01',NULL,NULL,'2026-05-09 10:56:39','2028-04-13 10:56:39','2027-04-29 10:56:39','2026-04-14 10:56:39','complies','issued',NULL,NULL,'qr-coa-2569-0004-e6r0n0zu','2026-05-14 10:56:38',1,'2026-05-10 10:56:39',1,'2026-05-11 10:56:39',1,NULL,NULL,'2026-05-14 10:56:38'),(5,'COA-2569-0005',7,4,5,'OTH-EX-001-01',NULL,NULL,'2026-05-09 10:56:39','2028-04-13 10:56:39','2027-04-29 10:56:39','2026-04-14 10:56:39','partial','issued',NULL,NULL,'qr-coa-2569-0005-qmbogip3','2026-05-14 10:56:38',1,'2026-05-10 10:56:39',1,'2026-05-11 10:56:39',1,NULL,NULL,'2026-05-14 10:56:38'),(6,'COA-2569-0006',3,2,9,'CR-FG-002-01',NULL,NULL,'2026-05-09 10:56:39','2028-04-13 10:56:39','2027-04-29 10:56:39','2026-04-14 10:56:39','does_not_comply','revoked',NULL,'ตรวจพบความคลาดเคลื่อนของผลทดสอบ — ออกใบรับรองใหม่','qr-coa-2569-0006-eph2aa5r','2026-05-14 10:56:38',1,'2026-05-10 10:56:39',1,'2026-05-11 10:56:39',1,NULL,NULL,'2026-05-14 10:56:38');
/*!40000 ALTER TABLE `coa_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coa_test_results`
--

DROP TABLE IF EXISTS `coa_test_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coa_test_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coa_id` int NOT NULL,
  `sample_test_id` int DEFAULT NULL,
  `sequence` int NOT NULL DEFAULT '1',
  `test_name` varchar(255) NOT NULL,
  `test_name_th` varchar(255) DEFAULT NULL,
  `test_method` varchar(255) DEFAULT NULL,
  `specification` varchar(500) NOT NULL,
  `result` varchar(500) NOT NULL,
  `result_unit` varchar(20) DEFAULT NULL,
  `conclusion` varchar(20) NOT NULL,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coa_test_results`
--

LOCK TABLES `coa_test_results` WRITE;
/*!40000 ALTER TABLE `coa_test_results` DISABLE KEYS */;
INSERT INTO `coa_test_results` VALUES (1,1,1,1,'Moisture Content','ปริมาณความชื้น','Loss on Drying','≤ 7%','6.2000 %','%','conform',NULL,'2026-05-14 10:56:38'),(2,1,2,2,'Appearance Check','ตรวจลักษณะภายนอก','Visual Inspection','ไม่มีตำหนิ/สีสม่ำเสมอ','ผ่าน — สีและลักษณะปกติ',NULL,'conform',NULL,'2026-05-14 10:56:38'),(3,2,10,1,'Moisture Content','ปริมาณความชื้น','Loss on Drying','≤ 7%','5.8000 %','%','conform',NULL,'2026-05-14 10:56:38'),(4,2,11,2,'Appearance Check','ตรวจลักษณะภายนอก','Visual Inspection','ไม่มีตำหนิ/สีสม่ำเสมอ','ผ่าน',NULL,'conform',NULL,'2026-05-14 10:56:38'),(5,3,3,1,'Average Weight','น้ำหนักเฉลี่ย','USP <905>','300 ± 5%','500.0000 mg','mg','conform',NULL,'2026-05-14 10:56:38'),(6,3,4,2,'Disintegration Time','เวลาแตกตัว','USP <701>','≤ 30 min','18.0000 min','min','conform',NULL,'2026-05-14 10:56:38'),(7,3,5,3,'Appearance Check','ตรวจลักษณะภายนอก','Visual Inspection','ไม่มีตำหนิ/สีสม่ำเสมอ','ผ่าน',NULL,'conform',NULL,'2026-05-14 10:56:38'),(8,4,12,1,'Hardness','ความแข็ง','USP <1217>','4 - 8 kp','6.0000 kp','kp','conform',NULL,'2026-05-14 10:56:38'),(9,4,13,2,'Disintegration Time','เวลาแตกตัว','USP <701>','≤ 30 min','22.0000 min','min','conform',NULL,'2026-05-14 10:56:38'),(10,4,14,3,'Seal Integrity','ความสมบูรณ์ของซีล','Visual / Leak Test','ซีลสมบูรณ์ ไม่รั่ว','ผ่าน — ซีลสมบูรณ์',NULL,'conform',NULL,'2026-05-14 10:56:38'),(11,5,15,1,'Moisture Content','ปริมาณความชื้น','Loss on Drying','≤ 7%','7.5000 %','%','na',NULL,'2026-05-14 10:56:38'),(12,6,6,1,'Average Weight','น้ำหนักเฉลี่ย','USP <905>','300 ± 5%','360.0000 mg','mg','non_conform',NULL,'2026-05-14 10:56:38'),(13,6,7,2,'Appearance Check','ตรวจลักษณะภายนอก','Visual Inspection','ไม่มีตำหนิ/สีสม่ำเสมอ','ไม่ผ่าน — พบความชื้นในแคปซูล',NULL,'non_conform',NULL,'2026-05-14 10:56:38');
/*!40000 ALTER TABLE `coa_test_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scale_verifications`
--

DROP TABLE IF EXISTS `scale_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scale_verifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `scale_id` int NOT NULL,
  `standard_weight_id` int NOT NULL,
  `certified_value_snapshot` decimal(15,4) NOT NULL,
  `certified_unit_snapshot` varchar(10) NOT NULL,
  `actual_reading` decimal(15,4) NOT NULL,
  `deviation_amount` decimal(15,4) NOT NULL,
  `deviation_percent` decimal(8,4) NOT NULL,
  `result` varchar(10) NOT NULL,
  `operator_user_id` int NOT NULL,
  `signature_id` int DEFAULT NULL,
  `performed_at` datetime NOT NULL,
  `valid_until` datetime NOT NULL,
  `notes` text,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scale_verifications`
--

LOCK TABLES `scale_verifications` WRITE;
/*!40000 ALTER TABLE `scale_verifications` DISABLE KEYS */;
INSERT INTO `scale_verifications` VALUES (1,1,2,500.0000,'g',500.0200,0.0200,0.0040,'pass',1,NULL,'2026-06-03 18:24:40','2026-06-04 02:24:40','ตรวจก่อนเริ่มกะเช้า — อุณหภูมิห้อง 23°C ความชื้น 55%','2026-06-04 00:24:40'),(2,1,1,1000.0000,'g',999.9800,-0.0200,-0.0020,'pass',1,NULL,'2026-06-03 00:24:40','2026-06-03 08:24:40','ตรวจรอบบ่ายเมื่อวาน — ใช้ลูกตุ้ม 1kg','2026-06-03 00:24:40'),(3,1,2,500.0000,'g',100.0050,-399.9950,-79.9990,'fail',1,1,'2026-06-04 00:33:05','2026-06-04 08:33:05',NULL,'2026-06-04 00:33:06'),(4,1,1,1000.0000,'g',1000.0000,0.0000,0.0000,'pass',1,9,'2026-06-10 01:22:21','2026-06-10 09:22:21',NULL,'2026-06-10 01:22:21');
/*!40000 ALTER TABLE `scale_verifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deviations`
--

DROP TABLE IF EXISTS `deviations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deviations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `deviation_number` varchar(50) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `source_type` varchar(50) DEFAULT NULL,
  `source_id` int DEFAULT NULL,
  `lot_id` int DEFAULT NULL,
  `work_order_id` int DEFAULT NULL,
  `severity` varchar(50) NOT NULL DEFAULT 'minor',
  `status` varchar(50) NOT NULL DEFAULT 'open',
  `root_cause` text,
  `corrective_action` text,
  `preventive_action` text,
  `reported_by` int DEFAULT NULL,
  `reported_at` datetime DEFAULT NULL,
  `responsible_person` int DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `due_date` datetime DEFAULT NULL,
  `closed_by` int DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `closure_notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `withdrawal_request_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `deviation_number` (`deviation_number`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deviations`
--

LOCK TABLES `deviations` WRITE;
/*!40000 ALTER TABLE `deviations` DISABLE KEYS */;
INSERT INTO `deviations` VALUES (1,'DEV-2026-41887','Env inspection out-of-spec on storage_area #1','1 item(s) outside specification. See inspection record #2.',NULL,NULL,NULL,NULL,NULL,'major','open',NULL,NULL,NULL,1,'2026-06-05 07:22:22',NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-05 07:22:22','2026-06-05 07:22:22',NULL),(2,'DEV-2026-52793','Env inspection out-of-spec on storage_area #1','1 item(s) outside specification. See inspection record #3.',NULL,NULL,NULL,NULL,NULL,'major','open',NULL,NULL,NULL,1,'2026-06-05 07:24:13',NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-05 07:24:13','2026-06-05 07:24:13',NULL);
/*!40000 ALTER TABLE `deviations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_rooms`
--

DROP TABLE IF EXISTS `production_rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_rooms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `name_th` varchar(255) NOT NULL,
  `room_type` varchar(50) NOT NULL,
  `description` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_rooms`
--

LOCK TABLES `production_rooms` WRITE;
/*!40000 ALTER TABLE `production_rooms` DISABLE KEYS */;
INSERT INTO `production_rooms` VALUES (1,'ROOM-WEIGH-01','Weighing Room','ห้องชั่ง','weighing','ห้องชั่งวัตถุดิบ ควบคุมฝุ่นและความชื้น',1,'2026-06-10 17:38:36','2026-06-10 17:38:36'),(2,'ROOM-MIX-01','Mixing Room A','ห้องผสม A','mixing','ห้องผสมสมุนไพรและสารสกัด',1,'2026-06-10 17:38:36','2026-06-10 17:38:36'),(3,'ROOM-MILL-01','Milling Room','ห้องบด','production','ห้องบดและร่อนวัตถุดิบ',1,'2026-06-10 17:38:36','2026-06-10 17:38:36'),(4,'ROOM-FILL-01','Capsule Filling Room','ห้องบรรจุแคปซูล','production','ห้องบรรจุผงยาลงแคปซูล ควบคุมความชื้น',1,'2026-06-10 17:38:36','2026-06-10 17:38:36'),(5,'ROOM-PACK-01','Packaging Room','ห้องบรรจุภัณฑ์','packaging','ห้องบรรจุขวดและติดฉลาก',1,'2026-06-10 17:38:36','2026-06-10 17:38:36'),(6,'ROOM-QC-01','QC Laboratory','ห้องปฏิบัติการ QC','production','ห้องตรวจสอบคุณภาพระหว่างและหลังผลิต',1,'2026-06-10 17:38:36','2026-06-10 17:38:36'),(7,'ROOM-STORE-01','Storage Area','คลังจัดเก็บ','storage','พื้นที่จัดเก็บวัตถุดิบและสินค้าสำเร็จรูป',1,'2026-06-10 17:38:36','2026-06-10 17:38:36');
/*!40000 ALTER TABLE `production_rooms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_equipment`
--

DROP TABLE IF EXISTS `production_equipment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_equipment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `name_th` varchar(255) NOT NULL,
  `equipment_type` varchar(50) NOT NULL,
  `capacity` varchar(100) DEFAULT NULL,
  `room_id` int DEFAULT NULL,
  `description` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verification_interval_hours` int NOT NULL DEFAULT '8',
  `min_verification_weight_g` decimal(15,4) DEFAULT NULL,
  `max_verification_weight_g` decimal(15,4) DEFAULT NULL,
  `tolerance_percent` decimal(6,4) NOT NULL DEFAULT '0.1000',
  `scale_status` varchar(20) NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_equipment`
--

LOCK TABLES `production_equipment` WRITE;
/*!40000 ALTER TABLE `production_equipment` DISABLE KEYS */;
INSERT INTO `production_equipment` VALUES (1,'EQ-CONT-01','Stainless Container 100L','ภาชนะสแตนเลส 100L','Container','100 liters',2,'ภาชนะผสมสแตนเลส',1,'2026-06-10 17:38:36','2026-06-10 17:38:36',8,NULL,NULL,0.1000,'active'),(2,'EQ-FILL-01','Capsule Filler 1200','เครื่องบรรจุแคปซูล 1200','Filler','1200 caps/hr',4,'เครื่องบรรจุแคปซูลกึ่งอัตโนมัติ',1,'2026-06-10 17:38:36','2026-06-10 17:38:36',8,NULL,NULL,0.1000,'active'),(3,'EQ-MILL-01','Hammer Mill','เครื่องบดแบบค้อน','Mill','50 kg/hr',3,'เครื่องบดวัตถุดิบสมุนไพร',1,'2026-06-10 17:38:36','2026-06-10 17:38:36',8,NULL,NULL,0.1000,'active'),(4,'EQ-MIX-01','Ribbon Mixer 500L','เครื่องผสมริบบอน 500L','Mixer','500 liters',2,'เครื่องผสมแห้ง',1,'2026-06-10 17:38:36','2026-06-10 17:38:36',8,NULL,NULL,0.1000,'active'),(5,'EQ-SIEVE-01','Vibro Sifter','เครื่องร่อนสั่น','Sieve','40 mesh',3,'เครื่องร่อนผง',1,'2026-06-10 17:38:36','2026-06-10 17:38:36',8,NULL,NULL,0.1000,'active'),(6,'EQ-SCALE-01','Digital Platform Scale 200kg','เครื่องชั่งดิจิทัล 200kg','Scale','200 kg x 0.01 kg',1,'เครื่องชั่งวัตถุดิบใหญ่',1,'2026-06-10 17:38:36','2026-06-10 17:38:36',8,1000.0000,200000.0000,0.1000,'active'),(7,'EQ-SCALE-02','Precision Balance 1kg','เครื่องชั่งแม่นยำสูง 1kg','balance','1000 g x 0.001 g',1,'เครื่องชั่งห้องชั่งละเอียด',1,'2026-06-10 17:38:36','2026-06-10 17:38:36',8,10.0000,1000.0000,0.0500,'active'),(8,'EQ-SCALE-03','Analytical Balance 220g','เครื่องชั่งวิเคราะห์ 220g','balance','220 g x 0.0001 g',6,'เครื่องชั่งวิเคราะห์ QC Lab',1,'2026-06-10 17:38:36','2026-06-10 17:38:36',8,1.0000,220.0000,0.0100,'active'),(9,'EQ-HOT-01','Industrial Hotplate','เตาร้อนอุตสาหกรรม','Hotplate','50 liters',2,'เตาให้ความร้อน',1,'2026-06-10 17:38:36','2026-06-10 17:38:36',8,NULL,NULL,0.1000,'active'),(10,'EQ-TOOL-01','Stainless Scoop Set','ชุดช้อนตักสแตนเลส','Tool',NULL,1,'อุปกรณ์ตักวัตถุดิบ',1,'2026-06-10 17:38:36','2026-06-10 17:38:36',8,NULL,NULL,0.1000,'active');
/*!40000 ALTER TABLE `production_equipment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `equipment`
--

DROP TABLE IF EXISTS `equipment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `equipment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(100) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `manufacturer` varchar(255) DEFAULT NULL,
  `model` varchar(255) DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `installation_date` datetime DEFAULT NULL,
  `last_maintenance_date` datetime DEFAULT NULL,
  `next_maintenance_date` datetime DEFAULT NULL,
  `last_calibration_date` datetime DEFAULT NULL,
  `next_calibration_date` datetime DEFAULT NULL,
  `cleaning_status` varchar(50) DEFAULT 'clean',
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `equipment`
--

LOCK TABLES `equipment` WRITE;
/*!40000 ALTER TABLE `equipment` DISABLE KEYS */;
/*!40000 ALTER TABLE `equipment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sanitation_logs`
--

DROP TABLE IF EXISTS `sanitation_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sanitation_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` int DEFAULT NULL,
  `scheduled_date` datetime DEFAULT NULL,
  `performed_date` datetime DEFAULT NULL,
  `performed_by` int DEFAULT NULL,
  `method` text,
  `chemicals_used` text,
  `status` varchar(20) NOT NULL,
  `verified_by` int DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `deviation_id` int DEFAULT NULL,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sanitation_logs`
--

LOCK TABLES `sanitation_logs` WRITE;
/*!40000 ALTER TABLE `sanitation_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `sanitation_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sanitation_schedules`
--

DROP TABLE IF EXISTS `sanitation_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sanitation_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `area_type` varchar(30) NOT NULL,
  `area_id` int DEFAULT NULL,
  `equipment_id` int DEFAULT NULL,
  `frequency` varchar(20) NOT NULL,
  `day_of_week` int DEFAULT NULL,
  `day_of_month` int DEFAULT NULL,
  `method` text,
  `verification_required` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sanitation_schedules`
--

LOCK TABLES `sanitation_schedules` WRITE;
/*!40000 ALTER TABLE `sanitation_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `sanitation_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pest_control_logs`
--

DROP TABLE IF EXISTS `pest_control_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pest_control_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_date` datetime NOT NULL,
  `contractor_name` varchar(200) DEFAULT NULL,
  `technician_name` varchar(200) DEFAULT NULL,
  `service_type` varchar(30) NOT NULL,
  `areas_serviced` text,
  `treatment_method` text,
  `findings_count` int DEFAULT '0',
  `findings` text,
  `recommendations` text,
  `follow_up_required` tinyint(1) DEFAULT '0',
  `follow_up_date` datetime DEFAULT NULL,
  `verified_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pest_control_logs`
--

LOCK TABLES `pest_control_logs` WRITE;
/*!40000 ALTER TABLE `pest_control_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `pest_control_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_number` varchar(50) NOT NULL,
  `vendor_id` int NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `order_date` datetime DEFAULT NULL,
  `expected_date` datetime DEFAULT NULL,
  `total_amount` decimal(15,2) DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'THB',
  `payment_terms` varchar(100) DEFAULT NULL,
  `shipping_address` text,
  `notes` text,
  `created_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `po_number` (`po_number`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
INSERT INTO `purchase_orders` VALUES (1,'PO-2026-0001',1,'approved','2026-05-25 09:00:00','2026-06-10 17:00:00',380000.00,'THB','30 days',NULL,'สั่งซื้อสมุนไพรรอบเดือน มิ.ย.',1,1,'2026-05-26 10:00:00','2026-06-03 17:58:10','2026-06-03 17:58:10'),(2,'PO-2026-0002',2,'approved','2026-05-28 14:00:00','2026-06-12 17:00:00',540000.00,'THB','cash',NULL,'รอบที่ 2 — สั่ง batch ใหญ่',1,1,'2026-05-29 09:00:00','2026-06-03 17:58:11','2026-06-03 17:58:11'),(3,'PO-2026-0003',3,'approved','2026-06-01 10:00:00','2026-06-15 17:00:00',165000.00,'THB','15 days',NULL,'บรรจุภัณฑ์สำหรับ FG-001 + FG-002',1,1,'2026-06-01 14:00:00','2026-06-03 17:58:11','2026-06-03 17:58:11'),(4,'PO2606105485',1,'received','2026-06-10 01:42:23','2026-06-17 00:00:00',500000.00,'THB','Net 30','35/5 ม.4 ต.ทดสอบ',NULL,1,NULL,NULL,'2026-06-10 01:42:23','2026-06-10 03:14:13');
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_order_lines`
--

DROP TABLE IF EXISTS `purchase_order_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_id` int NOT NULL,
  `item_id` int NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `received_quantity` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `unit` varchar(50) NOT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `total_price` decimal(15,2) NOT NULL,
  `expected_date` datetime DEFAULT NULL,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_order_lines`
--

LOCK TABLES `purchase_order_lines` WRITE;
/*!40000 ALTER TABLE `purchase_order_lines` DISABLE KEYS */;
INSERT INTO `purchase_order_lines` VALUES (1,1,1,500.0000,0.0000,'kg',400.00,200000.00,'2026-06-10 17:00:00',NULL,'2026-06-03 17:58:10'),(2,1,2,300.0000,0.0000,'kg',300.00,90000.00,'2026-06-10 17:00:00',NULL,'2026-06-03 17:58:10'),(3,1,3,200.0000,0.0000,'kg',450.00,90000.00,'2026-06-10 17:00:00',NULL,'2026-06-03 17:58:10'),(4,2,4,1000.0000,0.0000,'kg',350.00,350000.00,'2026-06-12 17:00:00',NULL,'2026-06-03 17:58:11'),(5,2,5,500.0000,0.0000,'kg',380.00,190000.00,'2026-06-12 17:00:00',NULL,'2026-06-03 17:58:11'),(6,3,6,60000.0000,0.0000,'pcs',1.50,90000.00,'2026-06-15 17:00:00',NULL,'2026-06-03 17:58:11'),(7,3,7,5000.0000,0.0000,'pcs',8.00,40000.00,'2026-06-15 17:00:00',NULL,'2026-06-03 17:58:11'),(8,3,45,5000.0000,0.0000,'pcs',5.00,25000.00,'2026-06-15 17:00:00',NULL,'2026-06-03 17:58:11'),(9,3,47,5000.0000,0.0000,'pcs',2.00,10000.00,'2026-06-15 17:00:00',NULL,'2026-06-03 17:58:11'),(10,4,14,10000.0000,10000.0000,'kg',50.00,500000.00,NULL,NULL,'2026-06-10 01:42:23');
/*!40000 ALTER TABLE `purchase_order_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text,
  `tax_id` varchar(50) DEFAULT NULL,
  `is_approved` tinyint(1) NOT NULL DEFAULT '0',
  `is_vmi` tinyint(1) NOT NULL DEFAULT '0',
  `lead_time_days` int DEFAULT NULL,
  `payment_terms` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,'VD-001','Thai Herb Supply Co., Ltd.','Mr. Somchai','02-123-4567',NULL,NULL,NULL,1,0,7,'Net 30',1,'2026-05-14 08:38:14','2026-05-14 08:38:14'),(2,'VD-002','Organic Farm Thailand','Ms. Suda','02-234-5678',NULL,NULL,NULL,1,0,7,'Net 30',1,'2026-05-14 08:38:14','2026-05-14 08:38:14'),(3,'VD-003','Packaging Solutions Ltd.','Mr. John','02-345-6789',NULL,NULL,NULL,1,1,7,'Net 30',1,'2026-05-14 08:38:14','2026-05-14 08:38:14');
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `approved_vendor_list`
--

DROP TABLE IF EXISTS `approved_vendor_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `approved_vendor_list` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `approval_date` datetime DEFAULT NULL,
  `expiry_date` datetime DEFAULT NULL,
  `is_preferred` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `approved_vendor_list`
--

LOCK TABLES `approved_vendor_list` WRITE;
/*!40000 ALTER TABLE `approved_vendor_list` DISABLE KEYS */;
/*!40000 ALTER TABLE `approved_vendor_list` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text,
  `tax_id` varchar(50) DEFAULT NULL,
  `customer_type` varchar(50) NOT NULL DEFAULT 'hospital',
  `credit_limit` decimal(15,2) DEFAULT NULL,
  `credit_term_days` int DEFAULT NULL,
  `payment_terms` varchar(100) DEFAULT NULL,
  `notes` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `vmi_customer_id` varchar(50) DEFAULT NULL,
  `vmi_portal_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'CUS001','โรงพยาบาลไทยสมุนไพร','คุณสมหญิง ใจดี','02-111-2233','contact@thaiherbalhospital.co.th','120 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900','0105551111111','hospital',500000.00,30,'เครดิต 30 วัน',NULL,1,NULL,NULL,'2026-06-10 03:28:59','2026-06-10 03:28:59'),(2,'CUS002','คลินิกแพทย์แผนไทยรุ่งเรือง','คุณวิชัย รุ่งเรือง','053-222-444','info@rungrueang-clinic.com','45/2 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมือง เชียงใหม่ 50200','0505552222222','clinic',200000.00,15,'เครดิต 15 วัน',NULL,1,NULL,NULL,'2026-06-10 03:28:59','2026-06-10 03:28:59'),(3,'CUS003','ร้านขายยาสุขภาพดี','คุณมานี มีสุข','02-333-5566','pharmacy.sukapabdee@gmail.com','88 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110','0105553333333','pharmacy',150000.00,30,'เครดิต 30 วัน',NULL,1,NULL,NULL,'2026-06-10 03:28:59','2026-06-10 03:28:59'),(4,'CUS004','บริษัท เนเชอรัล ดิสทริบิวชั่น จำกัด','คุณประเสริฐ ค้าไกล','02-444-7788','sales@naturaldist.co.th','199 หมู่ 5 ถนนบางนา-ตราด ตำบลบางพลีใหญ่ อำเภอบางพลี สมุทรปราการ 10540','0115554444444','distributor',1000000.00,45,'เครดิต 45 วัน',NULL,1,NULL,NULL,'2026-06-10 03:28:59','2026-06-10 03:28:59'),(5,'CUS005','สปาเพื่อสุขภาพบ้านสวน','คุณนภา ผ่อนคลาย','077-555-999','baansuan.spa@hotmail.com','12/8 หมู่ 3 ตำบลบ่อผุด อำเภอเกาะสมุย สุราษฎร์ธานี 84320','0845555555555','spa_wellness',80000.00,7,'เงินสด/เครดิต 7 วัน',NULL,1,NULL,NULL,'2026-06-10 03:28:59','2026-06-10 03:28:59');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_orders`
--

DROP TABLE IF EXISTS `sales_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `so_number` varchar(50) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `customer_contact` varchar(255) DEFAULT NULL,
  `customer_address` text,
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `order_date` datetime DEFAULT NULL,
  `required_date` datetime DEFAULT NULL,
  `shipped_date` datetime DEFAULT NULL,
  `total_amount` decimal(15,2) DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'THB',
  `payment_terms` varchar(100) DEFAULT NULL,
  `notes` text,
  `created_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `vmi_sales_order_id` int DEFAULT NULL,
  `source` varchar(20) NOT NULL DEFAULT 'direct',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `so_number` (`so_number`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_orders`
--

LOCK TABLES `sales_orders` WRITE;
/*!40000 ALTER TABLE `sales_orders` DISABLE KEYS */;
INSERT INTO `sales_orders` VALUES (1,'SO2606101207','โรงพยาบาลไทยสมุนไพร','คุณสมหญิง ใจดี','120 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900','draft','2026-06-10 03:30:23',NULL,NULL,5600.00,'THB','เครดิต 30 วัน','',1,NULL,NULL,'direct','2026-06-10 03:30:23','2026-06-10 03:30:23');
/*!40000 ALTER TABLE `sales_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_order_lines`
--

DROP TABLE IF EXISTS `sales_order_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_order_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `so_id` int NOT NULL,
  `item_id` int NOT NULL,
  `lot_id` int DEFAULT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `allocated_quantity` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `shipped_quantity` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `unit` varchar(50) NOT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `total_price` decimal(15,2) NOT NULL,
  `notes` text,
  `unit_cost` decimal(15,4) DEFAULT NULL,
  `total_cost` decimal(15,4) DEFAULT NULL,
  `margin_amount` decimal(15,4) DEFAULT NULL,
  `margin_percent` decimal(5,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_order_lines`
--

LOCK TABLES `sales_order_lines` WRITE;
/*!40000 ALTER TABLE `sales_order_lines` DISABLE KEYS */;
INSERT INTO `sales_order_lines` VALUES (1,1,9,NULL,112.0000,0.0000,0.0000,'bottle',50.00,5600.00,'',NULL,NULL,NULL,NULL,'2026-06-10 03:30:23');
/*!40000 ALTER TABLE `sales_order_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_deliveries`
--

DROP TABLE IF EXISTS `sales_deliveries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_deliveries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `so_id` int NOT NULL,
  `so_line_id` int NOT NULL,
  `item_id` int NOT NULL,
  `lot_id` int NOT NULL,
  `lot_number` varchar(50) NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `delivery_date` datetime NOT NULL,
  `delivery_number` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'shipped',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_deliveries`
--

LOCK TABLES `sales_deliveries` WRITE;
/*!40000 ALTER TABLE `sales_deliveries` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_deliveries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ar_invoices`
--

DROP TABLE IF EXISTS `ar_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ar_invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(50) NOT NULL,
  `tax_invoice_number` varchar(50) NOT NULL,
  `customer_id` int NOT NULL,
  `sales_order_id` int DEFAULT NULL,
  `invoice_date` datetime NOT NULL,
  `due_date` datetime NOT NULL,
  `description` text,
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `vat_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `paid_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(3) NOT NULL DEFAULT 'THB',
  `exchange_rate` decimal(10,6) NOT NULL DEFAULT '1.000000',
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `confirmed_by` int DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `journal_entry_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  UNIQUE KEY `tax_invoice_number` (`tax_invoice_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ar_invoices`
--

LOCK TABLES `ar_invoices` WRITE;
/*!40000 ALTER TABLE `ar_invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `ar_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ar_invoice_lines`
--

DROP TABLE IF EXISTS `ar_invoice_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ar_invoice_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ar_invoice_id` int NOT NULL,
  `line_number` int NOT NULL,
  `description` varchar(500) NOT NULL,
  `item_id` int DEFAULT NULL,
  `gl_account_id` int NOT NULL,
  `quantity` decimal(15,4) NOT NULL DEFAULT '1.0000',
  `unit_price` decimal(15,4) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `vat_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `lot_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ar_invoice_lines`
--

LOCK TABLES `ar_invoice_lines` WRITE;
/*!40000 ALTER TABLE `ar_invoice_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `ar_invoice_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ap_invoices`
--

DROP TABLE IF EXISTS `ap_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ap_invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(50) NOT NULL,
  `vendor_id` int NOT NULL,
  `purchase_order_id` int DEFAULT NULL,
  `invoice_date` datetime NOT NULL,
  `due_date` datetime NOT NULL,
  `received_date` datetime NOT NULL,
  `description` text,
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `vat_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `wht_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `paid_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(3) NOT NULL DEFAULT 'THB',
  `exchange_rate` decimal(10,6) NOT NULL DEFAULT '1.000000',
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `journal_entry_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number` (`invoice_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ap_invoices`
--

LOCK TABLES `ap_invoices` WRITE;
/*!40000 ALTER TABLE `ap_invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `ap_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ap_invoice_lines`
--

DROP TABLE IF EXISTS `ap_invoice_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ap_invoice_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ap_invoice_id` int NOT NULL,
  `line_number` int NOT NULL,
  `description` varchar(500) NOT NULL,
  `item_id` int DEFAULT NULL,
  `gl_account_id` int NOT NULL,
  `quantity` decimal(15,4) NOT NULL DEFAULT '1.0000',
  `unit_price` decimal(15,4) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `vat_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `is_capitalizable` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ap_invoice_lines`
--

LOCK TABLES `ap_invoice_lines` WRITE;
/*!40000 ALTER TABLE `ap_invoice_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `ap_invoice_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journal_entries`
--

DROP TABLE IF EXISTS `journal_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journal_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entry_number` varchar(20) NOT NULL,
  `entry_date` datetime NOT NULL,
  `fiscal_period_id` int DEFAULT NULL,
  `description` text,
  `source_type` varchar(30) DEFAULT NULL,
  `source_id` int DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `total_debit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_credit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `posted_by` int DEFAULT NULL,
  `posted_at` datetime DEFAULT NULL,
  `reversed_by` int DEFAULT NULL,
  `reversed_at` datetime DEFAULT NULL,
  `reversal_entry_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `entry_number` (`entry_number`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_entries`
--

LOCK TABLES `journal_entries` WRITE;
/*!40000 ALTER TABLE `journal_entries` DISABLE KEYS */;
INSERT INTO `journal_entries` VALUES (1,'JE-202605-000001','2026-05-22 00:00:00',5,'Material cost for WO 3 Batch B25690003','COST_ALLOCATION',3,'posted',0.00,0.00,1,'2026-05-22 04:07:14',NULL,NULL,NULL,1,'2026-05-22 04:07:14','2026-05-22 04:07:14'),(2,'JE-202605-000002','2026-05-22 00:00:00',5,'Material cost for WO 3 Batch B25690003','COST_ALLOCATION',3,'posted',0.00,0.00,1,'2026-05-22 04:07:14',NULL,NULL,NULL,1,'2026-05-22 04:07:14','2026-05-22 04:07:14'),(3,'JE-202605-000003','2026-05-22 00:00:00',5,'Material cost for WO 3 Batch B25690003','COST_ALLOCATION',3,'posted',0.00,0.00,1,'2026-05-22 04:07:14',NULL,NULL,NULL,1,'2026-05-22 04:07:14','2026-05-22 04:07:14'),(4,'JE-202605-000004','2026-05-22 00:00:00',5,'Material cost for WO 3 Batch B25690003','COST_ALLOCATION',3,'posted',0.00,0.00,1,'2026-05-22 04:07:15',NULL,NULL,NULL,1,'2026-05-22 04:07:15','2026-05-22 04:07:15'),(5,'JE-202606-000001','2026-06-07 00:00:00',6,'Material cost for WO 10 Batch B25690604-001','COST_ALLOCATION',10,'posted',5691.18,5691.18,1,'2026-06-07 15:24:07',NULL,NULL,NULL,1,'2026-06-07 15:24:07','2026-06-07 15:24:07'),(6,'JE-202606-000002','2026-06-07 00:00:00',6,'Material cost for WO 10 Batch B25690604-001','COST_ALLOCATION',10,'posted',1209.38,1209.38,1,'2026-06-07 15:24:07',NULL,NULL,NULL,1,'2026-06-07 15:24:07','2026-06-07 15:24:07'),(7,'JE-202606-000003','2026-06-07 00:00:00',6,'Material cost for WO 10 Batch B25690604-001','COST_ALLOCATION',10,'posted',1205.81,1205.81,1,'2026-06-07 15:24:08',NULL,NULL,NULL,1,'2026-06-07 15:24:08','2026-06-07 15:24:08'),(8,'JE-202606-000004','2026-06-07 00:00:00',6,'Material cost for WO 10 Batch B25690604-001','COST_ALLOCATION',10,'posted',207.39,207.39,1,'2026-06-07 15:24:08',NULL,NULL,NULL,1,'2026-06-07 15:24:08','2026-06-07 15:24:08'),(9,'JE-202606-000005','2026-06-10 00:00:00',6,'Material cost for WO 13 Batch FG-002-260610-636','COST_ALLOCATION',13,'posted',5520.00,5520.00,1,'2026-06-10 01:12:39',NULL,NULL,NULL,1,'2026-06-10 01:12:39','2026-06-10 01:12:39'),(10,'JE-202606-000006','2026-06-10 00:00:00',6,'Material cost for WO 13 Batch FG-002-260610-636','COST_ALLOCATION',13,'posted',1221.23,1221.23,1,'2026-06-10 01:12:39',NULL,NULL,NULL,1,'2026-06-10 01:12:39','2026-06-10 01:12:39'),(11,'JE-202606-000007','2026-06-10 00:00:00',6,'Material cost for WO 13 Batch FG-002-260610-636','COST_ALLOCATION',13,'posted',207.91,207.91,1,'2026-06-10 01:12:39',NULL,NULL,NULL,1,'2026-06-10 01:12:39','2026-06-10 01:12:39'),(12,'JE-202606-000008','2026-06-10 00:00:00',6,'Material cost for WO 14 Batch B260101','COST_ALLOCATION',14,'posted',10710.00,10710.00,1,'2026-06-10 18:33:37',NULL,NULL,NULL,1,'2026-06-10 18:33:37','2026-06-10 18:33:37'),(13,'JE-202606-000009','2026-06-10 00:00:00',6,'Material cost for WO 14 Batch B260101','COST_ALLOCATION',14,'posted',0.00,0.00,1,'2026-06-10 18:33:37',NULL,NULL,NULL,1,'2026-06-10 18:33:37','2026-06-10 18:33:37'),(14,'JE-202606-000010','2026-06-10 00:00:00',6,'Material cost for WO 14 Batch B260101','COST_ALLOCATION',14,'posted',0.00,0.00,1,'2026-06-10 18:33:37',NULL,NULL,NULL,1,'2026-06-10 18:33:37','2026-06-10 18:33:37'),(15,'JE-202606-000011','2026-06-10 00:00:00',6,'Material cost for WO 14 Batch B260101','COST_ALLOCATION',14,'posted',0.00,0.00,1,'2026-06-10 18:33:37',NULL,NULL,NULL,1,'2026-06-10 18:33:37','2026-06-10 18:33:37'),(16,'JE-202606-000012','2026-06-10 00:00:00',6,'Material cost for WO 15 Batch B260202','COST_ALLOCATION',15,'posted',10080.00,10080.00,1,'2026-06-10 18:33:37',NULL,NULL,NULL,1,'2026-06-10 18:33:37','2026-06-10 18:33:37'),(17,'JE-202606-000013','2026-06-10 00:00:00',6,'Material cost for WO 15 Batch B260202','COST_ALLOCATION',15,'posted',0.00,0.00,1,'2026-06-10 18:33:38',NULL,NULL,NULL,1,'2026-06-10 18:33:38','2026-06-10 18:33:38'),(18,'JE-202606-000014','2026-06-10 00:00:00',6,'Material cost for WO 15 Batch B260202','COST_ALLOCATION',15,'posted',0.00,0.00,1,'2026-06-10 18:33:38',NULL,NULL,NULL,1,'2026-06-10 18:33:38','2026-06-10 18:33:38'),(19,'JE-202606-000015','2026-06-10 00:00:00',6,'Material cost for WO 15 Batch B260202','COST_ALLOCATION',15,'posted',0.00,0.00,1,'2026-06-10 18:33:38',NULL,NULL,NULL,1,'2026-06-10 18:33:38','2026-06-10 18:33:38'),(20,'JE-202606-000016','2026-06-10 00:00:00',6,'Material cost for WO 16 Batch B260303','COST_ALLOCATION',16,'posted',13160.00,13160.00,1,'2026-06-10 18:33:38',NULL,NULL,NULL,1,'2026-06-10 18:33:38','2026-06-10 18:33:38'),(21,'JE-202606-000017','2026-06-10 00:00:00',6,'Material cost for WO 16 Batch B260303','COST_ALLOCATION',16,'posted',0.00,0.00,1,'2026-06-10 18:33:39',NULL,NULL,NULL,1,'2026-06-10 18:33:38','2026-06-10 18:33:39'),(22,'JE-202606-000018','2026-06-10 00:00:00',6,'Material cost for WO 16 Batch B260303','COST_ALLOCATION',16,'posted',0.00,0.00,1,'2026-06-10 18:33:39',NULL,NULL,NULL,1,'2026-06-10 18:33:39','2026-06-10 18:33:39'),(23,'JE-202606-000019','2026-06-10 00:00:00',6,'Material cost for WO 16 Batch B260303','COST_ALLOCATION',16,'posted',0.00,0.00,1,'2026-06-10 18:33:39',NULL,NULL,NULL,1,'2026-06-10 18:33:39','2026-06-10 18:33:39'),(24,'JE-202606-000020','2026-06-10 00:00:00',6,'Material cost for WO 17 Batch B260404','COST_ALLOCATION',17,'posted',0.00,0.00,1,'2026-06-10 18:33:39',NULL,NULL,NULL,1,'2026-06-10 18:33:39','2026-06-10 18:33:39'),(25,'JE-202606-000021','2026-06-10 00:00:00',6,'Material cost for WO 17 Batch B260404','COST_ALLOCATION',17,'posted',0.00,0.00,1,'2026-06-10 18:33:39',NULL,NULL,NULL,1,'2026-06-10 18:33:39','2026-06-10 18:33:39'),(26,'JE-202606-000022','2026-06-10 00:00:00',6,'Material cost for WO 17 Batch B260404','COST_ALLOCATION',17,'posted',0.00,0.00,1,'2026-06-10 18:33:39',NULL,NULL,NULL,1,'2026-06-10 18:33:39','2026-06-10 18:33:39'),(27,'JE-202606-000023','2026-06-10 00:00:00',6,'Material cost for WO 17 Batch B260404','COST_ALLOCATION',17,'posted',0.00,0.00,1,'2026-06-10 18:33:39',NULL,NULL,NULL,1,'2026-06-10 18:33:39','2026-06-10 18:33:39'),(28,'JE-202606-000024','2026-06-10 00:00:00',6,'Material cost for WO 18 Batch B260505','COST_ALLOCATION',18,'posted',0.00,0.00,1,'2026-06-10 18:33:40',NULL,NULL,NULL,1,'2026-06-10 18:33:40','2026-06-10 18:33:40'),(29,'JE-202606-000025','2026-06-10 00:00:00',6,'Material cost for WO 18 Batch B260505','COST_ALLOCATION',18,'posted',0.00,0.00,1,'2026-06-10 18:33:40',NULL,NULL,NULL,1,'2026-06-10 18:33:40','2026-06-10 18:33:40'),(30,'JE-202606-000026','2026-06-10 00:00:00',6,'Material cost for WO 19 Batch B260606','COST_ALLOCATION',19,'posted',0.00,0.00,1,'2026-06-10 18:33:40',NULL,NULL,NULL,1,'2026-06-10 18:33:40','2026-06-10 18:33:40'),(31,'JE-202606-000027','2026-06-10 00:00:00',6,'Material cost for WO 19 Batch B260606','COST_ALLOCATION',19,'posted',0.00,0.00,1,'2026-06-10 18:33:40',NULL,NULL,NULL,1,'2026-06-10 18:33:40','2026-06-10 18:33:40'),(32,'JE-202606-000028','2026-06-10 00:00:00',6,'Material cost for WO 19 Batch B260606','COST_ALLOCATION',19,'posted',0.00,0.00,1,'2026-06-10 18:33:41',NULL,NULL,NULL,1,'2026-06-10 18:33:41','2026-06-10 18:33:41'),(33,'JE-202606-000029','2026-06-10 00:00:00',6,'Material cost for WO 20 Batch B260707','COST_ALLOCATION',20,'posted',0.00,0.00,1,'2026-06-10 18:33:41',NULL,NULL,NULL,1,'2026-06-10 18:33:41','2026-06-10 18:33:41'),(34,'JE-202606-000030','2026-06-10 00:00:00',6,'Material cost for WO 20 Batch B260707','COST_ALLOCATION',20,'posted',0.00,0.00,1,'2026-06-10 18:33:41',NULL,NULL,NULL,1,'2026-06-10 18:33:41','2026-06-10 18:33:41'),(35,'JE-202606-000031','2026-06-10 00:00:00',6,'Material cost for WO 20 Batch B260707','COST_ALLOCATION',20,'posted',0.00,0.00,1,'2026-06-10 18:33:41',NULL,NULL,NULL,1,'2026-06-10 18:33:41','2026-06-10 18:33:41'),(36,'JE-202606-000032','2026-06-10 00:00:00',6,'Material cost for WO 20 Batch B260707','COST_ALLOCATION',20,'posted',0.00,0.00,1,'2026-06-10 18:33:41',NULL,NULL,NULL,1,'2026-06-10 18:33:41','2026-06-10 18:33:41'),(37,'JE-202606-000033','2026-06-10 00:00:00',6,'Material cost for WO 21 Batch B260808','COST_ALLOCATION',21,'posted',488.21,488.21,1,'2026-06-10 18:33:42',NULL,NULL,NULL,1,'2026-06-10 18:33:42','2026-06-10 18:33:42'),(38,'JE-202606-000034','2026-06-10 00:00:00',6,'Material cost for WO 21 Batch B260808','COST_ALLOCATION',21,'posted',149.02,149.02,1,'2026-06-10 18:33:42',NULL,NULL,NULL,1,'2026-06-10 18:33:42','2026-06-10 18:33:42'),(39,'JE-202606-000035','2026-06-10 00:00:00',6,'Material cost for WO 21 Batch B260808','COST_ALLOCATION',21,'posted',0.00,0.00,1,'2026-06-10 18:33:42',NULL,NULL,NULL,1,'2026-06-10 18:33:42','2026-06-10 18:33:42'),(40,'JE-202606-000036','2026-06-10 00:00:00',6,'Material cost for WO 21 Batch B260808','COST_ALLOCATION',21,'posted',0.00,0.00,1,'2026-06-10 18:33:42',NULL,NULL,NULL,1,'2026-06-10 18:33:42','2026-06-10 18:33:42'),(41,'JE-202606-000037','2026-06-10 00:00:00',6,'Material cost for WO 22 Batch B260909','COST_ALLOCATION',22,'posted',0.00,0.00,1,'2026-06-10 18:33:42',NULL,NULL,NULL,1,'2026-06-10 18:33:42','2026-06-10 18:33:42'),(42,'JE-202606-000038','2026-06-10 00:00:00',6,'Material cost for WO 22 Batch B260909','COST_ALLOCATION',22,'posted',0.00,0.00,1,'2026-06-10 18:33:42',NULL,NULL,NULL,1,'2026-06-10 18:33:42','2026-06-10 18:33:42'),(43,'JE-202606-000039','2026-06-10 00:00:00',6,'Material cost for WO 22 Batch B260909','COST_ALLOCATION',22,'posted',0.00,0.00,1,'2026-06-10 18:33:43',NULL,NULL,NULL,1,'2026-06-10 18:33:42','2026-06-10 18:33:43'),(44,'JE-202606-000040','2026-06-10 00:00:00',6,'Material cost for WO 22 Batch B260909','COST_ALLOCATION',22,'posted',0.00,0.00,1,'2026-06-10 18:33:43',NULL,NULL,NULL,1,'2026-06-10 18:33:43','2026-06-10 18:33:43'),(45,'JE-202606-000041','2026-06-10 00:00:00',6,'Material cost for WO 22 Batch B260909','COST_ALLOCATION',22,'posted',0.00,0.00,1,'2026-06-10 18:33:43',NULL,NULL,NULL,1,'2026-06-10 18:33:43','2026-06-10 18:33:43'),(46,'JE-202606-000042','2026-06-10 00:00:00',6,'Material cost for WO 24 Batch B261111','COST_ALLOCATION',24,'posted',0.00,0.00,1,'2026-06-10 18:33:43',NULL,NULL,NULL,1,'2026-06-10 18:33:43','2026-06-10 18:33:43'),(47,'JE-202606-000043','2026-06-10 00:00:00',6,'Material cost for WO 24 Batch B261111','COST_ALLOCATION',24,'posted',0.00,0.00,1,'2026-06-10 18:33:43',NULL,NULL,NULL,1,'2026-06-10 18:33:43','2026-06-10 18:33:43'),(48,'JE-202606-000044','2026-06-10 00:00:00',6,'Material cost for WO 24 Batch B261111','COST_ALLOCATION',24,'posted',0.00,0.00,1,'2026-06-10 18:33:44',NULL,NULL,NULL,1,'2026-06-10 18:33:43','2026-06-10 18:33:44'),(49,'JE-202606-000045','2026-06-10 00:00:00',6,'Material cost for WO 24 Batch B261111','COST_ALLOCATION',24,'posted',0.00,0.00,1,'2026-06-10 18:33:44',NULL,NULL,NULL,1,'2026-06-10 18:33:44','2026-06-10 18:33:44'),(50,'JE-202606-000046','2026-06-10 00:00:00',6,'Material cost for WO 26 Batch B261313','COST_ALLOCATION',26,'posted',0.00,0.00,1,'2026-06-10 18:33:44',NULL,NULL,NULL,1,'2026-06-10 18:33:44','2026-06-10 18:33:44'),(51,'JE-202606-000047','2026-06-10 00:00:00',6,'Material cost for WO 26 Batch B261313','COST_ALLOCATION',26,'posted',0.00,0.00,1,'2026-06-10 18:33:44',NULL,NULL,NULL,1,'2026-06-10 18:33:44','2026-06-10 18:33:44'),(52,'JE-202606-000048','2026-06-10 00:00:00',6,'Material cost for WO 26 Batch B261313','COST_ALLOCATION',26,'posted',921.69,921.69,1,'2026-06-10 18:33:44',NULL,NULL,NULL,1,'2026-06-10 18:33:44','2026-06-10 18:33:44'),(53,'JE-202606-000049','2026-06-10 00:00:00',6,'Material cost for WO 26 Batch B261313','COST_ALLOCATION',26,'posted',0.00,0.00,1,'2026-06-10 18:33:44',NULL,NULL,NULL,1,'2026-06-10 18:33:44','2026-06-10 18:33:44');
/*!40000 ALTER TABLE `journal_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journal_lines`
--

DROP TABLE IF EXISTS `journal_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journal_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `journal_entry_id` int NOT NULL,
  `line_number` int NOT NULL,
  `gl_account_id` int NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `credit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `description` text,
  `cost_center_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=107 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_lines`
--

LOCK TABLES `journal_lines` WRITE;
/*!40000 ALTER TABLE `journal_lines` DISABLE KEYS */;
INSERT INTO `journal_lines` VALUES (1,1,1,13,0.00,0.00,'Material issue: Material issue: LOT-RM-004-EXP for WO WO-2569-003',NULL,'2026-05-22 04:07:14'),(2,1,2,12,0.00,0.00,'Material issue: Material issue: LOT-RM-004-EXP for WO WO-2569-003',NULL,'2026-05-22 04:07:14'),(3,2,1,13,0.00,0.00,'Material issue: Material issue: LOT-RM-004-001 for WO WO-2569-003',NULL,'2026-05-22 04:07:14'),(4,2,2,12,0.00,0.00,'Material issue: Material issue: LOT-RM-004-001 for WO WO-2569-003',NULL,'2026-05-22 04:07:14'),(5,3,1,13,0.00,0.00,'Material issue: Material issue: LOT-EXC-001-001 for WO WO-2569-003',NULL,'2026-05-22 04:07:14'),(6,3,2,12,0.00,0.00,'Material issue: Material issue: LOT-EXC-001-001 for WO WO-2569-003',NULL,'2026-05-22 04:07:14'),(7,4,1,13,0.00,0.00,'Material issue: Material issue: LOT-EXC-002-001 for WO WO-2569-003',NULL,'2026-05-22 04:07:15'),(8,4,2,12,0.00,0.00,'Material issue: Material issue: LOT-EXC-002-001 for WO WO-2569-003',NULL,'2026-05-22 04:07:15'),(9,5,1,13,5691.18,0.00,'Material issue: Material issue: LOT-EX-001-NEAR for WO WO-2569-010',NULL,'2026-06-07 15:24:07'),(10,5,2,12,0.00,5691.18,'Material issue: Material issue: LOT-EX-001-NEAR for WO WO-2569-010',NULL,'2026-06-07 15:24:07'),(11,6,1,13,1209.38,0.00,'Material issue: Material issue: LOT-EX-001-001 for WO WO-2569-010',NULL,'2026-06-07 15:24:07'),(12,6,2,12,0.00,1209.38,'Material issue: Material issue: LOT-EX-001-001 for WO WO-2569-010',NULL,'2026-06-07 15:24:07'),(13,7,1,13,1205.81,0.00,'Material issue: Material issue: LOT-EXC-001-001 for WO WO-2569-010',NULL,'2026-06-07 15:24:08'),(14,7,2,12,0.00,1205.81,'Material issue: Material issue: LOT-EXC-001-001 for WO WO-2569-010',NULL,'2026-06-07 15:24:08'),(15,8,1,13,207.39,0.00,'Material issue: Material issue: LOT-EXC-002-001 for WO WO-2569-010',NULL,'2026-06-07 15:24:08'),(16,8,2,12,0.00,207.39,'Material issue: Material issue: LOT-EXC-002-001 for WO WO-2569-010',NULL,'2026-06-07 15:24:08'),(17,9,1,13,5520.00,0.00,'Material issue: Material issue: LOT-EX-002-001 for WO WO2606108311',NULL,'2026-06-10 01:12:39'),(18,9,2,12,0.00,5520.00,'Material issue: Material issue: LOT-EX-002-001 for WO WO2606108311',NULL,'2026-06-10 01:12:39'),(19,10,1,13,1221.23,0.00,'Material issue: Material issue: LOT-EXC-001-001 for WO WO2606108311',NULL,'2026-06-10 01:12:39'),(20,10,2,12,0.00,1221.23,'Material issue: Material issue: LOT-EXC-001-001 for WO WO2606108311',NULL,'2026-06-10 01:12:39'),(21,11,1,13,207.91,0.00,'Material issue: Material issue: LOT-EXC-002-001 for WO WO2606108311',NULL,'2026-06-10 01:12:39'),(22,11,2,12,0.00,207.91,'Material issue: Material issue: LOT-EXC-002-001 for WO WO2606108311',NULL,'2026-06-10 01:12:39'),(23,12,1,13,10710.00,0.00,'Material issue: Material issue: LOT-RM0001-2601 for WO WO2606101239',NULL,'2026-06-10 18:33:37'),(24,12,2,12,0.00,10710.00,'Material issue: Material issue: LOT-RM0001-2601 for WO WO2606101239',NULL,'2026-06-10 18:33:37'),(25,13,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0003 for WO WO2606101239',NULL,'2026-06-10 18:33:37'),(26,13,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0003 for WO WO2606101239',NULL,'2026-06-10 18:33:37'),(27,14,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0002 for WO WO2606101239',NULL,'2026-06-10 18:33:37'),(28,14,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0002 for WO WO2606101239',NULL,'2026-06-10 18:33:37'),(29,15,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0001 for WO WO2606101239',NULL,'2026-06-10 18:33:37'),(30,15,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0001 for WO WO2606101239',NULL,'2026-06-10 18:33:37'),(31,16,1,13,10080.00,0.00,'Material issue: Material issue: LOT-RM0002-2602 for WO WO2606104869',NULL,'2026-06-10 18:33:37'),(32,16,2,12,0.00,10080.00,'Material issue: Material issue: LOT-RM0002-2602 for WO WO2606104869',NULL,'2026-06-10 18:33:37'),(33,17,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0003 for WO WO2606104869',NULL,'2026-06-10 18:33:38'),(34,17,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0003 for WO WO2606104869',NULL,'2026-06-10 18:33:38'),(35,18,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0002 for WO WO2606104869',NULL,'2026-06-10 18:33:38'),(36,18,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0002 for WO WO2606104869',NULL,'2026-06-10 18:33:38'),(37,19,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0001 for WO WO2606104869',NULL,'2026-06-10 18:33:38'),(38,19,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0001 for WO WO2606104869',NULL,'2026-06-10 18:33:38'),(39,20,1,13,13160.00,0.00,'Material issue: Material issue: LOT-RM0003-2602 for WO WO2606101005',NULL,'2026-06-10 18:33:38'),(40,20,2,12,0.00,13160.00,'Material issue: Material issue: LOT-RM0003-2602 for WO WO2606101005',NULL,'2026-06-10 18:33:38'),(41,21,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0003 for WO WO2606101005',NULL,'2026-06-10 18:33:38'),(42,21,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0003 for WO WO2606101005',NULL,'2026-06-10 18:33:38'),(43,22,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0002 for WO WO2606101005',NULL,'2026-06-10 18:33:39'),(44,22,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0002 for WO WO2606101005',NULL,'2026-06-10 18:33:39'),(45,23,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0001 for WO WO2606101005',NULL,'2026-06-10 18:33:39'),(46,23,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0001 for WO WO2606101005',NULL,'2026-06-10 18:33:39'),(47,24,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0004 for WO WO2606108923',NULL,'2026-06-10 18:33:39'),(48,24,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0004 for WO WO2606108923',NULL,'2026-06-10 18:33:39'),(49,25,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0003 for WO WO2606108923',NULL,'2026-06-10 18:33:39'),(50,25,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0003 for WO WO2606108923',NULL,'2026-06-10 18:33:39'),(51,26,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0002 for WO WO2606108923',NULL,'2026-06-10 18:33:39'),(52,26,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0002 for WO WO2606108923',NULL,'2026-06-10 18:33:39'),(53,27,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0001 for WO WO2606108923',NULL,'2026-06-10 18:33:39'),(54,27,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0001 for WO WO2606108923',NULL,'2026-06-10 18:33:39'),(55,28,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0005 for WO WO2606105198',NULL,'2026-06-10 18:33:40'),(56,28,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0005 for WO WO2606105198',NULL,'2026-06-10 18:33:40'),(57,29,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0004 for WO WO2606105198',NULL,'2026-06-10 18:33:40'),(58,29,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0004 for WO WO2606105198',NULL,'2026-06-10 18:33:40'),(59,30,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0006 for WO WO2606106122',NULL,'2026-06-10 18:33:40'),(60,30,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0006 for WO WO2606106122',NULL,'2026-06-10 18:33:40'),(61,31,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0005 for WO WO2606106122',NULL,'2026-06-10 18:33:40'),(62,31,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0005 for WO WO2606106122',NULL,'2026-06-10 18:33:40'),(63,32,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0004 for WO WO2606106122',NULL,'2026-06-10 18:33:41'),(64,32,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0004 for WO WO2606106122',NULL,'2026-06-10 18:33:41'),(65,33,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0007 for WO WO2606109427',NULL,'2026-06-10 18:33:41'),(66,33,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0007 for WO WO2606109427',NULL,'2026-06-10 18:33:41'),(67,34,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0004 for WO WO2606109427',NULL,'2026-06-10 18:33:41'),(68,34,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0004 for WO WO2606109427',NULL,'2026-06-10 18:33:41'),(69,35,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0008 for WO WO2606109427',NULL,'2026-06-10 18:33:41'),(70,35,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0008 for WO WO2606109427',NULL,'2026-06-10 18:33:41'),(71,36,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0007 for WO WO2606109427',NULL,'2026-06-10 18:33:41'),(72,36,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0007 for WO WO2606109427',NULL,'2026-06-10 18:33:41'),(73,37,1,13,488.21,0.00,'Material issue: Material issue: LOT-RM0001-2601 for WO WO2606107057',NULL,'2026-06-10 18:33:42'),(74,37,2,12,0.00,488.21,'Material issue: Material issue: LOT-RM0001-2601 for WO WO2606107057',NULL,'2026-06-10 18:33:42'),(75,38,1,13,149.02,0.00,'Material issue: Material issue: LOT-RM0002-2602 for WO WO2606107057',NULL,'2026-06-10 18:33:42'),(76,38,2,12,0.00,149.02,'Material issue: Material issue: LOT-RM0002-2602 for WO WO2606107057',NULL,'2026-06-10 18:33:42'),(77,39,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0004 for WO WO2606107057',NULL,'2026-06-10 18:33:42'),(78,39,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0004 for WO WO2606107057',NULL,'2026-06-10 18:33:42'),(79,40,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0008 for WO WO2606107057',NULL,'2026-06-10 18:33:42'),(80,40,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0008 for WO WO2606107057',NULL,'2026-06-10 18:33:42'),(81,41,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0012 for WO WO2606107947',NULL,'2026-06-10 18:33:42'),(82,41,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0012 for WO WO2606107947',NULL,'2026-06-10 18:33:42'),(83,42,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0006 for WO WO2606107947',NULL,'2026-06-10 18:33:42'),(84,42,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-EX-0006 for WO WO2606107947',NULL,'2026-06-10 18:33:42'),(85,43,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0011 for WO WO2606107947',NULL,'2026-06-10 18:33:42'),(86,43,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0011 for WO WO2606107947',NULL,'2026-06-10 18:33:42'),(87,44,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0010 for WO WO2606107947',NULL,'2026-06-10 18:33:43'),(88,44,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0010 for WO WO2606107947',NULL,'2026-06-10 18:33:43'),(89,45,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0009 for WO WO2606107947',NULL,'2026-06-10 18:33:43'),(90,45,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0009 for WO WO2606107947',NULL,'2026-06-10 18:33:43'),(91,46,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0015 for WO WO2606106191',NULL,'2026-06-10 18:33:43'),(92,46,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0015 for WO WO2606106191',NULL,'2026-06-10 18:33:43'),(93,47,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0014 for WO WO2606106191',NULL,'2026-06-10 18:33:43'),(94,47,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0014 for WO WO2606106191',NULL,'2026-06-10 18:33:43'),(95,48,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0011 for WO WO2606106191',NULL,'2026-06-10 18:33:43'),(96,48,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0011 for WO WO2606106191',NULL,'2026-06-10 18:33:43'),(97,49,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0010 for WO WO2606106191',NULL,'2026-06-10 18:33:44'),(98,49,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0010 for WO WO2606106191',NULL,'2026-06-10 18:33:44'),(99,50,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0017 for WO WO2606106047',NULL,'2026-06-10 18:33:44'),(100,50,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0017 for WO WO2606106047',NULL,'2026-06-10 18:33:44'),(101,51,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0016 for WO WO2606106047',NULL,'2026-06-10 18:33:44'),(102,51,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0016 for WO WO2606106047',NULL,'2026-06-10 18:33:44'),(103,52,1,13,921.69,0.00,'Material issue: Material issue: LOT-RM0001-2601 for WO WO2606106047',NULL,'2026-06-10 18:33:44'),(104,52,2,12,0.00,921.69,'Material issue: Material issue: LOT-RM0001-2601 for WO WO2606106047',NULL,'2026-06-10 18:33:44'),(105,53,1,13,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0010 for WO WO2606106047',NULL,'2026-06-10 18:33:44'),(106,53,2,12,0.00,0.00,'Material issue: Material issue: LOT-WOSEED-RM-0010 for WO WO2606106047',NULL,'2026-06-10 18:33:44');
/*!40000 ALTER TABLE `journal_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gl_accounts`
--

DROP TABLE IF EXISTS `gl_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gl_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `name_th` varchar(200) NOT NULL,
  `name_en` varchar(200) NOT NULL,
  `account_type_id` int NOT NULL,
  `parent_id` int DEFAULT NULL,
  `level` int NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_postable` tinyint(1) NOT NULL DEFAULT '1',
  `is_bank_account` tinyint(1) NOT NULL DEFAULT '0',
  `bank_name` varchar(100) DEFAULT NULL,
  `bank_account_number` varchar(50) DEFAULT NULL,
  `description` text,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gl_accounts`
--

LOCK TABLES `gl_accounts` WRITE;
/*!40000 ALTER TABLE `gl_accounts` DISABLE KEYS */;
INSERT INTO `gl_accounts` VALUES (1,'1100','สินทรัพย์หมุนเวียน','Current Assets',1,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:46'),(2,'1110','เงินสดและรายการเทียบเท่าเงินสด','Cash and Cash Equivalents',1,1,2,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(3,'1111','เงินสด','Cash on Hand',1,2,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(4,'1112','เงินฝากธนาคาร - ออมทรัพย์','Bank - Savings Account',1,2,3,1,1,1,'ธนาคารกรุงเทพ (Bangkok Bank)','XXX-X-XXXXX-X',NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:48'),(5,'1113','เงินฝากธนาคาร - กระแสรายวัน','Bank - Current Account',1,2,3,1,1,1,'ธนาคารกสิกรไทย (Kasikorn Bank)','XXX-X-XXXXX-X',NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:48'),(6,'1114','เงินสดย่อย','Petty Cash',1,2,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(7,'1120','ลูกหนี้การค้า','Accounts Receivable',1,1,2,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(8,'1121','ลูกหนี้การค้า - ในประเทศ','AR - Domestic',1,7,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(9,'1122','ลูกหนี้การค้า - ต่างประเทศ','AR - Foreign',1,7,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(10,'1129','ค่าเผื่อหนี้สงสัยจะสูญ','Allowance for Doubtful Accounts',1,7,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(11,'1130','สินค้าคงเหลือ','Inventory',1,1,2,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(12,'1131','วัตถุดิบ','Raw Materials',1,11,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(13,'1132','งานระหว่างทำ','Work in Process',1,11,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(14,'1133','สินค้าสำเร็จรูป','Finished Goods',1,11,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(15,'1134','วัสดุบรรจุภัณฑ์','Packaging Materials',1,11,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(16,'1135','วัสดุสิ้นเปลือง','Supplies',1,11,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(17,'1140','สินทรัพย์หมุนเวียนอื่น','Other Current Assets',1,1,2,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(18,'1141','ภาษีซื้อรอเครดิต','Input VAT Pending',1,17,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(19,'1142','ภาษีซื้อ','Input VAT',1,17,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(20,'1143','ค่าใช้จ่ายจ่ายล่วงหน้า','Prepaid Expenses',1,17,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(21,'1144','เงินมัดจำ','Deposits',1,17,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(22,'1200','สินทรัพย์ไม่หมุนเวียน','Non-Current Assets',1,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:46'),(23,'1210','ที่ดิน อาคาร และอุปกรณ์','Property, Plant and Equipment',1,22,2,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(24,'1211','ที่ดิน','Land',1,23,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(25,'1212','อาคารและสิ่งปลูกสร้าง','Buildings',1,23,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(26,'1213','เครื่องจักรและอุปกรณ์','Machinery and Equipment',1,23,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(27,'1214','เครื่องใช้สำนักงาน','Office Equipment',1,23,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(28,'1215','ยานพาหนะ','Vehicles',1,23,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(29,'1216','เครื่องตกแต่งและติดตั้ง','Furniture and Fixtures',1,23,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(30,'1217','อุปกรณ์คอมพิวเตอร์','Computer Equipment',1,23,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(31,'1218','สินทรัพย์ระหว่างก่อสร้าง','Construction in Progress',1,23,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(32,'1220','ค่าเสื่อมราคาสะสม','Accumulated Depreciation',1,22,2,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(33,'1222','ค่าเสื่อมราคาสะสม - อาคาร','Accum. Depreciation - Buildings',1,32,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(34,'1223','ค่าเสื่อมราคาสะสม - เครื่องจักร','Accum. Depreciation - Machinery',1,32,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(35,'1224','ค่าเสื่อมราคาสะสม - เครื่องใช้สำนักงาน','Accum. Depreciation - Office Equipment',1,32,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(36,'1225','ค่าเสื่อมราคาสะสม - ยานพาหนะ','Accum. Depreciation - Vehicles',1,32,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(37,'1226','ค่าเสื่อมราคาสะสม - เครื่องตกแต่ง','Accum. Depreciation - F&F',1,32,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(38,'1227','ค่าเสื่อมราคาสะสม - คอมพิวเตอร์','Accum. Depreciation - Computer',1,32,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(39,'1230','สินทรัพย์ไม่มีตัวตน','Intangible Assets',1,22,2,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(40,'1231','ลิขสิทธิ์และสิทธิบัตร','Copyrights and Patents',1,39,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(41,'1232','โปรแกรมคอมพิวเตอร์','Software',1,39,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(42,'1239','ค่าตัดจำหน่ายสะสม','Accumulated Amortization',1,39,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(43,'2100','หนี้สินหมุนเวียน','Current Liabilities',2,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:46'),(44,'2110','เจ้าหนี้การค้า','Accounts Payable',2,43,2,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(45,'2111','เจ้าหนี้การค้า - ในประเทศ','AP - Domestic',2,44,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(46,'2112','เจ้าหนี้การค้า - ต่างประเทศ','AP - Foreign',2,44,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(47,'2120','เจ้าหนี้อื่น','Other Payables',2,43,2,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(48,'2121','ค่าใช้จ่ายค้างจ่าย','Accrued Expenses',2,47,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(49,'2122','เงินรับล่วงหน้า','Advances from Customers',2,47,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(50,'2123','เงินประกัน','Deposits Received',2,47,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(51,'2130','ภาษีค้างจ่าย','Taxes Payable',2,43,2,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(52,'2131','ภาษีขาย','Output VAT',2,51,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(53,'2132','ภาษีหัก ณ ที่จ่ายค้างจ่าย','WHT Payable',2,51,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(54,'2133','ภาษีเงินได้นิติบุคคลค้างจ่าย','Corporate Income Tax Payable',2,51,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(55,'2134','ประกันสังคมค้างจ่าย','Social Security Payable',2,51,3,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(56,'2140','เงินกู้ยืมระยะสั้น','Short-term Loans',2,43,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(57,'2150','เงินกู้ยืมระยะยาวครบกำหนดภายใน 1 ปี','Current Portion of Long-term Debt',2,43,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(58,'2200','หนี้สินไม่หมุนเวียน','Non-Current Liabilities',2,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:46'),(59,'2210','เงินกู้ยืมระยะยาว','Long-term Loans',2,58,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(60,'2220','หนี้สินภาษีเงินได้รอตัดบัญชี','Deferred Tax Liabilities',2,58,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(61,'2230','ภาระผูกพันผลประโยชน์พนักงาน','Employee Benefit Obligations',2,58,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(62,'3100','ทุน','Share Capital',3,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:46'),(63,'3110','ทุนจดทะเบียน','Registered Capital',3,62,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:46','2026-05-14 04:40:47'),(64,'3120','ทุนที่ออกและชำระแล้ว','Issued and Paid-up Capital',3,62,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(65,'3130','ส่วนเกินมูลค่าหุ้น','Share Premium',3,62,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(66,'3200','กำไรสะสม','Retained Earnings',3,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(67,'3210','สำรองตามกฎหมาย','Legal Reserve',3,66,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(68,'3220','กำไรสะสมยังไม่ได้จัดสรร','Unappropriated Retained Earnings',3,66,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(69,'3230','กำไร(ขาดทุน)สุทธิประจำปี','Net Income (Loss) for the Year',3,66,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(70,'4100','รายได้จากการขาย','Sales Revenue',4,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(71,'4110','รายได้จากการขายสินค้า','Sales of Goods',4,70,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(72,'4120','รายได้จากการให้บริการ','Service Revenue',4,70,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(73,'4130','รายได้จากการขาย - ส่งออก','Export Sales',4,70,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(74,'4190','ส่วนลดการขาย','Sales Discounts',4,70,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(75,'4191','รับคืนสินค้า','Sales Returns',4,70,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(76,'5100','ต้นทุนขาย','Cost of Goods Sold',5,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(77,'5110','ต้นทุนวัตถุดิบใช้ไป','Raw Materials Used',5,76,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(78,'5120','ค่าแรงงานทางตรง','Direct Labor',5,76,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(79,'5130','ค่าใช้จ่ายการผลิต','Manufacturing Overhead',5,76,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(80,'5140','ค่าเสื่อมราคา - เครื่องจักร','Depreciation - Machinery',5,76,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(81,'5150','ค่าสาธารณูปโภค - โรงงาน','Utilities - Factory',5,76,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(82,'5160','ค่าซ่อมแซมและบำรุงรักษา','Repairs and Maintenance',5,76,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(83,'6100','ค่าใช้จ่ายในการขาย','Selling Expenses',6,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(84,'6110','เงินเดือนพนักงานขาย','Sales Salaries',6,83,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(85,'6120','ค่าคอมมิชชั่น','Commissions',6,83,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(86,'6130','ค่าโฆษณาและส่งเสริมการขาย','Advertising and Promotion',6,83,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(87,'6140','ค่าขนส่ง','Freight Out',6,83,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(88,'6150','ค่าเดินทาง','Travel Expenses',6,83,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(89,'6200','ค่าใช้จ่ายในการบริหาร','Administrative Expenses',6,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(90,'6210','เงินเดือนและค่าจ้าง','Salaries and Wages',6,89,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(91,'6220','ค่าสวัสดิการพนักงาน','Employee Benefits',6,89,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(92,'6230','เงินสมทบประกันสังคม','Social Security Contributions',6,89,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(93,'6240','เงินสมทบกองทุนสำรองเลี้ยงชีพ','Provident Fund Contributions',6,89,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(94,'6250','ค่าเช่าสำนักงาน','Office Rent',6,89,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(95,'6260','ค่าสาธารณูปโภค - สำนักงาน','Utilities - Office',6,89,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(96,'6270','ค่าเสื่อมราคา - สำนักงาน','Depreciation - Office',6,89,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(97,'6280','ค่าที่ปรึกษาและวิชาชีพ','Professional Fees',6,89,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(98,'6290','ค่าใช้จ่ายบริหารอื่น','Other Administrative Expenses',6,89,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(99,'7100','รายได้อื่น','Other Income',7,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(100,'7110','ดอกเบี้ยรับ','Interest Income',7,99,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(101,'7120','กำไรจากการขายสินทรัพย์','Gain on Sale of Assets',7,99,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(102,'7130','รายได้อื่น','Other Miscellaneous Income',7,99,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(103,'7200','ค่าใช้จ่ายอื่น','Other Expenses',7,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(104,'7210','ดอกเบี้ยจ่าย','Interest Expense',7,103,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(105,'7220','ขาดทุนจากการขายสินทรัพย์','Loss on Sale of Assets',7,103,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(106,'7230','ค่าปรับ','Penalties',7,103,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(107,'7240','ค่าใช้จ่ายอื่น','Other Miscellaneous Expenses',7,103,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(108,'7300','ภาษีเงินได้','Income Tax',7,NULL,1,1,0,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47'),(109,'7310','ภาษีเงินได้นิติบุคคล','Corporate Income Tax',7,108,2,1,1,0,NULL,NULL,NULL,1,'2026-05-14 04:40:47','2026-05-14 04:40:47');
/*!40000 ALTER TABLE `gl_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `standard_costs`
--

DROP TABLE IF EXISTS `standard_costs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `standard_costs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `effective_date` datetime NOT NULL,
  `material_cost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `labor_cost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `overhead_cost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `total_cost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `standard_hours` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `standard_labor_rate` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `notes` text,
  `is_current` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `standard_costs`
--

LOCK TABLES `standard_costs` WRITE;
/*!40000 ALTER TABLE `standard_costs` DISABLE KEYS */;
/*!40000 ALTER TABLE `standard_costs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_cost_layers`
--

DROP TABLE IF EXISTS `item_cost_layers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_cost_layers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `transaction_type` varchar(20) NOT NULL,
  `transaction_id` int NOT NULL,
  `transaction_date` datetime NOT NULL,
  `quantity_in` decimal(15,4) NOT NULL,
  `unit_cost` decimal(15,4) NOT NULL,
  `total_cost` decimal(15,4) NOT NULL,
  `running_qty` decimal(15,4) NOT NULL,
  `running_total_cost` decimal(15,4) NOT NULL,
  `running_wac` decimal(15,4) NOT NULL,
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT '2026-05-14 04:40:28',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_cost_layers`
--

LOCK TABLES `item_cost_layers` WRITE;
/*!40000 ALTER TABLE `item_cost_layers` DISABLE KEYS */;
/*!40000 ALTER TABLE `item_cost_layers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `landed_cost_headers`
--

DROP TABLE IF EXISTS `landed_cost_headers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `landed_cost_headers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_number` varchar(30) NOT NULL,
  `reference_type` varchar(20) NOT NULL,
  `reference_id` int NOT NULL,
  `vendor_id` int DEFAULT NULL,
  `invoice_number` varchar(50) DEFAULT NULL,
  `invoice_date` datetime DEFAULT NULL,
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(3) NOT NULL DEFAULT 'THB',
  `exchange_rate` decimal(10,6) NOT NULL DEFAULT '1.000000',
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `posted_at` datetime DEFAULT NULL,
  `posted_by` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT '2026-05-14 04:40:28',
  `updated_at` datetime NOT NULL DEFAULT '2026-05-14 04:40:28',
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_number` (`document_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `landed_cost_headers`
--

LOCK TABLES `landed_cost_headers` WRITE;
/*!40000 ALTER TABLE `landed_cost_headers` DISABLE KEYS */;
/*!40000 ALTER TABLE `landed_cost_headers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `landed_cost_lines`
--

DROP TABLE IF EXISTS `landed_cost_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `landed_cost_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `landed_cost_header_id` int NOT NULL,
  `cost_type` varchar(20) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `allocation_basis` varchar(20) NOT NULL DEFAULT 'value',
  `created_at` datetime NOT NULL DEFAULT '2026-05-14 04:40:28',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `landed_cost_lines`
--

LOCK TABLES `landed_cost_lines` WRITE;
/*!40000 ALTER TABLE `landed_cost_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `landed_cost_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hr_employees`
--

DROP TABLE IF EXISTS `hr_employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hr_employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `employee_code` varchar(20) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `first_name_en` varchar(50) DEFAULT NULL,
  `last_name_en` varchar(50) DEFAULT NULL,
  `nickname` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `thai_cid` varchar(255) DEFAULT NULL,
  `thai_cid_hash` varchar(64) DEFAULT NULL,
  `date_of_birth` datetime DEFAULT NULL,
  `gender` varchar(10) DEFAULT NULL,
  `blood_type` varchar(5) DEFAULT NULL,
  `religion` varchar(30) DEFAULT NULL,
  `marital_status` varchar(20) DEFAULT NULL,
  `nationality_code` varchar(3) DEFAULT 'TH',
  `photo_url` varchar(255) DEFAULT NULL,
  `photo_thumbnail_url` varchar(255) DEFAULT NULL,
  `sso_number` varchar(255) DEFAULT NULL,
  `tax_id` varchar(255) DEFAULT NULL,
  `address_line1` varchar(255) DEFAULT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `sub_district` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `permanent_address_line1` varchar(255) DEFAULT NULL,
  `permanent_address_line2` varchar(255) DEFAULT NULL,
  `permanent_sub_district` varchar(100) DEFAULT NULL,
  `permanent_district` varchar(100) DEFAULT NULL,
  `permanent_province` varchar(100) DEFAULT NULL,
  `permanent_postal_code` varchar(10) DEFAULT NULL,
  `use_same_address` tinyint(1) DEFAULT '0',
  `emergency_contact_name` varchar(100) DEFAULT NULL,
  `emergency_contact_relation` varchar(50) DEFAULT NULL,
  `emergency_contact_phone` varchar(20) DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `bank_branch` varchar(100) DEFAULT NULL,
  `bank_account_number` varchar(255) DEFAULT NULL,
  `bank_account_name` varchar(100) DEFAULT NULL,
  `education_level` varchar(30) DEFAULT NULL,
  `education_field` varchar(100) DEFAULT NULL,
  `education_institution` varchar(200) DEFAULT NULL,
  `military_status` varchar(20) DEFAULT NULL,
  `medical_notes` text,
  `position_id` int DEFAULT NULL,
  `org_unit_id` int DEFAULT NULL,
  `site_id` int DEFAULT NULL,
  `hire_date` datetime NOT NULL,
  `termination_date` datetime DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_code` (`employee_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hr_employees`
--

LOCK TABLES `hr_employees` WRITE;
/*!40000 ALTER TABLE `hr_employees` DISABLE KEYS */;
/*!40000 ALTER TABLE `hr_employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hr_positions`
--

DROP TABLE IF EXISTS `hr_positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hr_positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `title` varchar(100) NOT NULL,
  `title_en` varchar(100) DEFAULT NULL,
  `org_unit_id` int NOT NULL,
  `job_grade` varchar(10) DEFAULT NULL,
  `is_gmp_critical` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hr_positions`
--

LOCK TABLES `hr_positions` WRITE;
/*!40000 ALTER TABLE `hr_positions` DISABLE KEYS */;
INSERT INTO `hr_positions` VALUES (1,'POS-EXEC-001','ผู้อำนวยการโรงงาน','Site Director',1,'E1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(2,'POS-EXEC-002','รองผู้อำนวยการโรงงาน','Deputy Site Director',1,'E2',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(3,'POS-AP-001','ผู้มีหน้าที่ปฏิบัติการ (QP)','Authorized Person (Qualified Person)',1,'E2',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(4,'POS-PROD-001','หัวหน้าฝ่ายผลิต','Head of Production',2,'M1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(5,'POS-PROD-002','เภสัชกรควบคุมการผลิต','Production Pharmacist',2,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(6,'POS-PROD-010','หัวหน้ากลุ่มงานผลิตยา','Head of Manufacturing Section',11,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(7,'POS-PROD-011','นักวิทยาศาสตร์การผลิต','Production Scientist',11,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(8,'POS-PROD-012','เจ้าพนักงานผลิต','Production Technician',11,'T1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(9,'POS-PROD-020','หัวหน้ากลุ่มงานบรรจุ','Head of Packaging Section',12,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(10,'POS-PROD-021','เจ้าพนักงานบรรจุ','Packaging Technician',12,'T1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(11,'POS-PROD-030','หัวหน้ากลุ่มงาน IPC','Head of IPC Section',13,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(12,'POS-PROD-031','เจ้าหน้าที่ IPC','IPC Officer',13,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(13,'POS-QC-001','หัวหน้าฝ่ายควบคุมคุณภาพ','Head of Quality Control',3,'M1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(14,'POS-QC-002','เภสัชกรควบคุมคุณภาพ','QC Pharmacist',3,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(15,'POS-QC-010','หัวหน้ากลุ่มงานวิเคราะห์เคมี','Head of Chemical Analysis',14,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(16,'POS-QC-011','นักวิทยาศาสตร์ (เคมี)','Chemist',14,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(17,'POS-QC-012','เจ้าพนักงานวิทยาศาสตร์ (เคมี)','Chemistry Technician',14,'T1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(18,'POS-QC-020','หัวหน้ากลุ่มงานจุลชีววิทยา','Head of Microbiology',15,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(19,'POS-QC-021','นักวิทยาศาสตร์ (จุลชีววิทยา)','Microbiologist',15,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(20,'POS-QC-022','เจ้าพนักงานวิทยาศาสตร์ (จุลชีววิทยา)','Microbiology Technician',15,'T1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(21,'POS-QC-030','หัวหน้ากลุ่มงานพิสูจน์เอกลักษณ์สมุนไพร','Head of Herbal Identification',16,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(22,'POS-QC-031','นักวิทยาศาสตร์ (พฤกษศาสตร์)','Botanist',16,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(23,'POS-QC-040','หัวหน้ากลุ่มงานศึกษาความคงสภาพ','Head of Stability Study',17,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(24,'POS-QC-041','นักวิทยาศาสตร์ความคงสภาพ','Stability Scientist',17,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(25,'POS-QA-001','หัวหน้าฝ่ายประกันคุณภาพ','Head of Quality Assurance',4,'M1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(26,'POS-QA-002','เภสัชกรประกันคุณภาพ','QA Pharmacist',4,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(27,'POS-QA-010','หัวหน้ากลุ่มงานระบบคุณภาพ','Head of Quality System',18,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(28,'POS-QA-011','เจ้าหน้าที่ระบบคุณภาพ','Quality System Officer',18,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(29,'POS-QA-020','หัวหน้ากลุ่มงาน Validation','Head of Validation',19,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(30,'POS-QA-021','วิศวกร Validation','Validation Engineer',19,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(31,'POS-QA-022','เจ้าหน้าที่ Validation','Validation Officer',19,'P2',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(32,'POS-QA-030','หัวหน้ากลุ่มงานควบคุมเอกสาร','Head of Document Control',20,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(33,'POS-QA-031','เจ้าหน้าที่ควบคุมเอกสาร','Document Controller',20,'T1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(34,'POS-QA-040','หัวหน้ากลุ่มงานตรวจสอบภายใน','Head of Internal Audit',21,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(35,'POS-QA-041','ผู้ตรวจสอบภายใน','Internal Auditor',21,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(36,'POS-ENG-001','หัวหน้าฝ่ายวิศวกรรมและซ่อมบำรุง','Head of Engineering & Maintenance',5,'M1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(37,'POS-ENG-010','หัวหน้ากลุ่มงานซ่อมบำรุง','Head of Maintenance',22,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(38,'POS-ENG-011','วิศวกรซ่อมบำรุง','Maintenance Engineer',22,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(39,'POS-ENG-012','ช่างเทคนิค','Maintenance Technician',22,'T1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(40,'POS-ENG-020','หัวหน้ากลุ่มงานสอบเทียบ','Head of Calibration',23,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(41,'POS-ENG-021','เจ้าหน้าที่สอบเทียบ','Calibration Officer',23,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(42,'POS-ENG-030','หัวหน้ากลุ่มงานระบบสาธารณูปโภค','Head of Utilities',24,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(43,'POS-ENG-031','วิศวกรระบบสาธารณูปโภค','Utilities Engineer',24,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(44,'POS-WH-001','หัวหน้าฝ่ายคลังสินค้า','Head of Warehouse',6,'M1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(45,'POS-WH-010','หัวหน้ากลุ่มงานคลังวัตถุดิบ','Head of Raw Material Warehouse',25,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(46,'POS-WH-011','เจ้าพนักงานพัสดุ (วัตถุดิบ)','Material Clerk (Raw Material)',25,'T1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(47,'POS-WH-020','หัวหน้ากลุ่มงานคลังวัสดุบรรจุ','Head of Packaging Material Warehouse',26,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(48,'POS-WH-021','เจ้าพนักงานพัสดุ (วัสดุบรรจุ)','Material Clerk (Packaging)',26,'T1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(49,'POS-WH-030','หัวหน้ากลุ่มงานคลังผลิตภัณฑ์สำเร็จรูป','Head of Finished Goods Warehouse',27,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(50,'POS-WH-031','เจ้าพนักงานพัสดุ (ผลิตภัณฑ์)','Material Clerk (Finished Goods)',27,'T1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(51,'POS-WH-040','หัวหน้ากลุ่มงานพื้นที่กักกัน','Head of Quarantine Area',28,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(52,'POS-WH-041','เจ้าพนักงานพื้นที่กักกัน','Quarantine Clerk',28,'T1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(53,'POS-RD-001','หัวหน้าฝ่ายวิจัยและพัฒนา','Head of R&D',7,'M1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(54,'POS-RD-010','หัวหน้ากลุ่มงานพัฒนาตำรับยา','Head of Formulation Development',29,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(55,'POS-RD-011','เภสัชกรพัฒนาตำรับ','Formulation Pharmacist',29,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(56,'POS-RD-020','หัวหน้ากลุ่มงานวิจัยสมุนไพร','Head of Herbal Research',30,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(57,'POS-RD-021','นักวิจัยสมุนไพร','Herbal Researcher',30,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(58,'POS-RD-022','แพทย์แผนไทย','Thai Traditional Medicine Doctor',30,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(59,'POS-REG-001','หัวหน้าฝ่ายทะเบียนและวิชาการ','Head of Regulatory Affairs',8,'M1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(60,'POS-REG-010','หัวหน้ากลุ่มงานทะเบียนยา','Head of Drug Registration',31,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(61,'POS-REG-011','เภสัชกรทะเบียนยา','Drug Registration Pharmacist',31,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(62,'POS-REG-020','หัวหน้ากลุ่มงานเภสัชสนเทศ','Head of Drug Information',32,'S1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(63,'POS-REG-021','เภสัชกรเภสัชสนเทศ','Drug Information Pharmacist',32,'P1',1,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(64,'POS-ADMIN-001','หัวหน้าฝ่ายบริหารงานทั่วไป','Head of General Administration',9,'M1',0,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(65,'POS-ADMIN-010','หัวหน้ากลุ่มงานบุคคลและฝึกอบรม','Head of HR & Training',33,'S1',0,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(66,'POS-ADMIN-011','นักทรัพยากรบุคคล','HR Specialist',33,'P1',0,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(67,'POS-ADMIN-012','เจ้าหน้าที่ฝึกอบรม','Training Officer',33,'P1',0,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(68,'POS-ADMIN-013','เจ้าพนักงานธุรการ','Administrative Officer',33,'T1',0,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(69,'POS-ADMIN-020','หัวหน้ากลุ่มงานการเงินและบัญชี','Head of Finance & Accounting',34,'S1',0,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(70,'POS-ADMIN-021','นักวิชาการเงินและบัญชี','Finance & Accounting Specialist',34,'P1',0,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(71,'POS-PROC-001','หัวหน้าฝ่ายจัดซื้อ','Head of Procurement',10,'M1',0,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(72,'POS-PROC-010','นักวิชาการพัสดุ','Procurement Specialist',10,'P1',0,1,'2026-05-14 08:17:39','2026-05-14 08:17:39'),(73,'POS-PROC-011','เจ้าพนักงานพัสดุ','Procurement Officer',10,'T1',0,1,'2026-05-14 08:17:39','2026-05-14 08:17:39');
/*!40000 ALTER TABLE `hr_positions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hr_training_records`
--

DROP TABLE IF EXISTS `hr_training_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hr_training_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `session_id` int DEFAULT NULL,
  `course_id` int NOT NULL,
  `completion_date` datetime NOT NULL,
  `expiry_date` datetime DEFAULT NULL,
  `result` varchar(20) NOT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `assessed_by` int DEFAULT NULL,
  `certificate_number` varchar(50) DEFAULT NULL,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hr_training_records`
--

LOCK TABLES `hr_training_records` WRITE;
/*!40000 ALTER TABLE `hr_training_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `hr_training_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hr_training_sessions`
--

DROP TABLE IF EXISTS `hr_training_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hr_training_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `course_id` int NOT NULL,
  `session_date` datetime NOT NULL,
  `start_time` varchar(5) DEFAULT NULL,
  `end_time` varchar(5) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `instructor_id` int DEFAULT NULL,
  `instructor_external` varchar(100) DEFAULT NULL,
  `max_participants` int DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'scheduled',
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hr_training_sessions`
--

LOCK TABLES `hr_training_sessions` WRITE;
/*!40000 ALTER TABLE `hr_training_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `hr_training_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hr_health_records`
--

DROP TABLE IF EXISTS `hr_health_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hr_health_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `examination_type` varchar(20) NOT NULL,
  `examination_date` datetime NOT NULL,
  `next_exam_due` datetime DEFAULT NULL,
  `fitness_status` varchar(20) NOT NULL,
  `restrictions` text,
  `affected_areas` text,
  `medical_details` text,
  `examiner_name` varchar(100) DEFAULT NULL,
  `examiner_notes` text,
  `recorded_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hr_health_records`
--

LOCK TABLES `hr_health_records` WRITE;
/*!40000 ALTER TABLE `hr_health_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `hr_health_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hr_employee_assignments`
--

DROP TABLE IF EXISTS `hr_employee_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hr_employee_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `position_id` int DEFAULT NULL,
  `org_unit_id` int DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `effective_from` datetime NOT NULL,
  `effective_to` datetime DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hr_employee_assignments`
--

LOCK TABLES `hr_employee_assignments` WRITE;
/*!40000 ALTER TABLE `hr_employee_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `hr_employee_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hr_audit_log`
--

DROP TABLE IF EXISTS `hr_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hr_audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(30) NOT NULL,
  `table_name` varchar(50) NOT NULL,
  `record_id` int NOT NULL,
  `old_value` text,
  `new_value` text,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hr_audit_log`
--

LOCK TABLES `hr_audit_log` WRITE;
/*!40000 ALTER TABLE `hr_audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `hr_audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audits`
--

DROP TABLE IF EXISTS `audits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `audit_number` varchar(50) NOT NULL,
  `plan_id` int DEFAULT NULL,
  `audit_type` varchar(20) NOT NULL,
  `scope` text,
  `gmp_chapters` text,
  `scheduled_date` datetime DEFAULT NULL,
  `actual_date` datetime DEFAULT NULL,
  `lead_auditor_id` int DEFAULT NULL,
  `audit_team` text,
  `status` varchar(20) NOT NULL DEFAULT 'scheduled',
  `summary` text,
  `report_path` varchar(500) DEFAULT NULL,
  `closed_date` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `audit_number` (`audit_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audits`
--

LOCK TABLES `audits` WRITE;
/*!40000 ALTER TABLE `audits` DISABLE KEYS */;
/*!40000 ALTER TABLE `audits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_plans`
--

DROP TABLE IF EXISTS `audit_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_year` int NOT NULL,
  `name` varchar(200) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_plans`
--

LOCK TABLES `audit_plans` WRITE;
/*!40000 ALTER TABLE `audit_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_findings`
--

DROP TABLE IF EXISTS `audit_findings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_findings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `audit_id` int NOT NULL,
  `finding_number` varchar(20) DEFAULT NULL,
  `category` varchar(20) NOT NULL,
  `gmp_chapter` int DEFAULT NULL,
  `gmp_requirement` text,
  `description` text NOT NULL,
  `evidence` text,
  `area_owner` int DEFAULT NULL,
  `capa_required` tinyint(1) DEFAULT '0',
  `capa_id` int DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'open',
  `closed_date` datetime DEFAULT NULL,
  `closed_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_findings`
--

LOCK TABLES `audit_findings` WRITE;
/*!40000 ALTER TABLE `audit_findings` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_findings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `water_quality_tests`
--

DROP TABLE IF EXISTS `water_quality_tests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `water_quality_tests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sample_point_id` int NOT NULL,
  `water_system_id` int NOT NULL,
  `performed_at` datetime NOT NULL,
  `operator_user_id` int NOT NULL,
  `signature_id` int DEFAULT NULL,
  `overall_result` varchar(20) NOT NULL DEFAULT 'in_spec',
  `notes` text,
  `deviation_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `water_quality_tests`
--

LOCK TABLES `water_quality_tests` WRITE;
/*!40000 ALTER TABLE `water_quality_tests` DISABLE KEYS */;
INSERT INTO `water_quality_tests` VALUES (1,1,2,'2026-06-05 09:10:52',1,5,'in_spec',NULL,NULL,'2026-06-05 09:10:52');
/*!40000 ALTER TABLE `water_quality_tests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `water_quality_test_results`
--

DROP TABLE IF EXISTS `water_quality_test_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `water_quality_test_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `test_id` int NOT NULL,
  `spec_id` int DEFAULT NULL,
  `parameter` varchar(30) NOT NULL,
  `numeric_value` decimal(15,4) DEFAULT NULL,
  `unit` varchar(20) NOT NULL,
  `spec_min_snapshot` decimal(15,4) DEFAULT NULL,
  `spec_max_snapshot` decimal(15,4) DEFAULT NULL,
  `result` varchar(20) NOT NULL DEFAULT 'in_spec',
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `water_quality_test_results`
--

LOCK TABLES `water_quality_test_results` WRITE;
/*!40000 ALTER TABLE `water_quality_test_results` DISABLE KEYS */;
INSERT INTO `water_quality_test_results` VALUES (1,1,1,'conductivity',-5.0000,'uS/cm',NULL,5.0000,'in_spec','2026-06-05 09:10:52');
/*!40000 ALTER TABLE `water_quality_test_results` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-10 19:51:58
