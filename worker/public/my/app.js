// Web Dashboard: the personal web dashboard of HINT.
// Opened from the app already signed in (see worker/src/web.ts), or as a read-only link shared with the doctor (/s/...).
// Each part of the dashboard is a module in MODULES: blood pressure now, lab results later. A module gets its data
// from /my/api/data?module=<id> and draws itself in the page; sign-in, periods, sharing and export are shared by all.
// The charts are drawn by this file as SVG: no library and no request to third parties.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const IT = (navigator.language || "en").toLowerCase().startsWith("it");
  const LOCALE = IT ? "it-CH" : "en-GB";
  const TZ = "Europe/Zurich";

  /* ---------- words ---------- */
  const T = IT ? {
    share: "Invia al medico", pdf: "PDF", csv: "Excel", out: "Esci",
    bp: "Pressione", labs: "Analisi",
    range: { 7: "7 giorni" },
    bpTitle: "Pressione arteriosa", readings: (n) => `${n} misure`,
    last: "Ultima misura", avgBp: "Media SYS / DIA", avgPul: "Media PUL", count: "Misure", days: (d, n) => `in ${d} giorni su ${n}`,
    chartsNote: "Come leggere i grafici: ogni punto è la media di tutte le misure di quel giorno (un aggregato), quindi 7 punti per 7 giorni. Le singole misure sono nell'elenco in fondo e nei valori del periodo.",
    whole: "Andamento del periodo", dailyAvg: "media di ogni giorno", nOf: (n) => (n === 1 ? "1 misura" : `${n} misure`),
    morning: "Mattina", morningSub: "prima delle 12", evening: "Sera", eveningSub: "dalle 17",
    pulse: "Battiti (PUL)", pulseSub: "battiti al minuto",
    values: "Valori del periodo", hi: "più alta", lo: "più bassa", mean: "media", meanOf: (n) => `media di ${n} misure`,
    list: "Tutte le misure", cols: ["Data", "Ora", "Momento", "SYS", "DIA", "PUL", "Fonte"],
    per: { morning: "Mattina", afternoon: "Pomeriggio", evening: "Sera" }, src: { photo: "Foto", voice: "Voce" },
    none: "Nessuna misura in questo periodo", noneMoment: "Nessuna misura in questo momento della giornata",
    signinT: "Apri Web Dashboard dall'app", signinP: "Per entrare senza password: nell'app HINT vai su Report e tocca «Web Dashboard». Il browser si apre già collegato al tuo account.",
    goneT: "Link scaduto", goneP: "Questo link non è più valido: è scaduto oppure è stato ritirato da chi l'ha inviato.",
    sharedB: (a, b, e) => `Report condiviso dal paziente: misure dal ${a} al ${b}. Link valido fino al ${e}.`,
    shTitle: "Invia il report al medico", shIntro: "Crea un link di sola lettura con le misure del periodo scelto. Chi lo riceve vede solo i grafici e le misure: niente email, niente account.",
    shValid: "Valido per", valid: { 1: "1 giorno", 7: "7 giorni", 30: "30 giorni" }, shMake: "Crea il link", shClose: "Chiudi",
    shCopy: "Copia", shCopied: "Copiato", shNative: "Altre app", shRevoke: "Ritira tutti i link inviati", shRevoked: "Tutti i link sono stati ritirati",
    shExp: (d) => `Il link smette di funzionare il ${d}.`,
    shText: (a, b, url, e) => `Report della pressione (HINT), misure dal ${a} al ${b}: ${url} — link valido fino al ${e}.`,
    shSubject: "Report della pressione",
    footNote: "HINT non fa diagnosi e non valuta i valori: ogni valutazione spetta al medico.",
    rights: "Tutti i diritti riservati", terms: "Condizioni d'uso",
    err: "Qualcosa non ha funzionato. Riprova.",
  } : {
    share: "Send to doctor", pdf: "PDF", csv: "Excel", out: "Sign out",
    bp: "Blood pressure", labs: "Lab results",
    range: { 7: "7 days" },
    bpTitle: "Blood pressure", readings: (n) => `${n} readings`,
    last: "Last reading", avgBp: "Average SYS / DIA", avgPul: "Average PUL", count: "Readings", days: (d, n) => `on ${d} of ${n} days`,
    chartsNote: "How to read the charts: each dot is the average of all the readings of that day (an aggregate), so 7 dots for 7 days. The single readings are in the list at the bottom and in the values of the period.",
    whole: "The whole period", dailyAvg: "average of each day", nOf: (n) => (n === 1 ? "1 reading" : `${n} readings`),
    morning: "Morning", morningSub: "before 12:00", evening: "Evening", eveningSub: "from 17:00",
    pulse: "Pulse (PUL)", pulseSub: "beats per minute",
    values: "Values of the period", hi: "highest", lo: "lowest", mean: "average", meanOf: (n) => `average of ${n} readings`,
    list: "All readings", cols: ["Date", "Time", "Moment", "SYS", "DIA", "PUL", "Source"],
    per: { morning: "Morning", afternoon: "Afternoon", evening: "Evening" }, src: { photo: "Photo", voice: "Voice" },
    none: "No readings in this period", noneMoment: "No readings at this time of day",
    signinT: "Open Web Dashboard from the app", signinP: "To come in without a password: in the HINT app go to Report and tap “Web Dashboard”. The browser opens already signed in to your account.",
    goneT: "Link expired", goneP: "This link no longer works: it has expired or was withdrawn by the person who sent it.",
    sharedB: (a, b, e) => `Report shared by the patient: readings from ${a} to ${b}. Link valid until ${e}.`,
    shTitle: "Send the report to your doctor", shIntro: "Creates a read-only link with the readings of the chosen period. Whoever gets it sees only the charts and readings: no email, no account.",
    shValid: "Valid for", valid: { 1: "1 day", 7: "7 days", 30: "30 days" }, shMake: "Create link", shClose: "Close",
    shCopy: "Copy", shCopied: "Copied", shNative: "Other apps", shRevoke: "Withdraw all links sent", shRevoked: "All links have been withdrawn",
    shExp: (d) => `The link stops working on ${d}.`,
    shText: (a, b, url, e) => `Blood pressure report (HINT), readings from ${a} to ${b}: ${url} — link valid until ${e}.`,
    shSubject: "Blood pressure report",
    footNote: "HINT makes no diagnosis and does not assess the values: every assessment is up to the doctor.",
    rights: "All rights reserved", terms: "Terms of use",
    err: "Something went wrong. Please try again.",
  };

  /* ---------- dates: everything in Swiss time ---------- */
  const fDate = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
  const fDay = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
  const fTime = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const fParts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
  const date = (ms) => fDate.format(ms), day = (ms) => fDay.format(ms), time = (ms) => fTime.format(ms);
  // the charts count in UTC: each reading is placed at its Swiss wall-clock time, so the axis reads like the phone
  function chartTime(ms) {
    const p = {}; for (const x of fParts.formatToParts(ms)) p[x.type] = x.value;
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) / 1000;
  }
  const fTip = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const when = (ms) => fTip.format(chartTime(ms) * 1000);   // e.g. "dom 27 set, 11:58"

  /* ---------- server ---------- */
  async function api(path, opts = {}) {
    const r = await fetch(path, { credentials: "same-origin", headers: { "content-type": "application/json" }, ...opts });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || r.status); e.status = r.status; e.code = j.code; throw e; }
    return j;
  }

  /* ---------- charts ---------- */
  // Drawn here as SVG at the exact size of the screen: sharp on any phone, nothing from third parties.
  // The week has 7 places, one per day; each day is one dot, the average of that day's readings, with its value
  // written next to it. Under the chart only the day of the month; above it the period. Touching a day shows its
  // date, its averages and how many readings they come from.
  const COL = { sys: "#8C7BF2", dia: "#1FA396", pul: "#C08A1E" };   // no red: it would read as "a problem"
  const TXT = { sys: "#B3A7FF", dia: "#5FD3C6", pul: "#F2C25A" };
  const NS = "http://www.w3.org/2000/svg";
  const fRange = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: "numeric", month: "short" });
  const redraws = [];
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => redraws.forEach((f) => f()), 150); });

  function svgEl(parent, name, attrs, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    parent.appendChild(e); return e;
  }
  let mctx;
  const textW = (t, size) => { mctx = mctx || document.createElement("canvas").getContext("2d"); mctx.font = `700 ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`; return mctx.measureText(String(t)).width; };

  // the Swiss calendar day of a moment, as a UTC midnight, so days can be counted
  const fYmd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" });
  function midnight(ms) { const p = {}; for (const x of fYmd.formatToParts(ms)) p[x.type] = x.value; return Date.UTC(+p.year, +p.month - 1, +p.day); }
  const fLegendDay = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

  function lineChart(el, legend, items, keys, range) {
    // one dot per day: the average of that day's readings; the week always has its 7 places, empty days stay empty
    const start = midnight(range.from), days = Math.round((midnight(range.to) - start) / 864e5) + 1;
    const slots = Array.from({ length: days }, (_, i) => ({ day: start + i * 864e5, n: 0, v: {} }));
    for (const k of keys) for (const sl of slots) sl.v[k] = [];
    for (const r of items) {
      const i = Math.round((midnight(r.t) - start) / 864e5);
      if (i < 0 || i >= days) continue;
      let any = false;
      for (const k of keys) if (r[k] != null) { slots[i].v[k].push(r[k]); any = true; }
      if (any) slots[i].n++;
    }
    for (const sl of slots) for (const k of keys) { const a = sl.v[k]; sl.v[k] = a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null; }
    const idle = () => { legend.innerHTML = keys.map((k) => `<span><i style="background:${COL[k]}"></i>${k.toUpperCase()}</span>`).join(""); };
    if (!slots.some((sl) => sl.n)) { el.innerHTML = `<div class="empty">${T.noneMoment}</div>`; legend.innerHTML = ""; return; }
    idle();
    const draw = () => {
      el.innerHTML = "";
      const W = el.clientWidth, H = el.clientHeight;
      const L = 8, R = W - 36, TOP = 24, B = H - 28;
      const vals = slots.flatMap((sl) => keys.map((k) => sl.v[k]).filter((v) => v != null));
      const lo = Math.floor((Math.min(...vals) - 6) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 6) / 10) * 10;
      const Y = (v) => B - (v - lo) / (hi - lo) * (B - TOP);
      const step = (R - L) / days, X = (i) => L + step * (i + 0.5);
      const svg = svgEl(el, "svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: "plot" });
      for (let v = lo; v <= hi; v += 10) {
        svgEl(svg, "line", { x1: L, x2: R, y1: Y(v), y2: Y(v), stroke: "#1F2E50", "stroke-width": 1 });
        svgEl(svg, "text", { x: R + 8, y: Y(v) + 4, class: "ax" }, v);
      }
      // under each place, only the day of the month
      slots.forEach((sl, i) => svgEl(svg, "text", { x: X(i), y: B + 20, class: "day", "text-anchor": "middle" }, new Date(sl.day).getUTCDate()));
      const dots = [];
      for (const k of [...keys].reverse()) {
        const p = slots.map((sl, i) => (sl.v[k] != null ? { x: X(i), y: Y(sl.v[k]), v: sl.v[k], k } : null)).filter(Boolean);
        if (p.length > 1) svgEl(svg, "path", { d: "M" + p.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" L"), fill: "none", stroke: COL[k], "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" });
        for (const q of p) svgEl(svg, "circle", { cx: q.x, cy: q.y, r: 5, fill: COL[k], stroke: "#101C35", "stroke-width": 2 });
        dots.push(...p);
      }
      // the value of each day next to its dot: SYS and PUL above, DIA below (the other side if taken)
      const fs = 12.5;
      const taken = dots.map((q) => [q.x - 6, q.y - 6, q.x + 6, q.y + 6]);
      const hit = (a) => taken.some((t) => a[0] < t[2] && a[2] > t[0] && a[1] < t[3] && a[3] > t[1]);
      for (const q of dots) {
        const half = textW(q.v, fs) / 2 + 1, up = q.k !== "dia";
        for (const u of [up, !up]) {
          const by = u ? q.y - 11 : q.y + fs + 9;
          const box = [q.x - half, by - fs + 1, q.x + half, by + 2];
          if (box[1] < 2 || box[3] > B + 2 || hit(box)) continue;
          taken.push(box); svgEl(svg, "text", { x: q.x, y: by, "text-anchor": "middle", class: "val", fill: TXT[q.k], "font-size": fs }, q.v); break;
        }
      }
      // touching a day: its date, its averages and how many readings they come from
      const cross = svgEl(svg, "line", { x1: 0, x2: 0, y1: TOP - 10, y2: B, stroke: "#8C9BBA", "stroke-width": 1, "stroke-dasharray": "2 3", visibility: "hidden" });
      const ring = keys.map((k) => svgEl(svg, "circle", { r: 8, fill: "none", stroke: COL[k], "stroke-width": 2, visibility: "hidden" }));
      const pick = (ev) => {
        const rect = svg.getBoundingClientRect();
        const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
        const i = Math.max(0, Math.min(days - 1, Math.floor((cx - L) / step)));
        const sl = slots[i];
        if (!sl.n) return leave();
        cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
        keys.forEach((k, j) => { if (sl.v[k] == null) return ring[j].setAttribute("visibility", "hidden"); ring[j].setAttribute("cx", X(i)); ring[j].setAttribute("cy", Y(sl.v[k])); ring[j].setAttribute("visibility", "visible"); });
        legend.innerHTML = `<span class="when">${fLegendDay.format(sl.day)} · ${T.nOf(sl.n)}</span>` + keys.map((k) => `<span><i style="background:${COL[k]}"></i>${k.toUpperCase()} <b class="${k}">${sl.v[k] ?? "–"}</b></span>`).join("");
      };
      const leave = () => { cross.setAttribute("visibility", "hidden"); ring.forEach((c) => c.setAttribute("visibility", "hidden")); idle(); };
      svg.addEventListener("pointermove", pick); svg.addEventListener("pointerdown", pick);
      svg.addEventListener("touchmove", pick, { passive: true }); svg.addEventListener("pointerleave", leave);
    };
    draw();
    redraws.push(draw);
  }

  // the morning / evening balance, the same drawing as in the PDF (report.js), in the dark colours
  const DARK_BAL = { ink: "#EAF0FA", muted: "#8C9BBA", beam: "#6F7FA3", panel: "#1C2B4F", sys: "#B3A7FF", dia: "#5FD3C6" };
  function drawBalance(el, items) {
    const draw = () => {
      el.innerHTML = "";
      const W = el.clientWidth, H = 200;
      const svg = svgEl(el, "svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
      window.HintReport.balance(svg, 2, 4, W - 4, H - 8, items, DARK_BAL);
    };
    draw(); redraws.push(draw);
  }

  /* ---------- modules ---------- */
  const MODULES = {
    bp: {
      title: () => T.bp,
      render(main, data, ctx) {
        const items = data.items;
        const n = items.length;
        const dayCount = new Set(items.map((r) => day(r.t))).size;
        const spanDays = Math.max(1, Math.round((data.to - data.from) / 864e5));
        const avg = (k) => { const v = items.map((r) => r[k]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
        const last = items[n - 1];
        const per = `${fRange.formatRange(data.from, data.to)} · ${T.dailyAvg}`;   // e.g. "21–27 set · media di ogni giorno"
        main.innerHTML = `
          ${ctx.banner || ""}
          <div class="bar">
            <div><h1>${T.bpTitle}</h1><div class="sub">${date(data.from)} – ${date(data.to)} · ${T.readings(n)}</div></div>
            <span class="grow"></span>${ctx.pills || ""}
          </div>
          ${n ? `
          <section class="kpis">
            <div class="kpi"><div class="l">${T.last}</div>
              <div class="v"><span class="sys">${last.sys}</span><span class="u">/</span><span class="dia">${last.dia}</span>${last.pul != null ? `<span class="u"> · </span><span class="pul">${last.pul}</span>` : ""}</div>
              <div class="u">${day(last.t)} · ${time(last.t)}</div></div>
            <div class="kpi"><div class="l">${T.avgBp}</div><div class="v"><span class="sys">${avg("sys")}</span><span class="u">/</span><span class="dia">${avg("dia")}</span></div><div class="u">mmHg</div></div>
            <div class="kpi"><div class="l">${T.avgPul}</div><div class="v"><span class="pul">${avg("pul") ?? "–"}</span></div><div class="u">bpm</div></div>
            <div class="kpi"><div class="l">${T.count}</div><div class="v">${n}</div><div class="u">${T.days(dayCount, spanDays)}</div></div>
          </section>
          <p class="note">ⓘ ${T.chartsNote}</p>
          <section class="card"><div class="card-h"><h2>${T.whole}</h2><span class="sub">${per}</span><div class="legend" id="lg-all"></div></div><div class="chart" id="ch-all"></div></section>
          <div class="two">
            <section class="card"><div class="card-h"><h2>${T.morning}</h2><span class="sub">${T.morningSub} · ${per}</span><div class="legend" id="lg-m"></div></div><div class="chart small" id="ch-m"></div></section>
            <section class="card"><div class="card-h"><h2>${T.evening}</h2><span class="sub">${T.eveningSub} · ${per}</span><div class="legend" id="lg-e"></div></div><div class="chart small" id="ch-e"></div></section>
          </div>
          <section class="card"><div class="bal" id="bal"></div></section>
          <section class="card"><div class="card-h"><h2>${T.pulse}</h2><span class="sub">${per}</span><div class="legend" id="lg-p"></div></div><div class="chart small" id="ch-p"></div></section>
          <div class="card-h" style="margin-top:6px"><h2>${T.values}</h2></div>
          <section class="tiles">${tiles(items)}</section>
          <section class="card"><details${ctx.shared ? " open" : ""}><summary>${T.list} (${n})</summary>${table(items)}</details></section>
          ` : `<div class="card"><div class="empty" style="height:200px">${T.none}</div></div>`}`;
        ctx.bindPills && ctx.bindPills();
        if (!n) return;
        lineChart($("ch-all"), $("lg-all"), items, ["sys", "dia"], data);
        lineChart($("ch-m"), $("lg-m"), items.filter((r) => r.period === "morning"), ["sys", "dia"], data);
        lineChart($("ch-e"), $("lg-e"), items.filter((r) => r.period === "evening"), ["sys", "dia"], data);
        lineChart($("ch-p"), $("lg-p"), items, ["pul"], data);
        drawBalance($("bal"), items);
      },
      csv(items) {
        const rows = [T.cols.map((c, i) => (i === 3 || i === 4 ? c + " (mmHg)" : c))];
        for (const r of items) rows.push([day(r.t), time(r.t), T.per[r.period] || r.period, r.sys, r.dia, r.pul ?? "", T.src[r.source] || r.source]);
        return rows.map((r) => r.join(";")).join("\r\n");
      },
    },
    // labs: { title: () => T.labs, render(main, data, ctx) {...}, csv(items) {...} }   ← the lab results module goes here
  };

  // nine boxes: highest, lowest (with day and time) and average of SYS, DIA and PUL
  function tiles(items) {
    const out = [];
    const unit = (k) => (k === "pul" ? "bpm" : "mmHg");
    for (const row of ["hi", "lo", "mean"]) for (const k of ["sys", "dia", "pul"]) {
      const l = items.filter((r) => r[k] != null);
      let v = "–", w = "";
      if (l.length && row === "mean") { v = Math.round(l.reduce((a, r) => a + r[k], 0) / l.length); w = T.meanOf(l.length); }
      else if (l.length) {
        const r = l.reduce((a, b) => (row === "hi" ? (b[k] > a[k] ? b : a) : (b[k] < a[k] ? b : a)));
        v = r[k]; w = `${day(r.t)} · ${time(r.t)}` + (k === "pul" ? "" : ` · ${r.sys}/${r.dia}`);
      }
      out.push(`<div class="tile" style="--c:${COL[k]}"><div class="l">${k.toUpperCase()} ${T[row]}</div><div class="v">${v}<small>${unit(k)}</small></div><div class="w">${w}</div></div>`);
    }
    return out.join("");
  }
  function table(items) {
    let lastDay = "";
    const rows = [...items].reverse().map((r) => {
      const d = day(r.t), nd = d !== lastDay; lastDay = d;
      return `<tr class="${nd ? "newday" : ""}"><td>${nd ? d : ""}</td><td>${time(r.t)}</td><td>${T.per[r.period] || r.period}</td>
        <td class="sys"><b>${r.sys}</b></td><td class="dia"><b>${r.dia}</b></td><td class="pul">${r.pul ?? "–"}</td><td>${T.src[r.source] || r.source}</td></tr>`;
    }).join("");
    return `<div style="overflow-x:auto"><table><thead><tr>${T.cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  /* ---------- page ---------- */
  const main = $("main");
  let current = { module: "bp", days: 7, data: null };
    current.days = 7;   // one week only: every reading readable

  function words() {
    $("btn-share").textContent = "✉ " + T.share; $("btn-pdf").textContent = T.pdf; $("btn-csv").textContent = T.csv; $("btn-out").textContent = T.out;
    $("foot-note").textContent = T.footNote; $("rights").textContent = T.rights; $("terms-link").textContent = T.terms; 
    const y = new Date().getFullYear(); $("years").textContent = y > 2026 ? `2026–${y}` : "2026";
    document.documentElement.lang = IT ? "it" : "en";
  }
  function message(title, text) { main.innerHTML = `<div class="center"><h1>${title}</h1><p class="muted">${text}</p></div>`; }
  function charts0() { redraws.length = 0; }

  function pills() {
    return `<div class="pills" id="pills">${Object.entries(T.range).map(([d, l]) => `<button type="button" data-d="${d}" class="${+d === current.days ? "on" : ""}">${l}</button>`).join("")}</div>`;
  }
  function bindPills() {
    const p = $("pills"); if (!p) return;
    p.onclick = (e) => { const d = +e.target.dataset.d; if (!d) return; current.days = d; try { localStorage.setItem("hint.days", d); } catch {} load(); };
  }
  async function load() {
    try {
      const data = await api(`/my/api/data?module=${current.module}&days=${current.days}`);
      current.data = data; charts0();
      MODULES[current.module].render(main, data, {});   // one period only (7 days): no period buttons
    } catch (e) { if (e.status === 401) signedOut(); else message(T.err, ""); }
  }
  function signedOut() { $("actions").hidden = true; $("modules").innerHTML = ""; message(T.signinT, T.signinP); }

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- share with the doctor ---------- */
  function setupShare() {
    const dlg = $("share");
    $("sh-title").textContent = T.shTitle; $("sh-intro").textContent = T.shIntro; $("sh-valid-l").textContent = T.shValid;
    [...$("sh-valid").options].forEach((o) => (o.textContent = T.valid[o.value]));
    $("sh-make").textContent = T.shMake; $("sh-close").textContent = T.shClose; $("sh-copy").textContent = T.shCopy;
    $("sh-native").textContent = T.shNative; $("sh-revoke").textContent = T.shRevoke;
    $("btn-share").onclick = () => { $("sh-result").hidden = true; $("sh-make").hidden = false; dlg.showModal(); };
    $("sh-make").onclick = async () => {
      try {
        const r = await api("/my/api/share", { method: "POST", body: JSON.stringify({ days: current.days, validDays: +$("sh-valid").value }) });
        const text = T.shText(date(r.from), date(r.to), r.url, date(r.expiresAt));
        $("sh-url").value = r.url;
        $("sh-wa").href = "https://wa.me/?text=" + encodeURIComponent(text);
        $("sh-mail").href = `mailto:?subject=${encodeURIComponent(T.shSubject)}&body=${encodeURIComponent(text)}`;
        $("sh-exp").textContent = T.shExp(date(r.expiresAt));
        $("sh-copy").onclick = async () => { try { await navigator.clipboard.writeText(r.url); $("sh-copy").textContent = T.shCopied; } catch { $("sh-url").select(); } };
        $("sh-native").hidden = !navigator.share;
        $("sh-native").onclick = () => navigator.share({ title: T.shSubject, text }).catch(() => {});
        $("sh-result").hidden = false; $("sh-make").hidden = true;
      } catch (e) { alert(T.err); }
    };
    $("sh-revoke").onclick = async () => { try { await api("/my/api/shares", { method: "DELETE" }); alert(T.shRevoked); } catch { alert(T.err); } };
  }

  async function startSignedIn() {
    // step 3 of the sign-in from the app: the one-time code in the #part becomes a cookie, then disappears from the address
    const m = location.hash.match(/c=([A-Za-z0-9_-]+)/);
    if (m) {
      history.replaceState(null, "", "/my/");
      try { await api("/my/session", { method: "POST", body: JSON.stringify({ code: m[1] }) }); } catch (e) { /* expired: fall through to the cookie, if any */ }
    }
    let me;
    try { me = await api("/my/api/me"); } catch (e) { return signedOut(); }
    $("actions").hidden = false;
    $("modules").innerHTML = me.modules.map((id) => `<button type="button" data-m="${id}" class="${id === current.module ? "on" : ""}">${MODULES[id] ? MODULES[id].title() : id}</button>`).join("");
    $("modules").onclick = (e) => { const id = e.target.dataset.m; if (!id || !MODULES[id]) return; current.module = id; [...$("modules").children].forEach((b) => b.classList.toggle("on", b.dataset.m === id)); load(); };
    $("btn-pdf").onclick = printReport;
    $("btn-csv").onclick = () => current.data && download(`hint-${current.module}-${current.days}d.csv`, MODULES[current.module].csv(current.data.items), "text/csv");
    $("btn-out").onclick = async () => { try { await api("/my/session", { method: "DELETE" }); } catch {} signedOut(); };
    setupShare();
    load();
  }

  // PDF: the same A4 report as the app, built from the readings on screen, then the browser's "Save as PDF"
  function loadScript(src) {
    return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  }
  async function printReport() {
    if (!current.data || !window.HintReport) return;
    const btn = $("btn-pdf"); btn.disabled = true;
    try {
      // the PDF libraries (jsPDF, svg2pdf, MIT licence, served from this site) are loaded only when needed
      if (!window.jspdf) await loadScript("/my/vendor/jspdf-4.2.1.umd.min.js");
      if (!window.svg2pdf) await loadScript("/my/vendor/svg2pdf-2.8.1.umd.min.js");
      const box = $("print");
      window.HintReport.render(box, current.data);
      box.classList.add("building");
      const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4", compress: true });
      const pages = [...box.querySelectorAll(".a4 svg")];
      for (let i = 0; i < pages.length; i++) {
        if (i) doc.addPage("a4");
        await doc.svg(pages[i], { x: 0, y: 0, width: 595.28, height: 841.89 });
      }
      box.classList.remove("building");
      doc.save(`HINT-${T.bpTitle.replace(/\s+/g, "-")}-${day(current.data.to).replace(/[./]/g, "-")}.pdf`);
    } catch (e) {
      // if anything goes wrong, the browser's own "Save as PDF" still gives the same pages
      setTimeout(() => window.print(), 50);
    } finally { btn.disabled = false; }
  }

  async function startShared(token) {
    // the doctor's view: only the PDF button
    $("actions").hidden = false;
    for (const id of ["btn-share", "btn-csv", "btn-out"]) $(id).hidden = true;
    $("btn-pdf").onclick = printReport;
    try {
      const data = await api(`/s/${token}/data?module=bp`);
      const banner = `<div class="banner">${T.sharedB(date(data.from), date(data.to), date(data.expiresAt))}</div>`;
      current.data = data;
      MODULES.bp.render(main, data, { banner, shared: true });
    } catch (e) { message(T.goneT, T.goneP); }
  }

  words();
  const s = location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)/);
  if (s) startShared(s[1]); else startSignedIn();
})();
