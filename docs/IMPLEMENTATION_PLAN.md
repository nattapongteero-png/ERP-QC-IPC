# Herbal Medicine ERP - Comprehensive Implementation Plan

แผนพัฒนาระบบบริหารจัดการการผลิตยาสมุนไพรแบบครบวงจร ตามมาตรฐาน GMP PIC/S

## Executive Summary

เอกสารนี้อธิบายแผนการพัฒนาแต่ละโมดูลของระบบ ERP สำหรับโรงงานผลิตยาสมุนไพร โดยครอบคลุม:
- Features และ Algorithms ที่สะท้อน Real-world Scenarios
- Use Cases ที่พบบ่อยในอุตสาหกรรม
- Business Logic และ Validation Rules
- Integration Points ระหว่างโมดูล

---

## Module 1: Inventory Management (ระบบคลังสินค้า)

### 1.1 Core Features

#### 1.1.1 Item Master Management
**Real-world Scenario**: โรงงานต้องจัดการวัตถุดิบหลากหลายประเภท ตั้งแต่สมุนไพรดิบ สารสกัด ตัวทำละลาย บรรจุภัณฑ์ ไปจนถึงสินค้าสำเร็จรูป

**Features**:
- รองรับประเภทสินค้า: Raw Material, Extract, Solvent, Excipient, Packaging, WIP, Finished Good
- Herbal Attributes: ชื่อพฤกษศาสตร์, ส่วนที่ใช้, แหล่งที่มา, วันเก็บเกี่ยว
- หน่วยนับหลัก/รอง พร้อม Conversion Factor
- Shelf Life และ Storage Conditions
- Min/Max Stock, Safety Stock, Reorder Point

**Algorithm - Stock Level Calculation**:
```
Available Stock = On Hand - Reserved - Quarantine - Blocked
Reorder Alert = Available Stock <= Reorder Point
```

#### 1.1.2 Lot/Batch Management with FEFO
**Real-world Scenario**: วัตถุดิบสมุนไพรมีอายุจำกัด ต้องใช้ของที่หมดอายุก่อน เพื่อลดการสูญเสีย

**FEFO Algorithm (First Expiry First Out)**:
```python
def get_lots_for_picking(item_id, required_qty):
    # 1. Get all released lots ordered by expiry date
    lots = get_released_lots(item_id).order_by('expiry_date ASC')
    
    # 2. Allocate from earliest expiry first
    allocated = []
    remaining = required_qty
    
    for lot in lots:
        available = lot.quantity - lot.reserved_quantity
        if available > 0:
            allocate_qty = min(available, remaining)
            allocated.append({
                'lot_id': lot.id,
                'quantity': allocate_qty,
                'expiry_date': lot.expiry_date
            })
            remaining -= allocate_qty
            
        if remaining <= 0:
            break
    
    return allocated, remaining
```

**Use Cases**:
1. **UC-INV-001**: รับวัตถุดิบเข้าคลัง → สร้าง Lot → กักกัน (Quarantine)
2. **UC-INV-002**: QC ปล่อยผ่าน → เปลี่ยนสถานะเป็น Released
3. **UC-INV-003**: จ่ายวัตถุดิบเข้าผลิต → ตรวจสอบ FEFO → หักสต็อก
4. **UC-INV-004**: คืนวัตถุดิบจากไลน์ผลิต → ตรวจสอบสภาพ → เข้าคลัง

#### 1.1.3 Inventory Transactions
**Transaction Types**:
| Type | Description | Stock Effect |
|------|-------------|--------------|
| RECEIVE | รับเข้าจาก PO | +Quantity (Quarantine) |
| RELEASE | QC ปล่อยผ่าน | Quarantine → Released |
| ISSUE | จ่ายเข้าผลิต | -Quantity |
| RETURN | คืนจากไลน์ผลิต | +Quantity |
| ADJUST | ปรับยอด (นับสต็อก) | ±Quantity |
| TRANSFER | โอนย้ายคลัง | -From, +To |
| SCRAP | ตัดทำลาย | -Quantity |

