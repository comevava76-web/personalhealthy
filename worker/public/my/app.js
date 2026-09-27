// Web Dashboard: the personal web dashboard of HINT 365.
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
    signinT: "Apri Web Dashboard dall'app", signinP: "Per entrare senza password: nell'app HINT 365 vai su Report e tocca «Web Dashboard». Il browser si apre già collegato al tuo account.",
    ckT: "Cookie", ckP: "La Web Dashboard usa un solo cookie tecnico, <b>hint_s</b>, che ti tiene collegato per 7 giorni dopo averla aperta dall'app. Contiene solo un codice casuale, è di prima parte e non è leggibile dagli script (HttpOnly, Secure, SameSite=Strict). Nessun cookie di profilazione, di statistica, di pubblicità o di terze parti. La tua scelta resta salvata in questo browser. Dettagli nell'<a href=\"/privacy#cookie\">informativa privacy</a>.",
    ckYes: "Accetto", ckNo: "Rifiuto", ckNoT: "Senza cookie non posso tenerti collegato", ckNoP: "Il cookie tecnico serve solo a tenerti collegato alla Web Dashboard. Senza di esso puoi continuare a usare l'app. Se cambi idea, riapri Web Dashboard dall'app e tocca «Accetto».", ckAgain: "Rivedi la scelta",
    subT: "Il tuo abbonamento è scaduto", subP: "Grazie per aver usato HINT 365. Rinnova l'abbonamento annuale dall'app (Google Play) per ripristinare tutte le funzioni: le tue misure sono al sicuro e tornano subito disponibili.",
    goneT: "Link scaduto", goneP: "Questo link non è più valido: è scaduto oppure è stato ritirato da chi l'ha inviato.",
    sharedB: (a, b, e) => `Report condiviso dal paziente: misure dal ${a} al ${b}. Link valido fino al ${e}.`,
    shTitle: "Invia il report al medico", shIntro: "Crea un link di sola lettura con le misure del periodo scelto. Chi lo riceve vede solo i grafici e le misure: niente email, niente account.",
    shValid: "Valido per", valid: { 1: "1 giorno", 7: "7 giorni", 30: "30 giorni" }, shMake: "Crea il link", shClose: "Chiudi",
    shCopy: "Copia", shCopied: "Copiato", shNative: "Altre app", shRevoke: "Ritira tutti i link inviati", shRevoked: "Tutti i link sono stati ritirati",
    shExp: (d) => `Il link smette di funzionare il ${d}.`,
    shText: (a, b, url, e) => `Report della pressione (HINT 365), misure dal ${a} al ${b}: ${url} — link valido fino al ${e}.`,
    shSubject: "Report della pressione",
    footNote: "HINT 365 non fa diagnosi e non valuta i valori: ogni valutazione spetta al medico.",
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
    signinT: "Open Web Dashboard from the app", signinP: "To come in without a password: in the HINT 365 app go to Report and tap “Web Dashboard”. The browser opens already signed in to your account.",
    ckT: "Cookies", ckP: "The Web Dashboard uses a single technical cookie, <b>hint_s</b>, which keeps you signed in for 7 days after you open it from the app. It holds only a random code, is first-party and cannot be read by scripts (HttpOnly, Secure, SameSite=Strict). No profiling, statistics, advertising or third-party cookies. Your choice is saved in this browser. Details in the <a href=\"/privacy#cookie\">privacy policy</a>.",
    ckYes: "Accept", ckNo: "Decline", ckNoT: "Without the cookie I cannot keep you signed in", ckNoP: "The technical cookie only keeps you signed in to the Web Dashboard. Without it you can keep using the app. If you change your mind, open Web Dashboard again from the app and tap “Accept”.", ckAgain: "Review the choice",
    subT: "Your subscription has run out", subP: "Thank you for using HINT 365. Renew the yearly subscription in the app (Google Play) to bring back every feature: your readings are safe and come back at once.",
    goneT: "Link expired", goneP: "This link no longer works: it has expired or was withdrawn by the person who sent it.",
    sharedB: (a, b, e) => `Report shared by the patient: readings from ${a} to ${b}. Link valid until ${e}.`,
    shTitle: "Send the report to your doctor", shIntro: "Creates a read-only link with the readings of the chosen period. Whoever gets it sees only the charts and readings: no email, no account.",
    shValid: "Valid for", valid: { 1: "1 day", 7: "7 days", 30: "30 days" }, shMake: "Create link", shClose: "Close",
    shCopy: "Copy", shCopied: "Copied", shNative: "Other apps", shRevoke: "Withdraw all links sent", shRevoked: "All links have been withdrawn",
    shExp: (d) => `The link stops working on ${d}.`,
    shText: (a, b, url, e) => `Blood pressure report (HINT 365), readings from ${a} to ${b}: ${url} — link valid until ${e}.`,
    shSubject: "Blood pressure report",
    footNote: "HINT 365 makes no diagnosis and does not assess the values: every assessment is up to the doctor.",
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
    p.onclick = (e) => { const d = +e.target.dataset.d; if (!d) return; current.days = d; load(); };
  }
  async function load() {
    try {
      const data = await api(`/my/api/data?module=${current.module}&days=${current.days}`);
      current.data = data; charts0();
      MODULES[current.module].render(main, data, {});   // one period only (7 days): no period buttons
    } catch (e) { if (e.status === 401) signedOut(); else if (e.status === 402) message(T.subT, T.subP); else message(T.err, ""); }
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

  /* ---------- cookie consent ----------
     The only cookie is the technical session cookie hint_s. It is set only after the person accepts it here;
     the choice (accepted, and which version of this notice) is kept in this browser's local storage. */
  const CK_KEY = "hint.cookies", CK_VER = "1";
  const ckGet = () => { try { return localStorage.getItem(CK_KEY); } catch { return null; } };
  const ckSet = (v) => { try { v == null ? localStorage.removeItem(CK_KEY) : localStorage.setItem(CK_KEY, v); } catch {} };
  function cookieBanner() {
    return new Promise((done) => {
      const box = document.createElement("div");
      box.className = "cookie"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
      box.innerHTML = `<div class="cookie-in"><h3>${T.ckT}</h3><p>${T.ckP}</p><div class="cookie-b">
        <button class="btn" type="button" data-v="no">${T.ckNo}</button><button class="btn primary" type="button" data-v="yes">${T.ckYes}</button></div></div>`;
      box.onclick = (e) => { const v = e.target.dataset && e.target.dataset.v; if (!v) return; box.remove(); done(v === "yes"); };
      document.body.appendChild(box);
    });
  }
  async function cookiesOk() {
    if (ckGet() === "yes:" + CK_VER) return true;
    const yes = await cookieBanner();
    ckSet(yes ? "yes:" + CK_VER : "no:" + CK_VER);
    return yes;
  }
  function cookiesRefused() {
    $("actions").hidden = true; $("modules").innerHTML = "";
    message(T.ckNoT, T.ckNoP);
  }
  // footer link: see the notice again; declining now signs this browser out and removes the cookie
  function bindCookieLink() {
    const a = $("cookie-link"); if (!a) return;
    a.textContent = T.ckT;
    a.onclick = async (e) => {
      e.preventDefault();
      const yes = await cookieBanner();
      ckSet(yes ? "yes:" + CK_VER : "no:" + CK_VER);
      if (!yes) { try { await api("/my/session", { method: "DELETE" }); } catch {} cookiesRefused(); }
    };
  }

  async function startSignedIn() {
    bindCookieLink();
    // step 3 of the sign-in from the app: the one-time code in the #part becomes a cookie, then disappears from the address.
    // The cookie is set only after it has been accepted.
    const m = location.hash.match(/c=([A-Za-z0-9_-]+)/);
    if (!(await cookiesOk())) { if (m) history.replaceState(null, "", "/my/"); return cookiesRefused(); }
    if (m) {
      history.replaceState(null, "", "/my/");
      try { await api("/my/session", { method: "POST", body: JSON.stringify({ code: m[1] }) }); } catch (e) { /* expired: fall through to the cookie, if any */ }
    }
    let me;
    try { me = await api("/my/api/me"); } catch (e) { return signedOut(); }
    $("actions").hidden = false;
    $("modules").innerHTML = me.modules.map((id) => `<button type="button" data-m="${id}" class="${id === current.module ? "on" : ""}">${MODULES[id] ? MODULES[id].title() : id}</button>`).join("")
      // the owner's area: only the owner gets this tab, and the server answers it only for the owner
      + (me.isOwner ? `<button type="button" data-m="admin">${AD.tab}</button>` : "");
    $("modules").onclick = (e) => {
      const id = e.target.dataset.m; if (!id || (!MODULES[id] && id !== "admin")) return;
      [...$("modules").children].forEach((b) => b.classList.toggle("on", b.dataset.m === id));
      if (id === "admin") { $("actions").hidden = true; return loadAdmin(); }
      $("actions").hidden = false; current.module = id; load();
    };
    $("btn-pdf").onclick = printReport;
    $("btn-csv").onclick = () => current.data && download(`hint-${current.module}-${current.days}d.csv`, MODULES[current.module].csv(current.data.items), "text/csv");
    $("btn-out").onclick = async () => { try { await api("/my/session", { method: "DELETE" }); } catch {} signedOut(); };
    setupShare();
    load();
  }

  /* ---------- the owner's area ----------
     Usage numbers per anonymous account code: when it joined, when it was last used, how many readings.
     Never a value, a report or a name. The server refuses all of it to anyone but the owner. */
  const AD = IT ? {
    tab: "Admin", title: "Area del proprietario", sub: "La vedi solo tu · solo numeri d'uso, legati al codice anonimo: nessuna misura, nessun report, nessun nome",
    upd: "Aggiornato", users: "Utenti", new30: (n) => `${n} nuovi in 30 giorni`, act7: "Attivi 7 giorni", act30: "Attivi 30 giorni",
    act: "hanno aperto l'app o misurato", rd: "Misure", rd7: "Misure 7 giorni", rd30: "Misure 30 giorni", total: "in totale",
    split: (v, f) => `${v} a voce · ${f} da foto`, ai: "AI attiva", aiU: "utenti con chiave Anthropic", aiSp: "Spesa AI", aiSpU: "sui crediti Anthropic degli utenti",
    web: "Web Dashboard", webU: "sessioni aperte", links: "Link al medico", linksU: "attivi ora",
    stT: "Spazio su Cloudflare", stDb: (a, b, pc) => `Database D1: ${a} su ${b} (${pc}) del piano gratuito`, stRows: "Righe per tabella",
    stNote: "Il limite di 500 MB è quello di un database D1 nel piano gratuito di Cloudflare. Le misure oltre 365 giorni vengono cancellate ogni notte.",
    vT: "Versioni dell'app", vNew: (v) => `Versione più recente installata: ${v}`, vNone: "Nessuna versione bloccata: tutte le app installate funzionano.",
    vMin: (v) => `Bloccate tutte le versioni precedenti alla ${v}: mostrano solo il link per scaricare l'ultima.`,
    vOff: (v) => `Blocca le versioni precedenti alla ${v}`, vOn: "Sblocca tutte le versioni",
    vAskOff: (v) => `Tutte le app precedenti alla ${v} smettono subito di funzionare, su ogni telefono, finché non si installa l'ultima. I dati restano. Confermi?`,
    vAskOn: "Tutte le versioni installate tornano a funzionare. Confermi?",
    uT: "Utenti", uNote: "Codice anonimo dell'account e numeri d'uso. «tu» è il tuo account.",
    cols: ["Codice", "Iscritto", "Ultimo accesso", "Misure", "7 gg", "30 gg", "Voce / foto", "AI", "App", "Link medico"],
    aiS: { none: "—", ok: "attiva", no_credit: "credito finito", invalid: "chiave non valida" }, you: "tu", never: "—",
  } : {
    tab: "Admin", title: "Owner's area", sub: "Only you see it · usage numbers only, tied to the anonymous code: no readings, no reports, no names",
    upd: "Updated", users: "Users", new30: (n) => `${n} new in 30 days`, act7: "Active 7 days", act30: "Active 30 days",
    act: "opened the app or measured", rd: "Readings", rd7: "Readings 7 days", rd30: "Readings 30 days", total: "in total",
    split: (v, f) => `${v} by voice · ${f} by photo`, ai: "AI on", aiU: "users with an Anthropic key", aiSp: "AI spending", aiSpU: "on the users' own Anthropic credit",
    web: "Web Dashboard", webU: "open sessions", links: "Doctor links", linksU: "active now",
    stT: "Space on Cloudflare", stDb: (a, b, pc) => `D1 database: ${a} of ${b} (${pc}) on the free plan`, stRows: "Rows per table",
    stNote: "500 MB is the size limit of one D1 database on Cloudflare's free plan. Readings older than 365 days are deleted every night.",
    vT: "App versions", vNew: (v) => `Newest version installed: ${v}`, vNone: "No version blocked: every installed app works.",
    vMin: (v) => `Every version older than ${v} is blocked: it shows only the link to download the latest.`,
    vOff: (v) => `Block versions older than ${v}`, vOn: "Unblock every version",
    vAskOff: (v) => `Every app older than ${v} stops working at once, on every phone, until the latest is installed. The data stay. Confirm?`,
    vAskOn: "Every installed version works again. Confirm?",
    uT: "Users", uNote: "Anonymous account code and usage numbers. “you” is your own account.",
    cols: ["Code", "Joined", "Last opened", "Readings", "7 d", "30 d", "Voice / photo", "AI", "App", "Doctor links"],
    aiS: { none: "—", ok: "on", no_credit: "credit out", invalid: "key refused" }, you: "you", never: "—",
  };
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const mb = (b) => (b / 1048576).toLocaleString(LOCALE, { maximumFractionDigits: b < 10485760 ? 2 : 0 }) + " MB";
  const ver = (n) => "0.1." + n;
  async function loadAdmin() {
    main.innerHTML = `<div class="loading"><span class="pulse"></span></div>`;
    let d;
    try { d = await api("/my/api/admin/overview"); } catch (e) { if (e.status === 401) return signedOut(); return message(T.err, ""); }
    const t = d.totals, st = d.storage, v = d.versions;
    const tile = (l, val, w) => `<div class="tile"><div class="l">${l}</div><div class="v">${val}</div><div class="w">${w}</div></div>`;
    const pc = st.freeLimitBytes ? Math.min(100, (st.dbBytes / st.freeLimitBytes) * 100) : 0;
    const when = (ms) => (ms ? `${day(ms)} ${time(ms)}` : AD.never);
    main.innerHTML = `
      <div class="bar"><h1>${AD.title}</h1><span class="grow"></span><span class="sub">${AD.upd} ${time(d.at)}</span></div>
      <p class="note">${AD.sub}</p>
      <section class="tiles adm">
        ${tile(AD.users, t.users, AD.new30(t.newUsers30))}
        ${tile(AD.act7, t.active7, AD.act)}
        ${tile(AD.act30, t.active30, AD.act)}
        ${tile(AD.rd, t.readings, AD.split(t.voice, t.photo))}
        ${tile(AD.rd7, t.readings7, AD.total)}
        ${tile(AD.rd30, t.readings30, AD.total)}
        ${tile(AD.ai, t.aiOn, AD.aiU)}
        ${tile(AD.aiSp, "$" + t.aiSpentUsd.toFixed(2), AD.aiSpU)}
        ${tile(AD.links, t.doctorLinks, AD.linksU)}
      </section>
      <div class="card"><div class="card-h"><h2>${AD.stT}</h2></div>
        <p>${AD.stDb(mb(st.dbBytes), mb(st.freeLimitBytes), (pc < 0.1 ? "< 0,1%".replace(",", IT ? "," : ".") : pc.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) + "%"))}</p>
        <div class="meter"><i style="width:${Math.max(pc, 0.5)}%"></i></div>
        <p class="muted small" style="margin-top:10px">${AD.stRows}: ${Object.entries(st.rows).map(([k, n]) => `<code>${esc(k)}</code> ${n}`).join(" · ")}</p>
        <p class="muted small">${AD.stNote}</p>
      </div>
      <div class="card"><div class="card-h"><h2>${AD.vT}</h2></div>
        <p>${v.newest ? AD.vNew(ver(v.newest)) : ""}</p>
        <p>${v.min ? AD.vMin(ver(v.min)) : AD.vNone}</p>
        <div class="send" style="margin:8px 0 6px">
          ${v.newest && v.min < v.newest ? `<button class="btn" type="button" id="adm-off">${AD.vOff(ver(v.newest))}</button>` : ""}
          ${v.min ? `<button class="btn ghost" type="button" id="adm-on">${AD.vOn}</button>` : ""}
        </div>
      </div>
      <div class="card"><div class="card-h"><h2>${AD.uT}</h2><span class="sub">${AD.uNote}</span></div>
        <div class="tbl"><table class="list"><thead><tr>${AD.cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>
          ${d.users.map((u) => `<tr>
            <td><code>${esc(u.id)}</code>${u.owner ? ` <b class="you">${AD.you}</b>` : ""}</td>
            <td>${day(u.since)}</td><td>${when(u.lastSeen)}</td>
            <td>${u.readings}</td><td>${u.last7}</td><td>${u.last30}</td><td>${u.voice} / ${u.photo}</td>
            <td>${AD.aiS[u.ai] || esc(u.ai)}</td><td>${u.app ? esc(u.app) : "—"}</td><td>${u.shares}</td></tr>`).join("")}
        </tbody></table></div>
      </div>`;
    const setMin = async (min, ask) => {
      if (!confirm(ask)) return;
      try { await api("/my/api/admin/app-min-version", { method: "POST", body: JSON.stringify({ minVersion: min }) }); } catch { alert(T.err); }
      loadAdmin();
    };
    const off = $("adm-off"); if (off) off.onclick = () => setMin(v.newest, AD.vAskOff(ver(v.newest)));
    const on = $("adm-on"); if (on) on.onclick = () => setMin(0, AD.vAskOn);
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
