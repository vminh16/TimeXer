// One-slide wireframe of the MVP web dashboard, built from native shapes and charts.
//   cd solar/docs && npm install && node build_ui_mvp.js   -> ui_mvp.pptx
// Numbers come from the mock dataset (dataset/Solar/solar_demo.csv, solar/mock/weather_hourly.csv).
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const JSZip = require("jszip");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(__dirname, process.argv[2] || "ui_mvp.pptx");
const COL = {
  ink: "1B2433", ink2: "2D3748", slate: "4A5568", muted: "718096", grid: "E2E8F0", line: "CBD5E0", bg: "F8FAFC", white: "FFFFFF",
  sun: "E89B0C", sunBg: "FDF3DC", sea: "2A9D8F", seaBg: "E6F4F2", seaLight: "9FD3CC", coral: "E76F51", coralBg: "FCE9E4", ok: "38A169",
};
const FONT = "Calibri";

// ------------------------------------------------------------- mock data
function readCsv(file) {
  const [head, ...rows] = fs.readFileSync(file, "utf8").trim().split("\n");
  const cols = head.split(",");
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [cols[i], i ? +v : v])));
}
const ds = readCsv(path.join(ROOT, "dataset/Solar/solar_demo.csv"));
const wx = readCsv(path.join(ROOT, "solar/mock/weather_hourly.csv"));
const day = (rows, key, d) => rows.filter((r) => r[key].startsWith(d));
const DAYS = ["2023-03-15", "2023-03-16", "2023-03-17", "2023-03-18", "2023-03-19", "2023-03-20"];
const NOW_DAY = 2, NOW_H = 13; // "now" = 17/03 13:00
const pv = DAYS.flatMap((d) => day(ds, "date", d).map((r) => r.OT));
const nowIdx = NOW_DAY * 24 + NOW_H;
const actual = pv.map((v, i) => (i <= nowIdx ? v : null));
const p50 = pv.map((v, i) => (i >= nowIdx ? v : null));                 // mock forecast = future mock values
const p10 = p50.map((v) => (v == null ? null : +(v * 0.72).toFixed(3)));
const p90 = p50.map((v) => (v == null ? null : +Math.min(v * 1.18, 4.6).toFixed(3)));
const sum = (a) => a.reduce((s, v) => s + (v || 0), 0);
const todayRows = pv.slice(48, 72), tomorrow = pv.slice(72, 96);
const doneToday = sum(todayRows.slice(0, NOW_H + 1)), fcToday = sum(todayRows), fcTomorrow = sum(tomorrow);
const LAST7 = ["2023-03-11", "2023-03-12", "2023-03-13", "2023-03-14", "2023-03-15", "2023-03-16", "2023-03-17"];
const avg7 = sum(LAST7.map((d) => sum(day(ds, "date", d).map((r) => r.OT)))) / 7;
const cloudTomorrow = day(wx, "time", "2023-03-18").map((r) => r.cloud);
const nowWx = wx.find((r) => r.time.startsWith("2023-03-17 13:00"));
const vn = (x, d = 1) => x.toFixed(d).replace(".", ",");

// ------------------------------------------------------------- deck
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
pres.title = "Thiết kế UI – MVP dự báo điện mặt trời";
const s = pres.addSlide();
s.background = { color: COL.white };

const txt = (t, o) => s.addText(t, Object.assign({ isTextBox: true, margin: 0, fontFace: FONT, fontSize: 10, color: COL.ink, valign: "top" }, o));
const rect = (x, y, w, h, fill, name, o = {}) => s.addShape(pres.shapes.RECTANGLE, Object.assign({ x, y, w, h, fill: { color: fill }, line: { type: "none" }, objectName: name }, o));
const card = (x, y, w, h, name, o = {}) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, Object.assign({ x, y, w, h, rectRadius: 0.06, fill: { color: COL.white }, line: { color: COL.grid, width: 0.75 }, objectName: name }, o));
const badge = (n, x, y, name) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: 0.2, h: 0.2, fill: { color: COL.coral }, line: { color: COL.white, width: 1 }, objectName: `Ref badge ${n} ${name}` });
  txt(String(n), { x, y, w: 0.2, h: 0.2, fontSize: 9, bold: true, color: COL.white, align: "center", valign: "middle", objectName: `Ref badge ${n} num ${name}` });
};
const legendItem = (x, y, label, color, dash, name) => {
  s.addShape(pres.shapes.LINE, { x, y: y + 0.08, w: 0.2, h: 0, line: { color, width: 2, dashType: dash || "solid" }, objectName: `${name} line` });
  txt(label, { x: x + 0.24, y, w: 0.06 * label.length + 0.1, h: 0.16, fontSize: 8, color: COL.slate, valign: "middle", objectName: `${name} text` });
};

