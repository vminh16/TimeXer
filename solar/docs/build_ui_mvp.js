// One-slide UI design for the MVP: three phone screens built from native shapes and charts.
//   cd solar/docs && npm install && node build_ui_mvp.js   -> ui_mvp.pptx
// Patterns follow existing monitoring / forecast apps (see the comparison on the slide);
// numbers come from the mock dataset (dataset/Solar/solar_demo.csv, solar/mock/weather_hourly.csv).
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const JSZip = require("jszip");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(__dirname, process.argv[2] || "ui_mvp.pptx");
// one accent (solar amber) + greys, as in inverter monitoring apps
const C = { text: "111827", sub: "6B7280", hair: "E5E7EB", fill: "F3F4F6", frame: "1F2937", white: "FFFFFF", accent: "F59E0B", accentDark: "B45309", fc: "9CA3AF" };
const FONT = "Arial";

// ------------------------------------------------------------- mock data
function readCsv(file) {
  const [head, ...rows] = fs.readFileSync(file, "utf8").trim().split("\n");
  const cols = head.split(",");
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [cols[i], i ? +v : v])));
}
const ds = readCsv(path.join(ROOT, "dataset/Solar/solar_demo.csv"));
const wx = readCsv(path.join(ROOT, "solar/mock/weather_hourly.csv"));
const hourly = (d) => ds.filter((r) => r.date.startsWith(d)).map((r) => r.OT);
const sum = (a) => a.reduce((s, v) => s + (v || 0), 0);
const vn = (x, d = 1) => x.toFixed(d).replace(".", ",");
const NOW_H = 13;
const today = hourly("2023-03-17"), tomorrow = hourly("2023-03-18");
const doneToday = sum(today.slice(0, NOW_H + 1)), restToday = sum(today.slice(NOW_H + 1));
const week = ["17", "18", "19", "20", "21", "22", "23"].map((d, i) => {
  const date = `2023-03-${d}`, rows = wx.filter((r) => r.time.startsWith(date) && r.ghi > 0);
  return { label: ["Hôm nay", "T7", "CN", "T2", "T3", "T4", "T5"][i], date: `${d}/03`, kwh: sum(hourly(date)), cloud: Math.round(sum(rows.map((r) => r.cloud)) / rows.length) };
});

// ------------------------------------------------------------- deck
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
pres.title = "UI MVP – dự báo điện mặt trời";
const s = pres.addSlide();
s.background = { color: C.white };
let uid = 0;
const T = (t, o) => s.addText(t, Object.assign({ isTextBox: true, margin: 0, fontFace: FONT, fontSize: 8, color: C.text, valign: "middle", objectName: `t${uid++}` }, o));
const R = (x, y, w, h, fill, o = {}) => s.addShape(pres.shapes.RECTANGLE, Object.assign({ x, y, w, h, fill: { color: fill }, line: { type: "none" }, objectName: `r${uid++}` }, o));
const RR = (x, y, w, h, r, fill, o = {}) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, Object.assign({ x, y, w, h, rectRadius: r, fill: { color: fill }, line: { type: "none" }, objectName: `rr${uid++}` }, o));
const hair = (x, y, w) => s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: C.hair, width: 0.75 }, objectName: `hair${uid++}` });

// phone shell with status bar and bottom tab bar
const PW = 1.95, PH = 4.12, PY = 0.82;
function phone(x, name, activeTab) {
  RR(x, PY, PW, PH, 0.22, C.white, { line: { color: C.frame, width: 2 }, objectName: `${name} frame` });
  RR(x + PW / 2 - 0.3, PY + 0.06, 0.6, 0.1, 0.05, C.frame, { objectName: `${name} notch` });
  T("13:05", { x: x + 0.18, y: PY + 0.05, w: 0.4, h: 0.12, fontSize: 7, bold: true });
  RR(x + PW - 0.36, PY + 0.08, 0.18, 0.08, 0.02, C.white, { line: { color: C.text, width: 0.75 } });
  if (activeTab != null) {
    hair(x + 0.05, PY + PH - 0.4, PW - 0.1);
    ["Tổng quan", "Dự báo", "Thiết bị", "Tôi"].forEach((t, i) => {
      const cx = x + 0.1 + i * ((PW - 0.2) / 4);
      s.addShape(pres.shapes.OVAL, { x: cx + (PW - 0.2) / 8 - 0.05, y: PY + PH - 0.34, w: 0.1, h: 0.1, fill: { color: i === activeTab ? C.accent : C.fc }, line: { type: "none" }, objectName: `${name} tab icon ${i}` });
      T(t, { x: cx, y: PY + PH - 0.22, w: (PW - 0.2) / 4, h: 0.12, fontSize: 6, align: "center", color: i === activeTab ? C.accentDark : C.sub, bold: i === activeTab });
    });
  }
}
const caption = (x, title, lines) => {
  T(title, { x, y: 0.5, w: PW, h: 0.22, fontSize: 11, bold: true, valign: "bottom" });
  T(lines, { x, y: PY + PH + 0.08, w: PW + 0.2, h: 0.55, fontSize: 7.5, color: C.sub, valign: "top" });
};

