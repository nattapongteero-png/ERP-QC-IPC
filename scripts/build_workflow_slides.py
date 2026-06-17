# -*- coding: utf-8 -*-
"""
สร้าง slide แสดง End-to-End Workflow ของ Herbal Medicine ERP
แบ่งเป็นขั้นตอน (PowerPoint .pptx) — ฟอนต์ TH Sarabun PSK
"""
import copy
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

OUT = r"C:\Herbal ERP\herbal-medicine-erp\Herbal_ERP_Workflow.pptx"
FONT = "TH Sarabun PSK"

# palette
NAVY   = RGBColor(0x1E, 0x3A, 0x5F)
BLUE   = RGBColor(0x2C, 0x6F, 0xBF)
TEAL   = RGBColor(0x0F, 0x76, 0x6E)
GREEN  = RGBColor(0x15, 0x80, 0x3D)
AMBER  = RGBColor(0xB4, 0x53, 0x09)
PURPLE = RGBColor(0x6D, 0x28, 0xD9)
RED    = RGBColor(0xB9, 0x1C, 0x1C)
SLATE  = RGBColor(0x47, 0x55, 0x69)
LIGHT  = RGBColor(0xEA, 0xF2, 0xFB)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
GREY   = RGBColor(0xF1, 0xF5, 0xF9)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]


def set_font(run, size, bold=False, color=None):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.name = FONT
    if color is not None:
        run.font.color.rgb = color
    # inject cs/ea typeface so Thai uses TH Sarabun PSK (memory: pptx-font)
    rPr = run._r.get_or_add_rPr()
    for tag in ('a:latin', 'a:cs', 'a:ea'):
        el = rPr.find(qn(tag))
        if el is None:
            el = rPr.makeelement(qn(tag), {})
            rPr.append(el)
        el.set('typeface', FONT)


def add_text(slide, x, y, w, h, text, size, bold=False, color=NAVY,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, wrap=True):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = wrap
    tf.vertical_anchor = anchor
    tf.margin_left = Pt(4); tf.margin_right = Pt(4)
    tf.margin_top = Pt(2); tf.margin_bottom = Pt(2)
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run(); r.text = ln
        set_font(r, size, bold, color)
    return tb


def add_box(slide, x, y, w, h, fill, line=None, radius=True):
    shp = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE, x, y, w, h)
    shp.fill.solid(); shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line; shp.line.width = Pt(1.25)
    shp.shadow.inherit = False
    return shp


def box_text(shp, text, size, bold=False, color=WHITE, align=PP_ALIGN.CENTER):
    tf = shp.text_frame; tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = Pt(6); tf.margin_right = Pt(6)
    tf.margin_top = Pt(3); tf.margin_bottom = Pt(3)
    for i, ln in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run(); r.text = ln
        set_font(r, size, bold, color)


def add_arrow(slide, x, y, w, h, color=SLATE, shape=MSO_SHAPE.RIGHT_ARROW):
    a = slide.shapes.add_shape(shape, x, y, w, h)
    a.fill.solid(); a.fill.fore_color.rgb = color
    a.line.fill.background(); a.shadow.inherit = False
    return a


def header_band(slide, kicker, title, color=NAVY):
    add_box(slide, 0, 0, SW, Inches(1.15), color, radius=False)
    add_text(slide, Inches(0.6), Inches(0.12), Inches(12), Inches(0.4),
             kicker, 16, True, RGBColor(0xBF, 0xD7, 0xF2))
    add_text(slide, Inches(0.6), Inches(0.46), Inches(12), Inches(0.6),
             title, 30, True, WHITE)


def footer(slide, n):
    add_text(slide, Inches(0.5), Inches(7.05), Inches(8), Inches(0.35),
             "Herbal Medicine ERP — End-to-End Workflow", 12, False, SLATE)
    add_text(slide, Inches(12.0), Inches(7.05), Inches(0.9), Inches(0.35),
             str(n), 12, True, SLATE, align=PP_ALIGN.RIGHT)


