# -*- coding: utf-8 -*-
"""Generate Herbal Medicine ERP presentation deck (.pptx) with TH Sarabun PSK."""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn
import copy

# ---------- Theme ----------
FONT = "TH Sarabun PSK"
GREEN_DARK = RGBColor(0x1B, 0x5E, 0x20)   # deep herbal green
GREEN = RGBColor(0x2E, 0x7D, 0x32)
GREEN_LT = RGBColor(0x66, 0xBB, 0x6A)
GOLD = RGBColor(0xC8, 0xA0, 0x4A)
INK = RGBColor(0x21, 0x2B, 0x27)
GREY = RGBColor(0x5C, 0x67, 0x62)
LIGHT = RGBColor(0xF2, 0xF6, 0xF1)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CARD_BORDER = RGBColor(0xD8, 0xE3, 0xD6)

EMU_W = Inches(13.333)
EMU_H = Inches(7.5)

prs = Presentation()
prs.slide_width = EMU_W
prs.slide_height = EMU_H
BLANK = prs.slide_layouts[6]


def set_thai_font(run, name=FONT):
    """Inject latin + ea + cs typeface so Thai renders in TH Sarabun PSK."""
    run.font.name = name
    rPr = run._r.get_or_add_rPr()
    for tag in ("a:latin", "a:ea", "a:cs"):
        el = rPr.find(qn(tag))
        if el is None:
            el = rPr.makeelement(qn(tag), {})
            rPr.append(el)
        el.set("typeface", name)


def add_slide():
    return prs.slides.add_slide(BLANK)


def bg(slide, color):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = color


def box(slide, x, y, w, h, fill=None, line=None, line_w=None, shape=MSO_SHAPE.RECTANGLE, shadow=False):
    sp = slide.shapes.add_shape(shape, x, y, w, h)
    if fill is None:
        sp.fill.background()
    else:
        sp.fill.solid()
        sp.fill.fore_color.rgb = fill
    if line is None:
        sp.line.fill.background()
    else:
        sp.line.color.rgb = line
        sp.line.width = line_w or Pt(1)
    sp.shadow.inherit = False
    if shadow:
        el = sp._element.spPr
        effect = el.makeelement(qn('a:effectLst'), {})
        sh = el.makeelement(qn('a:outerShdw'),
                            {'blurRad': '90000', 'dist': '38100', 'dir': '5400000', 'rotWithShape': '0'})
        clr = el.makeelement(qn('a:srgbClr'), {'val': 'B9C6B6'})
        alpha = el.makeelement(qn('a:alpha'), {'val': '55000'})
        clr.append(alpha)
        sh.append(clr)
        effect.append(sh)
        el.append(effect)
    return sp