T("UI MVP – dự báo điện mặt trời cho chủ nhà", { x: 0.35, y: 0.12, w: 7, h: 0.3, fontSize: 16, bold: true });

// =============================================================== screen 1: home
{
  const x = 0.35, ix = x + 0.14, iw = PW - 0.28;
  phone(x, "Home", 0);
  T([{ text: "Nhà Q.7  ", options: { bold: true, fontSize: 10 } }, { text: "▾", options: { fontSize: 7, color: C.sub } }], { x: ix, y: PY + 0.26, w: 1.2, h: 0.2 });
  s.addShape(pres.shapes.OVAL, { x: x + PW - 0.32, y: PY + 0.28, w: 0.14, h: 0.14, fill: { color: C.white }, line: { color: C.text, width: 1 }, objectName: "Home bell" });
  s.addShape(pres.shapes.OVAL, { x: x + PW - 0.22, y: PY + 0.26, w: 0.06, h: 0.06, fill: { color: "DC2626" }, line: { type: "none" }, objectName: "Home bell dot" });
  T("Sản lượng hôm nay", { x: ix, y: PY + 0.58, w: iw, h: 0.13, fontSize: 7, color: C.sub });
  T([{ text: vn(doneToday), options: { fontSize: 24, bold: true } }, { text: " kWh", options: { fontSize: 10, color: C.sub } }], { x: ix, y: PY + 0.72, w: iw, h: 0.38, valign: "bottom" });
  T(`Đang phát ${vn(today[NOW_H])} kW`, { x: ix, y: PY + 1.13, w: iw, h: 0.13, fontSize: 7, color: C.sub });
  // segmented control
  RR(ix, PY + 1.36, iw, 0.2, 0.05, C.fill);
  ["Ngày", "Tuần", "Tháng", "Năm"].forEach((t, i) => {
    const sw = iw / 4, sx = ix + i * sw;
    if (i === 0) RR(sx + 0.02, PY + 1.38, sw - 0.04, 0.16, 0.04, C.white, { line: { color: C.hair, width: 0.5 } });
    T(t, { x: sx, y: PY + 1.36, w: sw, h: 0.2, fontSize: 6.5, align: "center", bold: i === 0, color: i === 0 ? C.text : C.sub });
  });
  T([{ text: "‹", options: { color: C.sub } }, { text: "        Hôm nay, 17/03        " }, { text: "›", options: { color: C.sub } }], { x: ix, y: PY + 1.62, w: iw, h: 0.16, fontSize: 7.5, align: "center", bold: true });
  // bars = measured, line = forecast (Home Assistant energy dashboard pattern)
  const hrs = Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? `${h}h` : ""));
  s.addChart([
    { type: pres.charts.BAR, data: [{ name: "Thực tế", labels: hrs, values: today.map((v, h) => (h <= NOW_H ? v : null)) }], options: { chartColors: [C.accent], barGapWidthPct: 25 } },
    { type: pres.charts.LINE, data: [{ name: "Dự báo", labels: hrs, values: today }], options: { chartColors: [C.fc], lineSize: 1.25, lineDataSymbol: "none" } },
  ], {
    x: ix - 0.04, y: PY + 1.8, w: iw + 0.06, h: 1.2, objectName: "Home chart", showLegend: false, showTitle: false,
    valAxisMinVal: 0, valAxisMaxVal: 4, valAxisMajorUnit: 2, valAxisLabelFormatCode: "0", catAxisLabelFrequency: 1,
    catAxisLabelFontSize: 6, valAxisLabelFontSize: 6, catAxisLabelColor: C.sub, valAxisLabelColor: C.sub, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
    valGridLine: { color: C.hair, size: 0.5 }, catGridLine: { style: "none" }, valAxisLineShow: false, catAxisLineColor: C.hair,
  });
  R(ix, PY + 3.03, 0.1, 0.06, C.accent); T("Đã phát", { x: ix + 0.13, y: PY + 2.99, w: 0.5, h: 0.14, fontSize: 6, color: C.sub });
  s.addShape(pres.shapes.LINE, { x: ix + 0.62, y: PY + 3.06, w: 0.14, h: 0, line: { color: C.fc, width: 1.25, dashType: "dash" }, objectName: "Home legend fc" });
  T("Dự báo", { x: ix + 0.8, y: PY + 2.99, w: 0.5, h: 0.14, fontSize: 6, color: C.sub });
  // list rows
  hair(ix, PY + 3.2, iw);
  T("Còn lại hôm nay (dự báo)", { x: ix, y: PY + 3.22, w: 1.2, h: 0.2, fontSize: 7 });
  T(`+${vn(restToday)} kWh`, { x: ix + 1.0, y: PY + 3.22, w: iw - 1.0, h: 0.2, fontSize: 7, bold: true, align: "right" });
  hair(ix, PY + 3.44, iw);
  T([{ text: "Ngày mai", options: { breakLine: true } }, { text: "nhiều mây", options: { fontSize: 6, color: C.sub } }], { x: ix, y: PY + 3.45, w: 1.0, h: 0.26, fontSize: 7 });
  T(`${vn(sum(tomorrow))} kWh  ›`, { x: ix + 0.9, y: PY + 3.45, w: iw - 0.9, h: 0.26, fontSize: 7, bold: true, align: "right" });
  caption(x, "1  Tổng quan", "Số lớn trên cùng (FusionSolar, Solarman). Cột = đã đo, đường = dự báo trên cùng một biểu đồ (Home Assistant Energy).");
}