#### 1.1.4 Expiry Alert System
**Algorithm**:
```python
def check_expiry_alerts():
    today = date.today()
    
    # Near expiry (30 days)
    near_expiry = lots.filter(
        expiry_date <= today + timedelta(days=30),
        status = 'released'
    )
    
    # Expired
    expired = lots.filter(
        expiry_date < today,
        status = 'released'
    )
    
    # Auto-block expired lots
    for lot in expired:
        lot.status = 'blocked'
        create_deviation('EXPIRED_LOT', lot)
    
    return near_expiry, expired
```

### 1.2 Warehouse Management

#### 1.2.1 Multi-Warehouse Support
- Warehouse Types: Raw Material, WIP, Finished Goods, Quarantine, Rejected
- Location/Bin Management
- Zone-based Storage (Temperature controlled, Humidity controlled)

#### 1.2.2 Stock Valuation
**Methods Supported**:
- FIFO Cost
- Weighted Average Cost
- Standard Cost

---

## Module 2: Production Management (ระบบการผลิต)

### 2.1 Core Features

#### 2.1.1 Bill of Materials (BOM)
**Real-world Scenario**: สูตรการผลิตยาสมุนไพรมีหลายระดับ ตั้งแต่การสกัด การผสม ไปจนถึงการบรรจุ

**BOM Structure**:
```
Finished Product (FG-001: แคปซูลขมิ้นชัน 500mg)
├── WIP-001: ผงขมิ้นชันผสม (1 kg per 2000 capsules)
│   ├── EX-001: สารสกัดขมิ้นชัน (200g)
│   ├── RM-002: แป้งข้าวโพด (700g)
│   └── RM-003: Magnesium Stearate (100g)
├── PK-001: แคปซูลเปล่า (2000 pcs)
├── PK-002: ขวดพลาสติก (1 pc)
├── PK-003: ฝาขวด (1 pc)
└── PK-004: ฉลาก (1 pc)
```

**BOM Explosion Algorithm**:
```python
def explode_bom(item_id, quantity, level=0):
    bom = get_bom(item_id)
    requirements = []
    
    for line in bom.lines:
        required_qty = line.quantity * quantity / bom.base_quantity
        
        # Apply yield factor
        required_qty = required_qty / (1 - line.loss_factor)
        
        requirements.append({
            'item_id': line.component_id,
            'quantity': required_qty,
            'level': level
        })
        
        # Recursive explosion for sub-assemblies
        if line.component.type == 'WIP':
            sub_reqs = explode_bom(line.component_id, required_qty, level + 1)
            requirements.extend(sub_reqs)
    
    return requirements
```

#### 2.1.2 Work Order Management
**Work Order Lifecycle**:
```
Draft → Planned → Released → In Progress → Completed → Closed
                     ↓
                  Cancelled
```

**Status Transitions**:
| From | To | Conditions |
|------|-----|------------|
| Draft | Planned | BOM assigned, Quantity > 0 |
| Planned | Released | Materials available, Equipment available |
| Released | In Progress | Materials issued, Line clearance done |
| In Progress | Completed | All operations done, Yield recorded |
| Completed | Closed | QC released, Batch record reviewed |

#### 2.1.3 Electronic Batch Manufacturing Record (eBMR)
**Real-world Scenario**: ทุกขั้นตอนการผลิตต้องบันทึกตาม GMP รวมถึงผู้ปฏิบัติ เวลา และค่าพารามิเตอร์

**eBMR Structure**:
```
Work Order: WO-2024-001
├── Header
│   ├── Product: FG-001
│   ├── Batch: BATCH-2024-001
│   ├── Planned Qty: 10,000 capsules
│   └── Start Date: 2024-01-15
├── Material Dispensing
│   ├── Step 1: Weigh Extract (200g ± 2g)
│   ├── Step 2: Weigh Starch (700g ± 7g)
│   └── Step 3: Weigh Lubricant (100g ± 1g)
├── Processing Steps
│   ├── Step 4: Blending (30 min, 25 RPM)
│   ├── Step 5: Encapsulation
│   └── Step 6: Polishing
├── In-Process Controls
│   ├── IPC-1: Blend uniformity
│   ├── IPC-2: Capsule weight (500mg ± 5%)
│   └── IPC-3: Disintegration time
├── Packaging
│   ├── Step 7: Bottle filling (100 caps/bottle)
│   ├── Step 8: Capping
│   └── Step 9: Labeling
└── Yield Reconciliation
    ├── Input: 10,200 capsules (theoretical)
    ├── Output: 10,000 capsules (actual)
    ├── Reject: 150 capsules
    └── Yield: 98.5%
```