# ───────────────────────── Slide 1 — Title ─────────────────────────
s = prs.slides.add_slide(BLANK)
add_box(s, 0, 0, SW, SH, NAVY, radius=False)
add_box(s, 0, Inches(2.5), SW, Inches(0.08), TEAL, radius=False)
add_text(s, Inches(1), Inches(2.7), Inches(11.3), Inches(1.4),
         "ระบบ ERP ยาสมุนไพร", 54, True, WHITE, align=PP_ALIGN.CENTER)
add_text(s, Inches(1), Inches(3.9), Inches(11.3), Inches(0.9),
         "ขั้นตอนการทำงานทั้งระบบ (End-to-End Workflow)", 30, False,
         RGBColor(0xBF, 0xD7, 0xF2), align=PP_ALIGN.CENTER)
add_text(s, Inches(1), Inches(5.2), Inches(11.3), Inches(0.6),
         "จัดซื้อ · ตรวจรับ/QC · ผลิตตาม GMP · คลัง · ขาย · บัญชี",
         20, False, WHITE, align=PP_ALIGN.CENTER)

# ───────────────────────── Slide 2 — Overview (8 ขั้นตอน) ─────────────────────────
s = prs.slides.add_slide(BLANK)
header_band(s, "ภาพรวม", "8 ขั้นตอนหลักของระบบ")
steps = [
    ("1", "จัดซื้อวัตถุดิบ", "PR → PO → รับเข้า (GRN)", AMBER),
    ("2", "ตรวจรับ & QC ขาเข้า", "ตรวจสอบ → สุ่มตัวอย่าง → ปล่อยผ่าน", TEAL),
    ("3", "เตรียมผลิต", "BOM (สูตร) → สร้าง Work Order → เบิกวัตถุดิบ", BLUE),
    ("4", "ดำเนินการผลิต", "Line Clearance → Cleaning → SOP → IPC", PURPLE),
    ("5", "ตรวจสอบ & ปล่อยผลิตภัณฑ์", "Final Inspection → COA → ปล่อยผ่าน", GREEN),
    ("6", "รับเข้าคลัง & ขาย", "FG เข้าคลัง → Sales Order → ส่งมอบ", BLUE),
    ("7", "บัญชี & ต้นทุน", "AR/AP → Journal → ต้นทุน/Variance", NAVY),
    ("8", "คุณภาพ GMP (ขนาน)", "Deviation → CAPA → Audit → เอกสาร", RED),
]
cols, gx, gy = 4, Inches(0.45), Inches(0.45)
bw = Inches((13.333 - 0.45*2 - gx/Emu(1)*0)/1)  # placeholder
bw = Inches(2.95); bh = Inches(2.15)
x0, y0 = Inches(0.55), Inches(1.5)
dx, dy = Inches(3.15), Inches(2.45)
for i, (no, title, desc, col) in enumerate(steps):
    r, c = divmod(i, cols)
    x = x0 + dx * c
    y = y0 + dy * r
    add_box(s, x, y, bw, bh, GREY, line=col)
    add_box(s, x, y, bw, Inches(0.55), col)
    box_text(_b := s.shapes[-1], f"ขั้นตอน {no}", 16, True, WHITE)
    add_text(s, x + Inches(0.12), y + Inches(0.62), bw - Inches(0.24), Inches(0.6),
             title, 19, True, col)
    add_text(s, x + Inches(0.12), y + Inches(1.25), bw - Inches(0.24), Inches(0.8),
             desc, 14, False, SLATE)
footer(s, 2)

# helper: a horizontal flow of boxes with arrows
def flow_row(slide, items, y, h, box_w, color, gap=Inches(0.35),
             x_start=Inches(0.7), text_size=14, num_color=WHITE):
    x = x_start
    shapes = []
    for i, label in enumerate(items):
        b = add_box(slide, x, y, box_w, h, color)
        box_text(b, label, text_size, True, WHITE)
        shapes.append(b)
        if i < len(items) - 1:
            ax = x + box_w + Pt(2)
            add_arrow(slide, ax, y + h/2 - Inches(0.18), gap - Pt(4), Inches(0.36), SLATE)
        x = x + box_w + gap
    return shapes


