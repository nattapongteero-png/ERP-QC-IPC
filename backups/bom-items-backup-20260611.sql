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
-- Table structure for table `bom`
--

DROP TABLE IF EXISTS `bom`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `product_id` int NOT NULL,
  `version` varchar(20) NOT NULL DEFAULT '1.0',
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `batch_size` decimal(15,4) NOT NULL,
  `batch_unit` varchar(50) NOT NULL,
  `yield_target` decimal(5,2) DEFAULT NULL,
  `loss_allowance` decimal(5,2) DEFAULT NULL,
  `theoretical_yield` decimal(15,4) DEFAULT NULL,
  `fill_weight_mg` decimal(10,4) DEFAULT NULL,
  `effective_date` datetime DEFAULT NULL,
  `expiry_date` datetime DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom`
--

LOCK TABLES `bom` WRITE;
/*!40000 ALTER TABLE `bom` DISABLE KEYS */;
INSERT INTO `bom` VALUES (1,'BOM-FG-001','สูตรแคปซูลขมิ้นชัน 500mg',8,'1.0','active',1000.0000,'bottle',95.00,5.00,NULL,500.0000,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05','2026-05-14 09:13:05'),(2,'BOM-FG-002','สูตรแคปซูลฟ้าทะลายโจร 400mg',9,'1.0','active',1000.0000,'bottle',95.00,5.00,NULL,500.0000,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05','2026-05-14 09:13:05'),(3,'BOM-FG-003','สูตรแคปซูลกระชายขาว 350mg',53,'1.0','active',1000.0000,'bottle',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05','2026-05-14 09:13:05'),(4,'BOM-FG-004','สูตรยาเม็ดบอระเพ็ด 500mg',54,'1.0','active',1000.0000,'bottle',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06','2026-05-14 09:13:06'),(5,'BOM-FG-005','สูตรยาผงขิงชง',55,'1.0','active',2000.0000,'box',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06','2026-05-14 09:13:06'),(6,'BOM-FG-006','สูตรชาชงรางจืด',56,'1.0','active',2000.0000,'box',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06','2026-05-14 09:13:06'),(7,'BOM-FG-007','สูตรยาน้ำแก้ไอมะขามป้อม',57,'1.0','active',1000.0000,'bottle',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06','2026-05-14 09:13:06'),(8,'BOM-FG-008','สูตรยาลูกกลอนบำรุงร่างกาย',58,'1.0','active',500.0000,'bottle',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06','2026-05-14 09:13:06'),(9,'BOM-FG-009','สูตรยาหม่องสมุนไพร',59,'1.0','active',2000.0000,'pcs',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06','2026-05-14 09:13:06'),(10,'BOM-FG-010','สูตรครีมว่านหางจระเข้',60,'1.0','active',1500.0000,'pcs',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06','2026-05-14 09:13:06'),(11,'BOM-FG-011','สูตรน้ำมันนวดสมุนไพร',61,'1.0','active',1000.0000,'bottle',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07','2026-05-14 09:13:07'),(12,'BOM-FG-012','สูตรยาดมสมุนไพร',62,'1.0','active',3000.0000,'pcs',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07','2026-05-14 09:13:07'),(13,'BOM-FG-013','สูตรลูกประคบสมุนไพร',63,'1.0','active',500.0000,'pcs',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07','2026-05-14 09:13:07'),(14,'BOM-FG-014','สูตรยาอมมะแว้ง',64,'1.0','active',1000.0000,'box',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07','2026-05-14 09:13:07'),(15,'BOM-FG-001-V2','สูตรแคปซูลขมิ้นชัน 500mg (ปรับปรุง)',8,'2.0','draft',1200.0000,'bottle',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09','2026-05-14 09:59:09'),(16,'BOM-FG-004-V2','สูตรยาเม็ดบอระเพ็ด 500mg (ปรับปรุง)',54,'2.0','draft',1200.0000,'bottle',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09','2026-05-14 09:59:09'),(17,'BOM-FG-005-V2','สูตรยาผงขิงชง (ปรับปรุง)',55,'2.0','draft',2500.0000,'box',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09','2026-05-14 09:59:09'),(18,'BOM-FG-007-V2','สูตรยาน้ำแก้ไอมะขามป้อม (ปรับปรุง)',57,'2.0','draft',1200.0000,'bottle',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10','2026-05-14 09:59:10'),(19,'BOM-FG-008-V2','สูตรยาลูกกลอนบำรุงร่างกาย (ปรับปรุง)',58,'2.0','draft',600.0000,'bottle',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10','2026-05-14 09:59:10'),(20,'BOM-FG-009-V2','สูตรยาหม่องสมุนไพร (ปรับปรุง)',59,'2.0','draft',2400.0000,'pcs',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10','2026-05-14 09:59:10'),(21,'BOM-FG-013-V2','สูตรลูกประคบสมุนไพร (ปรับปรุง)',63,'2.0','draft',600.0000,'pcs',95.00,5.00,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10','2026-05-14 09:59:10');
/*!40000 ALTER TABLE `bom` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bom_lines`
--