// =============================================================== screen 2: 7-day forecast
{
  const x = 2.75, ix = x + 0.14, iw = PW - 0.28;
  phone(x, "Forecast", 1);
  T("Dự báo", { x: ix, y: PY + 0.26, w: iw, h: 0.22, fontSize: 12, bold: true });
  T("7 ngày tới · Nhà Q.7 · 5 kWp", { x: ix, y: PY + 0.48, w: iw, h: 0.13, fontSize: 6.5, color: C.sub });
  const max = Math.max(...week.map((d) => d.kwh)), RH = 0.27, y0 = PY + 0.7;
  week.forEach((d, i) => {
    const y = y0 + i * RH;
    hair(ix, y, iw);
    T([{ text: d.label, options: { bold: i === 0, breakLine: true } }, { text: d.date, options: { fontSize: 5.5, color: C.sub } }], { x: ix, y: y + 0.02, w: 0.45, h: RH - 0.04, fontSize: 7 });
    T(`mây ${d.cloud}%`, { x: ix + 0.45, y, w: 0.42, h: RH, fontSize: 6, color: C.sub });
    // range-bar style row (weather-app daily list)
    const bx = ix + 0.88, bw = 0.5;
    RR(bx, y + RH / 2 - 0.025, bw, 0.05, 0.025, C.fill);
    RR(bx, y + RH / 2 - 0.025, Math.max(0.05, bw * d.kwh / max), 0.05, 0.025, C.accent);
    T(vn(d.kwh), { x: ix + 1.4, y, w: iw - 1.4, h: RH, fontSize: 7.5, bold: true, align: "right" });
  });
  hair(ix, y0 + 7 * RH, iw);
  T("Ngày mai theo giờ (kWh)", { x: ix, y: y0 + 7 * RH + 0.06, w: iw, h: 0.14, fontSize: 7, bold: true });
  const hrs = Array.from({ length: 15 }, (_, i) => ((i + 5) % 3 === 0 ? `${i + 5}h` : ""));
  s.addChart(pres.charts.BAR, [{ name: "kWh", labels: hrs, values: tomorrow.slice(5, 20) }], {
    x: ix - 0.04, y: y0 + 7 * RH + 0.2, w: iw + 0.06, h: 0.7, objectName: "Forecast tomorrow chart", chartColors: [C.fc], barGapWidthPct: 25,
    showLegend: false, showTitle: false, valAxisMinVal: 0, valAxisMaxVal: 4, valAxisMajorUnit: 2, valAxisLabelFormatCode: "0", catAxisLabelFrequency: 1,
    catAxisLabelFontSize: 6, valAxisLabelFontSize: 6, catAxisLabelColor: C.sub, valAxisLabelColor: C.sub, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
    valGridLine: { color: C.hair, size: 0.5 }, catGridLine: { style: "none" }, valAxisLineShow: false, catAxisLineColor: C.hair,
  });
  T("Theo dự báo thời tiết, cập nhật mỗi giờ", { x: ix, y: PY + PH - 0.58, w: iw, h: 0.13, fontSize: 5.5, color: C.sub });
  caption(x, "2  Dự báo", "Danh sách theo ngày như app thời tiết (PV Solar Forecast, Forecast.Solar). Chạm một ngày để xem theo giờ.");
}