def detail_slide(n, kicker, title, color, flow_items, details, note=None):
    s = prs.slides.add_slide(BLANK)
    header_band(s, kicker, title, color)
    # flow row
    bw = Inches((12.0 - 0.35*(len(flow_items)-1)/Emu(1)*0)/len(flow_items))
    bw = Inches(min(2.6, (12.0 - 0.4*(len(flow_items)-1))/len(flow_items)))
    flow_row(s, flow_items, Inches(1.55), Inches(0.95), bw, color,
             gap=Inches(0.4), x_start=Inches(0.7),
             text_size=15 if len(flow_items) <= 4 else 13)
    # detail bullets
    by = Inches(3.05)
    add_box(s, Inches(0.7), by, Inches(11.9), Inches(3.6), GREY)
    add_text(s, Inches(0.95), by + Inches(0.15), Inches(11.4), Inches(0.5),
             "รายละเอียดขั้นตอน", 18, True, color)
    ty = by + Inches(0.75)
    for d in details:
        add_text(s, Inches(1.05), ty, Inches(0.4), Inches(0.45), "▸", 16, True, color)
        add_text(s, Inches(1.45), ty, Inches(10.9), Inches(0.55), d, 16, False, RGBColor(0x33,0x33,0x33))
        ty = ty + Inches(0.52)
    if note:
        add_text(s, Inches(0.95), Inches(6.55), Inches(11.4), Inches(0.4),
                 "หมายเหตุ: " + note, 13, False, SLATE)
    footer(s, n)
    return s


# ───────────────────────── Slides 3-10 — แต่ละขั้นตอน ─────────────────────────
detail_slide(3, "ขั้นตอนที่ 1", "จัดซื้อวัตถุดิบ (Procurement)", AMBER,
    ["ใบขอซื้อ (PR)", "อนุมัติ", "ใบสั่งซื้อ (PO)", "รับเข้า (GRN)"],
    ["สร้างใบขอซื้อ (Purchase Requisition) เมื่อวัตถุดิบถึงจุดสั่งซื้อ (reorder point)",
     "ส่งอนุมัติตามลำดับชั้น แล้วแปลงเป็นใบสั่งซื้อ (Purchase Order) ส่งให้ผู้ขายที่อนุมัติแล้ว (AVL)",
     "เมื่อของมาถึง บันทึกการรับเข้า (Goods Receipt – GRN) ตรวจนับและบันทึกเลขที่ล็อต",
     "วัตถุดิบเข้าสถานะ Quarantine (กักกัน) รอ QC ตรวจปล่อยผ่านก่อนใช้งาน"],
    "เมนู: จัดซื้อ → ใบขอซื้อ/ใบสั่งซื้อ · คลังสินค้า → รับเข้าสินค้า")

detail_slide(4, "ขั้นตอนที่ 2", "ตรวจรับ & ควบคุมคุณภาพขาเข้า (Incoming QC)", TEAL,
    ["ตรวจรับเข้า", "สุ่มตัวอย่าง QC", "ทดสอบ", "ปล่อยผ่าน / ปฏิเสธ"],
    ["ตรวจรับเชิงคุณภาพ (Incoming Inspection) ตาม checklist เฉพาะหมวดวัตถุดิบ",
     "สุ่มตัวอย่าง (QC Sample) เข้าห้องปฏิบัติการ พร้อมเก็บตัวอย่างคงสภาพ (retain)",
     "ทดสอบตามข้อกำหนด (Specification) — ลักษณะ เคมี จุลชีววิทยา",
     "ผ่าน → ปล่อยเข้าคลังใช้งานได้ / ไม่ผ่าน → OOS → Deviation → กักกัน/คืนผู้ขาย"],
    "Triple Independence: ผู้ตรวจ ≠ ผู้ทวนสอบ ≠ ผู้อนุมัติ (admin ไม่ bypass)")