// title
txt("Thiết kế UI – MVP dự báo điện mặt trời", { x: 0.3, y: 0.15, w: 7, h: 0.35, fontSize: 20, bold: true, objectName: "Slide title" });
txt("Wireframe dashboard web. Mỗi khối dựng lại từ một mẫu tham khảo (số đỏ ↔ cột bên phải). Số liệu: dữ liệu mock.", { x: 0.3, y: 0.48, w: 7.0, h: 0.2, fontSize: 9, color: COL.muted, objectName: "Slide subtitle" });

// ---------------- browser frame
const FX = 0.3, FY = 0.75, FW = 6.95, FH = 4.7;
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: FX, y: FY, w: FW, h: FH, rectRadius: 0.08, fill: { color: COL.bg }, line: { color: COL.line, width: 1 }, objectName: "Browser frame" });
rect(FX + 0.02, FY + 0.02, FW - 0.04, 0.2, COL.grid, "Browser bar");
["E76F51", "E9C46A", "38A169"].forEach((c, i) => s.addShape(pres.shapes.OVAL, { x: FX + 0.1 + i * 0.13, y: FY + 0.07, w: 0.09, h: 0.09, fill: { color: c }, line: { type: "none" }, objectName: `Browser dot ${i}` }));
txt("app.solarcast.vn/tong-quan", { x: FX + 0.6, y: FY + 0.04, w: 3, h: 0.16, fontSize: 8, color: COL.muted, valign: "middle", objectName: "Browser url" });

// ---------------- sidebar  (ref 1)
const SX = FX + 0.02, SY = FY + 0.22, SW = 1.15, SH = FH - 0.24;
rect(SX, SY, SW, SH, COL.ink, "Sidebar");
txt([{ text: "Solar", options: { color: COL.white } }, { text: "Cast", options: { color: COL.sun } }], { x: SX + 0.15, y: SY + 0.12, w: 1, h: 0.25, fontSize: 13, bold: true, objectName: "Logo" });
["Tổng quan", "Dự báo", "Lịch sử", "Cảnh báo", "Hệ thống"].forEach((n, i) => {
  const y = SY + 0.5 + i * 0.32;
  if (i === 0) s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: SX + 0.08, y: y - 0.04, w: SW - 0.16, h: 0.26, rectRadius: 0.05, fill: { color: COL.sun }, line: { type: "none" }, objectName: "Nav active" });
  txt(n, { x: SX + 0.18, y, w: SW - 0.3, h: 0.18, fontSize: 10, bold: i === 0, color: i === 0 ? COL.ink : "CBD5E0", valign: "middle", objectName: `Nav ${n}` });
});
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: SX + 0.08, y: SY + SH - 1.0, w: SW - 0.16, h: 0.9, rectRadius: 0.05, fill: { color: COL.ink2 }, line: { type: "none" }, objectName: "System card" });
txt([
  { text: "Hệ thống của bạn", options: { bold: true, color: COL.white, breakLine: true } },
  { text: "5 kWp · 10° · Nam", options: { color: "CBD5E0", breakLine: true } },
  { text: "TP.HCM", options: { color: "CBD5E0", breakLine: true } },
  { text: "Kết nối inverter ›", options: { color: COL.sun, bold: true } },
], { x: SX + 0.15, y: SY + SH - 0.93, w: SW - 0.25, h: 0.8, fontSize: 8, paraSpaceAfter: 2, objectName: "System card text" });
badge(1, SX + SW - 0.14, SY + 0.08, "sidebar");
badge(6, SX + SW - 0.14, SY + SH - 1.06, "system");

// ---------------- main area
const MX = SX + SW + 0.12, MW = FX + FW - 0.12 - MX;
// header (ref 2)
txt([{ text: "Nhà mẫu · 5 kWp", options: { bold: true, fontSize: 13, breakLine: true } }, { text: "Thứ Sáu 17/03 · 13:00 · cập nhật 5 phút trước", options: { fontSize: 8, color: COL.muted } }],
  { x: MX, y: SY + 0.08, w: 2.6, h: 0.4, objectName: "Header site" });
const pill = (x, w, fill, color, t, name) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: SY + 0.12, w, h: 0.26, rectRadius: 0.13, fill: { color: fill }, line: { type: "none" }, objectName: `${name} pill` });
  txt(t, { x, y: SY + 0.12, w, h: 0.26, fontSize: 9, bold: true, color, align: "center", valign: "middle", objectName: `${name} text` });
};
pill(MX + MW - 2.55, 1.25, "E6F6EC", COL.ok, `Đang phát ${vn(actual[nowIdx])} kW`, "Status");
pill(MX + MW - 1.2, 1.2, COL.seaBg, COL.sea, `${vn(nowWx.temp, 0)}°C · mây ${nowWx.cloud}%`, "Weather");
badge(2, MX + MW - 2.65, SY + 0.04, "header");