DROP TABLE IF EXISTS `bom_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bom_id` int NOT NULL,
  `item_id` int NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `unit` varchar(50) NOT NULL,
  `sequence` int NOT NULL DEFAULT '1',
  `is_optional` tinyint(1) NOT NULL DEFAULT '0',
  `notes` text,
  `is_confidential` tinyint(1) DEFAULT NULL,
  `confidentiality_override` enum('INHERIT','PUBLIC','CONFIDENTIAL') NOT NULL DEFAULT 'INHERIT',
  `percentage_in_formula` decimal(5,2) DEFAULT NULL,
  `weighed_qty` decimal(15,4) DEFAULT NULL,
  `weighed_by` int DEFAULT NULL,
  `verified_by` int DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=128 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom_lines`
--

LOCK TABLES `bom_lines` WRITE;
/*!40000 ALTER TABLE `bom_lines` DISABLE KEYS */;
INSERT INTO `bom_lines` VALUES (1,1,5,30000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(2,1,29,5000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(3,1,30,500.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(4,1,6,60000.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(5,1,7,1000.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(6,1,45,1000.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(7,1,47,1000.0000,'pcs',7,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(8,2,26,24000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(9,2,29,5000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(10,2,30,500.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(11,2,6,60000.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(12,2,7,1000.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(13,2,45,1000.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(14,2,47,1000.0000,'pcs',7,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(15,3,4,25000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(16,3,29,4000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(17,3,30,400.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(18,3,39,60000.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(19,3,7,1000.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(20,3,45,1000.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(21,3,47,1000.0000,'pcs',7,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:05'),(22,4,15,30000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(23,4,29,8000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(24,4,30,600.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(25,4,7,1000.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(26,4,45,1000.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(27,4,47,1000.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(28,5,2,60000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(29,5,31,10000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(30,5,43,60000.0000,'pcs',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(31,5,46,2000.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(32,5,45,2000.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(33,6,17,40000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(34,6,20,10000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(35,6,48,60000.0000,'pcs',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(36,6,46,2000.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(37,6,45,2000.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(38,7,2,10000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(39,7,20,5000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(40,7,31,50000.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(41,7,7,1000.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(42,7,47,1000.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(43,7,45,1000.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(44,8,1,15000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(45,8,15,15000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(46,8,22,10000.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(47,8,31,20000.0000,'g',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(48,8,7,500.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(49,8,45,500.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(50,8,47,500.0000,'pcs',7,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(51,9,33,20000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(52,9,34,3000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(53,9,35,2000.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(54,9,36,1000.0000,'g',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(55,9,42,2000.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(56,9,45,2000.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(57,10,19,30000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(58,10,32,20000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(59,10,49,1500.0000,'pcs',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(60,10,46,1500.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(61,10,45,1500.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:06'),(62,11,20,10000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(63,11,34,2000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(64,11,35,1000.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(65,11,41,1000.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(66,11,47,1000.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(67,11,45,1000.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(68,12,34,5000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(69,12,35,3000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(70,12,36,2000.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(71,12,40,3000.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(72,12,45,3000.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(73,13,1,20000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(74,13,20,30000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(75,13,21,10000.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(76,13,15,10000.0000,'g',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(77,13,50,500.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(78,13,45,500.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(79,14,3,10000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(80,14,31,15000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(81,14,29,5000.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(82,14,43,30000.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(83,14,46,1000.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(84,14,45,1000.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:13:07'),(85,15,5,36000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(86,15,29,6000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(87,15,30,600.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(88,15,6,72000.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(89,15,7,1200.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(90,15,45,1200.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(91,15,47,1200.0000,'pcs',7,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(92,16,15,36000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(93,16,29,9600.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(94,16,30,720.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(95,16,7,1200.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(96,16,45,1200.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(97,16,47,1200.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(98,17,2,75000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(99,17,31,12500.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(100,17,43,75000.0000,'pcs',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(101,17,46,2500.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(102,17,45,2500.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:09'),(103,18,2,12000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(104,18,20,6000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(105,18,31,60000.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(106,18,7,1200.0000,'pcs',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(107,18,47,1200.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(108,18,45,1200.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(109,19,1,18000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(110,19,15,18000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(111,19,22,12000.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(112,19,31,24000.0000,'g',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(113,19,7,600.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(114,19,45,600.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(115,19,47,600.0000,'pcs',7,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(116,20,33,24000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(117,20,34,3600.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(118,20,35,2400.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(119,20,36,1200.0000,'g',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(120,20,42,2400.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(121,20,45,2400.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(122,21,1,24000.0000,'g',1,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(123,21,20,36000.0000,'g',2,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(124,21,21,12000.0000,'g',3,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(125,21,15,12000.0000,'g',4,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(126,21,50,600.0000,'pcs',5,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10'),(127,21,45,600.0000,'pcs',6,0,NULL,NULL,'INHERIT',NULL,NULL,NULL,NULL,NULL,'2026-05-14 09:59:10');
/*!40000 ALTER TABLE `bom_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bom_rooms`
--

DROP TABLE IF EXISTS `bom_rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom_rooms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bom_id` int NOT NULL,
  `room_id` int NOT NULL,
  `phase` varchar(50) NOT NULL,
  `sequence` int NOT NULL DEFAULT '1',
  `is_required` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=85 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom_rooms`
--