detail_slide(5, "ขั้นตอนที่ 3", "เตรียมการผลิต (Production Planning)", BLUE,
    ["สูตรการผลิต (BOM)", "สร้าง Work Order", "เบิกวัตถุดิบ"],
    ["กำหนดสูตรการผลิต (BOM) — วัตถุดิบ ห้องผลิต เครื่องจักร SOP IPC ครบทุก phase",
     "สร้างใบสั่งผลิต (Work Order) จาก BOM ที่อนุมัติแล้ว ระบุขนาดรุ่น (batch size)",
     "ระบบคำนวณวัตถุดิบตามสัดส่วน แล้วยื่นขอเบิก (Material Requisition)",
     "คลังอนุมัติเบิก → ตัดสต็อกตามล็อต (FEFO) พร้อมส่งเข้าสายการผลิต"],
    "สถานะ WO: planned → released (เมื่อใบเบิกอนุมัติ)")

detail_slide(6, "ขั้นตอนที่ 4", "ดำเนินการผลิตตาม GMP (Execution)", PURPLE,
    ["Line Clearance", "Cleaning", "ชั่งน้ำหนัก", "SOP + IPC", "บรรจุ"],
    ["Line Clearance: ตรวจเคลียร์สายการผลิตทุก phase ก่อนเริ่มงาน",
     "Cleaning: ทำความสะอาดห้อง/เครื่องจักรของแต่ละ phase (clean + verify)",
     "ชั่งน้ำหนักวัตถุดิบ + ทวนสอบ — บันทึกใน BMR (เครื่องชั่งต้องสอบเทียบลูกตุ้ม)",
     "ทำตามขั้นตอน SOP ทีละ step + บันทึกผล IPC (In-Process Control) ในระหว่างผลิต",
     "บรรจุภัณฑ์ → ตรวจน้ำหนัก/ความสมบูรณ์ของซีล → บันทึกสภาวะแวดล้อม"],
    "สถานะ WO: released → in_progress · ห้ามข้าม phase · บันทึกครบทุก phase")

detail_slide(7, "ขั้นตอนที่ 5", "ตรวจสอบ & ปล่อยผลิตภัณฑ์ (Release)", GREEN,
    ["Final Inspection", "QC สินค้าสำเร็จรูป", "ออก COA", "ปล่อยผ่าน (QA)"],
    ["ตรวจสอบขั้นสุดท้าย (Finished Inspection) ตาม checklist ก่อนปิดงาน",
     "QC สุ่มตรวจสินค้าสำเร็จรูปตามข้อกำหนด แล้วบันทึกผลทดสอบ",
     "ออกใบรับรองผลวิเคราะห์ (COA) พร้อม QR code สำหรับตรวจสอบย้อนกลับ",
     "QA ปล่อยผ่านรุ่นผลิต (Batch Release) — WO เปลี่ยนเป็น completed"],
    "สถานะ WO: in_progress → completed → closed · auto-create GRN ของ FG")

detail_slide(8, "ขั้นตอนที่ 6", "รับเข้าคลัง & การขาย (Warehouse & Sales)", BLUE,
    ["FG เข้าคลัง", "ใบสั่งขาย (SO)", "จัดสรร/ตัดสต็อก", "ส่งมอบ (Delivery)"],
    ["สินค้าสำเร็จรูปเข้าคลัง FG (สร้างล็อตใหม่อัตโนมัติจาก WO ที่ปิดงาน)",
     "รับใบสั่งขาย (Sales Order) จากลูกค้า ระบุสินค้า/จำนวน/ราคา",
     "ระบบจัดสรรสต็อก (allocate) และคำนวณต้นทุน/กำไรขั้นต้น (margin)",
     "ส่งมอบสินค้า (Delivery) ตัดสต็อกตามล็อต พร้อมเอกสารส่งของ"],
    "เมนู: ขาย → ใบสั่งขาย/ส่งมอบ · คลังสินค้า → ล็อตสินค้า")