// KPI cards (ref 3)
const KY = SY + 0.55, KH = 0.66, KG = 0.1, KW = (MW - 3 * KG) / 4;
const kpis = [
  ["Đã phát hôm nay", `${vn(doneToday)} kWh`, "tính đến 13:00", COL.ink],
  ["Dự báo cả ngày", `${vn(fcToday)} kWh`, `P10–P90: ${vn(fcToday * 0.8, 0)}–${vn(fcToday * 1.08, 0)} kWh`, COL.sea],
  ["Ngày mai 18/03", `${vn(fcTomorrow)} kWh`, `${vn((fcTomorrow / avg7 - 1) * 100, 0)}% so với TB 7 ngày`, COL.coral],
  ["Sai số 7 ngày (MAE)", "0,21 kWh", "trung bình mỗi giờ", COL.ink],
];
kpis.forEach(([l, v, sub, c], i) => {
  const x = MX + i * (KW + KG);
  card(x, KY, KW, KH, `KPI ${i} card`);
  txt(l, { x: x + 0.1, y: KY + 0.07, w: KW - 0.15, h: 0.16, fontSize: 8, color: COL.muted, objectName: `KPI ${i} label` });
  txt(v, { x: x + 0.1, y: KY + 0.23, w: KW - 0.15, h: 0.24, fontSize: 15, bold: true, color: c, objectName: `KPI ${i} value` });
  txt(sub, { x: x + 0.1, y: KY + 0.48, w: KW - 0.12, h: 0.14, fontSize: 7.5, color: i === 2 ? COL.coral : COL.muted, objectName: `KPI ${i} sub` });
});
badge(3, MX - 0.08, KY - 0.08, "kpi");

// main chart: history vs forecast with "now" line and P10-P90 (ref 4)
const CY = KY + KH + 0.1, CHh = 1.72;
card(MX, CY, MW, CHh, "Chart card");
txt("Sản lượng theo giờ: 3 ngày qua & 3 ngày tới", { x: MX + 0.12, y: CY + 0.08, w: 3, h: 0.18, fontSize: 10, bold: true, objectName: "Chart title" });
legendItem(MX + MW - 2.75, CY + 0.08, "Thực tế", COL.sun, null, "Legend actual");
legendItem(MX + MW - 1.95, CY + 0.08, "Dự báo P50", COL.sea, "dash", "Legend p50");
legendItem(MX + MW - 0.98, CY + 0.08, "P10–P90", COL.seaLight, null, "Legend band");
const PL = { x: 0.07, y: 0.06, w: 0.91, h: 0.76 };
const cf = { x: MX + 0.05, y: CY + 0.3, w: MW - 0.1, h: CHh - 0.38 };
const xs = pv.map((_, i) => +(i / 24).toFixed(4));
s.addChart(pres.charts.SCATTER, [{ name: "x", values: xs }, { name: "P90", values: p90 }, { name: "P10", values: p10 }, { name: "Thực tế", values: actual }, { name: "P50", values: p50 }], Object.assign({}, cf, {
  objectName: "Forecast chart", chartColors: [COL.seaLight, COL.seaLight, COL.sun, COL.sea], lineSize: 1.25, lineDataSymbol: "none",
  showLegend: false, showTitle: false, layout: PL, displayBlanksAs: "gap",
  catAxisMinVal: 0, catAxisMaxVal: 6, catAxisMajorUnit: 1, catAxisHidden: true,
  valAxisMinVal: 0, valAxisMaxVal: 5, valAxisMajorUnit: 1, valAxisLabelFormatCode: "0", valAxisLabelFontSize: 8, valAxisLabelColor: COL.muted, valAxisLabelFontFace: FONT,
  showValAxisTitle: true, valAxisTitle: "kWh", valAxisTitleFontSize: 8, valAxisTitleColor: COL.muted, valAxisTitleFontFace: FONT,
  valGridLine: { color: COL.grid, size: 0.5 }, catGridLine: { style: "none" }, valAxisLineShow: false, catAxisLineShow: true, catAxisLineColor: COL.line,
}));
const px = (d) => cf.x + PL.x * cf.w + (d / 6) * PL.w * cf.w;
const pyTop = cf.y + PL.y * cf.h, pyBot = cf.y + (PL.y + PL.h) * cf.h;
["15/03", "16/03", "17/03 (hôm nay)", "18/03", "19/03", "20/03"].forEach((l, i) =>
  txt(l, { x: px(i), y: pyBot + 0.03, w: px(1) - px(0), h: 0.15, fontSize: 8, color: i === 2 ? COL.ink : COL.muted, bold: i === 2, align: "center", objectName: `Day label ${i}` }));
