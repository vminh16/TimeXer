// Two figure slides describing the solar data pipeline.
//   python solar/make_mock_data.py && python solar/docs/make_figure_data.py
//   cd solar/docs && npm install && node build_deck.js   -> solar_data_pipeline.pptx
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const JSZip = require("jszip");

const D = JSON.parse(fs.readFileSync(path.join(__dirname, "fig_data.json"), "utf8"));
const OUT = path.join(__dirname, process.argv[2] || "solar_data_pipeline.pptx");
const COL = {
  ink: "1B2433", slate: "4A5568", muted: "718096", grid: "E2E8F0", line: "CBD5E0", panel: "F4F6F9", white: "FFFFFF",
  sun: "E89B0C", sea: "2A9D8F", coral: "E76F51", grey: "9AA5B1", sea2: "5FB3A8", sea3: "8CC9C0", sea4: "3B7F76", sea5: "B5DDD7",
};
const FONT = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.theme = { headFontFace: "Cambria", bodyFontFace: FONT };
pres.title = "Luồng thu thập và xử lý dữ liệu điện mặt trời";
pres.defineSlideMaster({
  title: "FIGURE",
  background: { color: COL.white },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.4, y: 0.25, w: 9.2, h: 0.55, fontFace: "Cambria", fontSize: 26, bold: true, color: COL.ink, align: "left", valign: "top", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "caption", type: "body", x: 0.4, y: 4.95, w: 9.2, h: 0.5, fontSize: 11, color: COL.slate, align: "left", valign: "top", margin: 0 }, text: "" } },
  ],
});

// ------------------------------------------------------------------ helpers
const txt = (s, t, o) => s.addText(t, Object.assign({ isTextBox: true, margin: 0, fontSize: 11, color: COL.ink, valign: "top" }, o));
const box = (s, x, y, w, h, name, o = {}) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, Object.assign({ x, y, w, h, rectRadius: 0.08, fill: { color: COL.white }, line: { color: COL.line, width: 1 }, objectName: name }, o));
const arrow = (s, x1, y, x2, name, color = COL.slate) => s.addShape(pres.shapes.LINE, { x: x1, y, w: x2 - x1, h: 0, line: { color, width: 1.25, endArrowType: "triangle" }, objectName: name });
const badge = (s, n, x, y, col) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: 0.22, h: 0.22, fill: { color: col }, line: { type: "none" }, objectName: `Badge ${n}` });
  txt(s, String(n), { x, y, w: 0.22, h: 0.22, fontSize: 10, bold: true, color: COL.white, align: "center", valign: "middle", objectName: `Badge ${n} num` });
};
// sparkline: line/column chart with no axes, plot area pinned so overlays line up
function spark(s, type, series, x, y, w, h, colors, name, extra = {}) {
  const data = series.map((v, i) => ({ name: "s" + i, labels: v.map((_, j) => String(j + 1)), values: v }));
  s.addChart(type, data, Object.assign({
    x, y, w, h, objectName: name, chartColors: colors, showLegend: false, showTitle: false,
    catAxisHidden: true, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
    lineSize: 1, lineDataSymbol: "none", displayBlanksAs: "gap", layout: { x: 0.02, y: 0.04, w: 0.96, h: 0.92 },
  }, extra));
}
// panel chart: XY scatter with numeric x axis, titled axes, integer tick labels
const PLOT = { x: 0.12, y: 0.05, w: 0.85, h: 0.66 }; // plot area as a fraction of the chart frame
function panelChart(s, name, xs, ys, colors, o) {
  const data = [{ name: "x", values: xs }].concat(ys.map((v, i) => ({ name: "y" + i, values: v })));
  s.addChart(pres.charts.SCATTER, data, Object.assign({
    objectName: name, chartColors: colors, showLegend: false, showTitle: false, lineSize: 1.25, lineDataSymbol: "none",
    displayBlanksAs: "gap", layout: PLOT, valAxisLabelFormatCode: "0",
    showValAxisTitle: true, showCatAxisTitle: true,
    valAxisTitleFontSize: 9, catAxisTitleFontSize: 9, valAxisTitleColor: COL.slate, catAxisTitleColor: COL.slate,
    valAxisTitleFontFace: FONT, catAxisTitleFontFace: FONT, valAxisLabelFontFace: FONT, catAxisLabelFontFace: FONT,
    valAxisLabelFontSize: 9, catAxisLabelFontSize: 9, valAxisLabelColor: COL.slate, catAxisLabelColor: COL.slate,
    valGridLine: { color: COL.grid, size: 0.5 }, catGridLine: { style: "none" },
    valAxisLineShow: false, catAxisLineShow: true, catAxisLineColor: COL.line,
    valAxisCrossesAt: "min", catAxisCrossesAt: "min", // y axis at the left edge even when x < 0
  }, o));
}
// legend row drawn with shapes (right-aligned at xr)
function legend(s, items, xr, y, tag) {
  let x = xr;
  [...items].reverse().forEach(([label, color, dash], i) => {
    const tw = 0.062 * label.length + 0.04;
    x -= tw;
    txt(s, label, { x, y, w: tw, h: 0.2, fontSize: 9.5, color: COL.slate, valign: "middle", objectName: `${tag} legend text ${i}` });
    x -= 0.28;
    s.addShape(pres.shapes.LINE, { x, y: y + 0.1, w: 0.24, h: 0, line: { color, width: 2, dashType: dash || "solid" }, objectName: `${tag} legend line ${i}` });
    x -= 0.15;
  });
}