#### 2.1.4 Material Dispensing with Barcode Verification
**Algorithm**:
```python
def dispense_material(work_order_id, lot_barcode, weight):
    # 1. Scan and verify lot
    lot = get_lot_by_barcode(lot_barcode)
    
    # 2. Validate lot status
    if lot.status != 'released':
        raise ValidationError(f"Lot {lot.lot_number} is not released")
    
    # 3. Validate lot is for correct item
    bom_line = get_bom_line(work_order_id, lot.item_id)
    if not bom_line:
        raise ValidationError(f"Item {lot.item_id} not in BOM")
    
    # 4. Check tolerance
    target = bom_line.required_quantity
    tolerance = bom_line.tolerance_percent / 100
    min_weight = target * (1 - tolerance)
    max_weight = target * (1 + tolerance)
    
    if not (min_weight <= weight <= max_weight):
        # Create deviation if out of tolerance
        create_deviation('WEIGHT_OUT_OF_TOLERANCE', {
            'work_order': work_order_id,
            'lot': lot.lot_number,
            'target': target,
            'actual': weight,
            'tolerance': tolerance
        })
        # Require supervisor approval
        require_approval('SUPERVISOR')
    
    # 5. Record dispensing
    create_dispensing_record(work_order_id, lot.id, weight)
    
    # 6. Update lot quantity
    lot.quantity -= weight
    lot.save()
    
    return True
```

#### 2.1.5 Yield Calculation
**Algorithm**:
```python
def calculate_yield(work_order_id):
    wo = get_work_order(work_order_id)
    
    # Theoretical yield from BOM
    theoretical = wo.planned_quantity
    
    # Actual output
    actual_good = wo.actual_quantity
    actual_reject = wo.reject_quantity
    actual_total = actual_good + actual_reject
    
    # Yield calculations
    yield_percent = (actual_good / theoretical) * 100
    reject_percent = (actual_reject / actual_total) * 100 if actual_total > 0 else 0
    
    # Check against target
    bom = get_bom(wo.item_id)
    if yield_percent < bom.min_yield_percent:
        create_deviation('LOW_YIELD', {
            'work_order': work_order_id,
            'expected': bom.min_yield_percent,
            'actual': yield_percent
        })
    
    return {
        'theoretical': theoretical,
        'actual_good': actual_good,
        'actual_reject': actual_reject,
        'yield_percent': yield_percent,
        'reject_percent': reject_percent
    }
```

### 2.2 Production Planning

#### 2.2.1 MRP (Material Requirements Planning)
**Algorithm**:
```python
def run_mrp(demand_list, planning_horizon_days=30):
    requirements = []
    
    for demand in demand_list:
        # Explode BOM
        bom_requirements = explode_bom(demand.item_id, demand.quantity)
        
        for req in bom_requirements:
            # Check available stock
            available = get_available_stock(req['item_id'])
            
            # Calculate net requirement
            net_requirement = req['quantity'] - available
            
            if net_requirement > 0:
                item = get_item(req['item_id'])
                
                # Apply MOQ
                order_qty = max(net_requirement, item.moq)
                
                # Round to MPQ
                if item.mpq > 0:
                    order_qty = ceil(order_qty / item.mpq) * item.mpq
                
                # Calculate order date (demand date - lead time)
                order_date = demand.required_date - timedelta(days=item.lead_time_days)
                
                requirements.append({
                    'item_id': req['item_id'],
                    'quantity': order_qty,
                    'required_date': demand.required_date,
                    'order_date': order_date,
                    'source': 'MRP'
                })
    
    return consolidate_requirements(requirements)
```

---

## Module 3: Quality Control (ระบบควบคุมคุณภาพ)

### 3.1 Core Features

#### 3.1.1 Quality Specifications
**Real-world Scenario**: วัตถุดิบสมุนไพรแต่ละชนิดมีข้อกำหนดคุณภาพเฉพาะ เช่น ความชื้น สารสำคัญ โลหะหนัก