// =============================================================== screen 3: add system
{
  const x = 5.15, ix = x + 0.14, iw = PW - 0.28;
  phone(x, "Setup", null);
  T([{ text: "‹ ", options: { color: C.accentDark } }, { text: "Thêm hệ thống", options: { bold: true } }], { x: ix, y: PY + 0.26, w: iw, h: 0.2, fontSize: 9 });
  T("Bước 2/3", { x: ix, y: PY + 0.26, w: iw, h: 0.2, fontSize: 6.5, color: C.sub, align: "right" });
  const section = (y, t) => T(t, { x: ix, y, w: iw, h: 0.13, fontSize: 5.5, color: C.sub, bold: true, charSpacing: 1 });
  const row = (y, k, v, h = 0.22) => { hair(ix, y, iw); T(k, { x: ix, y, w: 1, h, fontSize: 7 }); T(v, { x: ix + 0.7, y, w: iw - 0.7, h, fontSize: 7, color: C.sub, align: "right" }); };
  section(PY + 0.56, "VỊ TRÍ");
  R(ix, PY + 0.7, iw, 0.5, C.fill, { objectName: "Map placeholder" });
  s.addShape(pres.shapes.OVAL, { x: ix + iw / 2 - 0.04, y: PY + 0.9, w: 0.08, h: 0.08, fill: { color: C.accent }, line: { color: C.white, width: 1 }, objectName: "Map pin" });
  row(PY + 1.2, "Địa chỉ", "Quận 7, TP.HCM ›");
  section(PY + 1.5, "TẤM PIN");
  row(PY + 1.64, "Công suất", "5,0 kWp");
  row(PY + 1.86, "Góc nghiêng", "10°");
  row(PY + 2.08, "Hướng", "Nam (180°) ›");
  hair(ix, PY + 2.3, iw);
  section(PY + 2.4, "LẤY SẢN LƯỢNG TỪ");
  ["Solarman", "FusionSolar", "Tải file CSV"].forEach((t, i) => {
    const y = PY + 2.54 + i * 0.22;
    hair(ix, y, iw);
    T(t, { x: ix, y, w: 1.2, h: 0.22, fontSize: 7 });
    s.addShape(pres.shapes.OVAL, { x: ix + iw - 0.13, y: y + 0.055, w: 0.11, h: 0.11, fill: { color: i === 0 ? C.accent : C.white }, line: { color: i === 0 ? C.accent : C.fc, width: 1 }, objectName: `Setup radio ${i}` });
  });
  hair(ix, PY + 3.2, iw);
  RR(ix, PY + PH - 0.5, iw, 0.26, 0.06, C.accent, { objectName: "Setup button" });
  T("Tiếp tục", { x: ix, y: PY + PH - 0.5, w: iw, h: 0.26, fontSize: 8, bold: true, color: C.white, align: "center" });
  caption(x, "3  Thêm hệ thống", "Khai báo vị trí, kWp, góc, hướng như Solcast. Lấy số đo từ tài khoản inverter có sẵn hoặc file CSV.");
}

