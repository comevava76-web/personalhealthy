// My Dash: the personal web dashboard of HINT.
// Opened from the app already signed in (see worker/src/web.ts), or as a read-only link shared with the doctor (/s/...).
// Each part of the dashboard is a module in MODULES: blood pressure now, lab results later. A module gets its data
// from /my/api/data?module=<id> and draws itself in the page; sign-in, periods, sharing and export are shared by all.
// The charts use TradingView Lightweight Charts (Apache 2.0), served from this site: no request leaves for third parties.
(function () {
  "use strict";
  const LC = window.LightweightCharts;
  const $ = (id) => document.getElementById(id);
  const IT = (navigator.language || "en").toLowerCase().startsWith("it");
  const LOCALE = IT ? "it-CH" : "en-GB";
  const TZ = "Europe/Zurich";

  /* ---------- words ---------- */
  const T = IT ? {
    share: "Invia al medico", pdf: "PDF", csv: "Excel", out: "Esci",
    bp: "Pressione", labs: "Analisi",
    range: { 7: "7 giorni", 14: "14 giorni" },
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
    rights: "Tutti i diritti riservati", terms: "Condizioni d'uso", tv: "Grafici: TradingView Lightweight Charts™",
    err: "Qualcosa non ha funzionato. Riprova.",
  } : {
    share: "Send to doctor", pdf: "PDF", csv: "Excel", out: "Sign out",
    bp: "Blood pressure", labs: "Lab results",
    range: { 7: "7 days", 14: "14 days" },
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
    rights: "All rights reserved", terms: "Terms of use", tv: "Charts: TradingView Lightweight Charts™",
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
  const when = (ms) => fTip.format(chartTime(ms) * 1000);   // the same words as under the finger, e.g. "dom 27 set, 11:58"

  /* ---------- server ---------- */
  async function api(path, opts = {}) {
    const r = await fetch(path, { credentials: "same-origin", headers: { "content-type": "application/json" }, ...opts });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || r.status); e.status = r.status; e.code = j.code; throw e; }
    return j;
  }

  /* ---------- charts ---------- */
  const COL = { sys: "#F2545B", dia: "#3FA7D6", pul: "#FFC145" };
  const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
  const charts = [];
  const DARK = { text: "#8C9BBA", grid: "rgba(40,58,98,0.55)", cross: "#5B6E96" };

  function theme(t) {
    return {
      layout: { background: { type: "solid", color: "transparent" }, textColor: t.text, fontSize: 11,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", attributionLogo: false },
      grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
      crosshair: { mode: LC.CrosshairMode.Normal,
        vertLine: { color: t.cross, width: 1, style: LC.LineStyle.Dashed, labelVisible: false },
        horzLine: { visible: false, labelVisible: false } },
    };
  }

  /**
   * One chart: every reading at its own day and hour, one line per value, a soft gradient below it,
   * a dot on each reading, and a legend that shows the values under the cursor (the last reading otherwise).
   */
  function lineChart(el, legend, items, keys) {
    el.innerHTML = "";
    const pts = items.filter((r) => keys.some((k) => r[k] != null));
    // the pressure chart shows SYS and DIA only; the pulse has its own chart
    if (!pts.length) { el.innerHTML = `<div class="empty">${T.noneMoment}</div>`; legend.innerHTML = ""; return; }
    const chart = LC.createChart(el, {
      autoSize: true, ...theme(DARK),
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.06 } },
      // the whole period always fits the width: no sideways scrolling or zooming, at most 30 days
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 1, minBarSpacing: 0.5,
        fixLeftEdge: true, fixRightEdge: true, lockVisibleTimeRangeOnResize: true },
      localization: { locale: LOCALE, priceFormatter: (v) => String(Math.round(v)), timeFormatter: (t) => fTip.format(t * 1000) },
      handleScale: false, handleScroll: false,
    });
    const series = {};
    // SYS on top: drawn last
    for (const k of [...keys].reverse()) {
      const c = COL[k];
      const s = chart.addSeries(LC.AreaSeries, {
        lineColor: c, lineWidth: 2, topColor: rgba(c, k === "pul" && keys.length > 1 ? 0.0 : 0.26), bottomColor: rgba(c, 0),
        lineType: LC.LineType.Simple, pointMarkersVisible: true, pointMarkersRadius: 2.5,
        crosshairMarkerRadius: 5, crosshairMarkerBorderColor: "#0A1224", crosshairMarkerBackgroundColor: c,
        priceLineVisible: false, lastValueVisible: false,
        priceFormat: { type: "price", precision: 0, minMove: 1 },
      });
      let prev = -1;
      s.setData(pts.filter((r) => r[k] != null).map((r) => {
        let t = chartTime(r.t); if (t <= prev) t = prev + 1; prev = t;     // two readings in the same second: keep both
        return { time: t, value: r[k] };
      }));
      series[k] = s;
    }
    chart.timeScale().fitContent();
    charts.push({ chart, series });

    const show = (vals, when) => {
      legend.innerHTML = `<span class="when">${when}</span>` + keys.map((k) =>
        `<span><i style="background:${COL[k]}"></i>${k.toUpperCase()} <b class="${k}">${vals[k] ?? "–"}</b></span>`).join("");
    };
    const last = pts[pts.length - 1];
    const lastVals = Object.fromEntries(keys.map((k) => [k, last[k]]));
    show(lastVals, when(last.t));
    chart.subscribeCrosshairMove((p) => {
      if (!p.time || !p.seriesData.size) return show(lastVals, when(last.t));
      const v = {}; for (const k of keys) { const d = p.seriesData.get(series[k]); v[k] = d ? d.value : null; }
      show(v, fTip.format(p.time * 1000));
    });
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
  let current = { module: "bp", days: 14, data: null };
  try { current.days = Number(localStorage.getItem("hint.days")) || 14; } catch {}
  if (![7, 14].includes(current.days)) current.days = 14;

  function words() {
    $("btn-share").textContent = "✉ " + T.share; $("btn-pdf").textContent = T.pdf; $("btn-csv").textContent = T.csv; $("btn-out").textContent = T.out;
    $("foot-note").textContent = T.footNote; $("rights").textContent = T.rights; $("terms-link").textContent = T.terms; $("tv-note").innerHTML = `${T.tv} · <a href="https://www.tradingview.com/" target="_blank" rel="noopener">tradingview.com</a>`;
    const y = new Date().getFullYear(); $("years").textContent = y > 2026 ? `2026–${y}` : "2026";
    document.documentElement.lang = IT ? "it" : "en";
  }
  function message(title, text) { main.innerHTML = `<div class="center"><h1>${title}</h1><p class="muted">${text}</p></div>`; }
  function charts0() { while (charts.length) charts.pop().chart.remove(); }

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
      MODULES[current.module].render(main, data, { pills: pills(), bindPills });
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
  if (!LC) { message(T.err, ""); return; }
  const s = location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)/);
  if (s) startShared(s[1]); else startSignedIn();
})();
