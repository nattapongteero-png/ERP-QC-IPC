-- =====================================================================
-- BOM Rebuild Seed — Part 2: bom_lines (formula ingredients)
-- All item_id values reference REAL items (1..60).
-- =====================================================================
SET NAMES utf8mb4;

-- BOM 1 — Capsule Turmeric 500mg (per 1000 bottles, 60 cap/bottle = 60000 cap)
-- Active ingredient 500mg/cap → 30000 g turmeric powder.
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (1, 1,30000,'g',1,83.33,'ผงขมิ้นชัน ตัวยาสำคัญ 500mg/cap'),
 (1,31, 4000,'g',2,11.11,'MCC เป็นสารช่วยไหล'),
 (1,30,  500,'g',3, 1.39,'แมกนีเซียมสเตียเรต สารหล่อลื่น'),
 (1,29, 1500,'g',4, 4.17,'แป้งข้าวโพด filler'),
 (1, 5,60000,'cap',5,NULL,'แคปซูลเปล่า ขนาด 00'),
 (1, 6, 1000,'pcs',6,NULL,'ขวด HDPE 60cc'),
 (1,44, 1000,'pcs',7,NULL,'ฉลากผลิตภัณฑ์');

-- BOM 2 — Capsule Andrographis 400mg
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (2, 2,24000,'g',1,80.00,'ผงฟ้าทะลายโจร 400mg/cap'),
 (2,31, 3600,'g',2,12.00,'MCC'),
 (2,30,  450,'g',3, 1.50,'แมกนีเซียมสเตียเรต'),
 (2,29, 1950,'g',4, 6.50,'แป้งข้าวโพด'),
 (2, 4,60000,'cap',5,NULL,'แคปซูลเปล่า ขนาด 0'),
 (2, 6, 1000,'pcs',6,NULL,'ขวด HDPE 60cc'),
 (2,44, 1000,'pcs',7,NULL,'ฉลาก');

-- BOM 3 — Capsule Krachai 350mg (uses extract + WIP bulk)
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (3, 3, 7000,'g',1,66.67,'สารสกัดกระชายขาว 350mg/cap (30cap/bottle)'),
 (3,31, 2500,'g',2,23.81,'MCC'),
 (3,30,  300,'g',3, 2.86,'แมกนีเซียมสเตียเรต'),
 (3,29,  700,'g',4, 6.67,'แป้งข้าวโพด'),
 (3, 4,30000,'cap',5,NULL,'แคปซูลเปล่า ขนาด 0'),
 (3, 6, 1000,'pcs',6,NULL,'ขวด HDPE 60cc'),
 (3,44, 1000,'pcs',7,NULL,'ฉลาก');

-- BOM 4 — Tablet Tinospora 500mg (100 tab/bottle = 100000 tab)
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (4,14,50000,'g',1,76.92,'ผงบอระเพ็ด 500mg/tab'),
 (4,31,10000,'g',2,15.38,'MCC binder'),
 (4,30, 1000,'g',3, 1.54,'แมกนีเซียมสเตียเรต'),
 (4,29, 4000,'g',4, 6.15,'แป้งข้าวโพด disintegrant'),
 (4, 6, 1000,'pcs',5,NULL,'ขวด'),
 (4,44, 1000,'pcs',6,NULL,'ฉลาก');

-- BOM 5 — Ginger powder sachet (5g x 10 sachet/box, 2000 box = 20000 sachet)
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (5,15,80000,'g',1,80.00,'ผงขิง 4g/ซอง'),
 (5,32,18000,'g',2,18.00,'น้ำเชื่อมเข้มข้น เพิ่มรสหวาน'),
 (5,33, 2000,'ml',3, 2.00,'น้ำบริสุทธิ์'),
 (5,36,20000,'pcs',4,NULL,'ซองฟอยล์ 5g'),
 (5,44, 2000,'pcs',5,NULL,'ฉลากกล่อง');

-- BOM 6 — Thunbergia tea sachet
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (6,16,90000,'g',1,90.00,'ผงรางจืด 4.5g/ซอง'),
 (6,15, 8000,'g',2, 8.00,'ผงขิง แต่งกลิ่น'),
 (6,32, 2000,'g',3, 2.00,'น้ำเชื่อมเข้มข้น'),
 (6,36,20000,'pcs',4,NULL,'ซองฟอยล์ 5g'),
 (6,44, 2000,'pcs',5,NULL,'ฉลากกล่อง');