**Specification Structure**:
```
Item: RM-001 (ขมิ้นชัน)
├── Physical Tests
│   ├── Appearance: ผงสีเหลืองส้ม
│   ├── Moisture: ≤ 10%
│   └── Particle Size: 80 mesh
├── Chemical Tests
│   ├── Curcumin Content: ≥ 3%
│   ├── Heavy Metals (Pb): ≤ 10 ppm
│   ├── Heavy Metals (As): ≤ 2 ppm
│   └── Pesticide Residue: Pass
├── Microbiological Tests
│   ├── Total Plate Count: ≤ 10^5 CFU/g
│   ├── Yeast & Mold: ≤ 10^3 CFU/g
│   └── E. coli: Absent
└── Identity Tests
    └── TLC: Match reference
```

#### 3.1.2 Sampling Plan
**Algorithm - AQL Based Sampling**:
```python
def get_sample_size(lot_size, inspection_level='II', aql=1.0):
    """
    Based on ISO 2859-1 / MIL-STD-105E
    """
    # Sample size code letters
    code_letters = {
        'II': {
            (2, 8): 'A', (9, 15): 'B', (16, 25): 'C',
            (26, 50): 'D', (51, 90): 'E', (91, 150): 'F',
            (151, 280): 'G', (281, 500): 'H', (501, 1200): 'J',
            (1201, 3200): 'K', (3201, 10000): 'L'
        }
    }
    
    # Sample sizes
    sample_sizes = {
        'A': 2, 'B': 3, 'C': 5, 'D': 8, 'E': 13,
        'F': 20, 'G': 32, 'H': 50, 'J': 80, 'K': 125, 'L': 200
    }
    
    # Find code letter
    for range_tuple, code in code_letters[inspection_level].items():
        if range_tuple[0] <= lot_size <= range_tuple[1]:
            return sample_sizes[code]
    
    return sample_sizes['L']  # Default for large lots
```

#### 3.1.3 QC Test Workflow
**Workflow**:
```
Sample Request → Sample Collection → Testing → Result Entry → Review → Release/Reject
```

**Test Result Evaluation Algorithm**:
```python
def evaluate_test_results(lot_id):
    lot = get_lot(lot_id)
    tests = get_tests_for_lot(lot_id)
    
    results = {
        'passed': [],
        'failed': [],
        'pending': []
    }
    
    for test in tests:
        spec = get_specification(lot.item_id, test.test_type)
        
        if test.status == 'pending':
            results['pending'].append(test)
            continue
        
        # Evaluate against specification
        if spec.spec_type == 'range':
            passed = spec.min_value <= test.result_value <= spec.max_value
        elif spec.spec_type == 'max':
            passed = test.result_value <= spec.max_value
        elif spec.spec_type == 'min':
            passed = test.result_value >= spec.min_value
        elif spec.spec_type == 'text':
            passed = test.result_text == spec.expected_text
        
        if passed:
            results['passed'].append(test)
        else:
            results['failed'].append(test)
            # Create OOS (Out of Specification) deviation
            create_deviation('OOS', {
                'lot': lot.lot_number,
                'test': test.test_type,
                'expected': spec,
                'actual': test.result_value
            })
    
    # Determine overall status
    if results['pending']:
        return 'under_test', results
    elif results['failed']:
        return 'failed', results
    else:
        return 'passed', results
```

#### 3.1.4 Deviation Management
**Deviation Types**:
- OOS (Out of Specification)
- OOT (Out of Trend)
- Process Deviation
- Equipment Failure
- Documentation Error
- Environmental Excursion

**Deviation Workflow**:
```
Open → Investigation → Root Cause Analysis → CAPA → Implementation → Verification → Close
```

**Investigation Template**:
```python
def create_investigation(deviation_id):
    return {
        'deviation_id': deviation_id,
        'immediate_actions': [],
        'root_cause_analysis': {
            'method': '5-Why / Fishbone',
            'findings': []
        },
        'risk_assessment': {
            'severity': None,  # 1-5
            'probability': None,  # 1-5
            'detectability': None,  # 1-5
            'rpn': None  # Risk Priority Number
        },
        'capa': {
            'corrective_actions': [],
            'preventive_actions': [],
            'responsible_person': None,
            'due_date': None
        },
        'batch_disposition': None,  # release, reject, rework
        'conclusion': None
    }
```