// =============================================================== comparison with similar apps
{
  const x = 7.45, w = 2.25;
  T("So với app tương tự", { x, y: 0.5, w, h: 0.22, fontSize: 11, bold: true, valign: "bottom" });
  T("theo mô tả công khai của từng app", { x, y: 0.73, w, h: 0.14, fontSize: 7, color: C.sub });
  const head = { bold: true, color: C.sub, fontSize: 7 };
  const rows = [
    [{ text: "App", options: head }, { text: "Số đo thật", options: head }, { text: "Dự báo", options: head }],
    ["FusionSolar, Solarman", "Có", "Không thấy"],
    ["Enphase", "Có", "5 ngày, chỉ hệ Enphase"],
    ["Solcast, PV Solar Forecast", "Ước tính", "7–15 ngày"],
    ["Home Assistant + Forecast.Solar", "Có", "7 ngày, tự cài"],
    [{ text: "MVP này", options: { bold: true } }, { text: "Có, nhiều hãng", options: { bold: true } }, { text: "Theo giờ, 7 ngày", options: { bold: true } }],
  ].map((r) => r.map((c) => (typeof c === "string" ? { text: c } : c)));
  s.addTable(rows, {
    x, y: 0.95, w, colW: [0.95, 0.55, 0.75], fontFace: FONT, fontSize: 7, color: C.text, valign: "middle",
    border: [{ type: "none" }, { type: "none" }, { pt: 0.5, color: C.hair }, { type: "none" }], margin: [0.03, 0.03, 0.03, 0], rowH: 0.36, objectName: "Comparison table",
  });
  T("Điểm khác", { x, y: 3.25, w, h: 0.16, fontSize: 8.5, bold: true });
  T([
    { text: "Số đo inverter và dự báo trên cùng một biểu đồ, không cần tự cài như Home Assistant.", options: { bullet: { indent: 8 }, breakLine: true } },
    { text: "Không gắn với một hãng inverter.", options: { bullet: { indent: 8 }, breakLine: true } },
    { text: "Báo trước ngày nhiều mây; báo khi sản lượng thấp hơn dự báo.", options: { bullet: { indent: 8 } } },
  ], { x, y: 3.43, w, h: 1.0, fontSize: 7.5, color: C.text, valign: "top", paraSpaceAfter: 3 });
  T("Số liệu trên màn hình: dữ liệu mock.", { x, y: 4.62, w, h: 0.14, fontSize: 6.5, color: C.sub });
}

s.addNotes([
  "Nguồn tham khảo (mô tả công khai):",
  "Home Assistant Energy + Forecast.Solar – đường dự báo trên biểu đồ sản lượng: https://www.home-assistant.io/integrations/forecast_solar/",
  "FusionSolar – Plant overview (yield hôm nay, KPI trên cùng, cảnh báo): https://support.huawei.com/enterprise/en/doc/EDOC1100096889/dcc45511/plant-overview",
  "SOLARMAN Smart – real-time overview, sản lượng ngày: https://www.solarmanpv.com/solarman-smart-explained-intelligent-solar-monitoring-made-simple.html",
  "Enphase app – five-day production forecast: https://enphase.com/blog/homeowners/enphase-app-solar-monitoring",
  "PV Solar Forecast (iOS) – dự báo theo giờ 360 giờ, theo ngày 15 ngày: https://apps.apple.com/us/app/pv-solar-forecast/id1496274910",
  "Solcast – thêm rooftop site (vị trí, kWp, azimuth, tilt), estimated actuals: https://www.solarquotes.com.au/blog/solcast-update-2023/",
  "Nhận xét FusionSolar không dùng dự báo thời tiết (đánh giá người dùng): https://www.heavengreenenergy.com/blog/huawei-fusionsolar-design-review",
].join("\n"));

// pptxgenjs writes nulls as empty <c:v></c:v> in number caches, which PowerPoint rejects: drop them;
// and dash the "Dự báo" line on the home chart.
async function fixCharts(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  for (const f of Object.keys(zip.files).filter((f) => /^ppt\/charts\/chart\d+\.xml$/.test(f))) {
    let xml = await zip.file(f).async("string");
    xml = xml.replace(/<c:numCache>[\s\S]*?<\/c:numCache>/g, (nc) => nc.replace(/<c:pt idx="\d+"><c:v><\/c:v><\/c:pt>/g, ""));
    xml = xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => (/<c:v>Dự báo<\/c:v>/.test(ser) ? ser.replace(/<a:prstDash val="solid"\/>/, '<a:prstDash val="dash"/>') : ser));
    zip.file(f, xml);
  }
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await fixCharts(OUT);
  console.log("wrote", OUT);
})();