-- BOM 7 — Cough syrup Emblica 100ml (1000 bottle)
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (7,17,20000,'g',1,20.00,'มะขามป้อมเข้มข้น'),
 (7,32,45000,'g',2,45.00,'น้ำเชื่อมเข้มข้น'),
 (7,18,10000,'g',3,10.00,'น้ำผึ้ง'),
 (7,35,  200,'g',4, 0.20,'เมทิลพาราเบน สารกันเสีย'),
 (7,33,24800,'ml',5,24.80,'น้ำบริสุทธิ์'),
 (7,37, 1000,'pcs',6,NULL,'ขวดแก้วสีชา 100ml');

-- BOM 8 — Herbal bolus (ลูกกลอน) 60 pcs/bottle x 500 = 30000 pcs
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (8, 1, 8000,'g',1,40.00,'ผงขมิ้นชัน'),
 (8, 2, 4000,'g',2,20.00,'ผงฟ้าทะลายโจร'),
 (8,14, 3000,'g',3,15.00,'ผงบอระเพ็ด'),
 (8,18, 4500,'g',4,22.50,'น้ำผึ้ง สารยึดเกาะ'),
 (8,33,  500,'ml',5, 2.50,'น้ำบริสุทธิ์'),
 (8, 6, 1000,'pcs',6,NULL,'ขวด'),
 (8,44, 1000,'pcs',7,NULL,'ฉลาก');

-- BOM 9 — Herbal balm 15g (2000 pcs)
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (9,22,18000,'g',1,60.00,'วาสลีน base'),
 (9,34, 6000,'g',2,20.00,'บีแว็กซ์'),
 (9,21, 2400,'g',3, 8.00,'เมนทอล'),
 (9,20, 1800,'g',4, 6.00,'การบูร'),
 (9,19, 1800,'g',5, 6.00,'พิมเสน'),
 (9,39, 2000,'pcs',6,NULL,'ขวดยาหม่อง 15g');

-- BOM 10 — Aloe cream 30g (1500 pcs)
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (10,23,22500,'g',1,50.00,'เจลว่านหางจระเข้'),
 (10,25,13500,'g',2,30.00,'น้ำมันมะพร้าว'),
 (10,34, 4500,'g',3,10.00,'บีแว็กซ์ emulsifier'),
 (10,35,  225,'g',4, 0.50,'เมทิลพาราเบน'),
 (10,33, 4275,'ml',5, 9.50,'น้ำบริสุทธิ์'),
 (10,38, 1500,'pcs',6,NULL,'ตลับครีม 30g');

-- BOM 11 — Massage oil 120ml (1000 bottle)
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (11,25,84000,'g',1,70.00,'น้ำมันมะพร้าว base'),
 (11,24,24000,'g',2,20.00,'น้ำมันไพล'),
 (11,21, 6000,'g',3, 5.00,'เมนทอล'),
 (11,20, 6000,'g',4, 5.00,'การบูร'),
 (11,40, 1000,'pcs',5,NULL,'ขวดน้ำมันนวด 120ml'),
 (11,44, 1000,'pcs',6,NULL,'ฉลาก');

-- BOM 12 — Herbal inhaler 3ml (3000 pcs)
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (12,21, 3600,'g',1,40.00,'เมนทอล'),
 (12,20, 2700,'g',2,30.00,'การบูร'),
 (12,19, 1800,'g',3,20.00,'พิมเสน'),
 (12,26,  900,'g',4,10.00,'ตะไคร้หอมอบแห้ง'),
 (12,41, 3000,'pcs',5,NULL,'ขวดยาดม 3ml');

-- BOM 13 — Herbal compress ball 200g (500 pcs)
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (13,27,40000,'g',1,40.00,'ไพลอบแห้ง'),
 (13,26,30000,'g',2,30.00,'ตะไคร้หอมอบแห้ง'),
 (13, 1,15000,'g',3,15.00,'ผงขมิ้นชัน'),
 (13,20, 5000,'g',4, 5.00,'การบูร'),
 (13,42,  500,'pcs',5,NULL,'ผ้าห่อลูกประคบ'),
 (13,44,  500,'pcs',6,NULL,'ฉลาก');

-- BOM 14 — Solanum lozenge 300mg (100 pcs/box x 1000 = 100000 pcs)
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (14,28,30000,'g',1,50.00,'ผงมะแว้ง 300mg/เม็ด'),
 (14,32,21000,'g',2,35.00,'น้ำเชื่อมเข้มข้น base'),
 (14,18, 6000,'g',3,10.00,'น้ำผึ้ง'),
 (14,21, 3000,'g',4, 5.00,'เมนทอล'),
 (14,43,10000,'pcs',5,NULL,'แผงบลิสเตอร์ 10 เม็ด'),
 (14,44, 1000,'pcs',6,NULL,'ฉลากกล่อง');