def text(slide, x, y, w, h, runs, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP,
         space_after=4, line_spacing=1.0, wrap=True):
    """runs: list of paragraphs; each paragraph = list of (txt, size, bold, color)."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = wrap
    tf.vertical_anchor = anchor
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    for i, para in enumerate(runs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(space_after)
        p.space_before = Pt(0)
        p.line_spacing = line_spacing
        for (txt, size, bold, color) in para:
            r = p.add_run()
            r.text = txt
            r.font.size = Pt(size)
            r.font.bold = bold
            r.font.color.rgb = color
            set_thai_font(r)
    return tb


def bullet(slide, x, y, w, h, items, size=15, color=INK, gap=6, marker="•", marker_color=GREEN):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_top = 0
    for i, it in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(gap)
        p.line_spacing = 1.0
        rm = p.add_run()
        rm.text = marker + "  "
        rm.font.size = Pt(size)
        rm.font.bold = True
        rm.font.color.rgb = marker_color
        set_thai_font(rm)
        rt = p.add_run()
        rt.text = it
        rt.font.size = Pt(size)
        rt.font.color.rgb = color
        set_thai_font(rt)
    return tb


def footer(slide, idx, total, label):
    box(slide, 0, EMU_H - Inches(0.35), EMU_W, Inches(0.35), fill=GREEN_DARK)
    text(slide, Inches(0.5), EMU_H - Inches(0.35), Inches(8), Inches(0.35),
         [[("Herbal ERP  |  " + label, 11, False, WHITE)]], anchor=MSO_ANCHOR.MIDDLE)
    text(slide, EMU_W - Inches(1.5), EMU_H - Inches(0.35), Inches(1), Inches(0.35),
         [[(f"{idx} / {total}", 11, True, WHITE)]], align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)


def header(slide, kicker, title):
    box(slide, 0, 0, Inches(0.22), Inches(1.35), fill=GREEN)
    box(slide, Inches(0.22), 0, EMU_W - Inches(0.22), Inches(1.35), fill=LIGHT)
    text(slide, Inches(0.55), Inches(0.22), Inches(12), Inches(0.4),
         [[(kicker, 14, True, GOLD)]])
    text(slide, Inches(0.55), Inches(0.55), Inches(12.3), Inches(0.7),
         [[(title, 30, True, GREEN_DARK)]])


TOTAL = 16
LABEL = "ระบบบริหารโรงงานผลิตยาสมุนไพร"

# ============================================================
# SLIDE 1 — Title / Cover
# ============================================================
s = add_slide()
bg(s, GREEN_DARK)
# decorative panels
box(s, 0, 0, EMU_W, Inches(2.1), fill=GREEN)
box(s, 0, Inches(2.1), EMU_W, Inches(0.08), fill=GOLD)
# leaf accent circles
box(s, EMU_W - Inches(2.6), Inches(3.5), Inches(2.2), Inches(2.2), fill=GREEN, shape=MSO_SHAPE.OVAL)
box(s, EMU_W - Inches(1.8), Inches(4.6), Inches(1.4), Inches(1.4), fill=GREEN_LT, shape=MSO_SHAPE.OVAL)
box(s, EMU_W - Inches(3.4), Inches(4.9), Inches(0.8), Inches(0.8), fill=GOLD, shape=MSO_SHAPE.OVAL)

text(s, Inches(0.9), Inches(0.55), Inches(11), Inches(0.5),
     [[("HERBAL MEDICINE ERP", 18, True, RGBColor(0xCF, 0xE8, 0xCC))]])
text(s, Inches(0.9), Inches(1.0), Inches(11.5), Inches(1.1),
     [[("ระบบบริหารจัดการโรงงานผลิตยาสมุนไพร", 40, True, WHITE)]])

text(s, Inches(0.9), Inches(2.6), Inches(11), Inches(0.6),
     [[("การจัดเตรียมข้อมูลพื้นฐาน และนำเสนอฟังก์ชันการใช้งานโปรแกรม", 24, True, GREEN_DARK)]])
text(s, Inches(0.9), Inches(3.3), Inches(10), Inches(0.5),
     [[("Master Data Setup & Functional Walkthrough", 18, False, GREY)]])

# meta chips
chips = ["GMP Compliant", "Next.js 16 + React 19", "ไทย / English", "Lot Traceability"]
cx = Inches(0.9)
for c in chips:
    w = Inches(0.45 + len(c) * 0.10)
    box(s, cx, Inches(4.4), w, Inches(0.5), fill=LIGHT, shape=MSO_SHAPE.ROUNDED_RECTANGLE, line=CARD_BORDER)
    text(s, cx, Inches(4.4), w, Inches(0.5), [[(c, 14, True, GREEN_DARK)]],
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    cx += w + Inches(0.2)

text(s, Inches(0.9), Inches(6.5), Inches(11), Inches(0.5),
     [[("นำเสนอวันที่ 11 มิถุนายน 2569   •   ทีมพัฒนาระบบ ERP", 16, False, RGBColor(0xCF, 0xE8, 0xCC))]])

# ============================================================
# SLIDE 2 — Agenda
# ============================================================
s = add_slide()
bg(s, WHITE)
header(s, "AGENDA", "หัวข้อการนำเสนอ")
agenda = [
    ("01", "ภาพรวมระบบ ERP", "System Overview & คุณค่าทางธุรกิจ"),
    ("02", "สถาปัตยกรรม & เทคโนโลยี", "Architecture & Tech Stack"),
    ("03", "ข้อมูลพื้นฐาน (Master Data)", "การจัดเตรียมข้อมูลก่อนใช้งาน"),
    ("04", "Flow การทำงานหลัก", "วัตถุดิบ → ผลิต → QC → คลัง → บัญชี"),
    ("05", "ฟังก์ชันแต่ละโมดูล", "Inventory / Production / Quality / GMP ฯลฯ"),
    ("06", "แผนการนำระบบไปใช้", "Implementation Roadmap"),
]
gx, gy = Inches(0.7), Inches(1.75)
cw, ch = Inches(5.9), Inches(1.5)
for i, (num, th, en) in enumerate(agenda):
    col = i % 2
    row = i // 2
    x = gx + col * (cw + Inches(0.5))
    y = gy + row * (ch + Inches(0.3))
    box(s, x, y, cw, ch, fill=LIGHT, shape=MSO_SHAPE.ROUNDED_RECTANGLE, line=CARD_BORDER, shadow=True)
    box(s, x, y, Inches(1.2), ch, fill=GREEN, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    text(s, x, y, Inches(1.2), ch, [[(num, 34, True, WHITE)]],
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    text(s, x + Inches(1.4), y + Inches(0.25), cw - Inches(1.6), Inches(0.6),
         [[(th, 21, True, GREEN_DARK)]])
    text(s, x + Inches(1.4), y + Inches(0.82), cw - Inches(1.6), Inches(0.5),
         [[(en, 14, False, GREY)]])
footer(s, 2, TOTAL, LABEL)

# ============================================================
# SLIDE 3 — System Overview / Value
# ============================================================
s = add_slide()
bg(s, WHITE)
header(s, "OVERVIEW", "ระบบ ERP สำหรับโรงงานผลิตยาสมุนไพร")
text(s, Inches(0.55), Inches(1.5), Inches(12.3), Inches(0.7),
     [[("ระบบบริหารจัดการครบวงจร ตั้งแต่รับวัตถุดิบ จนถึงส่งมอบสินค้าและบันทึกบัญชี — ออกแบบให้สอดคล้องมาตรฐาน GMP ยาสมุนไพร",
        17, False, INK)]])
stats = [
    ("19", "โมดูลหลัก", "Modules"),
    ("150+", "ตารางข้อมูล", "DB Tables"),
    ("15", "ชุดข้อมูลพื้นฐาน", "Master Data"),
    ("100%", "ตรวจสอบย้อนกลับ", "Lot Traceability"),
]
sx = Inches(0.7)
for v, th, en in stats:
    w = Inches(2.85)
    box(s, sx, Inches(2.35), w, Inches(1.5), fill=GREEN_DARK, shape=MSO_SHAPE.ROUNDED_RECTANGLE, shadow=True)
    text(s, sx, Inches(2.5), w, Inches(0.8), [[(v, 40, True, WHITE)]],
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    text(s, sx, Inches(3.25), w, Inches(0.35), [[(th, 16, True, RGBColor(0xCF, 0xE8, 0xCC))]],
         align=PP_ALIGN.CENTER)
    text(s, sx, Inches(3.55), w, Inches(0.3), [[(en, 12, False, GREEN_LT)]],
         align=PP_ALIGN.CENTER)
    sx += w + Inches(0.27)

pillars = [
    ("ครบวงจรการผลิต", "Manufacturing Lifecycle ตั้งแต่วัตถุดิบถึงสินค้าสำเร็จรูป พร้อม Lot Traceability"),
    ("คุณภาพ & GMP", "QC, ตรวจรับเข้า, ตรวจเครื่องชั่ง, Deviation, CAPA, เอกสารควบคุม"),
    ("บัญชี & ต้นทุน", "AP/AR, ภาษี VAT 7%, ต้นทุนต่อหน่วย (WAC), งบการเงิน"),
]
px = Inches(0.7)
for th, desc in pillars:
    w = Inches(3.93)
    box(s, px, Inches(4.15), w, Inches(2.55), fill=LIGHT, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
        line=CARD_BORDER, shadow=True)
    box(s, px, Inches(4.15), w, Inches(0.12), fill=GOLD, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    text(s, px + Inches(0.3), Inches(4.45), w - Inches(0.6), Inches(0.6),
         [[(th, 21, True, GREEN_DARK)]])
    text(s, px + Inches(0.3), Inches(5.1), w - Inches(0.6), Inches(1.5),
         [[(desc, 15, False, INK)]], line_spacing=1.05)
    px += w + Inches(0.27)
footer(s, 3, TOTAL, LABEL)

# ============================================================
# SLIDE 4 — Architecture / Tech Stack
# ============================================================
s = add_slide()
bg(s, WHITE)
header(s, "ARCHITECTURE", "สถาปัตยกรรม & เทคโนโลยี")
layers = [
    ("Presentation", "ส่วนติดต่อผู้ใช้", "Next.js 16 • React 19 • DevExtreme 25.2 • TanStack Query • next-intl (ไทย/EN)", GREEN),
    ("Business Logic", "ตรรกะทางธุรกิจ", "Service Layer • Zod Validation • Audit Logging • Approval Workflows", GREEN_LT),
    ("Data", "ชั้นข้อมูล", "Drizzle ORM • MySQL (Production) / SQLite (Test) • Dual-Schema Pattern", GREEN_DARK),
]
ly = Inches(1.7)
for name, th, tech, color in layers:
    box(s, Inches(0.7), ly, Inches(11.9), Inches(1.2), fill=color, shape=MSO_SHAPE.ROUNDED_RECTANGLE, shadow=True)
    text(s, Inches(1.0), ly, Inches(3.2), Inches(1.2),
         [[(name, 22, True, WHITE)], [(th, 16, False, RGBColor(0xE8, 0xF3, 0xE6))]],
         anchor=MSO_ANCHOR.MIDDLE)
    box(s, Inches(4.3), ly + Inches(0.2), Inches(0.03), Inches(0.8), fill=WHITE)
    text(s, Inches(4.6), ly, Inches(7.8), Inches(1.2),
         [[(tech, 16, False, WHITE)]], anchor=MSO_ANCHOR.MIDDLE)
    ly += Inches(1.4)

box(s, Inches(0.7), Inches(5.95), Inches(11.9), Inches(0.95), fill=LIGHT,
    shape=MSO_SHAPE.ROUNDED_RECTANGLE, line=CARD_BORDER)
text(s, Inches(1.0), Inches(6.0), Inches(11.3), Inches(0.85),
     [[("จุดเด่นทางเทคนิค: ", 16, True, GREEN_DARK),
       ("รองรับ 2 ฐานข้อมูล • ระบบสิทธิ์ตามบทบาท (RBAC) • บันทึก Audit Trail ทุกธุรกรรม • Electronic Signature • รองรับ 2 ภาษาแบบเปลี่ยนทันที",
        15, False, INK)]],
     anchor=MSO_ANCHOR.MIDDLE)
footer(s, 4, TOTAL, LABEL)

# ============================================================
# SLIDE 5 — Master Data divider
# ============================================================
s = add_slide()
bg(s, GREEN_DARK)
box(s, 0, Inches(2.9), EMU_W, Inches(0.08), fill=GOLD)
text(s, Inches(0.9), Inches(2.0), Inches(11), Inches(0.5),
     [[("PART 03", 18, True, GOLD)]])
text(s, Inches(0.9), Inches(2.4), Inches(11.5), Inches(1.0),
     [[("การจัดเตรียมข้อมูลพื้นฐาน", 42, True, WHITE)]])
text(s, Inches(0.9), Inches(3.3), Inches(11), Inches(0.5),
     [[("Master Data Setup — ข้อมูลที่ต้องเตรียมก่อนเริ่มใช้งานระบบ", 20, False, GREEN_LT)]])

# ============================================================
# SLIDE 6 — Master Data list
# ============================================================
s = add_slide()
bg(s, WHITE)
header(s, "MASTER DATA", "ข้อมูลพื้นฐาน 15 ชุด ที่ต้องเตรียม")
md = [
    ("รหัสสินค้า / รหัสล็อต", "Item Code & Lot Patterns — รูปแบบรหัสอัตโนมัติ"),
    ("สินค้า / วัตถุดิบ", "Items — วัตถุดิบ, บรรจุภัณฑ์, สินค้าสำเร็จรูป"),
    ("ผู้ขาย / ลูกค้า", "Vendors & Customers — คู่ค้าและเงื่อนไข"),
    ("สูตรการผลิต (BOM)", "Bill of Materials / Recipes"),
    ("ลูกตุ้มมาตรฐาน", "Standard Weights — สำหรับสอบเทียบเครื่องชั่ง"),
    ("เครื่องจักร / เครื่องชั่ง", "Production Equipment + Calibration"),
    ("ห้องผลิต & สภาพแวดล้อม", "Rooms + Environmental Conditions"),
    ("เทมเพลต SOP", "SOP Templates — ควบคุมเวอร์ชัน"),
    ("แผนการสุ่มตรวจ QC", "Sampling Plans"),
    ("เช็กลิสต์ตรวจรับ + Tolerance", "Receipt Checklist & Tolerances"),
    ("เกณฑ์ QC บรรจุภัณฑ์", "Packaging QC Criteria"),
    ("เกณฑ์ควบคุมระหว่างผลิต", "IPC Criteria + Maintenance Plans"),
]
gx, gy = Inches(0.6), Inches(1.65)
cw, ch = Inches(3.93), Inches(1.25)
for i, (th, en) in enumerate(md):
    col = i % 3
    row = i // 3
    x = gx + col * (cw + Inches(0.18))
    y = gy + row * (ch + Inches(0.16))
    box(s, x, y, cw, ch, fill=LIGHT, shape=MSO_SHAPE.ROUNDED_RECTANGLE, line=CARD_BORDER)
    box(s, x, y, Inches(0.1), ch, fill=GREEN_LT)
    text(s, x + Inches(0.28), y + Inches(0.16), cw - Inches(0.45), Inches(0.55),
         [[(th, 16, True, GREEN_DARK)]])
    text(s, x + Inches(0.28), y + Inches(0.66), cw - Inches(0.45), Inches(0.5),
         [[(en, 12, False, GREY)]], line_spacing=0.95)
footer(s, 6, TOTAL, LABEL)

# ============================================================
# SLIDE 7 — Master Data setup order
# ============================================================
s = add_slide()
bg(s, WHITE)
header(s, "SETUP ORDER", "ลำดับการเตรียมข้อมูลก่อนใช้งาน")
text(s, Inches(0.55), Inches(1.5), Inches(12), Inches(0.5),
     [[("แนะนำให้เตรียมข้อมูลตามลำดับนี้ เพื่อให้ระบบเชื่อมโยงข้อมูลได้ถูกต้อง", 17, False, INK)]])
steps = [
    ("1", "ตั้งค่าระบบ", "รหัสสินค้า, รหัสล็อต, หน่วยนับ, สิทธิ์ผู้ใช้"),
    ("2", "ข้อมูลหลัก", "สินค้า/วัตถุดิบ, ผู้ขาย, ลูกค้า, คลังสินค้า"),
    ("3", "การผลิต", "สูตร BOM, ห้องผลิต, เครื่องจักร, ลูกตุ้ม"),
    ("4", "คุณภาพ & GMP", "แผนสุ่มตรวจ, เกณฑ์ QC, เช็กลิสต์, SOP"),
    ("5", "บัญชี", "ผังบัญชี, ประเภทบัญชี, ภาษี, ต้นทุนมาตรฐาน"),
]
sx = Inches(0.6)
w = Inches(2.3)
for i, (num, th, desc) in enumerate(steps):
    x = sx + i * (w + Inches(0.13))
    box(s, x, Inches(2.5), w, Inches(2.9), fill=LIGHT, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
        line=CARD_BORDER, shadow=True)
    box(s, x + w/2 - Inches(0.45), Inches(2.7), Inches(0.9), Inches(0.9), fill=GREEN,
        shape=MSO_SHAPE.OVAL)
    text(s, x + w/2 - Inches(0.45), Inches(2.7), Inches(0.9), Inches(0.9),
         [[(num, 30, True, WHITE)]], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    text(s, x + Inches(0.15), Inches(3.75), w - Inches(0.3), Inches(0.55),
         [[(th, 18, True, GREEN_DARK)]], align=PP_ALIGN.CENTER)
    text(s, x + Inches(0.2), Inches(4.3), w - Inches(0.4), Inches(1.0),
         [[(desc, 14, False, INK)]], align=PP_ALIGN.CENTER, line_spacing=1.0)
    if i < len(steps) - 1:
        text(s, x + w - Inches(0.05), Inches(3.6), Inches(0.4), Inches(0.6),
             [[("›", 30, True, GOLD)]], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
footer(s, 7, TOTAL, LABEL)

# ============================================================
# SLIDE 8 — Workflow divider
# ============================================================
s = add_slide()
bg(s, GREEN_DARK)
box(s, 0, Inches(2.9), EMU_W, Inches(0.08), fill=GOLD)
text(s, Inches(0.9), Inches(2.0), Inches(11), Inches(0.5),
     [[("PART 04", 18, True, GOLD)]])
text(s, Inches(0.9), Inches(2.4), Inches(11.5), Inches(1.0),
     [[("Flow การทำงานหลัก", 42, True, WHITE)]])
text(s, Inches(0.9), Inches(3.3), Inches(11), Inches(0.5),
     [[("End-to-End Process — วัตถุดิบ → ผลิต → คุณภาพ → คลัง → บัญชี", 20, False, GREEN_LT)]])

# ============================================================
# SLIDE 9 — End-to-end flow
# ============================================================
s = add_slide()
bg(s, WHITE)
header(s, "PROCESS FLOW", "กระบวนการทำงานครบวงจร")
flow = [
    ("จัดซื้อ", "Purchasing", "ใบขอซื้อ → ใบสั่งซื้อ (PO)"),
    ("ตรวจรับเข้า", "Goods Receipt", "GRN + เช็กลิสต์ + สุ่ม QC"),
    ("คลังวัตถุดิบ", "Inventory", "รับเข้าล็อต + Quarantine"),
    ("ผลิต", "Production", "Work Order + เบิกวัตถุดิบ"),
    ("ควบคุมคุณภาพ", "Quality", "QC + COA + Deviation"),
    ("คลังสำเร็จรูป", "FG Stock", "รับเข้า + ตรวจสอบย้อนกลับ"),
    ("ขาย & บัญชี", "Sales & Accounting", "SO → AR → VAT → ต้นทุน"),
]
n = len(flow)
total_w = Inches(12.3)
cw = Emu(int(total_w) // n) - Inches(0.12)
sx = Inches(0.55)
y = Inches(2.6)
h = Inches(2.2)
for i, (th, en, desc) in enumerate(flow):
    x = sx + i * (cw + Inches(0.12))
    color = GREEN_DARK if i % 2 == 0 else GREEN
    box(s, x, y, cw, h, fill=color, shape=MSO_SHAPE.ROUNDED_RECTANGLE, shadow=True)
    text(s, x + Inches(0.1), y + Inches(0.2), cw - Inches(0.2), Inches(0.55),
         [[(f"{i+1}", 20, True, GOLD)]], align=PP_ALIGN.CENTER)
    text(s, x + Inches(0.08), y + Inches(0.7), cw - Inches(0.16), Inches(0.6),
         [[(th, 16, True, WHITE)]], align=PP_ALIGN.CENTER, line_spacing=0.95)
    text(s, x + Inches(0.08), y + Inches(1.2), cw - Inches(0.16), Inches(0.35),
         [[(en, 11, True, GREEN_LT)]], align=PP_ALIGN.CENTER)
    text(s, x + Inches(0.08), y + Inches(1.5), cw - Inches(0.16), Inches(0.65),
         [[(desc, 11.5, False, RGBColor(0xE8, 0xF3, 0xE6))]], align=PP_ALIGN.CENTER, line_spacing=0.92)

text(s, Inches(0.55), Inches(5.3), Inches(12.3), Inches(0.8),
     [[("หลักการสำคัญ: ", 16, True, GREEN_DARK),
       ("ทุกขั้นตอนผูกกับเลขล็อต (Lot) → ตรวจสอบย้อนกลับได้ตั้งแต่วัตถุดิบถึงสินค้าสำเร็จรูป  •  Triple Independence: ผู้รับ ≠ ผู้อนุมัติ QA",
        14.5, False, INK)]], line_spacing=1.05)
box(s, Inches(0.55), Inches(6.15), Inches(12.3), Inches(0.75), fill=LIGHT,
    shape=MSO_SHAPE.ROUNDED_RECTANGLE, line=CARD_BORDER)
text(s, Inches(0.8), Inches(6.2), Inches(11.9), Inches(0.65),
     [[("Gate คุณภาพ: ", 15, True, GOLD),
       ("วัตถุดิบ/สินค้าต้องผ่าน QC ก่อนปล่อยเข้าสต็อก (ปลด Quarantine) — ผ่านเครื่องชั่งที่สอบเทียบภายใน 8 ชม. เท่านั้น",
        14, False, INK)]], anchor=MSO_ANCHOR.MIDDLE)
footer(s, 9, TOTAL, LABEL)

# ============================================================
# SLIDE 10 — Modules divider
# ============================================================
s = add_slide()
bg(s, GREEN_DARK)
box(s, 0, Inches(2.9), EMU_W, Inches(0.08), fill=GOLD)
text(s, Inches(0.9), Inches(2.0), Inches(11), Inches(0.5),
     [[("PART 05", 18, True, GOLD)]])
text(s, Inches(0.9), Inches(2.4), Inches(11.5), Inches(1.0),
     [[("ฟังก์ชันการใช้งานแต่ละโมดูล", 40, True, WHITE)]])
text(s, Inches(0.9), Inches(3.3), Inches(11), Inches(0.5),
     [[("Module Functions Walkthrough", 20, False, GREEN_LT)]])


def module_slide(idx, kicker, title, modules, label_th):
    s = add_slide()
    bg(s, WHITE)
    header(s, kicker, title)
    gx, gy = Inches(0.6), Inches(1.6)
    cw, ch = Inches(5.95), Inches(1.62)
    for i, (name, th, feats) in enumerate(modules):
        col = i % 2
        row = i // 2
        x = gx + col * (cw + Inches(0.4))
        y = gy + row * (ch + Inches(0.2))
        box(s, x, y, cw, ch, fill=LIGHT, shape=MSO_SHAPE.ROUNDED_RECTANGLE, line=CARD_BORDER, shadow=True)
        box(s, x, y, Inches(0.13), ch, fill=GREEN)
        text(s, x + Inches(0.35), y + Inches(0.15), cw - Inches(0.6), Inches(0.45),
             [[(th, 19, True, GREEN_DARK), ("   " + name, 12, False, GREY)]])
        bullet(s, x + Inches(0.35), y + Inches(0.66), cw - Inches(0.6), Inches(0.9),
               feats, size=13.5, gap=2, marker="›", marker_color=GREEN_LT)
    footer(s, idx, TOTAL, label_th)
    return s

# ============================================================
# SLIDE 11 — Modules: Inventory / Production
# ============================================================
module_slide(11, "MODULES 1/4", "คลังสินค้า & การผลิต", [
    ("Inventory", "คลังสินค้า", [
        "จัดการสินค้า/ล็อต/คลัง + แจ้งเตือนหมดอายุ",
        "ตรวจรับเข้า (GRN) + Quarantine Gate",
        "ธุรกรรมสต็อก + รับคืน (Returns Inbox)",
    ]),
    ("Production", "การผลิต", [
        "สูตรการผลิต BOM / Recipes",
        "ใบสั่งผลิต (Work Order) + Batch Record",
        "เบิกวัตถุดิบเพิ่ม (Extra Withdrawal) + อนุมัติ",
    ]),
    ("Material Withdrawal", "เบิกวัตถุดิบ", [
        "เบิกตาม BOM และเบิกเพิ่มนอกสูตร",
        "เส้นทางอนุมัติ + รายงานการเบิก",
    ]),
    ("Purchasing", "จัดซื้อ", [
        "ใบขอซื้อ (Requisition) → ใบสั่งซื้อ (PO)",
        "จัดการผู้ขาย (Vendors) + VMI",
    ]),
], LABEL)

# ============================================================
# SLIDE 12 — Modules: Quality / GMP
# ============================================================
module_slide(12, "MODULES 2/4", "คุณภาพ & GMP Compliance", [
    ("Quality", "ควบคุมคุณภาพ", [
        "บันทึกผล QC + ใบตรวจ QC",
        "Certificate of Analysis (COA)",
        "ตรวจเครื่องชั่ง (ลูกตุ้ม) + Deviation",
    ]),
    ("GMP Compliance", "มาตรฐาน GMP", [
        "ควบคุมเอกสาร (Documents) + Change Control",
        "CAPA / Complaints / Recalls",
        "Stability / Internal Audit / PQR",
    ]),
    ("Incoming Inspection", "ตรวจรับเข้า", [
        "เช็กลิสต์ตามประเภทสินค้า",
        "สุ่มตัวอย่าง QC อัตโนมัติ + อนุมัติ QA",
    ]),
    ("Premises", "อาคารสถานที่", [
        "ตรวจสภาพแวดล้อม + ระบบน้ำ",
        "สุขาภิบาล + แจ้งเตือนบำรุงรักษา",
    ]),
], LABEL)

# ============================================================
# SLIDE 13 — Modules: Accounting / Cost
# ============================================================
module_slide(13, "MODULES 3/4", "บัญชี & ต้นทุน", [
    ("Accounting", "บัญชี", [
        "ผังบัญชี + สมุดรายวัน (Journal)",
        "AP / AR Invoices + VAT 7%",
        "ปิดงวด + กระทบยอดธนาคาร",
    ]),
    ("Cost Management", "บริหารต้นทุน", [
        "ต้นทุนต่อหน่วย (WAC) + Landed Cost",
        "Work Center Rates + สรุปต้นทุน",
    ]),
    ("Fixed Assets", "สินทรัพย์", [
        "ทะเบียนสินทรัพย์ + เครื่องจักร",
        "ค่าเสื่อมราคา",
    ]),
    ("3-Way Matching", "จับคู่เอกสาร", [
        "จับคู่ PO ↔ ใบรับ ↔ Invoice",
        "ต้นทุนมาตรฐาน + รายงานผลต่าง (Variance)",
    ]),
], LABEL)

# ============================================================
# SLIDE 14 — Modules: Sales / HR / Admin
# ============================================================
module_slide(14, "MODULES 4/4", "ขาย, บุคคล & การจัดการ", [
    ("Sales", "ขาย", [
        "ใบสั่งขาย (Sales Order) + VMI Orders",
        "จัดการลูกค้า (Customers)",
    ]),
    ("HR", "ทรัพยากรบุคคล", [
        "พนักงาน / ตำแหน่ง / โครงสร้างองค์กร",
        "การอบรม + สิทธิ์การปฏิบัติงาน + สุขภาพ",
    ]),
    ("VMI Portal", "พอร์ทัลผู้ขาย", [
        "Webhook แบบ Real-time (แทน Polling)",
        "Sync + จัดการคำสั่งซื้อ",
    ]),
    ("Settings & Admin", "ตั้งค่า & ผู้ดูแล", [
        "เส้นทางอนุมัติ + Tolerance + ผู้ใช้/สิทธิ์",
        "Reports (DevExpress) + Issue Tracking",
    ]),
], LABEL)

# ============================================================
# SLIDE 15 — Implementation Roadmap
# ============================================================
s = add_slide()
bg(s, WHITE)
header(s, "ROADMAP", "แผนการนำระบบไปใช้งาน")
phases = [
    ("ระยะที่ 1", "เตรียมข้อมูลพื้นฐาน", "ตั้งค่าระบบ, นำเข้าข้อมูลสินค้า/ผู้ขาย/ลูกค้า, ผังบัญชี, ผู้ใช้และสิทธิ์", GREEN_DARK),
    ("ระยะที่ 2", "อบรม & ทดสอบ", "อบรมผู้ใช้แต่ละแผนก, ทดสอบ Flow งานจริง (UAT), ปรับแต่งเอกสาร/เกณฑ์", GREEN),
    ("ระยะที่ 3", "เริ่มใช้งานจริง", "Go-Live ตามโมดูล, ติดตามผลและสนับสนุน, ตรวจ Audit Trail", GREEN_LT),
    ("ระยะที่ 4", "ต่อยอด & ปรับปรุง", "เชื่อม VMI/บัญชีเต็มรูปแบบ, รายงานเชิงวิเคราะห์, ปิด Gap GMP", GOLD),
]
y = Inches(1.7)
for i, (ph, th, desc, color) in enumerate(phases):
    box(s, Inches(0.7), y, Inches(2.4), Inches(1.1), fill=color, shape=MSO_SHAPE.ROUNDED_RECTANGLE, shadow=True)
    text(s, Inches(0.7), y + Inches(0.12), Inches(2.4), Inches(0.45),
         [[(ph, 17, True, WHITE)]], align=PP_ALIGN.CENTER)
    text(s, Inches(0.7), y + Inches(0.55), Inches(2.4), Inches(0.5),
         [[(th, 16, True, WHITE)]], align=PP_ALIGN.CENTER)
    box(s, Inches(3.3), y, Inches(9.3), Inches(1.1), fill=LIGHT, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
        line=CARD_BORDER)
    text(s, Inches(3.6), y, Inches(8.8), Inches(1.1), [[(desc, 16, False, INK)]],
         anchor=MSO_ANCHOR.MIDDLE, line_spacing=1.05)
    y += Inches(1.28)
footer(s, 15, TOTAL, LABEL)

# ============================================================
# SLIDE 16 — Closing
# ============================================================
s = add_slide()
bg(s, GREEN_DARK)
box(s, 0, 0, EMU_W, Inches(0.08), fill=GOLD)
box(s, 0, EMU_H - Inches(0.08), EMU_W, Inches(0.08), fill=GOLD)
box(s, EMU_W/2 - Inches(1.0), Inches(1.4), Inches(2.0), Inches(2.0), fill=GREEN, shape=MSO_SHAPE.OVAL)
box(s, EMU_W/2 - Inches(0.55), Inches(1.85), Inches(1.1), Inches(1.1), fill=GREEN_LT, shape=MSO_SHAPE.OVAL)
text(s, Inches(1), Inches(3.7), Inches(11.3), Inches(0.9),
     [[("ขอบคุณครับ", 46, True, WHITE)]], align=PP_ALIGN.CENTER)
text(s, Inches(1), Inches(4.7), Inches(11.3), Inches(0.6),
     [[("พร้อมตอบคำถามและสาธิตการใช้งานระบบ", 22, False, GREEN_LT)]], align=PP_ALIGN.CENTER)
text(s, Inches(1), Inches(5.4), Inches(11.3), Inches(0.5),
     [[("Herbal Medicine ERP  •  ระบบบริหารโรงงานผลิตยาสมุนไพร", 16, True, RGBColor(0xCF, 0xE8, 0xCC))]],
     align=PP_ALIGN.CENTER)

import os
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "Herbal-ERP-Presentation.pptx")
prs.save(out)
print("SAVED:", out)
print("Slides:", len(prs.slides._sldIdLst))
