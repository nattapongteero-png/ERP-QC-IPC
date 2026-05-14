/* pptx-export.js — Generates PPTX from the Herbal Medicine ERP Training slides */
/* Uses pptxgenjs loaded from CDN */

(function () {
  'use strict';

  // Color palette matching CSS variables
  var COLORS = {
    brand50: 'F0FDFA',
    brand100: 'CCFBF1',
    brand200: '99F6E4',
    brand400: '2DD4BF',
    brand500: '14B8A6',
    brand600: '0D9488',
    brand700: '0F766E',
    brand800: '115E59',
    brand900: '134E4A',
    gold400: 'FBBF24',
    gold500: 'F59E0B',
    ink50: 'F8FAFC',
    ink100: 'F1F5F9',
    ink200: 'E2E8F0',
    ink400: '94A3B8',
    ink500: '64748B',
    ink600: '475569',
    ink700: '334155',
    ink800: '1E293B',
    ink900: '0F172A',
    white: 'FFFFFF',
    red600: 'DC2626',
    green600: '16A34A',
    blue600: '2563EB',
    blue900: '1E3A8A',
    warnBg: 'FEF2F2',
    warnText: '7F1D1D',
    infoBg: 'EFF6FF',
    infoText: '1E3A8A',
    tipBg: 'FEFCE8',
    tipText: '713F12',
    successBg: 'F0FDF4',
    successText: '14532D'
  };

  var FONT_MAIN = 'Sarabun';
  var FONT_MONO = 'IBM Plex Mono';

  // Helper to convert screenshot URL to base64
  function fetchImageAsBase64(url) {
    return fetch(url)
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onloadend = function () { resolve(reader.result); };
          reader.readAsDataURL(blob);
        });
      })
      .catch(function () { return null; });
  }

  function addCoverGradient(slide) {
    slide.addShape('rect', {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { type: 'solid', color: COLORS.brand700 }
    });
    slide.addShape('rect', {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { type: 'solid', color: '0891B2', alpha: 50 }
    });
  }

  function addTopBar(slide) {
    slide.addShape('rect', {
      x: 0, y: 0, w: '100%', h: 0.08,
      fill: { type: 'solid', color: COLORS.brand700 }
    });
  }

  function addSlideHeader(slide, label, num) {
    slide.addShape('roundRect', {
      x: 0.5, y: 0.3, w: 12.33, h: 0.5,
      rectRadius: 0.1,
      fill: { type: 'solid', color: COLORS.brand50 },
      line: { color: COLORS.brand100, width: 1 }
    });
    slide.addText(label, {
      x: 0.7, y: 0.32, w: 8, h: 0.45,
      fontSize: 11, fontFace: FONT_MAIN, color: COLORS.brand700,
      bold: true
    });
    slide.addText(num, {
      x: 10, y: 0.32, w: 2.8, h: 0.45,
      fontSize: 10, fontFace: FONT_MONO, color: COLORS.ink500,
      align: 'right'
    });
  }

  function addTitle(slide, text, y) {
    y = y || 1.0;
    slide.addText(text, {
      x: 0.5, y: y, w: 12.33, h: 0.6,
      fontSize: 28, fontFace: FONT_MAIN, color: COLORS.ink900,
      bold: true
    });
    // Underline bar
    slide.addShape('rect', {
      x: 0.5, y: y + 0.6, w: 1.0, h: 0.06,
      fill: { type: 'solid', color: COLORS.brand500 }
    });
  }

  function addParagraph(slide, text, x, y, w, opts) {
    opts = opts || {};
    slide.addText(text, {
      x: x, y: y, w: w, h: opts.h || 0.5,
      fontSize: opts.fontSize || 16,
      fontFace: opts.fontFace || FONT_MAIN,
      color: opts.color || COLORS.ink700,
      bold: opts.bold || false,
      valign: opts.valign || 'top',
      wrap: true
    });
  }

  function addSteps(slide, steps, x, y, w) {
    var rows = steps.map(function (s, i) {
      return [
        { text: String(i + 1), options: { fontSize: 12, fontFace: FONT_MAIN, bold: true, color: COLORS.white, fill: { color: COLORS.brand600 }, align: 'center' } },
        { text: s, options: { fontSize: 13, fontFace: FONT_MAIN, color: COLORS.ink700 } }
      ];
    });
    slide.addTable(rows, {
      x: x, y: y, w: w,
      colW: [0.5, w - 0.5],
      border: { type: 'solid', color: COLORS.ink200, pt: 0.5 },
      rowH: 0.4,
      autoPage: false
    });
  }

  function addFieldsTable(slide, headers, rows, x, y, w) {
    var colW;
    if (headers.length === 3) {
      colW = [w * 0.3, w * 0.2, w * 0.5];
    } else {
      colW = headers.map(function () { return w / headers.length; });
    }

    var tableRows = [];
    // Header row
    tableRows.push(headers.map(function (h) {
      return { text: h, options: { fontSize: 11, fontFace: FONT_MAIN, bold: true, color: COLORS.white, fill: { color: COLORS.brand800 } } };
    }));
    // Data rows
    rows.forEach(function (row) {
      tableRows.push(row.map(function (cell) {
        return { text: cell, options: { fontSize: 11, fontFace: FONT_MAIN, color: COLORS.ink700 } };
      }));
    });

    slide.addTable(tableRows, {
      x: x, y: y, w: w,
      colW: colW,
      border: { type: 'solid', color: COLORS.ink200, pt: 0.5 },
      rowH: 0.35,
      autoPage: false
    });
  }

  function addInfoBox(slide, title, text, x, y, w, type) {
    var bgColor, textColor;
    switch (type) {
      case 'warn': bgColor = COLORS.warnBg; textColor = COLORS.warnText; break;
      case 'tip': bgColor = COLORS.tipBg; textColor = COLORS.tipText; break;
      case 'success': bgColor = COLORS.successBg; textColor = COLORS.successText; break;
      default: bgColor = COLORS.infoBg; textColor = COLORS.infoText;
    }
    slide.addShape('roundRect', {
      x: x, y: y, w: w, h: 0.7,
      rectRadius: 0.1,
      fill: { type: 'solid', color: bgColor },
      line: { color: bgColor, width: 1 }
    });
    slide.addText([
      { text: title + '\n', options: { fontSize: 12, bold: true, color: textColor } },
      { text: text, options: { fontSize: 11, color: textColor } }
    ], {
      x: x + 0.15, y: y + 0.05, w: w - 0.3, h: 0.6,
      fontFace: FONT_MAIN, valign: 'middle', wrap: true
    });
  }

  function addWorkflowRow(slide, steps, y) {
    var totalSteps = steps.length;
    var stepW = 1.5;
    var arrowW = 0.4;
    var totalW = totalSteps * stepW + (totalSteps - 1) * arrowW;
    var startX = (13.333 - totalW) / 2;

    steps.forEach(function (step, i) {
      var x = startX + i * (stepW + arrowW);
      slide.addShape('roundRect', {
        x: x, y: y, w: stepW, h: 1.0,
        rectRadius: 0.1,
        fill: { type: 'solid', color: COLORS.white },
        line: { color: COLORS.ink200, width: 1 },
        shadow: { type: 'outer', blur: 3, offset: 2, color: '000000', opacity: 0.1 }
      });
      slide.addText(step.label || '', {
        x: x, y: y + 0.05, w: stepW, h: 0.25,
        fontSize: 8, fontFace: FONT_MAIN, color: COLORS.brand700,
        bold: true, align: 'center'
      });
      slide.addText(step.title, {
        x: x, y: y + 0.3, w: stepW, h: 0.35,
        fontSize: 13, fontFace: FONT_MAIN, color: COLORS.ink900,
        bold: true, align: 'center'
      });
      if (step.desc) {
        slide.addText(step.desc, {
          x: x, y: y + 0.65, w: stepW, h: 0.3,
          fontSize: 9, fontFace: FONT_MAIN, color: COLORS.ink500,
          align: 'center'
        });
      }
      // Arrow between steps
      if (i < totalSteps - 1) {
        slide.addText('\u2794', {
          x: x + stepW, y: y + 0.25, w: arrowW, h: 0.5,
          fontSize: 20, color: COLORS.brand500, align: 'center', valign: 'middle'
        });
      }
    });
  }

  async function addScreenshot(slide, imgPath, x, y, w, h) {
    var base64 = await fetchImageAsBase64(imgPath);
    if (base64) {
      slide.addImage({
        data: base64,
        x: x, y: y, w: w, h: h,
        rounding: true,
        shadow: { type: 'outer', blur: 4, offset: 2, color: '000000', opacity: 0.15 }
      });
    }
  }

  // Main export function
  window.exportPPTX = async function () {
    var btn = document.getElementById('btn-pptx');
    if (btn) {
      btn.classList.add('loading');
    }
    if (typeof showToast === 'function') {
      showToast('กำลังสร้างไฟล์ PowerPoint...', '');
    }

    try {
      var pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.author = 'Herbal Medicine ERP';
      pptx.subject = 'Training Material';
      pptx.title = 'คู่มืออบรมผู้ใช้งาน - ระบบ Herbal Medicine ERP';

      // =========================================================
      // SLIDE 1: COVER
      // =========================================================
      var s1 = pptx.addSlide();
      addCoverGradient(s1);
      s1.addText('TRAINING MATERIAL \u00B7 2026', {
        x: 0, y: 1.5, w: '100%', h: 0.4,
        fontSize: 14, fontFace: FONT_MAIN, color: COLORS.white,
        align: 'center', italic: false, bold: false
      });
      s1.addText('\u0E04\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E2D\u0E1A\u0E23\u0E21\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19', {
        x: 0, y: 2.2, w: '100%', h: 1.0,
        fontSize: 44, fontFace: FONT_MAIN, color: COLORS.white,
        bold: true, align: 'center'
      });
      s1.addText('\u0E23\u0E30\u0E1A\u0E1A Herbal Medicine ERP', {
        x: 0, y: 3.2, w: '100%', h: 0.6,
        fontSize: 22, fontFace: FONT_MAIN, color: COLORS.white,
        align: 'center'
      });
      s1.addText('\u0E04\u0E23\u0E2D\u0E1A\u0E04\u0E25\u0E38\u0E21\u0E01\u0E23\u0E30\u0E1A\u0E27\u0E19\u0E01\u0E32\u0E23\u0E17\u0E33\u0E07\u0E32\u0E19\u0E15\u0E31\u0E49\u0E07\u0E41\u0E15\u0E48 Master Data, \u0E08\u0E31\u0E14\u0E0B\u0E37\u0E49\u0E2D, \u0E1C\u0E25\u0E34\u0E15, \u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32 \u0E08\u0E19\u0E16\u0E36\u0E07\u0E02\u0E32\u0E22', {
        x: 1, y: 3.9, w: 11.33, h: 0.5,
        fontSize: 14, fontFace: FONT_MAIN, color: COLORS.white,
        align: 'center'
      });
      // Tags
      var tags = ['Master Data', 'Purchasing', 'Production', 'Quality', 'Sales'];
      var tagStartX = (13.333 - tags.length * 2.0) / 2;
      tags.forEach(function (tag, i) {
        s1.addShape('roundRect', {
          x: tagStartX + i * 2.0, y: 5.0, w: 1.8, h: 0.4,
          rectRadius: 0.2,
          fill: { type: 'solid', color: COLORS.white, alpha: 15 },
          line: { color: COLORS.white, width: 0.5, alpha: 30 }
        });
        s1.addText(tag, {
          x: tagStartX + i * 2.0, y: 5.0, w: 1.8, h: 0.4,
          fontSize: 11, fontFace: FONT_MAIN, color: COLORS.white,
          align: 'center', valign: 'middle'
        });
      });

      // =========================================================
      // SLIDE 2: AGENDA
      // =========================================================
      var s2 = pptx.addSlide();
      addTopBar(s2);
      addSlideHeader(s2, '\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E01\u0E32\u0E23\u0E2D\u0E1A\u0E23\u0E21', '02 / 28');
      addTitle(s2, '\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E01\u0E32\u0E23\u0E2D\u0E1A\u0E23\u0E21');

      var modules = [
        { icon: '\uD83D\uDCC1', title: '\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19', en: 'Master Data', count: '4 \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D' },
        { icon: '\uD83D\uDE9A', title: '\u0E08\u0E31\u0E14\u0E0B\u0E37\u0E49\u0E2D\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32', en: 'Purchasing', count: '3 \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D' },
        { icon: '\u2697\uFE0F', title: '\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15\u0E2A\u0E21\u0E38\u0E19\u0E44\u0E1E\u0E23', en: 'Production', count: '3 \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D' },
        { icon: '\u2705', title: '\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B', en: 'FG Receipt', count: '2 \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D' },
        { icon: '\uD83D\uDCCA', title: '\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22\u0E41\u0E25\u0E30\u0E2A\u0E48\u0E07\u0E2D\u0E2D\u0E01', en: 'Sales & Report', count: '3 \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D' }
      ];
      var mStartX = 0.8;
      var mW = 2.2;
      modules.forEach(function (m, i) {
        var mx = mStartX + i * (mW + 0.3);
        s2.addShape('roundRect', {
          x: mx, y: 2.0, w: mW, h: 2.8,
          rectRadius: 0.15,
          fill: { type: 'solid', color: COLORS.white },
          line: { color: COLORS.ink200, width: 1 },
          shadow: { type: 'outer', blur: 3, offset: 2, color: '000000', opacity: 0.08 }
        });
        // Module number badge
        s2.addShape('roundRect', {
          x: mx + mW - 0.55, y: 2.15, w: 0.4, h: 0.4,
          rectRadius: 0.1,
          fill: { type: 'solid', color: COLORS.brand600 }
        });
        s2.addText(String(i + 1), {
          x: mx + mW - 0.55, y: 2.15, w: 0.4, h: 0.4,
          fontSize: 12, fontFace: FONT_MAIN, color: COLORS.white,
          bold: true, align: 'center', valign: 'middle'
        });
        s2.addText(m.en, {
          x: mx + 0.15, y: 2.3, w: mW - 0.3, h: 0.3,
          fontSize: 9, fontFace: FONT_MAIN, color: COLORS.ink500,
          bold: true
        });
        s2.addText(m.title, {
          x: mx + 0.15, y: 2.8, w: mW - 0.3, h: 0.6,
          fontSize: 18, fontFace: FONT_MAIN, color: COLORS.ink900,
          bold: true
        });
        s2.addText(m.count, {
          x: mx + 0.15, y: 3.6, w: mW - 0.3, h: 0.3,
          fontSize: 12, fontFace: FONT_MAIN, color: COLORS.ink500
        });
      });

      // =========================================================
      // SLIDE 3: END-TO-END FLOW
      // =========================================================
      var s3 = pptx.addSlide();
      addTopBar(s3);
      addSlideHeader(s3, '\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E01\u0E23\u0E30\u0E1A\u0E27\u0E19\u0E01\u0E32\u0E23', '03 / 28');
      addTitle(s3, 'End-to-End Flow');

      addWorkflowRow(s3, [
        { label: 'STEP 1', title: 'Master Data', desc: '\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19' },
        { label: 'STEP 2', title: '\u0E08\u0E31\u0E14\u0E0B\u0E37\u0E49\u0E2D', desc: '\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A' },
        { label: 'STEP 3', title: '\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A', desc: '\u0E23\u0E31\u0E1A\u0E02\u0E2D\u0E07 + \u0E2A\u0E23\u0E49\u0E32\u0E07 Lot' },
        { label: 'STEP 4', title: '\u0E1C\u0E25\u0E34\u0E15', desc: 'Work Order + \u0E0A\u0E31\u0E48\u0E07' }
      ], 2.2);

      addWorkflowRow(s3, [
        { label: 'STEP 5', title: 'IPC / QC', desc: '\u0E15\u0E23\u0E27\u0E08\u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E' },
        { label: 'STEP 6', title: '\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32 FG', desc: '\u0E23\u0E31\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B' },
        { label: 'STEP 7', title: '\u0E02\u0E32\u0E22 / \u0E2A\u0E48\u0E07\u0E2D\u0E2D\u0E01', desc: '\u0E43\u0E1A\u0E01\u0E33\u0E01\u0E31\u0E1A\u0E20\u0E32\u0E29\u0E35 + Report' }
      ], 3.8);

      // =========================================================
      // SLIDE 4: MODULE 1 SECTION DIVIDER
      // =========================================================
      var s4 = pptx.addSlide();
      addCoverGradient(s4);
      s4.addText('MODULE 01', {
        x: 1.2, y: 2.0, w: 5, h: 0.4,
        fontSize: 14, fontFace: FONT_MAIN, color: COLORS.white, bold: false
      });
      s4.addText('\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19', {
        x: 1.2, y: 2.6, w: 10, h: 1.2,
        fontSize: 48, fontFace: FONT_MAIN, color: COLORS.white, bold: true
      });
      s4.addText('Master Data Management', {
        x: 1.2, y: 3.8, w: 10, h: 0.5,
        fontSize: 18, fontFace: FONT_MAIN, color: COLORS.white
      });
      s4.addShape('roundRect', {
        x: 1.2, y: 4.8, w: 8, h: 0.5,
        rectRadius: 0.25,
        fill: { type: 'solid', color: COLORS.white, alpha: 15 },
        line: { color: COLORS.white, width: 0.5, alpha: 25 }
      });
      s4.addText('4 \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D \u00B7 \u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A \u00B7 \u0E1A\u0E23\u0E23\u0E08\u0E38\u0E20\u0E31\u0E13\u0E11\u0E4C \u00B7 \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B \u00B7 BOM', {
        x: 1.4, y: 4.8, w: 7.6, h: 0.5,
        fontSize: 12, fontFace: FONT_MAIN, color: COLORS.white,
        valign: 'middle'
      });

      // =========================================================
      // SLIDE 5: RAW MATERIALS
      // =========================================================
      var s5 = pptx.addSlide();
      addTopBar(s5);
      addSlideHeader(s5, 'MODULE 1 \u00B7 \u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A', '05 / 28');
      addTitle(s5, '\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A (Raw Materials)');
      addParagraph(s5, 'Inventory \u2192 Items \u2192 \u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A \u2192 + \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E2B\u0E21\u0E48', 0.5, 1.8, 6, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s5, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Inventory > Items',
        '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E41\u0E16\u0E1A "\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A" (Raw Materials)',
        '\u0E04\u0E25\u0E34\u0E01\u0E1B\u0E38\u0E48\u0E21 "+ \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E21\u0E48"',
        '\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25: \u0E23\u0E2B\u0E31\u0E2A, \u0E0A\u0E37\u0E48\u0E2D\u0E44\u0E17\u0E22, \u0E0A\u0E37\u0E48\u0E2D\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29, \u0E2B\u0E21\u0E27\u0E14\u0E2B\u0E21\u0E39\u0E48, \u0E2B\u0E19\u0E48\u0E27\u0E22\u0E2B\u0E25\u0E31\u0E01',
        '\u0E01\u0E14 "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"'
      ], 0.5, 2.2, 6);
      addFieldsTable(s5,
        ['\u0E1F\u0E34\u0E25\u0E14\u0E4C', '\u0E08\u0E33\u0E40\u0E1B\u0E47\u0E19', '\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22'],
        [
          ['\u0E23\u0E2B\u0E31\u0E2A\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A (Code)', '\u2705', 'Auto: RM-XXXX'],
          ['\u0E0A\u0E37\u0E48\u0E2D (\u0E44\u0E17\u0E22)', '\u2705', '\u0E40\u0E0A\u0E48\u0E19 \u0E02\u0E21\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E19'],
          ['\u0E0A\u0E37\u0E48\u0E2D (\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29)', '\u2705', '\u0E40\u0E0A\u0E48\u0E19 Turmeric'],
          ['\u0E2B\u0E21\u0E27\u0E14\u0E2B\u0E21\u0E39\u0E48 (Category)', '\u2705', '\u0E2A\u0E21\u0E38\u0E19\u0E44\u0E1E\u0E23\u0E2A\u0E14 / \u0E41\u0E2B\u0E49\u0E07 / \u0E2A\u0E32\u0E23\u0E40\u0E2A\u0E23\u0E34\u0E21'],
          ['\u0E2B\u0E19\u0E48\u0E27\u0E22\u0E2B\u0E25\u0E31\u0E01 (Unit)', '\u2705', 'kg / g / l / ml']
        ], 0.5, 4.9, 6
      );
      await addScreenshot(s5, 'screenshots/01-items-list.png', 7.0, 2.0, 5.8, 3.5);
      addInfoBox(s5, '\u0E40\u0E04\u0E25\u0E47\u0E14\u0E25\u0E31\u0E1A', '\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E2B\u0E31\u0E2A\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 (Auto-code) RM-XXXX \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A', 7.0, 5.8, 5.8, 'tip');

      // =========================================================
      // SLIDE 6: PACKAGING
      // =========================================================
      var s6 = pptx.addSlide();
      addTopBar(s6);
      addSlideHeader(s6, 'MODULE 1 \u00B7 \u0E1A\u0E23\u0E23\u0E08\u0E38\u0E20\u0E31\u0E13\u0E11\u0E4C', '06 / 28');
      addTitle(s6, '\u0E1A\u0E23\u0E23\u0E08\u0E38\u0E20\u0E31\u0E13\u0E11\u0E4C (Packaging)');
      addParagraph(s6, 'Inventory \u2192 Items \u2192 \u0E1A\u0E23\u0E23\u0E08\u0E38\u0E20\u0E31\u0E13\u0E11\u0E4C \u2192 + \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E2B\u0E21\u0E48', 0.5, 1.8, 6, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s6, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Inventory > Items',
        '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E41\u0E16\u0E1A "\u0E1A\u0E23\u0E23\u0E08\u0E38\u0E20\u0E31\u0E13\u0E11\u0E4C" (Packaging)',
        '\u0E04\u0E25\u0E34\u0E01 "+ \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E21\u0E48"',
        '\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25: \u0E23\u0E2B\u0E31\u0E2A, \u0E0A\u0E37\u0E48\u0E2D, \u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E1A\u0E23\u0E23\u0E08\u0E38\u0E20\u0E31\u0E13\u0E11\u0E4C, \u0E2B\u0E19\u0E48\u0E27\u0E22',
        '\u0E01\u0E14 "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"'
      ], 0.5, 2.2, 6);
      addFieldsTable(s6,
        ['\u0E1F\u0E34\u0E25\u0E14\u0E4C', '\u0E08\u0E33\u0E40\u0E1B\u0E47\u0E19', '\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22'],
        [
          ['\u0E23\u0E2B\u0E31\u0E2A\u0E1A\u0E23\u0E23\u0E08\u0E38\u0E20\u0E31\u0E13\u0E11\u0E4C (Code)', '\u2705', 'Auto: PK-XXXX'],
          ['\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E23\u0E23\u0E08\u0E38\u0E20\u0E31\u0E13\u0E11\u0E4C', '\u2705', '\u0E40\u0E0A\u0E48\u0E19 \u0E02\u0E27\u0E14 PET 100 ml'],
          ['\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17 (Type)', '\u2705', '\u0E02\u0E27\u0E14 / \u0E01\u0E25\u0E48\u0E2D\u0E07 / \u0E0B\u0E2D\u0E07 / \u0E09\u0E25\u0E32\u0E01'],
          ['\u0E2B\u0E19\u0E48\u0E27\u0E22\u0E19\u0E31\u0E1A', '\u2705', '\u0E0A\u0E34\u0E49\u0E19 / \u0E43\u0E1A / \u0E21\u0E49\u0E27\u0E19']
        ], 0.5, 4.6, 6
      );
      await addScreenshot(s6, 'screenshots/01-items-list.png', 7.0, 2.0, 5.8, 3.5);
      addInfoBox(s6, '\u0E40\u0E04\u0E25\u0E47\u0E14\u0E25\u0E31\u0E1A', '\u0E1A\u0E23\u0E23\u0E08\u0E38\u0E20\u0E31\u0E13\u0E11\u0E4C\u0E23\u0E27\u0E21\u0E16\u0E36\u0E07\u0E27\u0E31\u0E2A\u0E14\u0E38\u0E2A\u0E34\u0E49\u0E19\u0E40\u0E1B\u0E25\u0E37\u0E2D\u0E07 \u0E40\u0E0A\u0E48\u0E19 \u0E09\u0E25\u0E32\u0E01, \u0E01\u0E25\u0E48\u0E2D\u0E07\u0E0A\u0E31\u0E49\u0E19\u0E19\u0E2D\u0E01, seal', 7.0, 5.8, 5.8, 'tip');

      // =========================================================
      // SLIDE 7: FINISHED GOODS
      // =========================================================
      var s7 = pptx.addSlide();
      addTopBar(s7);
      addSlideHeader(s7, 'MODULE 1 \u00B7 \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B', '07 / 28');
      addTitle(s7, '\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B (Finished Goods)');
      addParagraph(s7, 'Inventory \u2192 Items \u2192 \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B \u2192 + \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E2B\u0E21\u0E48', 0.5, 1.8, 6, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s7, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Inventory > Items',
        '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E41\u0E16\u0E1A "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B" (Finished Goods)',
        '\u0E04\u0E25\u0E34\u0E01 "+ \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E21\u0E48"',
        '\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25: \u0E23\u0E2B\u0E31\u0E2A, \u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E25\u0E34\u0E15\u0E20\u0E31\u0E13\u0E11\u0E4C, \u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E22\u0E32, \u0E02\u0E19\u0E32\u0E14, \u0E2B\u0E19\u0E48\u0E27\u0E22',
        '\u0E01\u0E14 "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"'
      ], 0.5, 2.2, 6);
      addFieldsTable(s7,
        ['\u0E1F\u0E34\u0E25\u0E14\u0E4C', '\u0E08\u0E33\u0E40\u0E1B\u0E47\u0E19', '\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22'],
        [
          ['\u0E23\u0E2B\u0E31\u0E2A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 (Code)', '\u2705', 'Auto: FG-XXXX'],
          ['\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E25\u0E34\u0E15\u0E20\u0E31\u0E13\u0E11\u0E4C (\u0E44\u0E17\u0E22)', '\u2705', '\u0E40\u0E0A\u0E48\u0E19 \u0E41\u0E04\u0E1B\u0E0B\u0E39\u0E25\u0E02\u0E21\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E19 500 \u0E21\u0E01.'],
          ['\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E22\u0E32 (Dosage Form)', '\u2705', '\u0E41\u0E04\u0E1B\u0E0B\u0E39\u0E25 / \u0E40\u0E21\u0E47\u0E14 / \u0E1C\u0E07 / \u0E19\u0E49\u0E33'],
          ['\u0E02\u0E19\u0E32\u0E14\u0E1A\u0E23\u0E23\u0E08\u0E38', '\u2705', '\u0E40\u0E0A\u0E48\u0E19 60 \u0E41\u0E04\u0E1B\u0E0B\u0E39\u0E25/\u0E02\u0E27\u0E14']
        ], 0.5, 4.6, 6
      );
      await addScreenshot(s7, 'screenshots/01-items-list.png', 7.0, 2.0, 5.8, 3.5);

      // =========================================================
      // SLIDE 8: BOM
      // =========================================================
      var s8 = pptx.addSlide();
      addTopBar(s8);
      addSlideHeader(s8, 'MODULE 1 \u00B7 \u0E2A\u0E39\u0E15\u0E23\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15', '08 / 28');
      addTitle(s8, '\u0E2A\u0E39\u0E15\u0E23\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15 (BOM)');
      addParagraph(s8, 'Production \u2192 BOM \u2192 + \u0E2A\u0E23\u0E49\u0E32\u0E07 BOM \u0E43\u0E2B\u0E21\u0E48', 0.5, 1.8, 6, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s8, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Production > BOM',
        '\u0E04\u0E25\u0E34\u0E01 "+ \u0E2A\u0E23\u0E49\u0E32\u0E07 BOM \u0E43\u0E2B\u0E21\u0E48"',
        '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B (FG)',
        '\u0E23\u0E30\u0E1A\u0E38 Batch Size (\u0E1B\u0E23\u0E34\u0E21\u0E32\u0E13\u0E15\u0E48\u0E2D Lot)',
        '\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A + \u0E23\u0E30\u0E1A\u0E38\u0E1B\u0E23\u0E34\u0E21\u0E32\u0E13\u0E15\u0E48\u0E2D Batch',
        '\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1A\u0E23\u0E23\u0E08\u0E38\u0E20\u0E31\u0E13\u0E11\u0E4C (\u0E16\u0E49\u0E32\u0E21\u0E35)',
        '\u0E01\u0E14 "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"'
      ], 0.5, 2.2, 6);
      await addScreenshot(s8, 'screenshots/03-bom-list.png', 7.0, 2.0, 5.8, 3.5);
      addInfoBox(s8, '\u0E40\u0E04\u0E25\u0E47\u0E14\u0E25\u0E31\u0E1A', 'BOM 1 \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 \u0E1C\u0E39\u0E01\u0E01\u0E31\u0E1A FG 1 \u0E15\u0E31\u0E27 \u2014 \u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E39\u0E15\u0E23\u0E44\u0E14\u0E49\u0E42\u0E14\u0E22\u0E2A\u0E23\u0E49\u0E32\u0E07 Version \u0E43\u0E2B\u0E21\u0E48', 7.0, 5.8, 5.8, 'tip');

      // =========================================================
      // SLIDE 9: MODULE 2 SECTION DIVIDER
      // =========================================================
      var s9 = pptx.addSlide();
      addCoverGradient(s9);
      s9.addText('MODULE 02', {
        x: 1.2, y: 2.0, w: 5, h: 0.4,
        fontSize: 14, fontFace: FONT_MAIN, color: COLORS.white
      });
      s9.addText('\u0E08\u0E31\u0E14\u0E0B\u0E37\u0E49\u0E2D\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32', {
        x: 1.2, y: 2.6, w: 10, h: 1.2,
        fontSize: 48, fontFace: FONT_MAIN, color: COLORS.white, bold: true
      });
      s9.addText('Purchasing & Goods Receipt', {
        x: 1.2, y: 3.8, w: 10, h: 0.5,
        fontSize: 18, fontFace: FONT_MAIN, color: COLORS.white
      });
      s9.addShape('roundRect', {
        x: 1.2, y: 4.8, w: 7, h: 0.5,
        rectRadius: 0.25,
        fill: { type: 'solid', color: COLORS.white, alpha: 15 },
        line: { color: COLORS.white, width: 0.5, alpha: 25 }
      });
      s9.addText('3 \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D \u00B7 \u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D \u00B7 \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32 \u00B7 Lot & QC', {
        x: 1.4, y: 4.8, w: 6.6, h: 0.5,
        fontSize: 12, fontFace: FONT_MAIN, color: COLORS.white, valign: 'middle'
      });

      // =========================================================
      // SLIDE 10: PURCHASE FLOW
      // =========================================================
      var s10 = pptx.addSlide();
      addTopBar(s10);
      addSlideHeader(s10, 'MODULE 2 \u00B7 \u0E01\u0E23\u0E30\u0E1A\u0E27\u0E19\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E0B\u0E37\u0E49\u0E2D', '10 / 28');
      addTitle(s10, 'Flow: \u0E08\u0E31\u0E14\u0E0B\u0E37\u0E49\u0E2D \u2192 \u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32 \u2192 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49');
      addWorkflowRow(s10, [
        { label: 'STEP 1', title: '\u0E2A\u0E23\u0E49\u0E32\u0E07 PO', desc: '\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D' },
        { label: 'STEP 2', title: '\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34 PO', desc: 'Approval' },
        { label: 'STEP 3', title: '\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32', desc: 'Goods Receipt' },
        { label: 'STEP 4', title: '\u0E2A\u0E23\u0E49\u0E32\u0E07 Lot', desc: 'Auto-generate' }
      ], 2.0);

      addWorkflowRow(s10, [
        { label: 'STEP 5', title: '\u0E01\u0E31\u0E01\u0E01\u0E31\u0E19', desc: 'Quarantine' },
        { label: 'STEP 6', title: '\u0E2A\u0E48\u0E07\u0E15\u0E23\u0E27\u0E08 QC', desc: 'Quality Check' },
        { label: 'STEP 7', title: 'QC \u0E1C\u0E48\u0E32\u0E19', desc: 'Pass / Fail' },
        { label: 'STEP 8', title: '\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E43\u0E0A\u0E49', desc: 'Released' }
      ], 3.6);

      // =========================================================
      // SLIDE 11: PURCHASE ORDER
      // =========================================================
      var s11 = pptx.addSlide();
      addTopBar(s11);
      addSlideHeader(s11, 'MODULE 2 \u00B7 \u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D', '11 / 28');
      addTitle(s11, '\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D (Purchase Order)');
      addParagraph(s11, 'Purchasing \u2192 Orders \u2192 + \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D', 0.5, 1.8, 6, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s11, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Purchasing > Orders',
        '\u0E04\u0E25\u0E34\u0E01 "+ \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D\u0E43\u0E2B\u0E21\u0E48"',
        '\u0E40\u0E25\u0E37\u0E2D\u0E01 Supplier',
        '\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A: Item + \u0E08\u0E33\u0E19\u0E27\u0E19 + \u0E23\u0E32\u0E04\u0E32\u0E15\u0E48\u0E2D\u0E2B\u0E19\u0E48\u0E27\u0E22',
        '\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21',
        '\u0E01\u0E14 "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01" \u2192 \u0E2A\u0E16\u0E32\u0E19\u0E30 Draft',
        '\u0E01\u0E14 "\u0E2A\u0E48\u0E07\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34" \u2192 \u0E2A\u0E16\u0E32\u0E19\u0E30 Pending Approval'
      ], 0.5, 2.2, 6);
      await addScreenshot(s11, 'screenshots/04-po-list.png', 7.0, 2.0, 5.8, 2.5);
      await addScreenshot(s11, 'screenshots/05-po-new.png', 7.0, 4.7, 5.8, 2.5);
      addInfoBox(s11, '\u0E40\u0E04\u0E25\u0E47\u0E14\u0E25\u0E31\u0E1A', 'PO \u0E15\u0E49\u0E2D\u0E07\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E01\u0E48\u0E2D\u0E19\u0E08\u0E36\u0E07\u0E08\u0E30\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E44\u0E14\u0E49', 0.5, 6.5, 6, 'tip');

      // =========================================================
      // SLIDE 12: GOODS RECEIPT
      // =========================================================
      var s12 = pptx.addSlide();
      addTopBar(s12);
      addSlideHeader(s12, 'MODULE 2 \u00B7 \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32', '12 / 28');
      addTitle(s12, '\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32 (Goods Receipt)');
      addParagraph(s12, 'Purchasing \u2192 Orders \u2192 \u0E40\u0E25\u0E37\u0E2D\u0E01 PO \u2192 Receive', 0.5, 1.8, 12, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s12, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Purchasing > Orders',
        '\u0E40\u0E25\u0E37\u0E2D\u0E01 PO \u0E17\u0E35\u0E48\u0E2A\u0E16\u0E32\u0E19\u0E30 "Approved"',
        '\u0E04\u0E25\u0E34\u0E01\u0E1B\u0E38\u0E48\u0E21 "Receive" (\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32)',
        '\u0E23\u0E30\u0E1A\u0E38: \u0E08\u0E33\u0E19\u0E27\u0E19\u0E17\u0E35\u0E48\u0E23\u0E31\u0E1A\u0E08\u0E23\u0E34\u0E07, \u0E40\u0E25\u0E02 Lot/Batch \u0E08\u0E32\u0E01 Supplier',
        '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E04\u0E25\u0E31\u0E07\u0E17\u0E35\u0E48\u0E08\u0E30\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32 (Warehouse)',
        '\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32',
        '\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E23\u0E49\u0E32\u0E07 Lot \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 \u2192 \u0E2A\u0E16\u0E32\u0E19\u0E30 "Quarantine"'
      ], 0.5, 2.2, 12);
      addInfoBox(s12, '\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E23\u0E23\u0E30\u0E27\u0E31\u0E07', '\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E08\u0E30\u0E16\u0E39\u0E01\u0E01\u0E31\u0E01\u0E01\u0E31\u0E19 (Quarantine) \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34 \u2014 \u0E15\u0E49\u0E2D\u0E07\u0E1C\u0E48\u0E32\u0E19 QC \u0E01\u0E48\u0E2D\u0E19\u0E19\u0E33\u0E44\u0E1B\u0E43\u0E0A\u0E49\u0E1C\u0E25\u0E34\u0E15', 0.5, 5.6, 12, 'warn');

      // =========================================================
      // SLIDE 13: LOT & QC
      // =========================================================
      var s13 = pptx.addSlide();
      addTopBar(s13);
      addSlideHeader(s13, 'MODULE 2 \u00B7 Lot & QC', '13 / 28');
      addTitle(s13, 'Lot & QC Pass');
      addParagraph(s13, 'Quality \u2192 Tests \u2192 + \u0E2A\u0E23\u0E49\u0E32\u0E07 QC Test', 0.5, 1.8, 6, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s13, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Quality > Tests',
        '\u0E04\u0E25\u0E34\u0E01 "+ \u0E2A\u0E23\u0E49\u0E32\u0E07 QC Test \u0E43\u0E2B\u0E21\u0E48"',
        '\u0E40\u0E25\u0E37\u0E2D\u0E01 Lot \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08 (\u0E2A\u0E16\u0E32\u0E19\u0E30 Quarantine)',
        '\u0E23\u0E30\u0E1A\u0E38\u0E1C\u0E25\u0E15\u0E23\u0E27\u0E08\u0E15\u0E32\u0E21 Specification',
        '\u0E01\u0E14 "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E1C\u0E25\u0E15\u0E23\u0E27\u0E08"',
        '\u0E1C\u0E48\u0E32\u0E19 \u2192 \u0E01\u0E14 "Release" \u2192 Lot = "Released"',
        '\u0E44\u0E21\u0E48\u0E1C\u0E48\u0E32\u0E19 \u2192 \u0E01\u0E14 "Reject" \u2192 Lot = "Rejected"'
      ], 0.5, 2.2, 6);
      await addScreenshot(s13, 'screenshots/08-qc-tests.png', 7.0, 2.0, 5.8, 3.5);
      addInfoBox(s13, '\u0E2A\u0E33\u0E04\u0E31\u0E0D', 'Lot \u0E17\u0E35\u0E48 Released \u0E41\u0E25\u0E49\u0E27\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E17\u0E35\u0E48\u0E08\u0E30\u0E14\u0E36\u0E07\u0E44\u0E1B\u0E43\u0E0A\u0E49\u0E43\u0E19\u0E01\u0E23\u0E30\u0E1A\u0E27\u0E19\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15\u0E44\u0E14\u0E49', 7.0, 5.8, 5.8, 'success');

      // =========================================================
      // SLIDE 14: MODULE 3 SECTION DIVIDER
      // =========================================================
      var s14 = pptx.addSlide();
      addCoverGradient(s14);
      s14.addText('MODULE 03', {
        x: 1.2, y: 2.0, w: 5, h: 0.4,
        fontSize: 14, fontFace: FONT_MAIN, color: COLORS.white
      });
      s14.addText('\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15\u0E2A\u0E21\u0E38\u0E19\u0E44\u0E1E\u0E23', {
        x: 1.2, y: 2.6, w: 10, h: 1.2,
        fontSize: 48, fontFace: FONT_MAIN, color: COLORS.white, bold: true
      });
      s14.addText('Herbal Production Process', {
        x: 1.2, y: 3.8, w: 10, h: 0.5,
        fontSize: 18, fontFace: FONT_MAIN, color: COLORS.white
      });
      s14.addShape('roundRect', {
        x: 1.2, y: 4.8, w: 8, h: 0.5,
        rectRadius: 0.25,
        fill: { type: 'solid', color: COLORS.white, alpha: 15 },
        line: { color: COLORS.white, width: 0.5, alpha: 25 }
      });
      s14.addText('3 \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D \u00B7 \u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E1C\u0E25\u0E34\u0E15 \u00B7 \u0E15\u0E31\u0E14\u0E08\u0E48\u0E32\u0E22\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A \u00B7 \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15', {
        x: 1.4, y: 4.8, w: 7.6, h: 0.5,
        fontSize: 12, fontFace: FONT_MAIN, color: COLORS.white, valign: 'middle'
      });

      // =========================================================
      // SLIDE 15: PRODUCTION FLOW
      // =========================================================
      var s15 = pptx.addSlide();
      addTopBar(s15);
      addSlideHeader(s15, 'MODULE 3 \u00B7 \u0E01\u0E23\u0E30\u0E1A\u0E27\u0E19\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15', '15 / 28');
      addTitle(s15, 'Flow: \u0E01\u0E23\u0E30\u0E1A\u0E27\u0E19\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15');
      addWorkflowRow(s15, [
        { label: 'STEP 1', title: '\u0E40\u0E1B\u0E34\u0E14 Work Order', desc: '\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E1C\u0E25\u0E34\u0E15' },
        { label: 'STEP 2', title: '\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E1A\u0E40\u0E1A\u0E34\u0E01', desc: 'Requisition' },
        { label: 'STEP 3', title: '\u0E0A\u0E31\u0E48\u0E07\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A', desc: 'Weighing' }
      ], 2.0);
      addWorkflowRow(s15, [
        { label: 'STEP 4', title: '\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A IPC', desc: 'In-Process Control' },
        { label: 'STEP 5', title: '\u0E1A\u0E23\u0E23\u0E08\u0E38', desc: 'Packaging' },
        { label: 'STEP 6', title: '\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E1C\u0E25\u0E1C\u0E25\u0E34\u0E15', desc: 'Output Record' }
      ], 3.6);

      // =========================================================
      // SLIDE 16: WORK ORDER
      // =========================================================
      var s16 = pptx.addSlide();
      addTopBar(s16);
      addSlideHeader(s16, 'MODULE 3 \u00B7 \u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E1C\u0E25\u0E34\u0E15', '16 / 28');
      addTitle(s16, '\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E1C\u0E25\u0E34\u0E15 (Work Order)');
      addParagraph(s16, 'Production \u2192 Work Orders \u2192 + \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E1C\u0E25\u0E34\u0E15', 0.5, 1.8, 6, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s16, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Production > Work Orders',
        '\u0E04\u0E25\u0E34\u0E01 "+ \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E1A\u0E2A\u0E31\u0E48\u0E07\u0E1C\u0E25\u0E34\u0E15\u0E43\u0E2B\u0E21\u0E48"',
        '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 (FG) \u0E41\u0E25\u0E30 BOM',
        '\u0E23\u0E30\u0E1A\u0E38\u0E08\u0E33\u0E19\u0E27\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15 (Batch Qty)',
        '\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E27\u0E31\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21-\u0E2A\u0E34\u0E49\u0E19\u0E2A\u0E38\u0E14',
        '\u0E01\u0E14 "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01" \u2192 \u0E2A\u0E16\u0E32\u0E19\u0E30 Planned',
        '\u0E01\u0E14 "Start" \u2192 \u0E2A\u0E16\u0E32\u0E19\u0E30 In Progress'
      ], 0.5, 2.2, 6);
      await addScreenshot(s16, 'screenshots/06-wo-list.png', 7.0, 2.0, 5.8, 2.5);
      await addScreenshot(s16, 'screenshots/10-wo-detail.png', 7.0, 4.7, 5.8, 2.5);

      // =========================================================
      // SLIDE 17: MATERIAL ISSUE
      // =========================================================
      var s17 = pptx.addSlide();
      addTopBar(s17);
      addSlideHeader(s17, 'MODULE 3 \u00B7 \u0E15\u0E31\u0E14\u0E08\u0E48\u0E32\u0E22\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A', '17 / 28');
      addTitle(s17, '\u0E01\u0E32\u0E23\u0E15\u0E31\u0E14\u0E08\u0E48\u0E32\u0E22\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A (Material Issue)');
      addParagraph(s17, 'Production \u2192 Work Orders \u2192 [WO] \u2192 Material Weighing', 0.5, 1.8, 12, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s17, [
        '\u0E40\u0E1B\u0E34\u0E14 Work Order \u0E17\u0E35\u0E48\u0E2A\u0E16\u0E32\u0E19\u0E30 "In Progress"',
        '\u0E44\u0E1B\u0E17\u0E35\u0E48\u0E41\u0E16\u0E1A "Material Weighing" (\u0E01\u0E32\u0E23\u0E0A\u0E31\u0E48\u0E07\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A)',
        '\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E2A\u0E14\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A\u0E08\u0E32\u0E01 BOM',
        '\u0E40\u0E25\u0E37\u0E2D\u0E01 Lot \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E43\u0E0A\u0E49 (\u0E40\u0E09\u0E1E\u0E32\u0E30 Released)',
        '\u0E01\u0E23\u0E2D\u0E01\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E17\u0E35\u0E48\u0E0A\u0E31\u0E48\u0E07\u0E08\u0E23\u0E34\u0E07',
        '\u0E1C\u0E39\u0E49\u0E0A\u0E31\u0E48\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 \u2192 \u0E1C\u0E39\u0E49\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A (Verifier) \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19',
        '\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E31\u0E14\u0E2A\u0E15\u0E47\u0E2D\u0E01\u0E08\u0E32\u0E01 Lot \u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34'
      ], 0.5, 2.2, 12);
      addInfoBox(s17, 'Dual Control', '\u0E1C\u0E39\u0E49\u0E0A\u0E31\u0E48\u0E07 (Operator) \u0E41\u0E25\u0E30\u0E1C\u0E39\u0E49\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A (Verifier) \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E04\u0E19\u0E25\u0E30\u0E04\u0E19', 0.5, 5.6, 5.8, 'warn');
      addInfoBox(s17, 'FEFO', '\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E31\u0E14\u0E08\u0E48\u0E32\u0E22\u0E15\u0E32\u0E21 FEFO \u2014 First Expired, First Out \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34', 6.8, 5.6, 5.8, 'info');

      // =========================================================
      // SLIDE 18: PRODUCTION LOG
      // =========================================================
      var s18 = pptx.addSlide();
      addTopBar(s18);
      addSlideHeader(s18, 'MODULE 3 \u00B7 \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15', '18 / 28');
      addTitle(s18, '\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15');
      addParagraph(s18, 'Production \u2192 Work Orders \u2192 [WO] \u2192 SOP Execution / IPC', 0.5, 1.8, 12, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s18, [
        '\u0E40\u0E1B\u0E34\u0E14 Work Order \u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1C\u0E25\u0E34\u0E15',
        '\u0E44\u0E1B\u0E17\u0E35\u0E48\u0E41\u0E16\u0E1A "SOP Execution" \u2014 \u0E17\u0E33\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2B\u0E21\u0E32\u0E22\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E17\u0E33\u0E40\u0E2A\u0E23\u0E47\u0E08',
        '\u0E44\u0E1B\u0E17\u0E35\u0E48\u0E41\u0E16\u0E1A "IPC" \u2014 \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E04\u0E48\u0E32\u0E15\u0E23\u0E27\u0E08\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E1C\u0E25\u0E34\u0E15',
        '\u0E44\u0E1B\u0E17\u0E35\u0E48\u0E41\u0E16\u0E1A "Environmental Monitoring" \u2014 \u0E14\u0E39\u0E2D\u0E38\u0E13\u0E2B\u0E20\u0E39\u0E21\u0E34/\u0E04\u0E27\u0E32\u0E21\u0E0A\u0E37\u0E49\u0E19',
        '\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E1B\u0E23\u0E34\u0E21\u0E32\u0E13\u0E1C\u0E25\u0E1C\u0E25\u0E34\u0E15 (Actual Output)',
        '\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22 (Waste/Reject) \u0E16\u0E49\u0E32\u0E21\u0E35'
      ], 0.5, 2.2, 12);
      addInfoBox(s18, 'IPC \u0E04\u0E37\u0E2D\u0E2D\u0E30\u0E44\u0E23?', 'IPC \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E04\u0E48\u0E32\u0E40\u0E0A\u0E48\u0E19 \u0E04\u0E27\u0E32\u0E21\u0E41\u0E02\u0E47\u0E07\u0E40\u0E21\u0E47\u0E14\u0E22\u0E32, \u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E40\u0E21\u0E47\u0E14, \u0E04\u0E27\u0E32\u0E21\u0E0A\u0E37\u0E49\u0E19 \u2014 \u0E40\u0E17\u0E35\u0E22\u0E1A\u0E01\u0E31\u0E1A Spec \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34', 0.5, 5.6, 12, 'info');

      // =========================================================
      // SLIDE 19: MODULE 4 SECTION DIVIDER
      // =========================================================
      var s19 = pptx.addSlide();
      addCoverGradient(s19);
      s19.addText('MODULE 04', {
        x: 1.2, y: 2.0, w: 5, h: 0.4,
        fontSize: 14, fontFace: FONT_MAIN, color: COLORS.white
      });
      s19.addText('\u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B', {
        x: 1.2, y: 2.6, w: 10, h: 1.2,
        fontSize: 48, fontFace: FONT_MAIN, color: COLORS.white, bold: true
      });
      s19.addText('Finished Goods Receipt & QC', {
        x: 1.2, y: 3.8, w: 10, h: 0.5,
        fontSize: 18, fontFace: FONT_MAIN, color: COLORS.white
      });
      s19.addShape('roundRect', {
        x: 1.2, y: 4.8, w: 6, h: 0.5,
        rectRadius: 0.25,
        fill: { type: 'solid', color: COLORS.white, alpha: 15 },
        line: { color: COLORS.white, width: 0.5, alpha: 25 }
      });
      s19.addText('2 \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D \u00B7 \u0E23\u0E31\u0E1A FG \u00B7 \u0E15\u0E23\u0E27\u0E08\u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E', {
        x: 1.4, y: 4.8, w: 5.6, h: 0.5,
        fontSize: 12, fontFace: FONT_MAIN, color: COLORS.white, valign: 'middle'
      });

      // =========================================================
      // SLIDE 20: FG RECEIPT FLOW
      // =========================================================
      var s20 = pptx.addSlide();
      addTopBar(s20);
      addSlideHeader(s20, 'MODULE 4 \u00B7 \u0E01\u0E23\u0E30\u0E1A\u0E27\u0E19\u0E01\u0E32\u0E23\u0E23\u0E31\u0E1A FG', '20 / 28');
      addTitle(s20, 'Flow: \u0E23\u0E31\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B');
      addWorkflowRow(s20, [
        { label: 'STEP 1', title: '\u0E1C\u0E25\u0E34\u0E15\u0E40\u0E2A\u0E23\u0E47\u0E08', desc: 'WO Completed' },
        { label: 'STEP 2', title: '\u0E23\u0E31\u0E1A FG \u0E40\u0E02\u0E49\u0E32\u0E04\u0E25\u0E31\u0E07', desc: 'Goods Receipt' },
        { label: 'STEP 3', title: '\u0E2A\u0E23\u0E49\u0E32\u0E07 Lot', desc: 'Quarantine' },
        { label: 'STEP 4', title: 'Final QC', desc: '\u0E15\u0E23\u0E27\u0E08\u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E' },
        { label: 'STEP 5', title: 'Release', desc: '\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E02\u0E32\u0E22' }
      ], 2.5);

      // =========================================================
      // SLIDE 21: FG RECEIPT
      // =========================================================
      var s21 = pptx.addSlide();
      addTopBar(s21);
      addSlideHeader(s21, 'MODULE 4 \u00B7 \u0E23\u0E31\u0E1A FG', '21 / 28');
      addTitle(s21, '\u0E23\u0E31\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E23\u0E39\u0E1B (FG Receipt)');
      addParagraph(s21, 'Inventory \u2192 Lots \u2192 + \u0E2A\u0E23\u0E49\u0E32\u0E07 Lot \u0E43\u0E2B\u0E21\u0E48', 0.5, 1.8, 6, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s21, [
        'Work Order \u0E1C\u0E25\u0E34\u0E15\u0E40\u0E2A\u0E23\u0E47\u0E08 \u2014 \u0E2A\u0E16\u0E32\u0E19\u0E30 "Completed"',
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Inventory > Lots',
        '\u0E2A\u0E23\u0E49\u0E32\u0E07 Lot \u0E43\u0E2B\u0E21\u0E48 \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A FG',
        '\u0E23\u0E30\u0E1A\u0E38: \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32, \u0E08\u0E33\u0E19\u0E27\u0E19\u0E17\u0E35\u0E48\u0E23\u0E31\u0E1A, \u0E04\u0E25\u0E31\u0E07\u0E1B\u0E25\u0E32\u0E22\u0E17\u0E32\u0E07',
        'Lot \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30 "Quarantine" \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34',
        '\u0E23\u0E2D Final QC \u0E01\u0E48\u0E2D\u0E19 Release'
      ], 0.5, 2.2, 6);
      await addScreenshot(s21, 'screenshots/07-lots-list.png', 7.0, 2.0, 5.8, 3.5);

      // =========================================================
      // SLIDE 22: FINAL QC
      // =========================================================
      var s22 = pptx.addSlide();
      addTopBar(s22);
      addSlideHeader(s22, 'MODULE 4 \u00B7 Final QC', '22 / 28');
      addTitle(s22, 'Final QC & Release');
      addParagraph(s22, 'Quality \u2192 Tests \u2192 + \u0E2A\u0E23\u0E49\u0E32\u0E07 QC Test \u2192 Release', 0.5, 1.8, 12, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s22, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Quality > Tests',
        '\u0E2A\u0E23\u0E49\u0E32\u0E07 QC Test \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A FG Lot',
        '\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E15\u0E32\u0E21 Specification (physical, chemical, micro)',
        '\u0E1C\u0E48\u0E32\u0E19 \u2192 \u0E01\u0E14 Release \u2192 Lot \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E02\u0E32\u0E22',
        '\u0E44\u0E21\u0E48\u0E1C\u0E48\u0E32\u0E19 \u2192 \u0E01\u0E14 Reject \u2192 \u0E41\u0E22\u0E01\u0E40\u0E01\u0E47\u0E1A/\u0E17\u0E33\u0E25\u0E32\u0E22'
      ], 0.5, 2.2, 12);
      addInfoBox(s22, '\u0E2A\u0E33\u0E04\u0E31\u0E0D', 'FG \u0E17\u0E35\u0E48 Release \u0E41\u0E25\u0E49\u0E27 \u0E08\u0E30\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E04\u0E25\u0E31\u0E07\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E02\u0E32\u0E22 (Available for Sale)', 0.5, 4.6, 12, 'info');

      // =========================================================
      // SLIDE 23: MODULE 5 SECTION DIVIDER
      // =========================================================
      var s23 = pptx.addSlide();
      addCoverGradient(s23);
      s23.addText('MODULE 05', {
        x: 1.2, y: 2.0, w: 5, h: 0.4,
        fontSize: 14, fontFace: FONT_MAIN, color: COLORS.white
      });
      s23.addText('\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22\u0E41\u0E25\u0E30\u0E2A\u0E48\u0E07\u0E2D\u0E2D\u0E01', {
        x: 1.2, y: 2.6, w: 10, h: 1.2,
        fontSize: 48, fontFace: FONT_MAIN, color: COLORS.white, bold: true
      });
      s23.addText('Sales & Reporting', {
        x: 1.2, y: 3.8, w: 10, h: 0.5,
        fontSize: 18, fontFace: FONT_MAIN, color: COLORS.white
      });
      s23.addShape('roundRect', {
        x: 1.2, y: 4.8, w: 8, h: 0.5,
        rectRadius: 0.25,
        fill: { type: 'solid', color: COLORS.white, alpha: 15 },
        line: { color: COLORS.white, width: 0.5, alpha: 25 }
      });
      s23.addText('3 \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D \u00B7 \u0E43\u0E1A\u0E01\u0E33\u0E01\u0E31\u0E1A\u0E20\u0E32\u0E29\u0E35 \u00B7 Stock Balance \u00B7 Production Report', {
        x: 1.4, y: 4.8, w: 7.6, h: 0.5,
        fontSize: 12, fontFace: FONT_MAIN, color: COLORS.white, valign: 'middle'
      });

      // =========================================================
      // SLIDE 24: SALES ORDER / INVOICE
      // =========================================================
      var s24 = pptx.addSlide();
      addTopBar(s24);
      addSlideHeader(s24, 'MODULE 5 \u00B7 \u0E43\u0E1A\u0E01\u0E33\u0E01\u0E31\u0E1A\u0E20\u0E32\u0E29\u0E35', '24 / 28');
      addTitle(s24, '\u0E43\u0E1A\u0E01\u0E33\u0E01\u0E31\u0E1A\u0E20\u0E32\u0E29\u0E35 / \u0E43\u0E1A\u0E2A\u0E48\u0E07\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32');
      addParagraph(s24, 'Sales \u2192 Orders \u2192 + \u0E2A\u0E23\u0E49\u0E32\u0E07 Order \u0E43\u0E2B\u0E21\u0E48', 0.5, 1.8, 6, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s24, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Sales > Orders',
        '\u0E04\u0E25\u0E34\u0E01 "+ \u0E2A\u0E23\u0E49\u0E32\u0E07 Order \u0E43\u0E2B\u0E21\u0E48"',
        '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32 (Customer)',
        '\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32: FG + \u0E08\u0E33\u0E19\u0E27\u0E19 + \u0E23\u0E32\u0E04\u0E32',
        '\u0E23\u0E30\u0E1A\u0E38\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E20\u0E32\u0E29\u0E35 / \u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14',
        '\u0E01\u0E14 "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"',
        '\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E43\u0E1A\u0E01\u0E33\u0E01\u0E31\u0E1A\u0E20\u0E32\u0E29\u0E35 / \u0E43\u0E1A\u0E2A\u0E48\u0E07\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32'
      ], 0.5, 2.2, 6);
      await addScreenshot(s24, 'screenshots/09-sales-orders.png', 7.0, 2.0, 5.8, 3.5);

      // =========================================================
      // SLIDE 25: STOCK BALANCE
      // =========================================================
      var s25 = pptx.addSlide();
      addTopBar(s25);
      addSlideHeader(s25, 'MODULE 5 \u00B7 Stock Balance', '25 / 28');
      addTitle(s25, 'Stock Balance (\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E2A\u0E15\u0E47\u0E2D\u0E01)');
      addParagraph(s25, 'Inventory \u2192 Lots (\u0E43\u0E0A\u0E49 Filter \u0E14\u0E39\u0E22\u0E2D\u0E14\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D)', 0.5, 1.8, 12, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s25, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Inventory > Lots',
        '\u0E43\u0E0A\u0E49 Filter: \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E04\u0E25\u0E31\u0E07, \u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32, \u0E2A\u0E16\u0E32\u0E19\u0E30',
        '\u0E14\u0E39\u0E22\u0E2D\u0E14\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E41\u0E22\u0E01\u0E15\u0E32\u0E21 Lot',
        '\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A: \u0E08\u0E33\u0E19\u0E27\u0E19\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D, \u0E27\u0E31\u0E19\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38, \u0E2A\u0E16\u0E32\u0E19\u0E30',
        'Export \u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E40\u0E1B\u0E47\u0E19 Excel (\u0E16\u0E49\u0E32\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23)'
      ], 0.5, 2.2, 12);
      addInfoBox(s25, '\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19', '\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E2A\u0E15\u0E47\u0E2D\u0E01\u0E15\u0E48\u0E33 \u0E2B\u0E23\u0E37\u0E2D \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E01\u0E25\u0E49\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38', 0.5, 4.6, 12, 'info');

      // =========================================================
      // SLIDE 26: PRODUCTION REPORT
      // =========================================================
      var s26 = pptx.addSlide();
      addTopBar(s26);
      addSlideHeader(s26, 'MODULE 5 \u00B7 Production Report', '26 / 28');
      addTitle(s26, 'Production Report (\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15)');
      addParagraph(s26, 'Production \u2192 Work Orders (\u0E14\u0E39\u0E2A\u0E23\u0E38\u0E1B\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21)', 0.5, 1.8, 6, { fontSize: 12, fontFace: FONT_MONO, color: COLORS.brand800 });
      addSteps(s26, [
        '\u0E40\u0E02\u0E49\u0E32\u0E40\u0E21\u0E19\u0E39 Production > Work Orders',
        '\u0E14\u0E39 KPI Cards: \u0E08\u0E33\u0E19\u0E27\u0E19 WO, \u0E2A\u0E16\u0E32\u0E19\u0E30, Yield',
        '\u0E14\u0E39 Chart: \u0E41\u0E19\u0E27\u0E42\u0E19\u0E49\u0E21\u0E01\u0E32\u0E23\u0E1C\u0E25\u0E34\u0E15, \u0E1B\u0E23\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E20\u0E32\u0E1E',
        '\u0E01\u0E23\u0E2D\u0E07\u0E15\u0E32\u0E21\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32 / \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 / \u0E2A\u0E16\u0E32\u0E19\u0E30',
        '\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C Variance (\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E48\u0E32\u0E07\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A)'
      ], 0.5, 2.2, 6);
      await addScreenshot(s26, 'screenshots/06-wo-list.png', 7.0, 2.0, 5.8, 3.5);

      // =========================================================
      // SLIDE 27: SUMMARY
      // =========================================================
      var s27 = pptx.addSlide();
      addTopBar(s27);
      addSlideHeader(s27, '\u0E2A\u0E23\u0E38\u0E1B', '27 / 28');
      addTitle(s27, '\u0E2A\u0E23\u0E38\u0E1B\u0E01\u0E23\u0E30\u0E1A\u0E27\u0E19\u0E01\u0E32\u0E23');

      var summaryItems = [
        '\u2705 \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19 (RM, PK, FG, BOM)',
        '\u2705 \u0E2A\u0E31\u0E48\u0E07\u0E0B\u0E37\u0E49\u0E2D + \u0E23\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E32\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A + QC',
        '\u2705 \u0E40\u0E1B\u0E34\u0E14 Work Order + \u0E0A\u0E31\u0E48\u0E07/\u0E15\u0E31\u0E14\u0E08\u0E48\u0E32\u0E22 + \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E1C\u0E25\u0E34\u0E15',
        '\u2705 \u0E23\u0E31\u0E1A FG \u0E40\u0E02\u0E49\u0E32\u0E04\u0E25\u0E31\u0E07 + Final QC + Release',
        '\u2705 \u0E02\u0E32\u0E22 + \u0E15\u0E34\u0E14\u0E15\u0E32\u0E21 Stock + Report'
      ];
      summaryItems.forEach(function (item, i) {
        s27.addText(item, {
          x: 0.8, y: 1.8 + i * 0.5, w: 11, h: 0.45,
          fontSize: 16, fontFace: FONT_MAIN, color: COLORS.ink700,
          valign: 'middle'
        });
      });

      // Contact card
      s27.addShape('roundRect', {
        x: 0.8, y: 4.6, w: 11.7, h: 1.2,
        rectRadius: 0.15,
        fill: { type: 'solid', color: COLORS.brand700 },
        shadow: { type: 'outer', blur: 5, offset: 3, color: '000000', opacity: 0.15 }
      });
      s27.addText('\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E2A\u0E2D\u0E1A\u0E16\u0E32\u0E21', {
        x: 1.2, y: 4.75, w: 11, h: 0.4,
        fontSize: 16, fontFace: FONT_MAIN, color: COLORS.white, bold: true
      });
      s27.addText('\u0E2B\u0E32\u0E01\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E2A\u0E07\u0E2A\u0E31\u0E22 \u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E1D\u0E48\u0E32\u0E22 IT \u0E2B\u0E23\u0E37\u0E2D System Admin', {
        x: 1.2, y: 5.15, w: 11, h: 0.4,
        fontSize: 14, fontFace: FONT_MAIN, color: COLORS.white
      });

      // =========================================================
      // SLIDE 28: THANK YOU
      // =========================================================
      var s28 = pptx.addSlide();
      addCoverGradient(s28);
      s28.addText('\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13', {
        x: 0, y: 2.0, w: '100%', h: 1.5,
        fontSize: 60, fontFace: FONT_MAIN, color: COLORS.white,
        bold: true, align: 'center'
      });
      s28.addText('Herbal Medicine ERP System', {
        x: 0, y: 3.5, w: '100%', h: 0.6,
        fontSize: 22, fontFace: FONT_MAIN, color: COLORS.white,
        align: 'center'
      });
      var thankTags = ['Master Data', 'Purchasing', 'Production', 'Quality', 'Sales'];
      var thankStartX = (13.333 - thankTags.length * 2.0) / 2;
      thankTags.forEach(function (tag, i) {
        s28.addShape('roundRect', {
          x: thankStartX + i * 2.0, y: 5.0, w: 1.8, h: 0.4,
          rectRadius: 0.2,
          fill: { type: 'solid', color: COLORS.white, alpha: 15 },
          line: { color: COLORS.white, width: 0.5, alpha: 30 }
        });
        s28.addText(tag, {
          x: thankStartX + i * 2.0, y: 5.0, w: 1.8, h: 0.4,
          fontSize: 11, fontFace: FONT_MAIN, color: COLORS.white,
          align: 'center', valign: 'middle'
        });
      });

      // =========================================================
      // SAVE
      // =========================================================
      await pptx.writeFile({ fileName: 'Herbal-Medicine-ERP-Training.pptx' });

      if (typeof showToast === 'function') {
        showToast('\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E1F\u0E25\u0E4C PowerPoint \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!', 'success');
      }
    } catch (err) {
      console.error('PPTX export error:', err);
      if (typeof showToast === 'function') {
        showToast('\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14: ' + (err.message || err), 'error');
      }
    } finally {
      if (btn) {
        btn.classList.remove('loading');
      }
    }
  };
})();