// pptxgenjs writes nulls as empty <c:v></c:v> in number caches, which PowerPoint rejects.
// Drop those points (a missing point is a blank, drawn as a gap), and dash the series named in DASHED.
const DASHED = { "Shift spark": [1], "Panel b chart": [1], "Panel c chart": [1] };
async function fixCharts(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const dashed = {};
  for (const sl of Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))) {
    const xml = await zip.file(sl).async("string");
    const rels = await zip.file(sl.replace("slides/", "slides/_rels/") + ".rels").async("string");
    for (const m of xml.matchAll(/<p:graphicFrame>[\s\S]*?name="([^"]+)"[\s\S]*?<c:chart r:id="(rId\d+)"/g)) {
      const t = rels.match(new RegExp('Id="' + m[2] + '"[^>]*Target="([^"]+)"'));
      if (DASHED[m[1]] && t) dashed["ppt/charts/" + t[1].split("/").pop()] = DASHED[m[1]];
    }
  }
  for (const f of Object.keys(zip.files).filter((f) => /^ppt\/charts\/chart\d+\.xml$/.test(f))) {
    let xml = await zip.file(f).async("string");
    xml = xml.replace(/<c:numCache>[\s\S]*?<\/c:numCache>/g, (nc) => nc.replace(/<c:pt idx="\d+"><c:v><\/c:v><\/c:pt>/g, ""));
    if (dashed[f]) {
      let k = 0;
      xml = xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => (dashed[f].includes(k++) ? ser.replace(/<a:prstDash val="solid"\/>/, '<a:prstDash val="dash"/>') : ser));
    }
    if (/<c:v><\/c:v>/.test(xml.replace(/<c:(str|multiLvlStr)Cache>[\s\S]*?<\/c:\1Cache>/g, ""))) throw new Error("empty number left in " + f);
    zip.file(f, xml);
  }
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