detail_slide(9, "ขั้นตอนที่ 7", "บัญชี & การจัดการต้นทุน (Accounting & Cost)", NAVY,
    ["AP / AR Invoice", "ลงบัญชี (Journal)", "จับคู่ 3 ทาง", "ต้นทุน & Variance"],
    ["ตั้งหนี้เจ้าหนี้ (AP) จาก PO ที่รับของ และตั้งลูกหนี้ (AR) จาก SO ที่ส่งมอบ",
     "บันทึกบัญชีแยกประเภท (Journal Entry) — เดบิต/เครดิตสมดุล อัตโนมัติ",
     "จับคู่ 3 ทาง (3-way matching): PO → GRN → Invoice ตรวจส่วนต่าง",
     "คำนวณต้นทุนมาตรฐาน, ต้นทุน WO, landed cost และรายงานผลต่าง (Variance)"],
    "เมนู: บัญชี → ใบแจ้งหนี้/รายการบัญชี/จับคู่ · การจัดการต้นทุน")

detail_slide(10, "ขั้นตอนที่ 8 (ขนานทั้งระบบ)", "คุณภาพ & GMP Compliance", RED,
    ["Deviation", "CAPA", "Internal Audit", "Document Control"],
    ["ความเบี่ยงเบน (Deviation) — บันทึกเมื่อพบ OOS / scale fail / variance เกินเกณฑ์",
     "CAPA — แผนแก้ไขและป้องกัน เชื่อมโยงจาก Deviation และ Audit Finding",
     "ตรวจประเมินภายใน (Internal Audit) ตามหมวด GMP + ออกข้อบกพร่อง (Finding)",
     "ควบคุมเอกสาร (Document Control): SOP/Spec/Form มีเวอร์ชัน + ลิงก์หลักสูตรอบรม"],
    "ทำงานควบคู่ทุกขั้นตอน + Audit Trail บันทึกทุกการกระทำ (21 CFR Part 11)")

# ───────────────────────── Slide 11 — สรุปวงจร ─────────────────────────
s = prs.slides.add_slide(BLANK)
header_band(s, "สรุป", "วงจรการทำงานครบวงจร", NAVY)
cycle = [
    ("จัดซื้อ", AMBER), ("ตรวจรับ/QC", TEAL), ("เตรียมผลิต", BLUE),
    ("ผลิต GMP", PURPLE), ("ปล่อยผลิตภัณฑ์", GREEN), ("คลัง/ขาย", BLUE),
    ("บัญชี/ต้นทุน", NAVY),
]
# two rows of arrows
bw = Inches(1.62); bh = Inches(1.0); gap = Inches(0.18)
x0 = Inches(0.55); y = Inches(2.2)
x = x0
for i, (label, col) in enumerate(cycle):
    b = add_box(s, x, y, bw, bh, col)
    box_text(b, label, 15, True, WHITE)
    if i < len(cycle) - 1:
        add_arrow(s, x + bw + Pt(1), y + bh/2 - Inches(0.16), gap - Pt(2), Inches(0.32), SLATE)
    x = x + bw + gap
# GMP umbrella band underneath
add_box(s, Inches(0.55), Inches(3.7), Inches(12.2), Inches(0.85), RED)
box_text(s.shapes[-1], "คุณภาพ & GMP Compliance — ครอบคลุมทุกขั้นตอน (Deviation · CAPA · Audit · Document Control · Audit Trail)",
         16, True, WHITE)
# key points
pts = [
    "ทุกขั้นตอนสอบกลับได้ (traceability) ตั้งแต่วัตถุดิบจนถึงสินค้าส่งมอบ",
    "ควบคุมคุณภาพแบบ Triple Independence และบันทึก Audit Trail ครบถ้วน",
    "เชื่อมโยงข้อมูลข้ามโมดูล: BOM → WO → IPC → QC → คลัง → ขาย → บัญชี",
]
ty = Inches(5.0)
for p in pts:
    add_text(s, Inches(0.8), ty, Inches(0.4), Inches(0.45), "✓", 18, True, GREEN)
    add_text(s, Inches(1.25), ty, Inches(11.3), Inches(0.5), p, 17, False, RGBColor(0x33,0x33,0x33))
    ty = ty + Inches(0.55)
footer(s, 11)

prs.save(OUT)
print("saved:", OUT, "slides:", len(prs.slides._sldIdLst))