const xNow = px(nowIdx / 24);
s.addShape(pres.shapes.LINE, { x: xNow, y: pyTop, w: 0, h: pyBot - pyTop, line: { color: COL.ink, width: 1, dashType: "sysDot" }, objectName: "Now line" });
txt("Bây giờ", { x: xNow + 0.04, y: pyTop, w: 0.5, h: 0.14, fontSize: 7.5, bold: true, color: COL.ink, objectName: "Now label" });
badge(4, MX - 0.08, CY - 0.08, "chart");

// bottom-left: tomorrow by hour (ref 5)
const BY = CY + CHh + 0.1, BH = FY + FH - 0.1 - BY, BW1 = 3.05, BW2 = MW - BW1 - 0.1;
card(MX, BY, BW1, BH, "Tomorrow card");
txt([{ text: "Ngày mai 18/03 theo giờ  ", options: { bold: true } }, { text: "mây 90–100% từ 9h", options: { color: COL.coral, fontSize: 8 } }], { x: MX + 0.12, y: BY + 0.07, w: BW1 - 0.2, h: 0.18, fontSize: 10, objectName: "Tomorrow title" });
const hrs = Array.from({ length: 24 }, (_, h) => String(h));
s.addChart(pres.charts.BAR, [{ name: "kWh", labels: hrs.slice(5, 20), values: tomorrow.slice(5, 20) }], {
  x: MX + 0.05, y: BY + 0.27, w: BW1 - 0.1, h: BH - 0.5, objectName: "Tomorrow chart", barDir: "col", layout: { x: 0.1, y: 0.05, w: 0.88, h: 0.7 }, chartColors: [COL.sea], barGapWidthPct: 35,
  showLegend: false, showTitle: false, valAxisMinVal: 0, valAxisMaxVal: 4, valAxisMajorUnit: 2, valAxisLabelFormatCode: "0",
  catAxisLabelFontSize: 7.5, valAxisLabelFontSize: 7.5, catAxisLabelColor: COL.muted, valAxisLabelColor: COL.muted, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
  valGridLine: { color: COL.grid, size: 0.5 }, catGridLine: { style: "none" }, valAxisLineShow: false, catAxisLineColor: COL.line,
});
// cloud strip under the bars, one cell per hour 5..19
const cx0 = MX + 0.05 + 0.1 * (BW1 - 0.1), cw = (BW1 - 0.1) * 0.88 / 15;
cloudTomorrow.slice(5, 20).forEach((c, i) => rect(cx0 + i * cw + 0.005, BY + BH - 0.2, cw - 0.01, 0.1, COL.slate, `Cloud cell ${i}`, { fill: { color: COL.slate, transparency: 100 - c * 0.8 } }));
txt("mây", { x: MX + 0.08, y: BY + BH - 0.22, w: 0.3, h: 0.14, fontSize: 7, color: COL.muted, objectName: "Cloud label" });
badge(5, MX - 0.08, BY - 0.08, "tomorrow");

// bottom-right: alerts & tips (ref 6 -> numbered 7 to keep 6 for system card)
const AX = MX + BW1 + 0.1;
card(AX, BY, BW2, BH, "Alerts card");
txt("Cảnh báo & gợi ý", { x: AX + 0.12, y: BY + 0.07, w: BW2 - 0.2, h: 0.18, fontSize: 10, bold: true, objectName: "Alerts title" });
const alerts = [
  [COL.coralBg, COL.coral, "Ngày mai nhiều mây", `Dự báo ${vn(fcTomorrow, 0)} kWh, thấp hơn TB 7 ngày ${vn((1 - fcTomorrow / avg7) * 100, 0)}%`],
  [COL.sunBg, COL.sun, "Thấp hơn dự báo 15%", "10–12h hôm qua · kiểm tra bụi, bóng che"],
  [COL.seaBg, COL.sea, "Gợi ý dùng điện", "Chạy máy giặt, bơm nước 11–13h hôm nay"],
];
const ah = (BH - 0.33) / 3;
alerts.forEach(([bg, c, h, d], i) => {
  const y = BY + 0.29 + i * ah;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: AX + 0.08, y, w: BW2 - 0.16, h: ah - 0.05, rectRadius: 0.04, fill: { color: bg }, line: { type: "none" }, objectName: `Alert ${i} bg` });
  s.addShape(pres.shapes.OVAL, { x: AX + 0.15, y: y + (ah - 0.05) / 2 - 0.045, w: 0.09, h: 0.09, fill: { color: c }, line: { type: "none" }, objectName: `Alert ${i} dot` });
  txt([{ text: h, options: { bold: true, breakLine: true } }, { text: d, options: { color: COL.slate, fontSize: 7.5 } }], { x: AX + 0.3, y: y + 0.03, w: BW2 - 0.42, h: ah - 0.1, fontSize: 8.5, valign: "middle", objectName: `Alert ${i} text` });
});
badge(7, AX - 0.08, BY - 0.08, "alerts");