#### 3.1.5 Certificate of Analysis (COA)
**COA Generation**:
```python
def generate_coa(lot_id):
    lot = get_lot(lot_id)
    item = get_item(lot.item_id)
    tests = get_completed_tests(lot_id)
    
    coa = {
        'document_number': generate_coa_number(),
        'issue_date': date.today(),
        'product_info': {
            'name': item.name_en,
            'code': item.code,
            'lot_number': lot.lot_number,
            'batch_number': lot.batch_number,
            'manufacturing_date': lot.manufacturing_date,
            'expiry_date': lot.expiry_date,
            'quantity': lot.quantity,
            'unit': lot.unit
        },
        'test_results': [],
        'conclusion': 'PASS' if all(t.status == 'passed' for t in tests) else 'FAIL',
        'approved_by': None,
        'approval_date': None
    }
    
    for test in tests:
        spec = get_specification(lot.item_id, test.test_type)
        coa['test_results'].append({
            'test_name': test.test_type,
            'specification': format_spec(spec),
            'result': test.result_value or test.result_text,
            'status': 'Complies' if test.status == 'passed' else 'Does not comply'
        })
    
    return coa
```

---

## Module 4: Purchasing (ระบบจัดซื้อ)

### 4.1 Core Features

#### 4.1.1 Vendor Management with AVL
**Real-world Scenario**: ผู้ขายวัตถุดิบสมุนไพรต้องผ่านการประเมินและอนุมัติก่อนสั่งซื้อ

**Vendor Approval Workflow**:
```
Register → Document Review → Sample Evaluation → Audit → Approval → Active
                                                           ↓
                                                    Re-evaluation (Annual)
```

**Approved Vendor List (AVL)**:
```python
def check_vendor_approval(vendor_id, item_id):
    avl = get_avl_entry(vendor_id, item_id)
    
    if not avl:
        return False, "Vendor not approved for this item"
    
    if avl.expiry_date < date.today():
        return False, "Vendor approval expired"
    
    if avl.status != 'approved':
        return False, f"Vendor status: {avl.status}"
    
    return True, "Approved"
```

#### 4.1.2 Purchase Order Management
**PO Lifecycle**:
```
Draft → Pending Approval → Approved → Sent → Partial Receipt → Received → Closed
                                        ↓
                                   Cancelled
```

**PO Creation with MRP Integration**:
```python
def create_po_from_mrp(mrp_requirements):
    # Group by vendor
    vendor_items = group_by_preferred_vendor(mrp_requirements)
    
    purchase_orders = []
    for vendor_id, items in vendor_items.items():
        po = create_purchase_order(vendor_id)
        
        for item in items:
            # Check AVL
            approved, message = check_vendor_approval(vendor_id, item['item_id'])
            if not approved:
                raise ValidationError(message)
            
            # Add line
            po.add_line({
                'item_id': item['item_id'],
                'quantity': item['quantity'],
                'unit_price': get_last_price(vendor_id, item['item_id']),
                'required_date': item['required_date']
            })
        
        purchase_orders.append(po)
    
    return purchase_orders
```

#### 4.1.3 VMI (Vendor Managed Inventory) Integration
**Real-world Scenario**: ผู้ขายบรรจุภัณฑ์บริหารสต็อกให้โรงงาน โดยเติมของตามระดับที่กำหนด

**VMI Data Exchange**:
```python
# Data sent to VMI supplier
def generate_vmi_snapshot():
    vmi_items = get_vmi_items()
    
    snapshot = {
        'timestamp': datetime.now().isoformat(),
        'items': []
    }
    
    for item in vmi_items:
        stock = get_stock_summary(item.id)
        consumption = get_consumption_last_30_days(item.id)
        forecast = get_production_forecast(item.id, days=30)
        
        snapshot['items'].append({
            'item_code': item.code,
            'item_name': item.name_en,
            'unit': item.primary_unit,
            'on_hand': stock['on_hand'],
            'available': stock['available'],
            'quarantine': stock['quarantine'],
            'allocated': stock['allocated'],
            'min_stock': item.min_stock,
            'max_stock': item.max_stock,
            'reorder_point': item.reorder_point,
            'consumption_30d': consumption,
            'forecast_30d': forecast,
            'avg_daily_usage': consumption / 30
        })
    
    return snapshot

# Process ASN from VMI supplier
def process_vmi_asn(asn_data):
    for line in asn_data['lines']:
        # Create receiving record
        receiving = create_receiving({
            'vendor_id': asn_data['vendor_id'],
            'asn_number': asn_data['asn_number'],
            'item_code': line['item_code'],
            'quantity': line['quantity'],
            'lot_number': line['lot_number'],
            'expiry_date': line['expiry_date'],
            'expected_date': asn_data['expected_delivery_date']
        })
        
        # Auto-create lot in quarantine
        create_lot({
            'item_id': get_item_by_code(line['item_code']).id,
            'lot_number': line['lot_number'],
            'quantity': line['quantity'],
            'status': 'quarantine',
            'expiry_date': line['expiry_date'],
            'vendor_id': asn_data['vendor_id'],
            'receiving_id': receiving.id
        })
    
    return receiving
```

