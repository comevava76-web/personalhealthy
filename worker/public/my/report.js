// The PDF report of My Dash: the same A4 template as the app's PDF; charts show one dot per day, the day's average (android/.../Report.kt), page by page,
// with the same measures in points (1/72 inch). Drawn as SVG pages that only exist when printing:
// "PDF" in the dashboard opens the browser's "Save as PDF" with these full A4 pages and nothing else.
// If the layout changes in the app, change it here too.
(function () {
  "use strict";
  // the report speaks the browser's language: Italian, German, French, otherwise English
  const L2 = (navigator.language || "en").slice(0, 2).toLowerCase();
  const LG = ["it", "de", "fr"].includes(L2) ? L2 : "en";
  const LOCALE = { it: "it-CH", de: "de-CH", fr: "fr-CH", en: "en-GB" }[LG];
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
      cols: ["Data", "Ora", "AM/PM", "SYS", "DIA", "PUL", "Fonte"], per: { morning: "Mattina", afternoon: "Pomeriggio", evening: "Sera" },
      src: { photo: "Foto", voice: "Voce" }, empty: "Nessuna misura in questo periodo.",
      note: "Misure a domicilio. Fonte di ogni valore: foto del display del misuratore, letta dall'app, oppure detto a voce (colonna Fonte).",
      disclaimer: "Documento preparato dal paziente, senza valutazioni sui valori. La valutazione clinica spetta al medico.",
      page: (a, b) => `Pagina ${a} di ${b}`,
      balT: "Mattina e sera a confronto", balSub: "media di tutte le misure del periodo · solo un calcolo, nessuna valutazione",
      balM: "Mattina", balE: "Sera", balN: (n) => (n === 1 ? "1 misura" : `${n} misure`),
      balSame: "Mattina e sera hanno la stessa media.", balDiff: (s, d) => `Sera - mattina: SYS ${s} · DIA ${d} mmHg`,
      balNone: "Servono misure sia al mattino sia alla sera.",
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
      cols: ["Date", "Time", "AM/PM", "SYS", "DIA", "PUL", "Source"], per: { morning: "Morning", afternoon: "Afternoon", evening: "Evening" },
      src: { photo: "Photo", voice: "Voice" }, empty: "No readings in this period.",
      note: "Home readings. Source of each value: photo of the monitor display, read by the app, or said aloud (see the Source column).",
      disclaimer: "Document prepared by the patient, with no assessment of the values. Clinical evaluation is up to the doctor.",
      page: (a, b) => `Page ${a} of ${b}`,
      balT: "Morning and evening compared", balSub: "average of all the readings of the period · just arithmetic, no assessment",
      balM: "Morning", balE: "Evening", balN: (n) => (n === 1 ? "1 reading" : `${n} readings`),
      balSame: "Morning and evening have the same average.", balDiff: (s, d) => `Evening - morning: SYS ${s} · DIA ${d} mmHg`,
      balNone: "Readings are needed both in the morning and in the evening.",
    },
    de: {
      title: "Blutdruck", range: (a, b, n) => `vom ${a} bis ${b} · ${n} Tage`, count: (n, d) => `${n} Messungen an ${d} Tagen · Schweizer Zeit`,
      generated: (d) => `Erstellt am ${d}`, all: "Verlauf des Zeitraums", allSub: "Mittel jedes Tages",
      chartNote: "In den Grafiken ist jeder Punkt der Mittelwert aller Messungen dieses Tages (ein Durchschnitt). Die einzelnen Messungen stehen in der Liste.",
      units: "SYS und DIA in mmHg", unitsPul: "Schläge pro Minute", morning: "Morgen", morningSub: "vor 12 Uhr · Tagesmittel",
      evening: "Abend", eveningSub: "ab 17 Uhr · Tagesmittel", pulse: "Puls (PUL)", pulseSub: "Mittel jedes Tages",
      values: "Werte des Zeitraums", valuesSub: "der höchste, der tiefste und das Mittel, mit Tag und Uhrzeit",
      hi: (k) => `${k} höchster`, lo: (k) => `${k} tiefster`, avg: (k) => `${k} Mittel`, avgOf: (n) => `Mittel aus ${n} Messungen`,
      none: "Keine Messungen zu dieser Tageszeit", list: "Liste der Messungen",
      cols: ["Datum", "Zeit", "AM/PM", "SYS", "DIA", "PUL", "Quelle"], per: { morning: "Morgen", afternoon: "Nachmittag", evening: "Abend" },
      src: { photo: "Foto", voice: "Stimme" }, empty: "Keine Messungen in diesem Zeitraum.",
      note: "Messungen zu Hause. Quelle jedes Werts: Foto der Anzeige des Messgeräts, von der App gelesen, oder angesagt (Spalte Quelle).",
      disclaimer: "Vom Patienten erstelltes Dokument, ohne Bewertung der Werte. Die klinische Beurteilung ist Sache des Arztes.",
      page: (a, b) => `Seite ${a} von ${b}`,
      balT: "Morgen und Abend im Vergleich", balSub: "Mittel aller Messungen des Zeitraums · nur eine Rechnung, keine Bewertung",
      balM: "Morgen", balE: "Abend", balN: (n) => (n === 1 ? "1 Messung" : `${n} Messungen`),
      balSame: "Morgen und Abend haben dasselbe Mittel.", balDiff: (s, d) => `Abend - Morgen: SYS ${s} · DIA ${d} mmHg`,
      balNone: "Es braucht Messungen am Morgen und am Abend.",
    },
    fr: {
      title: "Tension artérielle", range: (a, b, n) => `du ${a} au ${b} · ${n} jours`, count: (n, d) => `${n} mesures sur ${d} jours · heure suisse`,
      generated: (d) => `Généré le ${d}`, all: "Évolution de la période", allSub: "moyenne de chaque jour",
      chartNote: "Dans les graphiques, chaque point est la moyenne de toutes les mesures de ce jour (un agrégat). Les mesures une à une sont dans la liste.",
      units: "SYS et DIA en mmHg", unitsPul: "battements par minute", morning: "Matin", morningSub: "avant 12 h · moyenne du jour",
      evening: "Soir", eveningSub: "dès 17 h · moyenne du jour", pulse: "Pouls (PUL)", pulseSub: "moyenne de chaque jour",
      values: "Valeurs de la période", valuesSub: "la plus haute, la plus basse et la moyenne, avec jour et heure",
      hi: (k) => `${k} la plus haute`, lo: (k) => `${k} la plus basse`, avg: (k) => `${k} moyenne`, avgOf: (n) => `moyenne de ${n} mesures`,
      none: "Aucune mesure à ce moment de la journée", list: "Liste des mesures",
      cols: ["Date", "Heure", "AM/PM", "SYS", "DIA", "PUL", "Source"], per: { morning: "Matin", afternoon: "Après-midi", evening: "Soir" },
      src: { photo: "Photo", voice: "Voix" }, empty: "Aucune mesure sur cette période.",
      note: "Mesures à domicile. Source de chaque valeur : photo de l'écran du tensiomètre, lue par l'app, ou dictée (colonne Source).",
      disclaimer: "Document préparé par le patient, sans évaluation des valeurs. L'évaluation clinique revient au médecin.",
      page: (a, b) => `Page ${a} sur ${b}`,
      balT: "Matin et soir comparés", balSub: "moyenne de toutes les mesures de la période · un simple calcul, aucune évaluation",
      balM: "Matin", balE: "Soir", balN: (n) => (n === 1 ? "1 mesure" : `${n} mesures`),
      balSame: "Le matin et le soir ont la même moyenne.", balDiff: (s, d) => `Soir - matin : SYS ${s} · DIA ${d} mmHg`,
      balNone: "Il faut des mesures le matin et le soir.",
    },
  }[LG];

  // print colours, as in the app's PDF
  const SYS = "#6D5BD0", DIA = "#0F9C8E", PUL = "#B7860B";
  const SYS_T = "#5543B8", DIA_T = "#0B7A6F", PUL_T = "#8F6806";
  const INK = "#13223F", MUTED = "#5B6B88", RULE = "#D9E0EA";
  // the colourful parts: a violet-to-teal band (never red), a three-colour line under it, light tints of the three colours
  const BAND_A = "#4B3BB0", BAND_B = "#0B7A6F", BAND_TXT = "#E4DFFF", CARD_LINE = "#E3E8F0", ZEBRA = "#F5F4FD";
  const TINT = { [SYS]: "#F1EFFC", [DIA]: "#E8F6F4", [PUL]: "#FBF5E6" };
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
      el(g, "circle", { cx: lx + 3.5, cy: ly - 4.9, r: 3.5, fill: l.c });
      txt(g, lx + 10, ly - 2, l.name, 8, l.t, { bold: true });
      lx += 10 + tw(l.name, 8, true) + 14;
    }
    txt(g, x0 + w, ly - 2, units, 7, MUTED, { anchor: "end" });
    const top = y0 + 24, left = x0 + 26, right = x0 + w - 8, pt = top + 8, pb = y0 + h - 22;
    el(g, "rect", { x: x0, y: top, width: w, height: y0 + h - top, rx: 6, fill: "#fff", stroke: CARD_LINE, "stroke-width": 0.8 });
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
    // each line with a light shade of its colour under it
    for (const pts of [...all].reverse()) {
      if (pts.length > 1) el(g, "path", { d: `M${pts[0].x} ${pb} ` + pts.map((p) => `L${p.x} ${p.y}`).join(" ") + ` L${pts[pts.length - 1].x} ${pb} Z`, fill: pts[0].l.c, "fill-opacity": 0.1 });
    }
    for (const pts of [...all].reverse()) {
      if (pts.length > 1) el(g, "polyline", { points: pts.map((p) => `${p.x},${p.y}`).join(" "), fill: "none", stroke: pts[0].l.c, "stroke-width": 1.4, "stroke-linejoin": "round" });
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
    // the coloured band (violet to teal) with the three-colour line under it
    function band(g, h, bar) {
      const id = "band" + pageNo;
      const lg = el(el(g, "defs", {}), "linearGradient", { id, x1: 0, x2: 1, y1: 0, y2: 1 });
      el(lg, "stop", { offset: 0, "stop-color": BAND_A }); el(lg, "stop", { offset: 1, "stop-color": BAND_B });
      el(g, "rect", { x: 0, y: 0, width: 595, height: h, fill: `url(#${id})` });
      [SYS, DIA, PUL].forEach((c, i) => el(g, "rect", { x: i * 595 / 3, y: h, width: 595 / 3, height: bar, fill: c }));
    }
    function smallHeader(g) {
      band(g, 40, 2);
      txt(g, left, 25, W.title, 10, "#fff", { bold: true });
      txt(g, right, 25, range, 8, BAND_TXT, { anchor: "end" });
    }

    // ---------- page 1 ----------
    let g = page();
    band(g, 112, 3);
    el(g, "path", { d: "M300 70 H400 l6 -8 6 8 h8 l5 -26 6 44 5 -18 h14 l6 -6 6 6 H595", fill: "none", stroke: "#fff", "stroke-opacity": 0.2, "stroke-width": 1.6 });
    txt(g, left, 30, "HINT 365 · HEALTHYINSTANTTRACKER", 8, BAND_TXT, { bold: true, spacing: 1.6 });
    txt(g, right, 30, W.generated(dayOf(Date.now())), 8, BAND_TXT, { anchor: "end" });
    txt(g, left, 62, W.title, 24, "#fff", { bold: true });
    txt(g, left, 82, range, 10.5, "#F2F0FF");
    txt(g, left, 98, W.count(list.length, new Set(list.map((r) => dayOf(r.t))).size), 8, BAND_TXT);
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
        el(g, "rect", { x, y, width: bw, height: bh, rx: 5, fill: TINT[l.c] });
        el(g, "rect", { x, y, width: 3, height: bh, fill: l.c });
        txt(g, x + 12, y + 15, label.toUpperCase(), 7.5, MUTED, { bold: true, spacing: 0.4 });
        txt(g, x + 12, y + 38, value, 20, l.t, { bold: true });
        txt(g, x + 12 + tw(value, 20, true) + 4, y + 38, l === pulL ? "bpm" : "mmHg", 7.5, MUTED);
        txt(g, x + 12, y + 50, sub, 7.2, MUTED);
      });
      y += bh + gap;
    }
    footer(g);

    // ---------- page 2: morning and evening ----------
    g = page(); smallHeader(g);
    chart(g, left, 74, cw, 280, dailyMeans(list.filter((r) => r.period === "morning")), [sysL, diaL], W.morning, W.morningSub, W.units, startDay, days);
    chart(g, left, 384, cw, 280, dailyMeans(list.filter((r) => r.period === "evening")), [sysL, diaL], W.evening, W.eveningSub, W.units, startDay, days);
    balance(g, left, 680, cw, 118, list, PRINT_THEME);
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
      const hid = "th" + pageNo, hg = el(el(g, "defs", {}), "linearGradient", { id: hid, x1: 0, x2: 1, y1: 0, y2: 0 });
      el(hg, "stop", { offset: 0, "stop-color": BAND_A }); el(hg, "stop", { offset: 1, "stop-color": BAND_B });
      el(g, "rect", { x: left, y, width: cw, height: 18, fill: `url(#${hid})` });
      W.cols.forEach((h, k) => txt(g, cols[k] + 5, y + 12.5, h, 9, "#fff", { bold: true }));
      y += 18;
      let row = 0, lastDay = null;
      if (!list.length) txt(g, left, y + 16, W.empty, 9.5);
      while (i < list.length && row < rowsPerPage) {
        const r = list[i], d = dayOf(r.t);
        if (row % 2 === 1) el(g, "rect", { x: left, y, width: cw, height: 17, fill: ZEBRA });
        if (lastDay != null && d !== lastDay) el(g, "line", { x1: left, x2: right, y1: y, y2: y, stroke: "#9FB0C8", "stroke-width": 0.8 });
        const cells = [d !== lastDay ? d : "", timeOf(r.t), (r.period === "morning" ? "AM" : "PM"), r.sys, r.dia, r.pul ?? "–", W.src[r.source] || r.source];
        cells.forEach((v, k) => txt(g, cols[k] + 5, y + 12, v, 9.5, colCol[k], { bold: k >= 3 && k <= 5 }));
        lastDay = d; y += 17; i++; row++;
      }
      footer(g);
    } while (i < list.length);
  }

  /**
   * The balance: morning on the left, evening on the right, each pan carrying its average SYS/DIA.
   * The side with the higher average goes up (like a higher point in the charts) (average of the SYS and DIA differences, at most 10°);
   * within 1 mmHg the beam stays level. Only arithmetic, drawn in neutral colours: nothing is good or bad.
   * theme: { ink, muted, beam, panel, sys, dia }
   */
  function balance(g, x, y, w, h, list, th) {
    const K = th.scale || 1;   // on a screen the small texts are drawn larger (the PDF keeps 1)
    const avg = (a) => (a.length ? Math.round(a.reduce((p, q) => p + q, 0) / a.length) : null);
    const side = (per) => { const l = list.filter((r) => r.period === per); return { n: l.length, sys: avg(l.map((r) => r.sys)), dia: avg(l.map((r) => r.dia)) }; };
    const m = side("morning"), e = side("evening");
    txt(g, x, y + 12, W.balT, 11.5, th.ink, { bold: true });
    // the explanation beside the title, or below it when the space is narrow (phone)
    // larger on a screen, but never wider than the space: it shrinks to fit a narrow phone
    const subSize = Math.min(7.5 * K, 7.5 * (w - 4) / Math.max(1, tw(W.balSub, 7.5)));
    if (w >= 440) txt(g, x + w, y + 12, W.balSub, 7.5, th.muted, { anchor: "end" });
    else txt(g, x, y + 26, W.balSub, subSize, th.muted);
    if (!m.n || !e.n) { txt(g, x + w / 2, y + h / 2 + 8, W.balNone, 9 * K, th.muted, { anchor: "middle" }); return; }
    const ds = e.sys - m.sys, dd = e.dia - m.dia;
    const level = Math.abs(ds) < 1 && Math.abs(dd) < 1;
    const deg = level ? 0 : -Math.max(-10, Math.min(10, ((ds + dd) / 2) * 1.2));   // higher average = higher pan, as in the charts
    const a = (deg * Math.PI) / 180;
    const cx = x + w / 2, py = y + h * 0.56, half = Math.min(w * 0.3, 170);
    const Lx = cx - half * Math.cos(a), Ly = py - half * Math.sin(a), Rx = cx + half * Math.cos(a), Ry = py + half * Math.sin(a);
    // stand and pivot; the foot stays clear of the line written under it (larger on a screen)
    const foot = y + h - 12 * K - 6;
    el(g, "path", { d: `M${cx - 16} ${foot} L${cx + 16} ${foot} L${cx} ${py + 4} Z`, fill: th.beam, opacity: 0.55 });
    el(g, "rect", { x: cx - 34, y: foot, width: 68, height: 3, rx: 1.5, fill: th.beam, opacity: 0.55 });
    // beam
    el(g, "line", { x1: Lx, y1: Ly, x2: Rx, y2: Ry, stroke: th.beam, "stroke-width": 3, "stroke-linecap": "round" });
    el(g, "circle", { cx, cy: py, r: 4, fill: th.ink });
    // pans, and above each one its label and averages
    for (const [px, pyy, lab, v] of [[Lx, Ly, W.balM, m], [Rx, Ry, W.balE, e]]) {
      el(g, "line", { x1: px, y1: pyy, x2: px - 22, y2: pyy + 16, stroke: th.beam, "stroke-width": 1 });
      el(g, "line", { x1: px, y1: pyy, x2: px + 22, y2: pyy + 16, stroke: th.beam, "stroke-width": 1 });
      el(g, "path", { d: `M${px - 30} ${pyy + 16} Q${px} ${pyy + 30} ${px + 30} ${pyy + 16} Z`, fill: th.panel, stroke: th.beam, "stroke-width": 1 });
      txt(g, px, pyy - 30, `${lab} · ${W.balN(v.n)}`, 7.5 * K, th.muted, { anchor: "middle" });
      const sw = tw(v.sys, 15, true), dw = tw(v.dia, 15, true), slash = tw("/", 15, false);
      const x0 = px - (sw + slash + dw) / 2;
      txt(g, x0, pyy - 11, v.sys, 15, th.sys, { bold: true });
      txt(g, x0 + sw, pyy - 11, "/", 15, th.muted);
      txt(g, x0 + sw + slash, pyy - 11, v.dia, 15, th.dia, { bold: true });
    }
    const sgn = (v) => (v > 0 ? "+" + v : String(v));
    txt(g, x + w / 2, y + h - 2, level ? W.balSame : W.balDiff(sgn(ds), sgn(dd)), 8 * K, th.ink, { anchor: "middle" });
  }

  const PRINT_THEME = { ink: INK, muted: MUTED, beam: "#8A97B0", panel: "#F1EFFC", sys: SYS_T, dia: DIA_T };

  window.HintReport = { render, balance };
})();
