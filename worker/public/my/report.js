// The PDF report of My Dash: the same A4 template as the app's PDF; charts show one dot per day, the day's average (android/.../Report.kt), page by page,
// with the same measures in points (1/72 inch). Drawn as SVG pages that only exist when printing:
// "PDF" in the dashboard opens the browser's "Save as PDF" with these full A4 pages and nothing else.
// If the layout changes in the app, change it here too.
(function () {
  "use strict";
  const IT = (navigator.language || "en").toLowerCase().startsWith("it");
  const LOCALE = IT ? "it-CH" : "en-GB";
  const TZ = "Europe/Zurich";
  const W = {
    it: {
      title: "Pressione arteriosa", range: (a, b, n) => `dal ${a} al ${b} · ${n} giorni`, count: (n, d) => `${n} misure in ${d} giorni · ora svizzera`,
      generated: (d) => `Generato il ${d}`, all: "Andamento del periodo", allSub: "media di ogni giorno",
      chartNote: "Nei grafici ogni punto è la media di tutte le misure di quel giorno (un aggregato). Le singole misure sono nell'elenco.",
      units: "SYS e DIA in mmHg", unitsPul: "battiti al minuto", morning: "Mattina", morningSub: "prima delle 12 · media del giorno",
      evening: "Sera", eveningSub: "dalle 17 · media del giorno", pulse: "Battiti (PUL)", pulseSub: "media di ogni giorno",
      values: "Valori del periodo", valuesSub: "il più alto, il più basso e la media, con giorno e ora",
      hi: (k) => `${k} più alta`, lo: (k) => `${k} più bassa`, avg: (k) => `${k} media`, avgOf: (n) => `media di ${n} misure`,
      none: "Nessuna misura in questo momento della giornata", list: "Elenco delle misure",
      cols: ["Data", "Ora", "Momento", "SYS", "DIA", "PUL", "Fonte"], per: { morning: "Mattina", afternoon: "Pomeriggio", evening: "Sera" },
      src: { photo: "Foto", voice: "Voce" }, empty: "Nessuna misura in questo periodo.",
      note: "Misure a domicilio. Fonte di ogni valore: foto del display del misuratore, letta dall'app, oppure detto a voce (colonna Fonte).",
      disclaimer: "Documento preparato dal paziente, senza valutazioni sui valori. La valutazione clinica spetta al medico.",
      page: (a, b) => `Pagina ${a} di ${b}`,
    },
    en: {
      title: "Blood pressure", range: (a, b, n) => `${a} to ${b} · ${n} days`, count: (n, d) => `${n} readings on ${d} days · Swiss time`,
      generated: (d) => `Generated on ${d}`, all: "The whole period", allSub: "average of each day",
      chartNote: "In the charts each dot is the average of all the readings of that day (an aggregate). The single readings are in the list.",
      units: "SYS and DIA in mmHg", unitsPul: "beats per minute", morning: "Morning", morningSub: "before 12:00 · daily average",
      evening: "Evening", eveningSub: "from 17:00 · daily average", pulse: "Pulse (PUL)", pulseSub: "average of each day",
      values: "Values of the period", valuesSub: "the highest, the lowest and the average, with day and time",
      hi: (k) => `${k} highest`, lo: (k) => `${k} lowest`, avg: (k) => `${k} average`, avgOf: (n) => `average of ${n} readings`,
      none: "No readings at this time of day", list: "All readings",
      cols: ["Date", "Time", "Time of day", "SYS", "DIA", "PUL", "Source"], per: { morning: "Morning", afternoon: "Afternoon", evening: "Evening" },
      src: { photo: "Photo", voice: "Voice" }, empty: "No readings in this period.",
      note: "Home readings. Source of each value: photo of the monitor display, read by the app, or said aloud (see the Source column).",
      disclaimer: "Document prepared by the patient, with no assessment of the values. Clinical evaluation is up to the doctor.",
      page: (a, b) => `Page ${a} of ${b}`,
    },
  }[IT ? "it" : "en"];

  // print colours, as in the app's PDF
  const SYS = "#D63B45", DIA = "#2B86C0", PUL = "#D9900F";
  const SYS_T = "#B02733", DIA_T = "#1F6A9A", PUL_T = "#A86A00";
  const INK = "#13223F", MUTED = "#5B6B88", RULE = "#D9E0EA", PANEL = "#F7F9FC";
  const FONT = "Roboto, 'Helvetica Neue', Arial, sans-serif";

  const fShort = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: "numeric", month: "short" });
  const fLong = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
  const fDay = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
  const fTime = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const fParts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" });
  const dayOf = (ms) => fDay.format(ms), timeOf = (ms) => fTime.format(ms);
  // the Swiss calendar day of a moment, as a UTC midnight (so days can be counted)
  function midnight(ms) { const p = {}; for (const x of fParts.formatToParts(ms)) p[x.type] = x.value; return Date.UTC(+p.year, +p.month - 1, +p.day); }

  const NS = "http://www.w3.org/2000/svg";
  function el(parent, name, attrs, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    parent.appendChild(e);
    return e;
  }
  let measureCtx;
  function tw(s, size, bold) {
    measureCtx = measureCtx || document.createElement("canvas").getContext("2d");
    measureCtx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
    return measureCtx.measureText(String(s)).width;
  }
  const txt = (g, x, y, s, size, fill = INK, o = {}) =>
    el(g, "text", { x, y, "font-size": size, fill, "font-family": FONT, "font-weight": o.bold ? 700 : 400, "text-anchor": o.anchor || "start", ...(o.spacing ? { "letter-spacing": o.spacing } : {}) }, s);

  function dot(g, x, y, c) { el(g, "circle", { cx: x, cy: y, r: 2.3, fill: c, stroke: "#fff", "stroke-width": 0.8 }); }

  /** Same chart as pdfChart() in the app: every reading at its day and hour, grid every 5, numbers beside the dots. */
  function chart(g, x0, y0, w, h, list, lines, title, sub, units, startDay, days) {
    txt(g, x0, y0, title, 11.5, INK, { bold: true });
    txt(g, x0 + w, y0, sub, 8, MUTED, { anchor: "end" });
    let lx = x0; const ly = y0 + 14;
    for (const l of lines) {
      el(g, "rect", { x: lx, y: ly - 6, width: 10, height: 2.2, fill: l.c });
      dot(g, lx + 5, ly - 4.9, l.c);
      txt(g, lx + 14, ly - 2, l.name, 8, INK, { bold: true });
      lx += 14 + tw(l.name, 8, true) + 14;
    }
    txt(g, x0 + w, ly - 2, units, 7, MUTED, { anchor: "end" });
    const top = y0 + 24, left = x0 + 26, right = x0 + w - 8, pt = top + 4, pb = y0 + h - 22;
    el(g, "rect", { x: x0, y: top, width: w, height: y0 + h - top, rx: 4, fill: PANEL });
    const vals = list.flatMap((r) => lines.map((l) => r[l.k]).filter((v) => v != null));
    if (!vals.length) { txt(g, x0 + w / 2, (top + pb) / 2, W.none, 9, MUTED, { anchor: "middle" }); return; }
    const lo = Math.floor((Math.min(...vals) - 6) / 10) * 10, hi = Math.floor((Math.max(...vals) + 6 + 9) / 10) * 10;
    const Y = (v) => pb - (v - lo) / (hi - lo) * (pb - pt);
    const t0 = startDay, span = days * 864e5;
    // position in the Swiss day: the reading's wall-clock time counted from the first day's midnight
    const X = (ms) => { const md = midnight(ms); const wall = md + ((ms - md) % 864e5 + 864e5) % 864e5; return left + (wall - t0) / span * (right - left); };
    for (let v = lo; v <= hi; v += 5) {
      const major = v % 10 === 0;
      el(g, "line", { x1: left, x2: right, y1: Y(v), y2: Y(v), stroke: major ? "#DCE3EC" : "#ECF0F5", "stroke-width": major ? 0.7 : 0.5 });
      if (major) txt(g, left - 4, Y(v) + 2.6, v, 7, MUTED, { anchor: "end" });
    }
    const slot = (right - left) / days, every = Math.max(1, Math.ceil(12 / slot));
    for (let d = 0; d <= days; d++) {
      const xx = left + d * slot;
      el(g, "line", { x1: xx, x2: xx, y1: pt, y2: pb, stroke: "#EEF2F6", "stroke-width": 0.5 });
      if (d < days) {
        const day = new Date(t0 + d * 864e5);
        if (d % every === 0) txt(g, xx + slot / 2, pb + 9, day.getUTCDate(), 6.8, MUTED, { anchor: "middle" });
      }
    }
    const all = lines.map((l) => list.filter((r) => r[l.k] != null).map((r) => ({ x: X(r.t), y: Y(r[l.k]), v: r[l.k], l })));
    for (const pts of [...all].reverse()) {
      if (pts.length > 1) el(g, "polyline", { points: pts.map((p) => `${p.x},${p.y}`).join(" "), fill: "none", stroke: pts[0].l.c, "stroke-width": 1.1, "stroke-opacity": 0.85, "stroke-linejoin": "round" });
      for (const p of pts) dot(g, p.x, p.y, p.l.c);
    }
    // the numbers, where they hit no other number or dot; highest and lowest of each line first
    const fs = 6.2, taken = all.flat().map((p) => [p.x - 2.6, p.y - 2.6, p.x + 2.6, p.y + 2.6]);
    const hit = (r) => taken.some((t) => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]);
    const order = all.flatMap((pts) => { const mx = Math.max(...pts.map((p) => p.v)), mn = Math.min(...pts.map((p) => p.v)); return pts.map((p) => [p, p.v === mx || p.v === mn ? 0 : 1]); })
      .sort((a, b) => a[1] - b[1]).map((a) => a[0]);
    for (const p of order) {
      const half = tw(p.v, fs, true) / 2 + 0.8, prefUp = p.l.k !== "dia";
      for (const up of [prefUp, !prefUp]) {
        const by = up ? p.y - 3.8 : p.y + 8.6;
        const r = [p.x - half, by - fs * 0.78, p.x + half, by + 0.8];
        if (r[1] < pt - 2 || r[3] > pb + 1 || hit(r)) continue;
        taken.push(r); txt(g, p.x, by, p.v, fs, p.l.t, { anchor: "middle", bold: true }); break;
      }
    }
  }

  /** One point per day: the average of that day's readings, placed at midday so it sits in the middle of its day. */
  function dailyMeans(list) {
    const by = new Map();
    for (const r of list) { const d = midnight(r.t); if (!by.has(d)) by.set(d, []); by.get(d).push(r); }
    const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
    return [...by.keys()].sort((a, b) => a - b).map((d) => {
      const l = by.get(d);
      return { t: d + 12 * 3600e3, sys: avg(l.map((r) => r.sys)), dia: avg(l.map((r) => r.dia)), pul: avg(l.map((r) => r.pul).filter((v) => v != null)) };
    });
  }

  /** Builds the A4 pages into `box` (emptied first). data = { from, to, items: [{t, period, sys, dia, pul, source}] } */
  function render(box, data) {
    box.innerHTML = "";
    const list = [...data.items].sort((a, b) => a.t - b.t);
    const days = Math.max(1, Math.round((midnight(data.to) - midnight(data.from)) / 864e5) + 1);
    const startDay = midnight(data.to) - (days - 1) * 864e5;
    const range = W.range(fShort.format(startDay + 12 * 3600e3), fLong.format(data.to), days);
    const sysL = { k: "sys", name: "SYS", c: SYS, t: SYS_T }, diaL = { k: "dia", name: "DIA", c: DIA, t: DIA_T }, pulL = { k: "pul", name: "PUL", c: PUL, t: PUL_T };
    const rowsPerPage = 40;
    const total = 3 + Math.max(1, Math.ceil(list.length / rowsPerPage));
    let pageNo = 0;
    const left = 40, right = 555, cw = right - left;
    function page() {
      const div = document.createElement("div"); div.className = "a4";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 595 842"); svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      div.appendChild(svg); box.appendChild(div); pageNo++;
      return svg;
    }
    function footer(g) {
      el(g, "line", { x1: left, x2: right, y1: 806, y2: 806, stroke: RULE, "stroke-width": 0.8 });
      txt(g, left, 818, W.note, 6.5, MUTED);
      txt(g, left, 829, W.disclaimer, 6.5, MUTED);
      txt(g, right, 829, W.page(pageNo, total), 7, MUTED, { anchor: "end" });
    }
    function smallHeader(g) {
      el(g, "rect", { x: 0, y: 0, width: 595, height: 40, fill: "#0F1C36" });
      el(g, "rect", { x: 0, y: 40, width: 595, height: 2, fill: SYS });
      txt(g, left, 25, W.title, 10, "#fff", { bold: true });
      txt(g, right, 25, range, 8, "#AFC0DC", { anchor: "end" });
    }

    // ---------- page 1 ----------
    let g = page();
    const defs = el(g, "defs", {});
    const lg = el(defs, "linearGradient", { id: "hg", x1: 0, x2: 1, y1: 0, y2: 1 });
    el(lg, "stop", { offset: 0, "stop-color": "#0F1C36" }); el(lg, "stop", { offset: 1, "stop-color": "#1F3D72" });
    el(g, "rect", { x: 0, y: 0, width: 595, height: 112, fill: "url(#hg)" });
    el(g, "path", { d: "M300 70 H400 l6 -8 6 8 h8 l5 -26 6 44 5 -18 h14 l6 -6 6 6 H595", fill: "none", stroke: "#fff", "stroke-opacity": 0.1, "stroke-width": 1.6 });
    el(g, "rect", { x: 0, y: 112, width: 595, height: 3, fill: SYS });
    txt(g, left, 30, "HINT · HEALTHYINSTANTTRACKER", 8, "#AFC0DC", { bold: true, spacing: 1.6 });
    txt(g, right, 30, W.generated(dayOf(Date.now())), 8, "#AFC0DC", { anchor: "end" });
    txt(g, left, 62, W.title, 24, "#fff", { bold: true });
    txt(g, left, 82, range, 10.5, "#DCE5F3");
    txt(g, left, 98, W.count(list.length, new Set(list.map((r) => dayOf(r.t))).size), 8, "#AFC0DC");
    txt(g, left, 130, W.chartNote, 7.5, MUTED);
    chart(g, left, 146, cw, 300, dailyMeans(list), [sysL, diaL], W.all, W.allSub, W.units, startDay, days);

    let y = 486;
    txt(g, left, y, W.values, 11.5, INK, { bold: true });
    txt(g, right, y, W.valuesSub, 8, MUTED, { anchor: "end" });
    y += 10;
    const gap = 10, bw = (cw - 2 * gap) / 3, bh = 58;
    for (let row = 0; row < 3; row++) {
      [sysL, diaL, pulL].forEach((l, i) => {
        const x = left + i * (bw + gap);
        const withV = list.filter((r) => r[l.k] != null);
        let label, value = "–", sub = "";
        if (row < 2) {
          label = row === 0 ? W.hi(l.name) : W.lo(l.name);
          if (withV.length) {
            const r = withV.reduce((a, b) => (row === 0 ? (b[l.k] > a[l.k] ? b : a) : (b[l.k] < a[l.k] ? b : a)));
            value = String(r[l.k]); sub = `${dayOf(r.t)} · ${timeOf(r.t)}` + (l === pulL ? "" : `  ·  ${r.sys}/${r.dia}`);
          }
        } else {
          label = W.avg(l.name);
          if (withV.length) value = String(Math.round(withV.reduce((a, r) => a + r[l.k], 0) / withV.length));
          sub = W.avgOf(withV.length);
        }
        el(g, "rect", { x, y, width: bw, height: bh, rx: 4, fill: PANEL });
        el(g, "rect", { x, y, width: 3, height: bh, fill: l.c });
        txt(g, x + 12, y + 15, label.toUpperCase(), 7.5, MUTED, { bold: true, spacing: 0.4 });
        txt(g, x + 12, y + 38, value, 20, INK, { bold: true });
        txt(g, x + 12 + tw(value, 20, true) + 4, y + 38, l === pulL ? "bpm" : "mmHg", 7.5, MUTED);
        txt(g, x + 12, y + 50, sub, 7.2, MUTED);
      });
      y += bh + gap;
    }
    footer(g);

    // ---------- page 2: morning and evening ----------
    g = page(); smallHeader(g);
    chart(g, left, 74, cw, 330, dailyMeans(list.filter((r) => r.period === "morning")), [sysL, diaL], W.morning, W.morningSub, W.units, startDay, days);
    chart(g, left, 440, cw, 330, dailyMeans(list.filter((r) => r.period === "evening")), [sysL, diaL], W.evening, W.eveningSub, W.units, startDay, days);
    footer(g);

    // ---------- page 3: pulse ----------
    g = page(); smallHeader(g);
    chart(g, left, 74, cw, 330, dailyMeans(list), [pulL], W.pulse, W.pulseSub, W.unitsPul, startDay, days);
    footer(g);

    // ---------- every reading ----------
    const cols = [left, 110, 160, 265, 335, 405, 470];
    const colCol = [INK, INK, INK, SYS_T, DIA_T, PUL_T, INK];
    let i = 0;
    do {
      g = page(); smallHeader(g);
      txt(g, left, 74, W.list, 11.5, INK, { bold: true });
      y = 84;
      el(g, "rect", { x: left, y, width: cw, height: 18, fill: "#0F1C36" });
      W.cols.forEach((h, k) => txt(g, cols[k] + 5, y + 12.5, h, 9, "#fff", { bold: true }));
      y += 18;
      let row = 0, lastDay = null;
      if (!list.length) txt(g, left, y + 16, W.empty, 9.5);
      while (i < list.length && row < rowsPerPage) {
        const r = list[i], d = dayOf(r.t);
        if (row % 2 === 1) el(g, "rect", { x: left, y, width: cw, height: 17, fill: "#F6F8FB" });
        if (lastDay != null && d !== lastDay) el(g, "line", { x1: left, x2: right, y1: y, y2: y, stroke: "#9FB0C8", "stroke-width": 0.8 });
        const cells = [d !== lastDay ? d : "", timeOf(r.t), W.per[r.period] || r.period, r.sys, r.dia, r.pul ?? "–", W.src[r.source] || r.source];
        cells.forEach((v, k) => txt(g, cols[k] + 5, y + 12, v, 9.5, colCol[k], { bold: k >= 3 && k <= 5 }));
        lastDay = d; y += 17; i++; row++;
      }
      footer(g);
    } while (i < list.length);
  }

  window.HintReport = { render };
})();