---

## Module 5: Sales (ระบบขาย)

### 5.1 Core Features

#### 5.1.1 Sales Order Management
**SO Lifecycle**:
```
Draft → Confirmed → Processing → Ready to Ship → Shipped → Delivered → Invoiced
                       ↓
                   Cancelled
```

#### 5.1.2 Available to Promise (ATP)
**Algorithm**:
```python
def check_atp(item_id, quantity, required_date):
    # Current available stock
    available = get_available_stock(item_id)
    
    # Incoming (PO + WO)
    incoming = get_expected_receipts(item_id, required_date)
    
    # Committed (SO + WO consumption)
    committed = get_committed_quantity(item_id, required_date)
    
    # ATP calculation
    atp = available + incoming - committed
    
    if atp >= quantity:
        return True, atp, None
    else:
        # Find earliest date when ATP is sufficient
        earliest_date = find_earliest_atp_date(item_id, quantity)
        return False, atp, earliest_date
```

#### 5.1.3 Order Fulfillment with Lot Allocation
**Algorithm**:
```python
def allocate_lots_for_order(order_line_id):
    line = get_order_line(order_line_id)
    
    # Get available lots using FEFO
    lots, remaining = get_lots_for_picking(line.item_id, line.quantity)
    
    if remaining > 0:
        raise InsufficientStockError(f"Short by {remaining} {line.unit}")
    
    # Create allocations
    for lot_allocation in lots:
        create_allocation({
            'order_line_id': order_line_id,
            'lot_id': lot_allocation['lot_id'],
            'quantity': lot_allocation['quantity']
        })
        
        # Update reserved quantity
        lot = get_lot(lot_allocation['lot_id'])
        lot.reserved_quantity += lot_allocation['quantity']
        lot.save()
    
    return lots
```

#### 5.1.4 Delivery and Shipment
**Shipment Creation**:
```python
def create_shipment(order_id):
    order = get_order(order_id)
    
    shipment = {
        'order_id': order_id,
        'customer_id': order.customer_id,
        'shipping_address': order.shipping_address,
        'lines': []
    }
    
    for line in order.lines:
        allocations = get_allocations(line.id)
        
        for alloc in allocations:
            lot = get_lot(alloc.lot_id)
            
            shipment['lines'].append({
                'item_id': line.item_id,
                'lot_number': lot.lot_number,
                'batch_number': lot.batch_number,
                'quantity': alloc.quantity,
                'expiry_date': lot.expiry_date
            })
    
    return shipment
```

---

## Module 6: Reports & Traceability

### 6.1 Traceability Reports

#### 6.1.1 Forward Traceability (Lot → Finished Products)
**Use Case**: ถ้าพบปัญหาในวัตถุดิบ Lot หนึ่ง ต้องหาว่าไปอยู่ในสินค้าสำเร็จรูป Batch ไหนบ้าง

**Algorithm**:
```python
def trace_forward(lot_id):
    """
    Trace from raw material lot to all finished goods batches
    """
    lot = get_lot(lot_id)
    results = []
    
    # Find all work orders that used this lot
    transactions = get_transactions(lot_id, type='ISSUE')
    
    for txn in transactions:
        wo = get_work_order(txn.reference_id)
        
        # Get output lots from this work order
        output_lots = get_output_lots(wo.id)
        
        for output in output_lots:
            results.append({
                'level': 1,
                'work_order': wo.wo_number,
                'output_item': output.item.name_en,
                'output_lot': output.lot_number,
                'output_batch': output.batch_number,
                'quantity_used': txn.quantity,
                'production_date': wo.actual_end_date
            })
            
            # Recursive trace for WIP items
            if output.item.type == 'WIP':
                sub_results = trace_forward(output.id)
                for sub in sub_results:
                    sub['level'] += 1
                    results.append(sub)
    
    return results
```

