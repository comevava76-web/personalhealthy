// My Dash: the personal web dashboard of HINT.
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
    last: "Ultima misura", avg: "Media del periodo", count: "Misure", days: (d, n) => `in ${d} giorni su ${n}`,
    whole: "Andamento del periodo", wholeSub: "ogni misura, giorno e ora",
    morning: "Mattina", morningSub: "prima delle 12", evening: "Sera", eveningSub: "dalle 17",
    pulse: "Battiti (PUL)", pulseSub: "battiti al minuto",
    values: "Valori del periodo", hi: "più alta", lo: "più bassa", mean: "media", meanOf: (n) => `media di ${n} misure`,
    list: "Tutte le misure", cols: ["Data", "Ora", "Momento", "SYS", "DIA", "PUL", "Fonte"],
    per: { morning: "Mattina", afternoon: "Pomeriggio", evening: "Sera" }, src: { photo: "Foto", voice: "Voce" },
    none: "Nessuna misura in questo periodo", noneMoment: "Nessuna misura in questo momento della giornata",
    signinT: "Apri My Dash dall'app", signinP: "Per entrare senza password: nell'app HINT vai su Report e tocca «My Dash». Il browser si apre già collegato al tuo account.",
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
    last: "Last reading", avg: "Period average", count: "Readings", days: (d, n) => `on ${d} of ${n} days`,
    whole: "The whole period", wholeSub: "every reading, day and time",
    morning: "Morning", morningSub: "before 12:00", evening: "Evening", eveningSub: "from 17:00",
    pulse: "Pulse (PUL)", pulseSub: "beats per minute",
    values: "Values of the period", hi: "highest", lo: "lowest", mean: "average", meanOf: (n) => `average of ${n} readings`,
    list: "All readings", cols: ["Date", "Time", "Moment", "SYS", "DIA", "PUL", "Source"],
    per: { morning: "Morning", afternoon: "Afternoon", evening: "Evening" }, src: { photo: "Photo", voice: "Voice" },
    none: "No readings in this period", noneMoment: "No readings at this time of day",
    signinT: "Open My Dash from the app", signinP: "To come in without a password: in the HINT app go to Report and tap “My Dash”. The browser opens already signed in to your account.",
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
  // Every reading is a dot with its value next to it (SYS and PUL above, DIA below), placed where it hits no other
  // number or dot, like in the PDF. Readings are evenly spaced one after the other; a thin line marks where each day
  // starts and the day is written below. Touching or pointing at the chart shows day, time and values above it.
  const COL = { sys: "#F2545B", dia: "#3FA7D6", pul: "#FFC145" };
  const TXT = { sys: "#FF8A8F", dia: "#7CC6EA", pul: "#FFD37A" };
  const NS = "http://www.w3.org/2000/svg";
  const fAxis = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: "short", day: "numeric" });
  const fDayNum = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: "numeric" });
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

  function lineChart(el, legend, items, keys) {
    const pts = items.filter((r) => keys.some((k) => r[k] != null));
    const idle = () => { legend.innerHTML = keys.map((k) => `<span><i style="background:${COL[k]}"></i>${k.toUpperCase()}</span>`).join(""); };
    if (!pts.length) { el.innerHTML = `<div class="empty">${T.noneMoment}</div>`; legend.innerHTML = ""; return; }
    idle();
    const draw = () => {
      el.innerHTML = "";
      const W = el.clientWidth, H = el.clientHeight, n = pts.length;
      const L = 6, R = W - 36, TOP = 22, B = H - 30;
      const vals = pts.flatMap((r) => keys.map((k) => r[k]).filter((v) => v != null));
      const lo = Math.floor((Math.min(...vals) - 6) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 6) / 10) * 10;
      const Y = (v) => B - (v - lo) / (hi - lo) * (B - TOP);
      const step = (R - L) / n, X = (i) => L + step * (i + 0.5);
      const svg = svgEl(el, "svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: "plot" });
      // grid every 10, numbers on the right
      for (let v = lo; v <= hi; v += 10) {
        svgEl(svg, "line", { x1: L, x2: R, y1: Y(v), y2: Y(v), stroke: "#1F2E50", "stroke-width": 1 });
        svgEl(svg, "text", { x: R + 8, y: Y(v) + 4, class: "ax" }, v);
      }
      // days: a thin line where each day starts, the day's name under its readings
      // the name of the day ("lun 21"), or just the number ("21") when two days are too close to write it in full
      let first = 0, lastEnd = -Infinity;
      for (let i = 1; i <= n; i++) {
        if (i === n || day(pts[i].t) !== day(pts[first].t)) {
          if (first > 0) svgEl(svg, "line", { x1: L + step * first, x2: L + step * first, y1: TOP - 8, y2: B + 4, stroke: "#2B3D66", "stroke-width": 1, "stroke-dasharray": "3 3" });
          const cx = (X(first) + X(i - 1)) / 2;
          for (const label of [fAxis.format(pts[first].t), fDayNum.format(pts[first].t)]) {
            const w = textW(label, 11) + 6;
            if (cx - w / 2 < lastEnd || cx + w / 2 > W) continue;
            svgEl(svg, "text", { x: cx, y: B + 20, class: "day", "text-anchor": "middle" }, label);
            lastEnd = cx + w / 2; break;
          }
          first = i;
        }
      }
      // lines and dots, SYS last so it stays on top
      const dots = [];
      for (const k of [...keys].reverse()) {
        const p = pts.map((r, i) => (r[k] != null ? { x: X(i), y: Y(r[k]), v: r[k], k } : null)).filter(Boolean);
        if (p.length > 1) svgEl(svg, "path", { d: "M" + p.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" L"), fill: "none", stroke: COL[k], "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round" });
        for (const q of p) svgEl(svg, "circle", { cx: q.x, cy: q.y, r: 4, fill: COL[k], stroke: "#101C35", "stroke-width": 2 });
        dots.push(...p);
      }
      // the numbers: highest and lowest of each line first, then the others where they fit
      const fs = n > 18 ? 10 : 11.5;
      const taken = dots.map((q) => [q.x - 5, q.y - 5, q.x + 5, q.y + 5]);
      const hit = (a) => taken.some((t) => a[0] < t[2] && a[2] > t[0] && a[1] < t[3] && a[3] > t[1]);
      const order = keys.flatMap((k) => {
        const p = dots.filter((q) => q.k === k); const mx = Math.max(...p.map((q) => q.v)), mn = Math.min(...p.map((q) => q.v));
        return p.map((q) => [q, q.v === mx || q.v === mn ? 0 : 1]);
      }).sort((a, b) => a[1] - b[1]).map((a) => a[0]);
      for (const q of order) {
        const half = textW(q.v, fs) / 2 + 1, up = q.k !== "dia";
        for (const u of [up, !up]) {
          const by = u ? q.y - 9 : q.y + fs + 7;
          const box = [q.x - half, by - fs + 1, q.x + half, by + 2];
          if (box[1] < 2 || box[3] > B + 2 || box[0] < 0 || box[2] > R + 4 || hit(box)) continue;
          taken.push(box); svgEl(svg, "text", { x: q.x, y: by, "text-anchor": "middle", class: "val", fill: TXT[q.k], "font-size": fs }, q.v); break;
        }
      }
      // pointing or touching: a vertical line on the nearest reading, its values in the legend
      const cross = svgEl(svg, "line", { x1: 0, x2: 0, y1: TOP - 8, y2: B, stroke: "#8C9BBA", "stroke-width": 1, "stroke-dasharray": "2 3", visibility: "hidden" });
      const ring = keys.map((k) => svgEl(svg, "circle", { r: 7, fill: "none", stroke: COL[k], "stroke-width": 2, visibility: "hidden" }));
      const pick = (ev) => {
        const rect = svg.getBoundingClientRect();
        const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
        const i = Math.max(0, Math.min(n - 1, Math.floor((cx - L) / step)));
        const r = pts[i];
        cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
        keys.forEach((k, j) => { if (r[k] == null) return ring[j].setAttribute("visibility", "hidden"); ring[j].setAttribute("cx", X(i)); ring[j].setAttribute("cy", Y(r[k])); ring[j].setAttribute("visibility", "visible"); });
        legend.innerHTML = `<span class="when">${when(r.t)}</span>` + keys.map((k) => `<span><i style="background:${COL[k]}"></i>${k.toUpperCase()} <b class="${k}">${r[k] ?? "–"}</b></span>`).join("");
      };
      const leave = () => { cross.setAttribute("visibility", "hidden"); ring.forEach((c) => c.setAttribute("visibility", "hidden")); idle(); };
      svg.addEventListener("pointermove", pick); svg.addEventListener("pointerdown", pick);
      svg.addEventListener("touchmove", pick, { passive: true }); svg.addEventListener("pointerleave", leave);
    };
    draw();
    redraws.push(draw);
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
        main.innerHTML = `
          ${ctx.banner || ""}
          <div class="bar">
            <div><h1>${T.bpTitle}</h1><div class="sub">${date(data.from)} – ${date(data.to)} · ${T.readings(n)}</div></div>
            <span class="grow"></span>${ctx.pills || ""}
          </div>
          ${n ? `
          <section class="kpis">
            <div class="kpi"><div class="l">${T.last}</div>
              <div class="v"><b class="sys">${last.sys}</b><span class="u"> / </span><b class="dia">${last.dia}</b>${last.pul != null ? ` <span class="u">·</span> <b class="pul">${last.pul}</b>` : ""}</div>
              <div class="u">${day(last.t)} ${time(last.t)} · mmHg${last.pul != null ? " · bpm" : ""}</div></div>
            <div class="kpi"><div class="l">${T.avg} · SYS / DIA</div><div class="v"><span class="sys">${avg("sys")}</span><span class="u"> / </span><span class="dia">${avg("dia")}</span></div><div class="u">mmHg</div></div>
            <div class="kpi"><div class="l">${T.avg} · PUL</div><div class="v pul">${avg("pul") ?? "–"}</div><div class="u">bpm</div></div>
            <div class="kpi"><div class="l">${T.count}</div><div class="v">${n}</div><div class="u">${T.days(dayCount, spanDays)}</div></div>
          </section>
          <section class="card"><div class="card-h"><h2>${T.whole}</h2><span class="sub">${T.wholeSub}</span><div class="legend" id="lg-all"></div></div><div class="chart" id="ch-all"></div></section>
          <div class="two">
            <section class="card"><div class="card-h"><h2>${T.morning}</h2><span class="sub">${T.morningSub}</span><div class="legend" id="lg-m"></div></div><div class="chart small" id="ch-m"></div></section>
            <section class="card"><div class="card-h"><h2>${T.evening}</h2><span class="sub">${T.eveningSub}</span><div class="legend" id="lg-e"></div></div><div class="chart small" id="ch-e"></div></section>
          </div>
          <section class="card"><div class="card-h"><h2>${T.pulse}</h2><span class="sub">${T.pulseSub}</span><div class="legend" id="lg-p"></div></div><div class="chart small" id="ch-p"></div></section>
          <div class="card-h" style="margin-top:6px"><h2>${T.values}</h2></div>
          <section class="tiles">${tiles(items)}</section>
          <section class="card"><details${ctx.shared ? " open" : ""}><summary>${T.list} (${n})</summary>${table(items)}</details></section>
          ` : `<div class="card"><div class="empty" style="height:200px">${T.none}</div></div>`}`;
        ctx.bindPills && ctx.bindPills();
        if (!n) return;
        lineChart($("ch-all"), $("lg-all"), items, ["sys", "dia"]);
        lineChart($("ch-m"), $("lg-m"), items.filter((r) => r.period === "morning"), ["sys", "dia"]);
        lineChart($("ch-e"), $("lg-e"), items.filter((r) => r.period === "evening"), ["sys", "dia"]);
        lineChart($("ch-p"), $("lg-p"), items, ["pul"]);
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
  function printReport() {
    if (!current.data || !window.HintReport) return;
    window.HintReport.render($("print"), current.data);
    setTimeout(() => window.print(), 50);
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