LOCK TABLES `bom_rooms` WRITE;
/*!40000 ALTER TABLE `bom_rooms` DISABLE KEYS */;
INSERT INTO `bom_rooms` VALUES (1,1,1,'pre_production',1,1,'2026-05-14 09:13:05'),(2,1,3,'pre_production',2,1,'2026-05-14 09:13:05'),(3,1,4,'production',3,1,'2026-05-14 09:13:05'),(4,1,6,'post_production',4,1,'2026-05-14 09:13:05'),(5,1,5,'packaging',5,1,'2026-05-14 09:13:05'),(6,2,1,'pre_production',1,1,'2026-05-14 09:13:05'),(7,2,3,'pre_production',2,1,'2026-05-14 09:13:05'),(8,2,4,'production',3,1,'2026-05-14 09:13:05'),(9,2,6,'post_production',4,1,'2026-05-14 09:13:05'),(10,2,5,'packaging',5,1,'2026-05-14 09:13:05'),(11,3,1,'pre_production',1,1,'2026-05-14 09:13:05'),(12,3,3,'pre_production',2,1,'2026-05-14 09:13:05'),(13,3,4,'production',3,1,'2026-05-14 09:13:05'),(14,3,6,'post_production',4,1,'2026-05-14 09:13:05'),(15,3,5,'packaging',5,1,'2026-05-14 09:13:05'),(16,4,1,'pre_production',1,1,'2026-05-14 09:13:06'),(17,4,3,'pre_production',2,1,'2026-05-14 09:13:06'),(18,4,4,'production',3,1,'2026-05-14 09:13:06'),(19,4,6,'post_production',4,1,'2026-05-14 09:13:06'),(20,4,5,'packaging',5,1,'2026-05-14 09:13:06'),(21,5,1,'pre_production',1,1,'2026-05-14 09:13:06'),(22,5,3,'pre_production',2,1,'2026-05-14 09:13:06'),(23,5,4,'production',3,1,'2026-05-14 09:13:06'),(24,5,5,'packaging',4,1,'2026-05-14 09:13:06'),(25,6,1,'pre_production',1,1,'2026-05-14 09:13:06'),(26,6,3,'pre_production',2,1,'2026-05-14 09:13:06'),(27,6,4,'production',3,1,'2026-05-14 09:13:06'),(28,6,5,'packaging',4,1,'2026-05-14 09:13:06'),(29,7,1,'pre_production',1,1,'2026-05-14 09:13:06'),(30,7,4,'production',2,1,'2026-05-14 09:13:06'),(31,7,5,'packaging',3,1,'2026-05-14 09:13:06'),(32,8,1,'pre_production',1,1,'2026-05-14 09:13:06'),(33,8,3,'pre_production',2,1,'2026-05-14 09:13:06'),(34,8,4,'production',3,1,'2026-05-14 09:13:06'),(35,8,5,'packaging',4,1,'2026-05-14 09:13:06'),(36,9,1,'pre_production',1,1,'2026-05-14 09:13:06'),(37,9,4,'production',2,1,'2026-05-14 09:13:06'),(38,9,5,'packaging',3,1,'2026-05-14 09:13:06'),(39,10,1,'pre_production',1,1,'2026-05-14 09:13:06'),(40,10,4,'production',2,1,'2026-05-14 09:13:06'),(41,10,5,'packaging',3,1,'2026-05-14 09:13:06'),(42,11,1,'pre_production',1,1,'2026-05-14 09:13:07'),(43,11,4,'production',2,1,'2026-05-14 09:13:07'),(44,11,5,'packaging',3,1,'2026-05-14 09:13:07'),(45,12,1,'pre_production',1,1,'2026-05-14 09:13:07'),(46,12,4,'production',2,1,'2026-05-14 09:13:07'),(47,12,5,'packaging',3,1,'2026-05-14 09:13:07'),(48,13,1,'pre_production',1,1,'2026-05-14 09:13:07'),(49,13,3,'pre_production',2,1,'2026-05-14 09:13:07'),(50,13,4,'production',3,1,'2026-05-14 09:13:07'),(51,13,5,'packaging',4,1,'2026-05-14 09:13:07'),(52,14,1,'pre_production',1,1,'2026-05-14 09:13:07'),(53,14,3,'pre_production',2,1,'2026-05-14 09:13:07'),(54,14,4,'production',3,1,'2026-05-14 09:13:07'),(55,14,6,'post_production',4,1,'2026-05-14 09:13:07'),(56,14,5,'packaging',5,1,'2026-05-14 09:13:07'),(57,15,1,'pre_production',1,1,'2026-05-14 09:59:09'),(58,15,3,'pre_production',2,1,'2026-05-14 09:59:09'),(59,15,4,'production',3,1,'2026-05-14 09:59:09'),(60,15,6,'post_production',4,1,'2026-05-14 09:59:09'),(61,15,5,'packaging',5,1,'2026-05-14 09:59:09'),(62,16,1,'pre_production',1,1,'2026-05-14 09:59:09'),(63,16,3,'pre_production',2,1,'2026-05-14 09:59:09'),(64,16,4,'production',3,1,'2026-05-14 09:59:09'),(65,16,6,'post_production',4,1,'2026-05-14 09:59:09'),(66,16,5,'packaging',5,1,'2026-05-14 09:59:09'),(67,17,1,'pre_production',1,1,'2026-05-14 09:59:09'),(68,17,3,'pre_production',2,1,'2026-05-14 09:59:09'),(69,17,4,'production',3,1,'2026-05-14 09:59:09'),(70,17,5,'packaging',4,1,'2026-05-14 09:59:09'),(71,18,1,'pre_production',1,1,'2026-05-14 09:59:10'),(72,18,4,'production',2,1,'2026-05-14 09:59:10'),(73,18,5,'packaging',3,1,'2026-05-14 09:59:10'),(74,19,1,'pre_production',1,1,'2026-05-14 09:59:10'),(75,19,3,'pre_production',2,1,'2026-05-14 09:59:10'),(76,19,4,'production',3,1,'2026-05-14 09:59:10'),(77,19,5,'packaging',4,1,'2026-05-14 09:59:10'),(78,20,1,'pre_production',1,1,'2026-05-14 09:59:10'),(79,20,4,'production',2,1,'2026-05-14 09:59:10'),(80,20,5,'packaging',3,1,'2026-05-14 09:59:10'),(81,21,1,'pre_production',1,1,'2026-05-14 09:59:10'),(82,21,3,'pre_production',2,1,'2026-05-14 09:59:10'),(83,21,4,'production',3,1,'2026-05-14 09:59:10'),(84,21,5,'packaging',4,1,'2026-05-14 09:59:10');
/*!40000 ALTER TABLE `bom_rooms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bom_equipment`
--

DROP TABLE IF EXISTS `bom_equipment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom_equipment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bom_id` int NOT NULL,
  `equipment_id` int NOT NULL,
  `phase` varchar(50) NOT NULL,
  `sequence` int NOT NULL DEFAULT '1',
  `is_required` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=84 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom_equipment`
--

LOCK TABLES `bom_equipment` WRITE;
/*!40000 ALTER TABLE `bom_equipment` DISABLE KEYS */;
INSERT INTO `bom_equipment` VALUES (1,1,1,'pre_production',1,1,'2026-05-14 09:13:05'),(2,1,2,'production',2,1,'2026-05-14 09:13:05'),(3,1,6,'production',3,1,'2026-05-14 09:13:05'),(4,1,4,'production',4,1,'2026-05-14 09:13:05'),(5,1,5,'packaging',5,1,'2026-05-14 09:13:05'),(6,2,1,'pre_production',1,1,'2026-05-14 09:13:05'),(7,2,2,'production',2,1,'2026-05-14 09:13:05'),(8,2,6,'production',3,1,'2026-05-14 09:13:05'),(9,2,4,'production',4,1,'2026-05-14 09:13:05'),(10,2,5,'packaging',5,1,'2026-05-14 09:13:05'),(11,3,1,'pre_production',1,1,'2026-05-14 09:13:05'),(12,3,2,'production',2,1,'2026-05-14 09:13:05'),(13,3,6,'production',3,1,'2026-05-14 09:13:05'),(14,3,4,'production',4,1,'2026-05-14 09:13:06'),(15,3,5,'packaging',5,1,'2026-05-14 09:13:06'),(16,4,1,'pre_production',1,1,'2026-05-14 09:13:06'),(17,4,2,'production',2,1,'2026-05-14 09:13:06'),(18,4,4,'production',3,1,'2026-05-14 09:13:06'),(19,4,5,'packaging',4,1,'2026-05-14 09:13:06'),(20,5,1,'pre_production',1,1,'2026-05-14 09:13:06'),(21,5,2,'production',2,1,'2026-05-14 09:13:06'),(22,5,4,'production',3,1,'2026-05-14 09:13:06'),(23,6,1,'pre_production',1,1,'2026-05-14 09:13:06'),(24,6,2,'production',2,1,'2026-05-14 09:13:06'),(25,6,4,'production',3,1,'2026-05-14 09:13:06'),(26,7,1,'pre_production',1,1,'2026-05-14 09:13:06'),(27,7,3,'production',2,1,'2026-05-14 09:13:06'),(28,7,2,'production',3,1,'2026-05-14 09:13:06'),(29,7,4,'production',4,1,'2026-05-14 09:13:06'),(30,8,1,'pre_production',1,1,'2026-05-14 09:13:06'),(31,8,2,'production',2,1,'2026-05-14 09:13:06'),(32,8,4,'production',3,1,'2026-05-14 09:13:06'),(33,8,5,'production',4,1,'2026-05-14 09:13:06'),(34,9,1,'pre_production',1,1,'2026-05-14 09:13:06'),(35,9,3,'production',2,1,'2026-05-14 09:13:06'),(36,9,2,'production',3,1,'2026-05-14 09:13:06'),(37,9,4,'production',4,1,'2026-05-14 09:13:06'),(38,10,1,'pre_production',1,1,'2026-05-14 09:13:06'),(39,10,3,'production',2,1,'2026-05-14 09:13:06'),(40,10,2,'production',3,1,'2026-05-14 09:13:06'),(41,10,4,'production',4,1,'2026-05-14 09:13:06'),(42,11,1,'pre_production',1,1,'2026-05-14 09:13:07'),(43,11,3,'production',2,1,'2026-05-14 09:13:07'),(44,11,2,'production',3,1,'2026-05-14 09:13:07'),(45,11,4,'production',4,1,'2026-05-14 09:13:07'),(46,12,1,'pre_production',1,1,'2026-05-14 09:13:07'),(47,12,3,'production',2,1,'2026-05-14 09:13:07'),(48,12,2,'production',3,1,'2026-05-14 09:13:07'),(49,12,4,'production',4,1,'2026-05-14 09:13:07'),(50,13,1,'pre_production',1,1,'2026-05-14 09:13:07'),(51,13,5,'production',2,1,'2026-05-14 09:13:07'),(52,13,4,'production',3,1,'2026-05-14 09:13:07'),(53,14,1,'pre_production',1,1,'2026-05-14 09:13:07'),(54,14,2,'production',2,1,'2026-05-14 09:13:07'),(55,14,4,'production',3,1,'2026-05-14 09:13:07'),(56,14,5,'packaging',4,1,'2026-05-14 09:13:07'),(57,15,1,'pre_production',1,1,'2026-05-14 09:59:09'),(58,15,2,'production',2,1,'2026-05-14 09:59:09'),(59,15,6,'production',3,1,'2026-05-14 09:59:09'),(60,15,4,'production',4,1,'2026-05-14 09:59:09'),(61,15,5,'packaging',5,1,'2026-05-14 09:59:09'),(62,16,1,'pre_production',1,1,'2026-05-14 09:59:09'),(63,16,2,'production',2,1,'2026-05-14 09:59:09'),(64,16,4,'production',3,1,'2026-05-14 09:59:09'),(65,16,5,'packaging',4,1,'2026-05-14 09:59:09'),(66,17,1,'pre_production',1,1,'2026-05-14 09:59:09'),(67,17,2,'production',2,1,'2026-05-14 09:59:09'),(68,17,4,'production',3,1,'2026-05-14 09:59:09'),(69,18,1,'pre_production',1,1,'2026-05-14 09:59:10'),(70,18,3,'production',2,1,'2026-05-14 09:59:10'),(71,18,2,'production',3,1,'2026-05-14 09:59:10'),(72,18,4,'production',4,1,'2026-05-14 09:59:10'),(73,19,1,'pre_production',1,1,'2026-05-14 09:59:10'),(74,19,2,'production',2,1,'2026-05-14 09:59:10'),(75,19,4,'production',3,1,'2026-05-14 09:59:10'),(76,19,5,'production',4,1,'2026-05-14 09:59:10'),(77,20,1,'pre_production',1,1,'2026-05-14 09:59:10'),(78,20,3,'production',2,1,'2026-05-14 09:59:10'),(79,20,2,'production',3,1,'2026-05-14 09:59:10'),(80,20,4,'production',4,1,'2026-05-14 09:59:10'),(81,21,1,'pre_production',1,1,'2026-05-14 09:59:10'),(82,21,5,'production',2,1,'2026-05-14 09:59:10'),(83,21,4,'production',3,1,'2026-05-14 09:59:10');
/*!40000 ALTER TABLE `bom_equipment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bom_environmental_conditions`
--

DROP TABLE IF EXISTS `bom_environmental_conditions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom_environmental_conditions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bom_id` int NOT NULL,
  `condition_id` int NOT NULL,
  `bom_room_id` int DEFAULT NULL,
  `phase` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom_environmental_conditions`
--

LOCK TABLES `bom_environmental_conditions` WRITE;
/*!40000 ALTER TABLE `bom_environmental_conditions` DISABLE KEYS */;
INSERT INTO `bom_environmental_conditions` VALUES (1,1,1,NULL,'pre_production','2026-05-14 09:13:05'),(2,1,2,NULL,'production','2026-05-14 09:13:05'),(3,1,1,NULL,'packaging','2026-05-14 09:13:05'),(4,2,1,NULL,'pre_production','2026-05-14 09:13:05'),(5,2,2,NULL,'production','2026-05-14 09:13:05'),(6,2,1,NULL,'packaging','2026-05-14 09:13:05'),(7,3,1,NULL,'pre_production','2026-05-14 09:13:06'),(8,3,2,NULL,'production','2026-05-14 09:13:06'),(9,3,1,NULL,'packaging','2026-05-14 09:13:06'),(10,4,1,NULL,'pre_production','2026-05-14 09:13:06'),(11,4,2,NULL,'production','2026-05-14 09:13:06'),(12,4,1,NULL,'packaging','2026-05-14 09:13:06'),(13,5,1,NULL,'production','2026-05-14 09:13:06'),(14,5,1,NULL,'packaging','2026-05-14 09:13:06'),(15,6,1,NULL,'production','2026-05-14 09:13:06'),(16,6,1,NULL,'packaging','2026-05-14 09:13:06'),(17,7,4,NULL,'production','2026-05-14 09:13:06'),(18,7,1,NULL,'packaging','2026-05-14 09:13:06'),(19,8,2,NULL,'production','2026-05-14 09:13:06'),(20,8,1,NULL,'packaging','2026-05-14 09:13:06'),(21,9,2,NULL,'production','2026-05-14 09:13:06'),(22,9,1,NULL,'packaging','2026-05-14 09:13:06'),(23,10,2,NULL,'production','2026-05-14 09:13:06'),(24,10,1,NULL,'packaging','2026-05-14 09:13:07'),(25,11,2,NULL,'production','2026-05-14 09:13:07'),(26,11,1,NULL,'packaging','2026-05-14 09:13:07'),(27,12,2,NULL,'production','2026-05-14 09:13:07'),(28,12,1,NULL,'packaging','2026-05-14 09:13:07'),(29,13,1,NULL,'production','2026-05-14 09:13:07'),(30,13,3,NULL,'post_production','2026-05-14 09:13:07'),(31,14,1,NULL,'pre_production','2026-05-14 09:13:07'),(32,14,2,NULL,'production','2026-05-14 09:13:07'),(33,14,1,NULL,'packaging','2026-05-14 09:13:07'),(34,15,1,NULL,'pre_production','2026-05-14 09:59:09'),(35,15,2,NULL,'production','2026-05-14 09:59:09'),(36,15,1,NULL,'packaging','2026-05-14 09:59:09'),(37,16,1,NULL,'pre_production','2026-05-14 09:59:09'),(38,16,2,NULL,'production','2026-05-14 09:59:09'),(39,16,1,NULL,'packaging','2026-05-14 09:59:09'),(40,17,1,NULL,'production','2026-05-14 09:59:09'),(41,17,1,NULL,'packaging','2026-05-14 09:59:09'),(42,18,4,NULL,'production','2026-05-14 09:59:10'),(43,18,1,NULL,'packaging','2026-05-14 09:59:10'),(44,19,2,NULL,'production','2026-05-14 09:59:10'),(45,19,1,NULL,'packaging','2026-05-14 09:59:10'),(46,20,2,NULL,'production','2026-05-14 09:59:10'),(47,20,1,NULL,'packaging','2026-05-14 09:59:10'),(48,21,1,NULL,'production','2026-05-14 09:59:10'),(49,21,3,NULL,'post_production','2026-05-14 09:59:10');
/*!40000 ALTER TABLE `bom_environmental_conditions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bom_sop_steps`
--

DROP TABLE IF EXISTS `bom_sop_steps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom_sop_steps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bom_id` int NOT NULL,
  `template_id` int DEFAULT NULL,
  `sequence` int NOT NULL,
  `step_name` varchar(255) NOT NULL,
  `step_name_th` varchar(255) DEFAULT NULL,
  `instructions` text,
  `instructions_th` text,
  `parameters` text,
  `equipment_ids` text,
  `requires_verification` tinyint(1) NOT NULL DEFAULT '1',
  `phase` varchar(50) NOT NULL DEFAULT 'production',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_critical` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=158 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom_sop_steps`
--

LOCK TABLES `bom_sop_steps` WRITE;
/*!40000 ALTER TABLE `bom_sop_steps` DISABLE KEYS */;
INSERT INTO `bom_sop_steps` VALUES (1,1,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:05',0),(2,1,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:05',0),(3,1,2,3,'Dispensing','การจ่ายวัตถุดิบ',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:05',0),(4,1,7,4,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:05',0),(5,1,11,5,'Filling','การบรรจุลงแคปซูล',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:05',0),(6,1,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:05',0),(7,1,12,7,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:05',0),(8,1,16,8,'Inspection','การตรวจสอบ',NULL,NULL,NULL,NULL,1,'post_production','2026-05-14 09:13:05',0),(9,2,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:05',0),(10,2,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:05',0),(11,2,2,3,'Dispensing','การจ่ายวัตถุดิบ',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:05',0),(12,2,7,4,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:05',0),(13,2,11,5,'Filling','การบรรจุลงแคปซูล',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:05',0),(14,2,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:05',0),(15,2,12,7,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:05',0),(16,2,16,8,'Inspection','การตรวจสอบ',NULL,NULL,NULL,NULL,1,'post_production','2026-05-14 09:13:05',0),(17,3,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(18,3,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(19,3,2,3,'Dispensing','การจ่ายวัตถุดิบ',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(20,3,7,4,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(21,3,11,5,'Filling','การบรรจุลงแคปซูล',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(22,3,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(23,3,12,7,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:06',0),(24,3,16,8,'Inspection','การตรวจสอบ',NULL,NULL,NULL,NULL,1,'post_production','2026-05-14 09:13:06',0),(25,4,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(26,4,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(27,4,4,3,'Milling','การบด',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(28,4,5,4,'Sieving','การร่อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(29,4,7,5,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(30,4,8,6,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(31,4,13,7,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(32,4,12,8,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:06',0),(33,4,16,9,'Inspection','การตรวจสอบ',NULL,NULL,NULL,NULL,1,'post_production','2026-05-14 09:13:06',0),(34,5,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(35,5,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(36,5,4,3,'Milling','การบด',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(37,5,5,4,'Sieving','การร่อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(38,5,7,5,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(39,5,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(40,5,12,7,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:06',0),(41,6,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(42,6,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(43,6,4,3,'Milling','การบด',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(44,6,5,4,'Sieving','การร่อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(45,6,7,5,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(46,6,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(47,6,12,7,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:06',0),(48,7,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(49,7,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(50,7,9,3,'Heating','การให้ความร้อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(51,7,8,4,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(52,7,10,5,'Cooling','การทำให้เย็น',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(53,7,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(54,7,11,7,'Filling','การบรรจุลงแคปซูล',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:06',0),(55,7,16,8,'Inspection','การตรวจสอบ',NULL,NULL,NULL,NULL,1,'post_production','2026-05-14 09:13:06',0),(56,8,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(57,8,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(58,8,4,3,'Milling','การบด',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(59,8,8,4,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(60,8,6,5,'Drying','การอบแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(61,8,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(62,8,12,7,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:06',0),(63,9,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(64,9,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:06',0),(65,9,9,3,'Heating','การให้ความร้อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(66,9,8,4,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(67,9,10,5,'Cooling','การทำให้เย็น',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(68,9,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:06',0),(69,9,11,7,'Filling','การบรรจุลงแคปซูล',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:06',0),(70,10,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:07',0),(71,10,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:07',0),(72,10,9,3,'Heating','การให้ความร้อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(73,10,8,4,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(74,10,10,5,'Cooling','การทำให้เย็น',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(75,10,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(76,10,11,7,'Filling','การบรรจุลงแคปซูล',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:07',0),(77,11,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:07',0),(78,11,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:07',0),(79,11,9,3,'Heating','การให้ความร้อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(80,11,8,4,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(81,11,10,5,'Cooling','การทำให้เย็น',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(82,11,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(83,11,11,7,'Filling','การบรรจุลงแคปซูล',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:07',0),(84,12,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:07',0),(85,12,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:07',0),(86,12,9,3,'Heating','การให้ความร้อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(87,12,8,4,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(88,12,10,5,'Cooling','การทำให้เย็น',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(89,12,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(90,12,11,7,'Filling','การบรรจุลงแคปซูล',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:07',0),(91,13,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:07',0),(92,13,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:07',0),(93,13,3,3,'Preparation','การเตรียมวัตถุดิบ',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(94,13,7,4,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(95,13,12,5,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:07',0),(96,13,16,6,'Inspection','การตรวจสอบ',NULL,NULL,NULL,NULL,1,'post_production','2026-05-14 09:13:07',0),(97,14,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:07',0),(98,14,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:13:07',0),(99,14,4,3,'Milling','การบด',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(100,14,5,4,'Sieving','การร่อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(101,14,7,5,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(102,14,8,6,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(103,14,13,7,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:13:07',0),(104,14,12,8,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:13:07',0),(105,14,16,9,'Inspection','การตรวจสอบ',NULL,NULL,NULL,NULL,1,'post_production','2026-05-14 09:13:07',0),(106,15,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:09',0),(107,15,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:09',0),(108,15,2,3,'Dispensing','การจ่ายวัตถุดิบ',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:09',0),(109,15,7,4,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:09',0),(110,15,11,5,'Filling','การบรรจุลงแคปซูล',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:09',0),(111,15,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:09',0),(112,15,12,7,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:59:09',0),(113,15,16,8,'Inspection','การตรวจสอบ',NULL,NULL,NULL,NULL,1,'post_production','2026-05-14 09:59:09',0),(114,16,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:09',0),(115,16,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:09',0),(116,16,4,3,'Milling','การบด',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:09',0),(117,16,5,4,'Sieving','การร่อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:09',0),(118,16,7,5,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:09',0),(119,16,8,6,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:09',0),(120,16,13,7,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:09',0),(121,16,12,8,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:59:09',0),(122,16,16,9,'Inspection','การตรวจสอบ',NULL,NULL,NULL,NULL,1,'post_production','2026-05-14 09:59:09',0),(123,17,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:10',0),(124,17,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:10',0),(125,17,4,3,'Milling','การบด',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(126,17,5,4,'Sieving','การร่อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(127,17,7,5,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(128,17,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(129,17,12,7,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:59:10',0),(130,18,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:10',0),(131,18,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:10',0),(132,18,9,3,'Heating','การให้ความร้อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(133,18,8,4,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(134,18,10,5,'Cooling','การทำให้เย็น',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(135,18,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(136,18,11,7,'Filling','การบรรจุลงแคปซูล',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:59:10',0),(137,18,16,8,'Inspection','การตรวจสอบ',NULL,NULL,NULL,NULL,1,'post_production','2026-05-14 09:59:10',0),(138,19,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:10',0),(139,19,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:10',0),(140,19,4,3,'Milling','การบด',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(141,19,8,4,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(142,19,6,5,'Drying','การอบแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(143,19,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(144,19,12,7,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:59:10',0),(145,20,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:10',0),(146,20,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:10',0),(147,20,9,3,'Heating','การให้ความร้อน',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(148,20,8,4,'Mixing','การผสม',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(149,20,10,5,'Cooling','การทำให้เย็น',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(150,20,13,6,'In-Process Control','การควบคุมระหว่างผลิต',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(151,20,11,7,'Filling','การบรรจุลงแคปซูล',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:59:10',0),(152,21,1,1,'Line Clearance','ตรวจสอบความพร้อมสายการผลิต',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:10',0),(153,21,14,2,'Weighing','การชั่งน้ำหนัก',NULL,NULL,NULL,NULL,1,'pre_production','2026-05-14 09:59:10',0),(154,21,3,3,'Preparation','การเตรียมวัตถุดิบ',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(155,21,7,4,'Blending','การผสมแห้ง',NULL,NULL,NULL,NULL,1,'production','2026-05-14 09:59:10',0),(156,21,12,5,'Packaging','การบรรจุภัณฑ์',NULL,NULL,NULL,NULL,1,'packaging','2026-05-14 09:59:10',0),(157,21,16,6,'Inspection','การตรวจสอบ',NULL,NULL,NULL,NULL,1,'post_production','2026-05-14 09:59:10',0);
/*!40000 ALTER TABLE `bom_sop_steps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bom_packaging_qc`
--

DROP TABLE IF EXISTS `bom_packaging_qc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom_packaging_qc` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bom_id` int NOT NULL,
  `criteria_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom_packaging_qc`
--

LOCK TABLES `bom_packaging_qc` WRITE;
/*!40000 ALTER TABLE `bom_packaging_qc` DISABLE KEYS */;
INSERT INTO `bom_packaging_qc` VALUES (1,1,1,'2026-05-14 09:13:05'),(2,2,1,'2026-05-14 09:13:05'),(3,3,1,'2026-05-14 09:13:06'),(4,4,2,'2026-05-14 09:13:06'),(5,5,3,'2026-05-14 09:13:06'),(6,6,3,'2026-05-14 09:13:06'),(7,7,4,'2026-05-14 09:13:06'),(8,8,1,'2026-05-14 09:13:06'),(9,9,4,'2026-05-14 09:13:06'),(10,10,4,'2026-05-14 09:13:07'),(11,11,4,'2026-05-14 09:13:07'),(12,12,4,'2026-05-14 09:13:07'),(13,13,3,'2026-05-14 09:13:07'),(14,14,2,'2026-05-14 09:13:07'),(15,15,1,'2026-05-14 09:59:09'),(16,16,2,'2026-05-14 09:59:09'),(17,17,3,'2026-05-14 09:59:10'),(18,18,4,'2026-05-14 09:59:10'),(19,19,1,'2026-05-14 09:59:10'),(20,20,4,'2026-05-14 09:59:10'),(21,21,3,'2026-05-14 09:59:10');
/*!40000 ALTER TABLE `bom_packaging_qc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bom_in_process_qc`
--

DROP TABLE IF EXISTS `bom_in_process_qc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom_in_process_qc` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bom_id` int NOT NULL,
  `criteria_id` int NOT NULL,
  `sequence` int NOT NULL DEFAULT '1',
  `sample_size` int NOT NULL DEFAULT '1',
  `is_critical` tinyint(1) NOT NULL DEFAULT '0',
  `phase` varchar(50) NOT NULL DEFAULT 'production',
  `max_retest_rounds` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom_in_process_qc`
--

LOCK TABLES `bom_in_process_qc` WRITE;
/*!40000 ALTER TABLE `bom_in_process_qc` DISABLE KEYS */;
INSERT INTO `bom_in_process_qc` VALUES (1,1,1,1,10,0,'production',NULL,'2026-05-14 09:13:05'),(2,1,2,2,3,0,'production',NULL,'2026-05-14 09:13:05'),(3,1,5,3,20,0,'packaging',NULL,'2026-05-14 09:13:05'),(4,2,1,1,10,0,'production',NULL,'2026-05-14 09:13:05'),(5,2,2,2,3,0,'production',NULL,'2026-05-14 09:13:05'),(6,2,5,3,20,0,'packaging',NULL,'2026-05-14 09:13:05'),(7,3,1,1,10,0,'production',NULL,'2026-05-14 09:13:06'),(8,3,2,2,3,0,'production',NULL,'2026-05-14 09:13:06'),(9,3,5,3,20,0,'packaging',NULL,'2026-05-14 09:13:06'),(10,4,1,1,10,0,'production',NULL,'2026-05-14 09:13:06'),(11,4,4,2,10,0,'production',NULL,'2026-05-14 09:13:06'),(12,4,3,3,6,0,'production',NULL,'2026-05-14 09:13:06'),(13,4,5,4,20,0,'packaging',NULL,'2026-05-14 09:13:06'),(14,5,2,1,3,0,'production',NULL,'2026-05-14 09:13:06'),(15,5,1,2,10,0,'packaging',NULL,'2026-05-14 09:13:06'),(16,5,5,3,20,0,'packaging',NULL,'2026-05-14 09:13:06'),(17,6,2,1,3,0,'production',NULL,'2026-05-14 09:13:06'),(18,6,1,2,10,0,'packaging',NULL,'2026-05-14 09:13:06'),(19,6,5,3,20,0,'packaging',NULL,'2026-05-14 09:13:06'),(20,7,5,1,10,0,'production',NULL,'2026-05-14 09:13:06'),(21,7,6,2,10,0,'packaging',NULL,'2026-05-14 09:13:06'),(22,8,1,1,10,0,'production',NULL,'2026-05-14 09:13:06'),(23,8,2,2,3,0,'production',NULL,'2026-05-14 09:13:06'),(24,8,5,3,20,0,'packaging',NULL,'2026-05-14 09:13:06'),(25,9,5,1,10,0,'production',NULL,'2026-05-14 09:13:06'),(26,9,6,2,10,0,'packaging',NULL,'2026-05-14 09:13:06'),(27,10,5,1,10,0,'production',NULL,'2026-05-14 09:13:07'),(28,10,6,2,10,0,'packaging',NULL,'2026-05-14 09:13:07'),(29,11,5,1,10,0,'production',NULL,'2026-05-14 09:13:07'),(30,11,6,2,10,0,'packaging',NULL,'2026-05-14 09:13:07'),(31,12,5,1,10,0,'production',NULL,'2026-05-14 09:13:07'),(32,12,6,2,10,0,'packaging',NULL,'2026-05-14 09:13:07'),(33,13,1,1,5,0,'production',NULL,'2026-05-14 09:13:07'),(34,13,5,2,10,0,'packaging',NULL,'2026-05-14 09:13:07'),(35,14,1,1,10,0,'production',NULL,'2026-05-14 09:13:07'),(36,14,4,2,10,0,'production',NULL,'2026-05-14 09:13:07'),(37,14,3,3,6,0,'production',NULL,'2026-05-14 09:13:07'),(38,14,5,4,20,0,'packaging',NULL,'2026-05-14 09:13:07'),(39,15,1,1,10,0,'production',NULL,'2026-05-14 09:59:09'),(40,15,2,2,3,0,'production',NULL,'2026-05-14 09:59:09'),(41,15,5,3,20,0,'packaging',NULL,'2026-05-14 09:59:09'),(42,16,1,1,10,0,'production',NULL,'2026-05-14 09:59:09'),(43,16,4,2,10,0,'production',NULL,'2026-05-14 09:59:09'),(44,16,3,3,6,0,'production',NULL,'2026-05-14 09:59:09'),(45,16,5,4,20,0,'packaging',NULL,'2026-05-14 09:59:09'),(46,17,2,1,3,0,'production',NULL,'2026-05-14 09:59:10'),(47,17,1,2,10,0,'packaging',NULL,'2026-05-14 09:59:10'),(48,17,5,3,20,0,'packaging',NULL,'2026-05-14 09:59:10'),(49,18,5,1,10,0,'production',NULL,'2026-05-14 09:59:10'),(50,18,6,2,10,0,'packaging',NULL,'2026-05-14 09:59:10'),(51,19,1,1,10,0,'production',NULL,'2026-05-14 09:59:10'),(52,19,2,2,3,0,'production',NULL,'2026-05-14 09:59:10'),(53,19,5,3,20,0,'packaging',NULL,'2026-05-14 09:59:10'),(54,20,5,1,10,0,'production',NULL,'2026-05-14 09:59:10'),(55,20,6,2,10,0,'packaging',NULL,'2026-05-14 09:59:10'),(56,21,1,1,5,0,'production',NULL,'2026-05-14 09:59:10'),(57,21,5,2,10,0,'packaging',NULL,'2026-05-14 09:59:10'),(58,7,1,3,10,1,'pre_production',NULL,'2026-06-04 22:56:12');
/*!40000 ALTER TABLE `bom_in_process_qc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bom_sop_step_ipc`
--

DROP TABLE IF EXISTS `bom_sop_step_ipc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom_sop_step_ipc` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bom_step_id` int NOT NULL,
  `procedure_step_id` int DEFAULT NULL,
  `criteria_id` int NOT NULL,
  `sequence` int NOT NULL DEFAULT '1',
  `sample_size` int NOT NULL DEFAULT '1',
  `is_critical` tinyint(1) NOT NULL DEFAULT '0',
  `max_retest_rounds` int DEFAULT NULL,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom_sop_step_ipc`
--

LOCK TABLES `bom_sop_step_ipc` WRITE;
/*!40000 ALTER TABLE `bom_sop_step_ipc` DISABLE KEYS */;
/*!40000 ALTER TABLE `bom_sop_step_ipc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name_th` varchar(255) NOT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `type` varchar(50) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `primary_unit` varchar(50) NOT NULL,
  `secondary_unit` varchar(50) DEFAULT NULL,
  `conversion_rate` decimal(10,4) DEFAULT NULL,
  `weight_unit` varchar(50) DEFAULT NULL,
  `secondary_to_weight_rate` decimal(10,4) DEFAULT NULL,
  `weight_tracking_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `shelf_life_days` int DEFAULT NULL,
  `storage_condition` varchar(255) DEFAULT NULL,
  `min_stock` decimal(15,4) DEFAULT '0.0000',
  `max_stock` decimal(15,4) DEFAULT NULL,
  `reorder_point` decimal(15,4) DEFAULT NULL,
  `on_hand` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `on_hand_cost` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `quarantine_qty` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `is_lot_controlled` tinyint(1) NOT NULL DEFAULT '1',
  `is_fefo` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `confidentiality_level` enum('PUBLIC','INTERNAL','CONFIDENTIAL') NOT NULL DEFAULT 'PUBLIC',
  `default_confidential` tinyint(1) NOT NULL DEFAULT '0',
  `tpp_code` varchar(13) DEFAULT NULL,
  `tpp_name` varchar(255) DEFAULT NULL,
  `ttmt_code` varchar(10) DEFAULT NULL,
  `ttmt_name` varchar(255) DEFAULT NULL,
  `drug_code_24` varchar(24) DEFAULT NULL,
  `vmi_sync_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `last_vmi_sync_at` datetime DEFAULT NULL,
  `strength` varchar(100) DEFAULT NULL,
  `strength_value` decimal(15,4) DEFAULT NULL,
  `strength_unit` varchar(30) DEFAULT NULL,
  `g_reg_number` varchar(50) DEFAULT NULL,
  `current_wac` decimal(15,4) DEFAULT NULL,
  `last_purchase_cost` decimal(15,4) DEFAULT NULL,
  `last_purchase_date` datetime DEFAULT NULL,
  `last_purchase_po_id` int DEFAULT NULL,
  `last_production_cost` decimal(15,4) DEFAULT NULL,
  `last_production_date` datetime DEFAULT NULL,
  `last_production_wo_id` int DEFAULT NULL,
  `sga_allocation_rate` decimal(5,2) DEFAULT '0.00',
  `standard_cost` decimal(15,4) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_primary_packing` tinyint(1) NOT NULL DEFAULT '0',
  `unit_weight_mg` decimal(15,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `items`
--

LOCK TABLES `items` WRITE;
/*!40000 ALTER TABLE `items` DISABLE KEYS */;
INSERT INTO `items` VALUES (1,'RM-0001','ผงขมิ้นชัน','Turmeric Powder','raw_material','สมุนไพร','kg','g',1000.0000,'g',1.0000,1,730,'เก็บในที่แห้ง อุณหภูมิห้อง หลีกเลี่ยงแสง',5.0000,500.0000,50.0000,200.0000,71400.0000,0.0000,1,1,1,'PUBLIC',0,'1000000000001','ขมิ้นชัน TPP','TTM-0001','ขมิ้นชัน','100000000000000000000001',0,NULL,'curcumin 95',95.0000,'%',NULL,357.0000,350.0000,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,5.00,350.0000,'2026-06-10 17:23:36','2026-06-10 17:23:36',0,NULL),(2,'RM-0002','ผงฟ้าทะลายโจร','Andrographis Powder','raw_material','สมุนไพร','kg','g',1000.0000,'g',1.0000,1,730,'เก็บในที่แห้ง อุณหภูมิห้อง',5.0000,400.0000,40.0000,95.0000,39900.0000,0.0000,1,1,1,'PUBLIC',0,'1000000000002','ฟ้าทะลายโจร TPP','TTM-0002','ฟ้าทะลายโจร','100000000000000000000002',0,NULL,'andrographolide 4',4.0000,'%',NULL,420.0000,420.0000,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,5.00,420.0000,'2026-06-10 17:23:36','2026-06-10 17:23:36',0,NULL),(3,'RM-0003','สารสกัดกระชายขาว','Fingerroot Extract','raw_material','สารสกัด','kg','g',1000.0000,'g',1.0000,1,548,'เก็บในตู้เย็น 2-8°C',2.0000,100.0000,20.0000,30.0000,56400.0000,0.0000,1,1,1,'CONFIDENTIAL',1,'1000000000003','กระชายขาว TPP','TTM-0003','กระชายขาว','100000000000000000000003',0,NULL,'panduratin 1.5',1.5000,'%',NULL,1880.0000,1850.0000,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,8.00,1850.0000,'2026-06-10 17:23:36','2026-06-10 17:23:36',0,NULL),(4,'PK-0001','แคปซูลเปล่า ขนาด 0','Empty Capsule Size 0','packaging','แคปซูล','box','cap',5000.0000,NULL,NULL,0,1095,'เก็บในที่แห้ง อุณหภูมิห้อง',10.0000,200.0000,30.0000,60.0000,5760.0000,0.0000,1,1,1,'PUBLIC',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,96.0000,0.0192,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,0.00,0.0192,'2026-06-10 17:23:36','2026-06-10 17:23:36',1,96.0000),(5,'PK-0002','แคปซูลเปล่า ขนาด 00','Empty Capsule Size 00','packaging','แคปซูล','box','cap',5000.0000,NULL,NULL,0,1095,'เก็บในที่แห้ง อุณหภูมิห้อง',5.0000,100.0000,15.0000,30.0000,3540.0000,0.0000,1,1,1,'PUBLIC',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,118.0000,0.0236,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,0.00,0.0236,'2026-06-10 17:23:36','2026-06-10 17:23:36',1,118.0000),(6,'PK-0003','ขวดพลาสติก HDPE 60 cc','HDPE Bottle 60cc','packaging','ขวด','box','pcs',100.0000,NULL,NULL,0,1825,'เก็บในที่แห้ง อุณหภูมิห้อง',20.0000,500.0000,50.0000,80.0000,28000.0000,0.0000,1,0,1,'PUBLIC',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,350.0000,3.5000,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,0.00,3.5000,'2026-06-10 17:23:36','2026-06-10 17:23:36',1,8500.0000),(7,'WIP-0001','ผงผสมขมิ้นชัน (bulk)','Turmeric Blend Bulk','wip','ผงผสม','kg','g',1000.0000,'g',1.0000,1,365,'เก็บในถุงสุญญากาศ อุณหภูมิห้อง',2.0000,50.0000,10.0000,18.0000,8730.0000,0.0000,1,1,1,'INTERNAL',0,NULL,NULL,NULL,NULL,NULL,0,NULL,'curcumin 90',90.0000,'%',NULL,485.0000,480.0000,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,6.00,480.0000,'2026-06-10 17:23:36','2026-06-10 17:23:36',0,NULL),(8,'WIP-0002','ผงผสมฟ้าทะลายโจร (bulk)','Andrographis Blend Bulk','wip','ผงผสม','kg','g',1000.0000,'g',1.0000,1,365,'เก็บในถุงสุญญากาศ อุณหภูมิห้อง',2.0000,40.0000,8.0000,15.0000,8025.0000,0.0000,1,1,1,'INTERNAL',0,NULL,NULL,NULL,NULL,NULL,0,NULL,'andrographolide 4',4.0000,'%',NULL,535.0000,530.0000,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,6.00,530.0000,'2026-06-10 17:23:36','2026-06-10 17:23:36',0,NULL),(9,'FG-0001','แคปซูลขมิ้นชัน 500 mg (60 แคปซูล)','Turmeric Capsule 500mg (60s)','finished_goods','herb','bottle','cap',60.0000,'mg',500.0000,1,730,'เก็บในที่แห้ง อุณหภูมิห้อง หลีกเลี่ยงแสงแดด',50.0000,2000.0000,200.0000,800.0000,76000.0000,0.0000,1,1,1,'PUBLIC',0,'2000000000001','ยาแคปซูลขมิ้นชัน','TTM-1001','ขมิ้นชันแคปซูล','200000000000000000000001',1,NULL,'500 mg/แคปซูล',500.0000,'mg/แคปซูล','G 123/2566',95.0000,95.0000,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,10.00,95.0000,'2026-06-10 17:23:36','2026-06-10 17:27:01',0,NULL),(10,'FG-0002','แคปซูลฟ้าทะลายโจร 400 mg (60 แคปซูล)','Andrographis Capsule 400mg (60s)','finished_goods','ยาแคปซูล','bottle','cap',60.0000,'mg',400.0000,1,730,'เก็บในที่แห้ง อุณหภูมิห้อง',50.0000,1500.0000,150.0000,600.0000,52800.0000,0.0000,1,1,1,'PUBLIC',0,'2000000000002','ยาแคปซูลฟ้าทะลายโจร','TTM-1002','ฟ้าทะลายโจรแคปซูล','200000000000000000000002',1,NULL,'400 mg/แคปซูล',400.0000,'mg/แคปซูล','G 124/2566',88.0000,88.0000,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,10.00,88.0000,'2026-06-10 17:23:36','2026-06-10 17:23:36',0,NULL),(11,'FG-0003','แคปซูลกระชายขาว 350 mg (30 แคปซูล)','Fingerroot Capsule 350mg (30s)','finished_goods','ยาแคปซูล','bottle','cap',30.0000,'mg',350.0000,1,548,'เก็บในที่แห้ง อุณหภูมิห้อง',30.0000,800.0000,80.0000,300.0000,43500.0000,0.0000,1,1,1,'CONFIDENTIAL',1,'2000000000003','ยาแคปซูลกระชายขาว','TTM-1003','กระชายขาวแคปซูล','200000000000000000000003',0,NULL,'350 mg/แคปซูล',350.0000,'mg/แคปซูล','G 125/2566',145.0000,145.0000,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,12.00,145.0000,'2026-06-10 17:23:36','2026-06-10 17:23:36',0,NULL),(12,'CS-0001','ถุงมือไนไตรล์ ไซส์ M','Nitrile Gloves M','consumable','วัสดุสิ้นเปลือง','box','pcs',100.0000,NULL,NULL,0,1095,'เก็บในที่แห้ง อุณหภูมิห้อง',10.0000,100.0000,20.0000,40.0000,4800.0000,0.0000,0,0,1,'PUBLIC',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,120.0000,120.0000,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,0.00,120.0000,'2026-06-10 17:23:36','2026-06-10 17:23:36',0,NULL),(13,'CS-0002','แอลกอฮอล์ 70% 5 ลิตร','Ethanol 70% 5L','consumable','วัสดุสิ้นเปลือง','gallon','ml',5000.0000,NULL,NULL,0,730,'เก็บในที่เย็น ห่างจากเปลวไฟ',5.0000,50.0000,10.0000,25.0000,8750.0000,0.0000,0,0,1,'PUBLIC',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,350.0000,350.0000,'2026-06-10 17:24:43',NULL,NULL,NULL,NULL,0.00,350.0000,'2026-06-10 17:23:36','2026-06-10 17:23:36',0,NULL);
/*!40000 ALTER TABLE `items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_units`
--

DROP TABLE IF EXISTS `item_units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_units` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name_th` varchar(255) NOT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `symbol` varchar(20) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_units`
--

LOCK TABLES `item_units` WRITE;
/*!40000 ALTER TABLE `item_units` DISABLE KEYS */;
INSERT INTO `item_units` VALUES (1,'kg','กิโลกรัม','Kilogram','kg','Weight unit (1000 grams)',1,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(2,'g','กรัม','Gram','g','Weight unit',2,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(3,'mg','มิลลิกรัม','Milligram','mg','Weight unit (0.001 gram)',3,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(4,'l','ลิตร','Liter','L','Volume unit',4,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(5,'ml','มิลลิลิตร','Milliliter','mL','Volume unit (0.001 liter)',5,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(6,'pcs','ชิ้น','Piece','pcs','Count unit',6,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(7,'pack','แพ็ค','Pack','pack','Package unit',7,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(8,'box','กล่อง','Box','box','Box unit',8,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(9,'bottle','ขวด','Bottle','bottle','Bottle unit',9,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(10,'bag','ถุง','Bag','bag','Bag unit',10,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(11,'roll','ม้วน','Roll','roll','Roll unit',11,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(12,'sheet','แผ่น','Sheet','sheet','Sheet unit',12,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(13,'set','ชุด','Set','set','Set unit',13,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(14,'carton','ลัง','Carton','carton','Carton unit',14,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(15,'drum','ถัง','Drum','drum','Drum/barrel unit',15,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(16,'can','กระป๋อง','Can','can','Can unit',16,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(17,'tube','หลอด','Tube','tube','Tube unit',17,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(18,'cap','ฝา','Cap','cap','Cap/lid unit',18,1,'2026-05-14 08:17:38','2026-05-14 08:17:38');
/*!40000 ALTER TABLE `item_units` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_categories`
--

DROP TABLE IF EXISTS `item_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name_th` varchar(255) NOT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_categories`
--

LOCK TABLES `item_categories` WRITE;
/*!40000 ALTER TABLE `item_categories` DISABLE KEYS */;
INSERT INTO `item_categories` VALUES (1,'herb','สมุนไพร','Herb','Raw herbal materials',1,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(2,'extract','สารสกัด','Extract','Herbal extracts and concentrates',2,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(3,'excipient','สารเติมแต่ง','Excipient','Pharmaceutical excipients',3,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(4,'packaging','บรรจุภัณฑ์','Packaging','Packaging materials',4,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(5,'capsule','แคปซูล','Capsule','Empty capsules',5,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(6,'bottle','ขวด','Bottle','Bottles and containers',6,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(7,'label','ฉลาก','Label','Labels and stickers',7,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(8,'box','กล่อง','Box','Boxes and cartons',8,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(9,'finished','ผลิตภัณฑ์สำเร็จรูป','Finished Product','Finished products',9,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(10,'semi_finished','กึ่งสำเร็จรูป','Semi-finished','Semi-finished products',10,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(11,'consumable','วัสดุสิ้นเปลือง','Consumable','Consumable supplies',11,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(12,'chemical','เคมีภัณฑ์','Chemical','Chemical substances',12,1,'2026-05-14 08:17:38','2026-05-14 08:17:38'),(13,'other','อื่นๆ','Other','Other materials',99,1,'2026-05-14 08:17:38','2026-05-14 08:17:38');
/*!40000 ALTER TABLE `item_categories` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-10 17:51:55