#### 6.1.2 Backward Traceability (Finished Product → Raw Materials)
**Use Case**: ลูกค้าร้องเรียนสินค้า Batch หนึ่ง ต้องหาว่าใช้วัตถุดิบ Lot ไหนบ้าง

**Algorithm**:
```python
def trace_backward(lot_id):
    """
    Trace from finished goods batch to all raw material lots
    """
    lot = get_lot(lot_id)
    results = []
    
    # Find work order that produced this lot
    wo = get_work_order_by_output_lot(lot_id)
    
    if not wo:
        return results  # This is a purchased lot
    
    # Get all materials issued to this work order
    transactions = get_transactions_by_wo(wo.id, type='ISSUE')
    
    for txn in transactions:
        input_lot = get_lot(txn.lot_id)
        
        results.append({
            'level': 1,
            'work_order': wo.wo_number,
            'input_item': input_lot.item.name_en,
            'input_lot': input_lot.lot_number,
            'vendor': input_lot.vendor.name if input_lot.vendor else 'Internal',
            'quantity_used': txn.quantity,
            'coa_number': input_lot.coa_number
        })
        
        # Recursive trace for WIP items
        if input_lot.item.type == 'WIP':
            sub_results = trace_backward(input_lot.id)
            for sub in sub_results:
                sub['level'] += 1
                results.append(sub)
    
    return results
```

#### 6.1.3 Recall Simulation
**Algorithm**:
```python
def simulate_recall(lot_id):
    """
    Simulate a recall to identify all affected products and customers
    """
    # Forward trace to find all affected finished goods
    affected_batches = trace_forward(lot_id)
    
    recall_report = {
        'source_lot': get_lot(lot_id),
        'affected_batches': [],
        'affected_customers': [],
        'total_quantity_at_risk': 0
    }
    
    for batch in affected_batches:
        if batch['output_item'].type == 'finished_product':
            output_lot = get_lot_by_number(batch['output_lot'])
            
            # Find shipments containing this lot
            shipments = get_shipments_by_lot(output_lot.id)
            
            batch_info = {
                'batch_number': batch['output_batch'],
                'product': batch['output_item'],
                'quantity_produced': output_lot.original_quantity,
                'quantity_in_stock': output_lot.quantity,
                'quantity_shipped': output_lot.original_quantity - output_lot.quantity,
                'shipments': []
            }
            
            for shipment in shipments:
                customer = get_customer(shipment.customer_id)
                batch_info['shipments'].append({
                    'shipment_number': shipment.shipment_number,
                    'customer': customer.name,
                    'ship_date': shipment.ship_date,
                    'quantity': shipment.quantity
                })
                
                if customer.id not in [c['id'] for c in recall_report['affected_customers']]:
                    recall_report['affected_customers'].append({
                        'id': customer.id,
                        'name': customer.name,
                        'contact': customer.contact_person,
                        'phone': customer.phone,
                        'email': customer.email
                    })
            
            recall_report['affected_batches'].append(batch_info)
            recall_report['total_quantity_at_risk'] += batch_info['quantity_shipped']
    
    return recall_report
```

### 6.2 Analytics Reports

#### 6.2.1 Yield Analysis
```python
def analyze_yield(item_id, date_from, date_to):
    work_orders = get_completed_work_orders(item_id, date_from, date_to)
    
    analysis = {
        'item': get_item(item_id),
        'period': f"{date_from} to {date_to}",
        'total_batches': len(work_orders),
        'yields': [],
        'statistics': {}
    }
    
    yields = []
    for wo in work_orders:
        yield_data = calculate_yield(wo.id)
        yields.append(yield_data['yield_percent'])
        analysis['yields'].append({
            'work_order': wo.wo_number,
            'batch': wo.batch_number,
            'date': wo.actual_end_date,
            'yield': yield_data['yield_percent']
        })
    
    analysis['statistics'] = {
        'average_yield': sum(yields) / len(yields) if yields else 0,
        'min_yield': min(yields) if yields else 0,
        'max_yield': max(yields) if yields else 0,
        'std_deviation': calculate_std_dev(yields),
        'batches_below_target': sum(1 for y in yields if y < 95)
    }
    
    return analysis
```