-- ---- V2 drafts: same formula as base, scaled-up batch sizes ----
-- BOM 15 = V2 of BOM 1
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (15, 1,36000,'g',1,83.33,'ผงขมิ้นชัน'),
 (15,31, 4800,'g',2,11.11,'MCC'),
 (15,30,  600,'g',3, 1.39,'แมกนีเซียมสเตียเรต'),
 (15,29, 1800,'g',4, 4.17,'แป้งข้าวโพด'),
 (15, 5,72000,'cap',5,NULL,'แคปซูลเปล่า ขนาด 00'),
 (15, 6, 1200,'pcs',6,NULL,'ขวด'),
 (15,44, 1200,'pcs',7,NULL,'ฉลาก');

-- BOM 16 = V2 of BOM 4
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (16,14,60000,'g',1,76.92,'ผงบอระเพ็ด'),
 (16,31,12000,'g',2,15.38,'MCC'),
 (16,30, 1200,'g',3, 1.54,'แมกนีเซียมสเตียเรต'),
 (16,29, 4800,'g',4, 6.15,'แป้งข้าวโพด'),
 (16, 6, 1200,'pcs',5,NULL,'ขวด'),
 (16,44, 1200,'pcs',6,NULL,'ฉลาก');

-- BOM 17 = V2 of BOM 5
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (17,15,100000,'g',1,80.00,'ผงขิง'),
 (17,32, 22500,'g',2,18.00,'น้ำเชื่อมเข้มข้น'),
 (17,33,  2500,'ml',3, 2.00,'น้ำบริสุทธิ์'),
 (17,36, 25000,'pcs',4,NULL,'ซองฟอยล์'),
 (17,44,  2500,'pcs',5,NULL,'ฉลากกล่อง');

-- BOM 18 = V2 of BOM 7
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (18,17,24000,'g',1,20.00,'มะขามป้อมเข้มข้น'),
 (18,32,54000,'g',2,45.00,'น้ำเชื่อมเข้มข้น'),
 (18,18,12000,'g',3,10.00,'น้ำผึ้ง'),
 (18,35,  240,'g',4, 0.20,'เมทิลพาราเบน'),
 (18,33,29760,'ml',5,24.80,'น้ำบริสุทธิ์'),
 (18,37, 1200,'pcs',6,NULL,'ขวดแก้วสีชา');

-- BOM 19 = V2 of BOM 8
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (19, 1, 9600,'g',1,40.00,'ผงขมิ้นชัน'),
 (19, 2, 4800,'g',2,20.00,'ผงฟ้าทะลายโจร'),
 (19,14, 3600,'g',3,15.00,'ผงบอระเพ็ด'),
 (19,18, 5400,'g',4,22.50,'น้ำผึ้ง'),
 (19,33,  600,'ml',5, 2.50,'น้ำบริสุทธิ์'),
 (19, 6, 1200,'pcs',6,NULL,'ขวด'),
 (19,44, 1200,'pcs',7,NULL,'ฉลาก');

-- BOM 20 = V2 of BOM 9
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (20,22,21600,'g',1,60.00,'วาสลีน'),
 (20,34, 7200,'g',2,20.00,'บีแว็กซ์'),
 (20,21, 2880,'g',3, 8.00,'เมนทอล'),
 (20,20, 2160,'g',4, 6.00,'การบูร'),
 (20,19, 2160,'g',5, 6.00,'พิมเสน'),
 (20,39, 2400,'pcs',6,NULL,'ขวดยาหม่อง');

-- BOM 21 = V2 of BOM 13
INSERT INTO bom_lines (bom_id,item_id,quantity,unit,sequence,percentage_in_formula,notes) VALUES
 (21,27,48000,'g',1,40.00,'ไพลอบแห้ง'),
 (21,26,36000,'g',2,30.00,'ตะไคร้หอมอบแห้ง'),
 (21, 1,18000,'g',3,15.00,'ผงขมิ้นชัน'),
 (21,20, 6000,'g',4, 5.00,'การบูร'),
 (21,42,  600,'pcs',5,NULL,'ผ้าห่อลูกประคบ'),
 (21,44,  600,'pcs',6,NULL,'ฉลาก');