// ================================================================== SLIDE 1
function slide1() {
  const S = D.s1;
  const s = pres.addSlide({ masterName: "FIGURE" });
  s.addText("Luồng thu thập và xử lý dữ liệu", { placeholder: "title" });

  const X = [0.45, 2.4, 4.35, 6.3, 8.3], W = [1.6, 1.6, 1.6, 1.65, 1.25];
  const R1 = 1.35, R2 = 3.05, RH = 1.45;
  [["THU THẬP", 0.33, 1.84], ["XỬ LÝ", 2.28, 3.79], ["ĐẦU VÀO MÔ HÌNH", 6.18, 3.49]].forEach(([g, gx, gw]) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: gx, y: R1 - 0.12, w: gw, h: R2 + RH - R1 + 0.24, rectRadius: 0.1, fill: { color: COL.panel }, line: { color: COL.line, width: 0.75, dashType: "dash" }, objectName: `Group ${g}` });
    txt(s, g, { x: gx, y: R1 - 0.42, w: gw, h: 0.25, fontSize: 10, bold: true, color: COL.slate, align: "center", charSpacing: 2, objectName: `Group ${g} label` });
  });

  function block(name, col, row, head, cap, step, stepCol, draw) {
    const x = X[col], y = row, w = W[col];
    box(s, x, y, w, RH, `${name} block`);
    let hx = x + 0.1;
    if (step) { badge(s, step, x + 0.08, y + 0.08, stepCol); hx = x + 0.36; }
    txt(s, head, { x: hx, y: y + 0.08, w: x + w - hx - 0.05, h: 0.24, fontSize: 12, bold: true, valign: "middle", objectName: `${name} head` });
    draw(x + 0.08, y + 0.38, w - 0.16, 0.66);
    txt(s, cap, { x: x + 0.08, y: y + 1.07, w: w - 0.16, h: 0.33, fontSize: 9.5, color: COL.slate, objectName: `${name} caption` });
  }
  block("Inverter", 0, R1, "Inverter", "Công suất AC · 5 phút\n(có lỗi: trùng, spike, mất)", null, null,
    (x, y, w, h) => spark(s, pres.charts.LINE, [S.raw5], x, y, w, h, [COL.coral], "Inverter spark", { valAxisMinVal: 0, valAxisMaxVal: 6 }));
  block("Clean", 1, R1, "Làm sạch", "Bỏ trùng, ngoài ngưỡng,\nđứng giá · đêm = 0", 1, COL.coral,
    (x, y, w, h) => spark(s, pres.charts.LINE, [S.kept5], x, y, w, h, [COL.sun], "Clean spark", { valAxisMinVal: 0, valAxisMaxVal: 6 }));
  block("Resample", 2, R1, "Gộp 1 giờ", "5 phút → kWh/giờ\nlấp chỗ trống", 2, COL.sun,
    (x, y, w, h) => spark(s, pres.charts.BAR, [S.hourly3], x, y, w, h, [COL.sun], "Resample spark", { barDir: "col", barGapWidthPct: 30, valAxisMinVal: 0, valAxisMaxVal: 4.5 }));
  block("Weather", 0, R2, "Open-Meteo", "Thời tiết theo tọa độ\n1 giờ · API miễn phí", null, null,
    (x, y, w, h) => spark(s, pres.charts.LINE, [S.w.ghi, S.w.temp], x, y, w, h, [COL.sea, COL.grey], "Weather spark", { valAxisMinVal: 0, valAxisMaxVal: 1 }));
  block("Select", 1, R2, "Chọn biến", "Bức xạ, mây, nhiệt,\nẩm, gió", 3, COL.sea,
    (x, y, w, h) => spark(s, pres.charts.LINE, ["ghi", "cloud", "temp", "rh", "wind"].map((k, i) => S.w[k].map((v) => (v == null ? null : +(v * 0.75 + (4 - i)).toFixed(2)))), x, y, w, h,
      [COL.sea, COL.sea2, COL.sea3, COL.sea4, COL.sea5], "Select spark", { valAxisMinVal: 0, valAxisMaxVal: 4.8, lineSize: 0.75 }));
  block("Shift", 2, R2, "Dịch +24 giờ", "Thời tiết ngày mai đặt vào\nhàng hôm nay (= dự báo)", 4, COL.sea,
    (x, y, w, h) => spark(s, pres.charts.LINE, [S.ghi_orig, S.ghi_lead], x, y, w, h, [COL.grey, COL.sea], "Shift spark", { valAxisMinVal: 0, valAxisMaxVal: 1.05 }));

  { // merge + sliding window
    const x = X[3], w = W[3], y = R1, h = R2 + RH - R1;
    box(s, x, y, w, h, "Merge block");
    badge(s, 5, x + 0.08, y + 0.08, COL.ink);
    txt(s, "Ghép & cửa sổ", { x: x + 0.36, y: y + 0.08, w: w - 0.4, h: 0.24, fontSize: 12, bold: true, valign: "middle", objectName: "Merge head" });
    const cx = x + 0.08, cy = y + 0.45, cw = w - 0.16, ch = 1.95;
    spark(s, pres.charts.LINE, S.stack, cx, cy, cw, ch, [COL.sun, COL.sea, COL.sea2, COL.sea3, COL.sea4, COL.sea5], "Merge spark", { valAxisMinVal: 0, valAxisMaxVal: 6, lineSize: 0.75 });
    const px = cx + 0.02 * cw, pw = 0.96 * cw, py = cy + 0.04 * ch, ph = 0.92 * ch, t = px + pw * (168 / 192);
    s.addShape(pres.shapes.RECTANGLE, { x: px, y: py, w: t - px, h: ph, fill: { color: COL.slate, transparency: 88 }, line: { color: COL.slate, width: 0.75 }, objectName: "Lookback window" });
    s.addShape(pres.shapes.RECTANGLE, { x: t, y: py, w: px + pw - t, h: ph * (1.05 / 6), fill: { color: COL.sun, transparency: 75 }, line: { color: COL.sun, width: 1, dashType: "dash" }, objectName: "Target window" });
    txt(s, "168 giờ đầu vào", { x: px, y: cy + ch + 0.02, w: t - px, h: 0.2, fontSize: 9, color: COL.slate, align: "center", objectName: "Lookback label" });
    txt(s, "24h", { x: t - 0.05, y: cy + ch + 0.02, w: px + pw - t + 0.1, h: 0.2, fontSize: 9, bold: true, color: COL.sun, align: "center", objectName: "Target label" });
    txt(s, "PV + 5 biến thời tiết\nchia train/val/test 70/10/20", { x: x + 0.08, y: y + h - 0.42, w: w - 0.16, h: 0.36, fontSize: 9.5, color: COL.slate, objectName: "Merge caption" });
  }
  { // TimeXer
    const x = X[4], w = W[4], y = R1;
    box(s, x, y, w, R2 + RH - R1, "TimeXer block", { fill: { color: "FFF8EC" }, line: { color: COL.sun, width: 1 } });
    txt(s, "TimeXer", { x, y: y + 0.08, w, h: 0.26, fontSize: 13, bold: true, align: "center", objectName: "TimeXer head" });
    const sq = 0.17, g = 0.04, sx = x + (w - (5 * sq + 4 * g)) / 2;
    txt(s, "Nội sinh: patch", { x, y: y + 0.5, w, h: 0.2, fontSize: 9.5, color: COL.slate, align: "center", objectName: "Endo label" });
    for (let i = 0; i < 5; i++) s.addShape(pres.shapes.RECTANGLE, { x: sx + i * (sq + g), y: y + 0.75, w: sq, h: sq, fill: { color: i < 4 ? COL.sun : COL.ink }, line: { type: "none" }, objectName: `Patch token ${i}` });
    txt(s, "+ token toàn cục", { x, y: y + 0.96, w, h: 0.2, fontSize: 8.5, color: COL.slate, align: "center", objectName: "Global label" });
    txt(s, "Ngoại sinh: biến", { x, y: y + 1.3, w, h: 0.2, fontSize: 9.5, color: COL.slate, align: "center", objectName: "Exo label" });
    for (let i = 0; i < 5; i++) s.addShape(pres.shapes.RECTANGLE, { x: sx + i * (sq + g), y: y + 1.55, w: sq, h: sq, fill: { color: COL.sea }, line: { type: "none" }, objectName: `Variate token ${i}` });
    s.addShape(pres.shapes.LINE, { x: x + w / 2, y: y + 1.85, w: 0, h: 0.3, line: { color: COL.slate, width: 1.25, endArrowType: "triangle" }, objectName: "Model arrow" });
    txt(s, "Dự báo 24 giờ tới", { x, y: y + 2.2, w, h: 0.2, fontSize: 9.5, bold: true, align: "center", objectName: "Forecast label" });
    spark(s, pres.charts.LINE, [S.forecast], x + 0.12, y + 2.45, w - 0.24, 0.5, [COL.sun], "Forecast spark", { valAxisMinVal: 0, lineSize: 1.5 });
  }
  const m1 = R1 + RH / 2, m2 = R2 + RH / 2;
  [[0, m1], [1, m1], [2, m1], [0, m2], [1, m2], [2, m2]].forEach(([c, yy], i) => arrow(s, X[c] + W[c] + 0.03, yy, X[c + 1] - 0.03, `Arrow ${i}`));
  arrow(s, X[3] + W[3] + 0.03, (R1 + R2 + RH) / 2, X[4] - 0.03, "Arrow model");

  s.addText([
    { text: "Hình 1. ", options: { bold: true } },
    { text: "Luồng dữ liệu. Nhánh trên (cam): sản lượng PV từ inverter, là biến cần dự báo. Nhánh dưới (xanh): thời tiết, là biến hỗ trợ. Hai nhánh ghép theo giờ, cắt thành cửa sổ 168 giờ → 24 giờ cho TimeXer." },
  ], { placeholder: "caption" });
  s.addNotes("Dữ liệu mock (solar/mock): thời tiết TMY2 Miami kèm pvlib, PV mô phỏng 5 kWp, lỗi logger giả lập.");
}