#### 6.2.2 Inventory Aging Report
```python
def inventory_aging_report():
    lots = get_all_released_lots()
    today = date.today()
    
    aging = {
        'current': [],      # > 6 months to expiry
        'near_expiry': [],  # 3-6 months to expiry
        'critical': [],     # 1-3 months to expiry
        'expired': []       # Past expiry
    }
    
    for lot in lots:
        days_to_expiry = (lot.expiry_date - today).days
        
        lot_info = {
            'item': lot.item.name_en,
            'lot_number': lot.lot_number,
            'quantity': lot.quantity,
            'expiry_date': lot.expiry_date,
            'days_to_expiry': days_to_expiry,
            'value': lot.quantity * lot.cost_per_unit
        }
        
        if days_to_expiry < 0:
            aging['expired'].append(lot_info)
        elif days_to_expiry <= 90:
            aging['critical'].append(lot_info)
        elif days_to_expiry <= 180:
            aging['near_expiry'].append(lot_info)
        else:
            aging['current'].append(lot_info)
    
    return aging
```

---

## Module 7: Audit Trail & Compliance

### 7.1 Audit Trail Implementation

**Audit Log Structure**:
```python
def create_audit_log(action, entity_type, entity_id, old_values, new_values, user_id):
    return {
        'id': generate_uuid(),
        'timestamp': datetime.now(),
        'user_id': user_id,
        'user_name': get_user(user_id).name,
        'action': action,  # CREATE, UPDATE, DELETE, VIEW, APPROVE, REJECT
        'entity_type': entity_type,  # lot, work_order, test_result, etc.
        'entity_id': entity_id,
        'old_values': json.dumps(old_values),
        'new_values': json.dumps(new_values),
        'ip_address': get_client_ip(),
        'session_id': get_session_id()
    }
```

### 7.2 Electronic Signature

**E-Signature Workflow**:
```python
def request_signature(document_type, document_id, signer_role):
    signature_request = {
        'document_type': document_type,
        'document_id': document_id,
        'signer_role': signer_role,
        'status': 'pending',
        'requested_at': datetime.now(),
        'requested_by': current_user.id
    }
    
    # Notify signer
    notify_user(signer_role, f"Signature required for {document_type} #{document_id}")
    
    return signature_request

def sign_document(signature_request_id, password, meaning):
    request = get_signature_request(signature_request_id)
    
    # Verify password
    if not verify_password(current_user, password):
        raise AuthenticationError("Invalid password")
    
    # Create signature
    signature = {
        'request_id': signature_request_id,
        'signer_id': current_user.id,
        'signer_name': current_user.name,
        'signer_role': current_user.role,
        'meaning': meaning,  # 'Reviewed', 'Approved', 'Verified'
        'signed_at': datetime.now(),
        'signature_hash': generate_signature_hash(request, current_user)
    }
    
    # Update request status
    request.status = 'signed'
    request.save()
    
    # Create audit log
    create_audit_log('SIGN', request.document_type, request.document_id, 
                     None, signature, current_user.id)
    
    return signature
```

---

## Implementation Priority

### Phase 1: Foundation (Weeks 1-4)
1. ✅ Basic CRUD for all modules
2. 🔄 FEFO algorithm for inventory
3. 🔄 Lot traceability
4. 🔄 Basic work order workflow

### Phase 2: Quality & Compliance (Weeks 5-8)
1. QC test management
2. Specification management
3. Deviation workflow
4. COA generation
5. Audit trail

### Phase 3: Advanced Features (Weeks 9-12)
1. eBMR implementation
2. MRP calculation
3. VMI integration
4. Advanced reporting
5. Recall simulation

### Phase 4: Optimization (Weeks 13-16)
1. Performance optimization
2. Advanced analytics
3. Dashboard KPIs
4. Mobile-friendly UI
5. API documentation

---

## Summary

This implementation plan provides a comprehensive roadmap for developing a real-world Herbal Medicine ERP system that:

1. **Complies with GMP standards** through proper documentation, traceability, and audit trails
2. **Supports real manufacturing scenarios** with batch-based production and quality control
3. **Enables VMI integration** for efficient supply chain management
4. **Provides full traceability** from raw materials to finished products and customers
5. **Includes practical algorithms** for FEFO, MRP, yield calculation, and more

Each module is designed to work together seamlessly, ensuring data integrity and process compliance throughout the manufacturing lifecycle.