// ---------------- reference column
const RX = 7.45, RW = 2.3;
txt("Tham khảo", { x: RX, y: 0.75, w: RW, h: 0.22, fontSize: 12, bold: true, objectName: "Refs title" });
const refs = [
  [1, "Thanh điều hướng trái", "Solentra – Solar SaaS Dashboard (Figma)", "https://www.figma.com/community/file/1633736467361773655/solar-energy-saas-dashboard-solentra", "dashboard 1 trang, sidebar"],
  [2, "Trạng thái + thời tiết", "Enphase app – tab Status", "https://support.enphase.com/s/article/how-to-monitor-energy-data-in-the-enphase-app", "thời tiết, trạng thái ở đầu trang"],
  [3, "Thẻ KPI", "Huawei FusionSolar – Plant overview", "https://support.huawei.com/enterprise/en/doc/EDOC1100096889/dcc45511/plant-overview", "yield hôm nay/tháng, KPI ở trên"],
  [4, "Biểu đồ quá khứ / dự báo", "Solcast – rooftop site", "https://www.solarquotes.com.au/blog/solcast-update-2023/", "vạch 'bây giờ', dải P10–P90"],
  [5, "Dự báo theo giờ", "pv-forecast-card (Home Assistant)", "https://github.com/dropqube/pv-forecast-card", "thẻ dự báo kiểu thẻ thời tiết"],
  [6, "Khai báo hệ thống", "Solcast – thêm rooftop site", "https://www.solarquotes.com.au/blog/solcast-update-2023/", "vị trí, kWp, góc nghiêng, hướng"],
  [7, "Cảnh báo màu", "mySolarEdge + FusionSolar alarms", "https://www.solaredge.com/us/products/software-tools/mysolaredge", "cảnh báo mã màu theo mức độ"],
];
const rh = 0.64;
refs.forEach(([n, block, src, url, idea], i) => {
  const y = 1.02 + i * rh;
  badge(n, RX, y + 0.01, `ref list`);
  txt([
    { text: block, options: { bold: true, breakLine: true } },
    { text: src, options: { color: COL.sea, hyperlink: { url, tooltip: url }, breakLine: true } },
    { text: idea, options: { color: COL.muted } },
  ], { x: RX + 0.28, y, w: RW - 0.28, h: rh - 0.06, fontSize: 8.5, objectName: `Ref ${n} text` });
});

s.addNotes([
  "MVP: dashboard web 1 trang cho chủ hệ điện mặt trời áp mái. Các khối và nguồn tham khảo:",
  ...refs.map(([n, b, src, url, idea]) => `${n}. ${b} – ${src} (${idea}): ${url}`),
  "Khác: Soola – Solar Monitoring App UI kit (Figma) https://www.figma.com/community/file/1351099676254002625 cho phiên bản mobile sau MVP.",
  "Số liệu trên wireframe lấy từ bộ dữ liệu mock; dự báo P50 là giá trị mock tương lai, P10/P90 = 0,72× / 1,18× P50.",
].join("\n"));

// pptxgenjs writes nulls as empty <c:v></c:v> in number caches, which PowerPoint rejects: drop them (gap)
async function fixCharts(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  for (const f of Object.keys(zip.files).filter((f) => /^ppt\/charts\/chart\d+\.xml$/.test(f))) {
    let xml = await zip.file(f).async("string");
    xml = xml.replace(/<c:numCache>[\s\S]*?<\/c:numCache>/g, (nc) => nc.replace(/<c:pt idx="\d+"><c:v><\/c:v><\/c:pt>/g, ""));
    // P50 forecast dashed (4th y series)
    let k = 0;
    xml = xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => (k++ === 3 ? ser.replace(/<a:prstDash val="solid"\/>/, '<a:prstDash val="dash"/>') : ser));
    zip.file(f, xml);
  }
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await fixCharts(OUT);
  console.log("wrote", OUT);
})();