// ================================================================== SLIDE 2
function slide2() {
  const s = pres.addSlide({ masterName: "FIGURE" });
  s.addText("Minh họa từng bước xử lý", { placeholder: "title" });
  const PX = [0.4, 5.1], PY = [0.95, 2.95], PW = 4.5, CH = 1.62;
  const head = (i, j, tag, title, items) => {
    txt(s, [{ text: tag + " ", options: { bold: true, color: COL.ink } }, { text: title, options: { bold: true } }], { x: PX[i], y: PY[j], w: 2.6, h: 0.24, fontSize: 12, valign: "middle", objectName: `Panel ${tag} title` });
    legend(s, items, PX[i] + PW, PY[j] + 0.02, `Panel ${tag}`);
  };
  // chart frame + data -> slide coordinates (plot area is pinned by PLOT)
  const frame = (i, j) => ({ x: PX[i], y: PY[j] + 0.28, w: PW, h: CH });
  const mapX = (f, v, x0, x1) => f.x + PLOT.x * f.w + ((v - x0) / (x1 - x0)) * PLOT.w * f.w;
  const mapY = (f, v, y0, y1) => f.y + PLOT.y * f.h + (1 - (v - y0) / (y1 - y0)) * PLOT.h * f.h;
  const note = (t, x, y, w, color, align = "center", name) => txt(s, t, { x, y, w, h: 0.2, fontSize: 9, bold: true, color, align, valign: "middle", objectName: name });

  // (a) cleaning --------------------------------------------------------
  {
    const f = frame(0, 0), A = D.a, ymax = 6;
    head(0, 0, "(a)", "Làm sạch log 5 phút", [["điểm bị loại", COL.coral], ["giữ lại", COL.sun]]);
    panelChart(s, "Panel a chart", A.x, [A.kept, A.removed], [COL.sun, COL.coral], Object.assign({}, f, {
      lineSize: 1, valAxisTitle: "Công suất (kW)", catAxisTitle: "Thời gian (ngày)",
      valAxisMinVal: 0, valAxisMaxVal: ymax, valAxisMajorUnit: 2, catAxisMinVal: 0, catAxisMaxVal: 3, catAxisMajorUnit: 1,
    }));
    const gi = A.kept.findIndex((v, k) => v === null && A.removed[k] === null && k > 288 && k < 576); // dropout on day 2
    const si = A.removed.findIndex((v) => v !== null && v > ymax);                  // spike
    note("mất tín hiệu", mapX(f, A.x[gi], 0, 3) - 0.5, mapY(f, 4.6, 0, ymax) - 0.1, 1.0, COL.coral, "center", "Gap note");
    s.addShape(pres.shapes.LINE, { x: mapX(f, A.x[gi], 0, 3), y: mapY(f, 4.3, 0, ymax), w: 0, h: mapY(f, 3.0, 0, ymax) - mapY(f, 4.3, 0, ymax), line: { color: COL.coral, width: 1, endArrowType: "triangle" }, objectName: "Gap arrow" });
    note(`spike ${A.removed[si].toFixed(1).replace(".", ",")} kW (vượt khung)`, mapX(f, A.x[si], 0, 3) - 1.85, mapY(f, 5.5, 0, ymax) - 0.1, 1.75, COL.coral, "right", "Spike note");
  }
  // (b) hourly + gap fill -----------------------------------------------
  {
    const f = frame(1, 0), B = D.b;
    head(1, 0, "(b)", "Gộp 1 giờ, lấp chỗ trống", [["đo được", COL.sun], ["ước lượng", COL.sea, "dash"]]);
    panelChart(s, "Panel b chart", B.x, [B.obs, B.fill], [COL.sun, COL.sea], Object.assign({}, f, {
      valAxisTitle: "Điện năng (kWh/giờ)", catAxisTitle: "Thời gian (ngày)",
      valAxisMinVal: 0, valAxisMaxVal: 5, valAxisMajorUnit: 1, catAxisMinVal: 0, catAxisMaxVal: 7, catAxisMajorUnit: 1,
    }));
    const idx = B.obs.map((v, k) => (v === null ? k : -1)).filter((k) => k >= 0);
    const x0 = mapX(f, B.x[idx[0]], 0, 7), x1 = mapX(f, B.x[idx[idx.length - 1]], 0, 7);
    s.addShape(pres.shapes.RECTANGLE, { x: x0, y: mapY(f, 5, 0, 5), w: x1 - x0, h: mapY(f, 0, 0, 5) - mapY(f, 5, 0, 5), fill: { color: COL.sea, transparency: 90 }, line: { type: "none" }, objectName: "Outage band" });
    note("inverter mất kết nối", (x0 + x1) / 2 - 0.8, mapY(f, 4.6, 0, 5) - 0.1, 1.6, COL.sea, "center", "Outage note");
  }
  // (c) +24 h lead ------------------------------------------------------
  {
    const f = frame(0, 1), Cc = D.c;
    head(0, 1, "(c)", "Dịch thời tiết +24 giờ", [["bức xạ gốc", COL.grey], ["sau khi dịch", COL.sea, "dash"]]);
    panelChart(s, "Panel c chart", Cc.x, [Cc.ghi, Cc.lead], [COL.grey, COL.sea], Object.assign({}, f, {
      valAxisTitle: "Bức xạ (W/m²)", catAxisTitle: "Thời gian (ngày)",
      valAxisMinVal: 0, valAxisMaxVal: 1200, valAxisMajorUnit: 400, catAxisMinVal: 0, catAxisMaxVal: 4, catAxisMajorUnit: 1,
    }));
    // cloudy day: original at day 2-3, shifted copy one day earlier
    const ya = mapY(f, 800, 0, 1200);
    s.addShape(pres.shapes.LINE, { x: mapX(f, 1.5, 0, 4), y: ya, w: mapX(f, 2.5, 0, 4) - mapX(f, 1.5, 0, 4), h: 0, line: { color: COL.sea, width: 1.25, beginArrowType: "triangle" }, objectName: "Shift arrow" });
    note("ngày mây hiện sớm 24 giờ", mapX(f, 1.7, 0, 4), mapY(f, 1100, 0, 1200) - 0.1, mapX(f, 3.2, 0, 4) - mapX(f, 1.7, 0, 4), COL.sea, "center", "Shift note");
  }
  // (d) sliding window --------------------------------------------------
  {
    const f = frame(1, 1), Dd = D.d, ymax = 5;
    head(1, 1, "(d)", "Một mẫu cho TimeXer", [["đầu vào", COL.slate], ["cần dự báo", COL.sun]]);
    const top = mapY(f, ymax, 0, ymax), bot = mapY(f, 0, 0, ymax), xa = mapX(f, -168, -168, 24), xt = mapX(f, 0, -168, 24), xb = mapX(f, 24, -168, 24);
    s.addShape(pres.shapes.RECTANGLE, { x: xa, y: top, w: xt - xa, h: bot - top, fill: { color: COL.slate, transparency: 90 }, line: { type: "none" }, objectName: "Input band" });
    s.addShape(pres.shapes.RECTANGLE, { x: xt, y: top, w: xb - xt, h: bot - top, fill: { color: COL.sun, transparency: 82 }, line: { type: "none" }, objectName: "Target band" });
    panelChart(s, "Panel d chart", Dd.x, [Dd.pv], [COL.sun], Object.assign({}, f, {
      valAxisTitle: "Điện năng (kWh/giờ)", catAxisTitle: "Giờ so với thời điểm dự báo t",
      valAxisMinVal: 0, valAxisMaxVal: ymax, valAxisMajorUnit: 1, catAxisMinVal: -168, catAxisMaxVal: 24, catAxisMajorUnit: 24,
    }));
    s.addShape(pres.shapes.LINE, { x: xt, y: top, w: 0, h: bot - top, line: { color: COL.ink, width: 1, dashType: "dash" }, objectName: "t line" });
    note("168 giờ đầu vào", xa, top + 0.03, xt - xa, COL.slate, "center", "Input note");
    note("24h", xt, top + 0.03, xb - xt, COL.sun, "center", "Target note");
  }

  s.addText([
    { text: "Hình 2. ", options: { bold: true } },
    { text: "(a) Lọc điểm lỗi trong log inverter. (b) Gộp theo giờ; khoảng trống dài được ước lượng từ bức xạ. (c) Cột thời tiết dời sớm 24 giờ, nên mỗi dòng chứa thời tiết của ngày mai. (d) Mỗi mẫu: 168 giờ đầu vào → 24 giờ cần dự báo. Dữ liệu mock." },
  ], { placeholder: "caption" });
}

(async () => {
  slide1();
  slide2();
  await pres.writeFile({ fileName: OUT });
  await fixCharts(OUT);
  console.log("wrote", OUT);
})();
