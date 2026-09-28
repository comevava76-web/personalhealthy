// Web Dashboard: the personal web dashboard of HINT 365.
// Opened from the app already signed in (see worker/src/web.ts), or as a read-only link shared with the doctor (/s/...).
// Each part of the dashboard is a module in MODULES: blood pressure now, lab results later. A module gets its data
// from /my/api/data?module=<id> and draws itself in the page; sign-in, periods, sharing and export are shared by all.
// The charts are drawn by this file as SVG: no library and no request to third parties.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  // the page speaks the browser's language: Italian, German, French, otherwise English
  const L2 = (navigator.language || "en").slice(0, 2).toLowerCase();
  const LG = ["it", "de", "fr"].includes(L2) ? L2 : "en";
  const IT = LG === "it";
  const LOCALE = { it: "it-CH", de: "de-CH", fr: "fr-CH", en: "en-GB" }[LG];
  const TZ = "Europe/Zurich";
  // the moment of the day in the tables, short to save space: before 12:00 AM, after PM
  const ampm = (p) => (p === "morning" ? "AM" : "PM");

  /* ---------- words ---------- */
  const T = {
   it: {
    share: "Invia al medico", pdf: "PDF", csv: "Excel",
    bp: "Pressione", labs: "Analisi",
    range: { 7: "7 giorni" },
    bpTitle: "Pressione arteriosa", readings: (n) => `${n} misure`,
    last: "Ultima misura", avgBp: "Media SYS / DIA", avgPul: "Media PUL", count: "Misure", days: (d, n) => `in ${d} giorni su ${n}`,
    chartsNote: "Come leggere i grafici: ogni punto è la media di tutte le misure di quel giorno (un aggregato), quindi 7 punti per 7 giorni. Le singole misure sono nell'elenco in fondo e nei valori del periodo.",
    whole: "Andamento del periodo", dailyAvg: "media di ogni giorno", nOf: (n) => (n === 1 ? "1 misura" : `${n} misure`),
    morning: "Mattina", morningSub: "prima delle 12", evening: "Sera", eveningSub: "dalle 17",
    pulse: "Battiti (PUL)", pulseSub: "battiti al minuto",
    values: "Valori del periodo", hi: "più alta", lo: "più bassa", mean: "media", meanOf: (n) => `media di ${n} misure`,
    list: "Tutte le misure", cols: ["Data", "Ora", "AM/PM", "SYS", "DIA", "PUL", "Fonte"],
    per: { morning: "Mattina", afternoon: "Pomeriggio", evening: "Sera" }, src: { photo: "Foto", voice: "Voce" },
    none: "Nessuna misura in questo periodo", noneMoment: "Nessuna misura in questo momento della giornata",
    signinT: "Apri Web Dashboard dall'app", signinP: "Per entrare senza password: nell'app HINT 365 vai su Report e tocca «Web Dashboard». Il browser si apre già collegato al tuo account.",
    ckT: "Cookie", ckP: "La Web Dashboard usa un solo cookie tecnico, <b>hint_s</b>, che ti tiene collegato per 7 giorni dopo averla aperta dall'app. Contiene solo un codice casuale, è di prima parte e non è leggibile dagli script (HttpOnly, Secure, SameSite=Strict). Nessun cookie di profilazione, di statistica, di pubblicità o di terze parti. La tua scelta resta salvata in questo browser. Dettagli nell'<a href=\"/privacy#cookie\">informativa privacy</a>.",
    ckYes: "Accetto", ckNo: "Rifiuto", ckIsOn: "Adesso: hai accettato il cookie tecnico.", ckIsOff: "Adesso: il cookie tecnico non è salvato.",
    ckShared: "Questa pagina di sola lettura non usa cookie e non salva nulla nel browser.", ckNoT: "Senza cookie non posso tenerti collegato", ckNoP: "Il cookie tecnico serve solo a tenerti collegato alla Web Dashboard. Senza di esso puoi continuare a usare l'app. Se cambi idea, riapri Web Dashboard dall'app e tocca «Accetto».", ckAgain: "Rivedi la scelta",
    subT: "Il tuo abbonamento è scaduto", subP: "Grazie per aver usato HINT 365. Rinnova l'abbonamento annuale dall'app (Google Play) per ripristinare tutte le funzioni: le tue misure sono al sicuro e tornano subito disponibili.",
    goneT: "Link scaduto", goneP: "Questo link non è più valido: è scaduto oppure è stato ritirato da chi l'ha inviato.",
    sharedB: (a, b, e) => `Report condiviso dal paziente: misure dal ${a} al ${b}. Link valido fino al ${e}.`,
    shTitle: "Invia il report al medico", shIntro: "Scegli come inviarlo: parte il PDF del report insieme a un link di sola lettura, con un messaggio già scritto.",
    shExp7: "Il link vale 7 giorni. Chi lo riceve vede solo grafici e misure del periodo: niente email, niente account.",
    shClose: "Chiudi", shRevoke: "Ritira tutti i link inviati", shRevoked: "Tutti i link sono stati ritirati",
    shWorking: "Preparo il PDF e il link…", shDone: "Inviato.", shAttach: "Il PDF è stato scaricato: allegalo al messaggio che si è aperto.",
    footNote: "HINT 365 non fa diagnosi e non valuta i valori: ogni valutazione spetta al medico.",
    rights: "Tutti i diritti riservati", terms: "Condizioni d'uso",
    err: "Qualcosa non ha funzionato. Riprova.",
    shRevokeQ: "Rendere subito non validi tutti i link inviati?",
    chartAria: (k, a, b) => `${k}, medie giornaliere dal ${a} al ${b}`,
   },
   en: {
    share: "Send to doctor", pdf: "PDF", csv: "Excel",
    bp: "Blood pressure", labs: "Lab results",
    range: { 7: "7 days" },
    bpTitle: "Blood pressure", readings: (n) => `${n} readings`,
    last: "Last reading", avgBp: "Average SYS / DIA", avgPul: "Average PUL", count: "Readings", days: (d, n) => `on ${d} of ${n} days`,
    chartsNote: "How to read the charts: each dot is the average of all the readings of that day (an aggregate), so 7 dots for 7 days. The single readings are in the list at the bottom and in the values of the period.",
    whole: "The whole period", dailyAvg: "average of each day", nOf: (n) => (n === 1 ? "1 reading" : `${n} readings`),
    morning: "Morning", morningSub: "before 12:00", evening: "Evening", eveningSub: "from 17:00",
    pulse: "Pulse (PUL)", pulseSub: "beats per minute",
    values: "Values of the period", hi: "highest", lo: "lowest", mean: "average", meanOf: (n) => `average of ${n} readings`,
    list: "All readings", cols: ["Date", "Time", "AM/PM", "SYS", "DIA", "PUL", "Source"],
    per: { morning: "Morning", afternoon: "Afternoon", evening: "Evening" }, src: { photo: "Photo", voice: "Voice" },
    none: "No readings in this period", noneMoment: "No readings at this time of day",
    signinT: "Open Web Dashboard from the app", signinP: "To come in without a password: in the HINT 365 app go to Report and tap “Web Dashboard”. The browser opens already signed in to your account.",
    ckT: "Cookies", ckP: "The Web Dashboard uses a single technical cookie, <b>hint_s</b>, which keeps you signed in for 7 days after you open it from the app. It holds only a random code, is first-party and cannot be read by scripts (HttpOnly, Secure, SameSite=Strict). No profiling, statistics, advertising or third-party cookies. Your choice is saved in this browser. Details in the <a href=\"/privacy#cookie\">privacy policy</a>.",
    ckYes: "Accept", ckNo: "Decline", ckIsOn: "Now: you have accepted the technical cookie.", ckIsOff: "Now: the technical cookie is not saved.",
    ckShared: "This read-only page uses no cookies and saves nothing in the browser.", ckNoT: "Without the cookie I cannot keep you signed in", ckNoP: "The technical cookie only keeps you signed in to the Web Dashboard. Without it you can keep using the app. If you change your mind, open Web Dashboard again from the app and tap “Accept”.", ckAgain: "Review the choice",
    subT: "Your subscription has run out", subP: "Thank you for using HINT 365. Renew the yearly subscription in the app (Google Play) to bring back every feature: your readings are safe and come back at once.",
    goneT: "Link expired", goneP: "This link no longer works: it has expired or was withdrawn by the person who sent it.",
    sharedB: (a, b, e) => `Report shared by the patient: readings from ${a} to ${b}. Link valid until ${e}.`,
    shTitle: "Send the report to your doctor", shIntro: "Choose how to send it: the PDF of the report goes together with a read-only link, with a ready message.",
    shExp7: "The link is valid for 7 days. Whoever gets it sees only the charts and readings of the period: no email, no account.",
    shClose: "Close", shRevoke: "Withdraw all links sent", shRevoked: "All links have been withdrawn",
    shWorking: "Preparing the PDF and the link…", shDone: "Sent.", shAttach: "The PDF has been downloaded: attach it to the message that opened.",
    footNote: "HINT 365 makes no diagnosis and does not assess the values: every assessment is up to the doctor.",
    rights: "All rights reserved", terms: "Terms of use",
    err: "Something went wrong. Please try again.",
    shRevokeQ: "Make every link you sent stop working now?",
    chartAria: (k, a, b) => `${k}, daily averages from ${a} to ${b}`,
   },
   de: {
    share: "An den Arzt senden", pdf: "PDF", csv: "Excel",
    bp: "Blutdruck", labs: "Laborwerte",
    range: { 7: "7 Tage" },
    bpTitle: "Blutdruck", readings: (n) => `${n} Messungen`,
    last: "Letzte Messung", avgBp: "Mittel SYS / DIA", avgPul: "Mittel PUL", count: "Messungen", days: (d, n) => `an ${d} von ${n} Tagen`,
    chartsNote: "So lesen Sie die Grafiken: Jeder Punkt ist der Mittelwert aller Messungen dieses Tages (ein Durchschnitt), also 7 Punkte für 7 Tage. Die einzelnen Messungen stehen in der Liste unten und bei den Werten des Zeitraums.",
    whole: "Verlauf des Zeitraums", dailyAvg: "Mittel jedes Tages", nOf: (n) => (n === 1 ? "1 Messung" : `${n} Messungen`),
    morning: "Morgen", morningSub: "vor 12 Uhr", evening: "Abend", eveningSub: "ab 17 Uhr",
    pulse: "Puls (PUL)", pulseSub: "Schläge pro Minute",
    values: "Werte des Zeitraums", hi: "höchster", lo: "tiefster", mean: "Mittel", meanOf: (n) => `Mittel aus ${n} Messungen`,
    list: "Alle Messungen", cols: ["Datum", "Zeit", "AM/PM", "SYS", "DIA", "PUL", "Quelle"],
    per: { morning: "Morgen", afternoon: "Nachmittag", evening: "Abend" }, src: { photo: "Foto", voice: "Stimme" },
    none: "Keine Messungen in diesem Zeitraum", noneMoment: "Keine Messungen zu dieser Tageszeit",
    signinT: "Web Dashboard aus der App öffnen", signinP: "Ohne Passwort hinein: In der App HINT 365 auf Bericht gehen und «Web Dashboard» tippen. Der Browser öffnet sich bereits mit Ihrem Konto verbunden.",
    ckT: "Cookies", ckP: "Das Web Dashboard verwendet ein einziges technisches Cookie, <b>hint_s</b>, das Sie nach dem Öffnen aus der App 7 Tage angemeldet hält. Es enthält nur einen Zufallscode, ist ein Erstanbieter-Cookie und für Skripte nicht lesbar (HttpOnly, Secure, SameSite=Strict). Keine Cookies für Profile, Statistik, Werbung oder Dritte. Ihre Wahl bleibt in diesem Browser gespeichert. Details in der <a href=\"/privacy#cookie\">Datenschutzerklärung</a>.",
    ckYes: "Akzeptieren", ckNo: "Ablehnen", ckIsOn: "Jetzt: Sie haben das technische Cookie akzeptiert.", ckIsOff: "Jetzt: Das technische Cookie ist nicht gespeichert.",
    ckShared: "Diese Nur-Lese-Seite verwendet keine Cookies und speichert nichts im Browser.", ckNoT: "Ohne Cookie kann ich Sie nicht angemeldet halten", ckNoP: "Das technische Cookie dient nur dazu, Sie im Web Dashboard angemeldet zu halten. Ohne es können Sie die App weiter verwenden. Wenn Sie es sich anders überlegen, öffnen Sie das Web Dashboard erneut aus der App und tippen Sie «Akzeptieren».", ckAgain: "Wahl ändern",
    subT: "Ihr Abo ist abgelaufen", subP: "Danke, dass Sie HINT 365 nutzen. Verlängern Sie das Jahresabo in der App (Google Play), um alle Funktionen wiederherzustellen: Ihre Messungen sind sicher und sofort wieder da.",
    goneT: "Link abgelaufen", goneP: "Dieser Link gilt nicht mehr: Er ist abgelaufen oder wurde von der Person zurückgezogen, die ihn gesendet hat.",
    sharedB: (a, b, e) => `Vom Patienten geteilter Bericht: Messungen vom ${a} bis ${b}. Link gültig bis ${e}.`,
    shTitle: "Bericht an den Arzt senden", shIntro: "Wählen Sie, wie Sie ihn senden: Das PDF des Berichts geht zusammen mit einem Nur-Lese-Link und einer fertigen Nachricht.",
    shExp7: "Der Link gilt 7 Tage. Wer ihn erhält, sieht nur Grafiken und Messungen des Zeitraums: keine E-Mail, kein Konto.",
    shClose: "Schliessen", shRevoke: "Alle gesendeten Links zurückziehen", shRevoked: "Alle Links wurden zurückgezogen", shRevokeQ: "Alle gesendeten Links sofort ungültig machen?",
    shWorking: "PDF und Link werden vorbereitet…", shDone: "Gesendet.", shAttach: "Das PDF wurde heruntergeladen: Hängen Sie es an die geöffnete Nachricht an.",
    footNote: "HINT 365 stellt keine Diagnosen und bewertet die Werte nicht: Jede Beurteilung ist Sache des Arztes.",
    rights: "Alle Rechte vorbehalten", terms: "Nutzungsbedingungen",
    err: "Etwas hat nicht funktioniert. Bitte erneut versuchen.",
    chartAria: (k, a, b) => `${k}, Tagesmittel vom ${a} bis ${b}`,
   },
   fr: {
    share: "Envoyer au médecin", pdf: "PDF", csv: "Excel",
    bp: "Tension", labs: "Analyses",
    range: { 7: "7 jours" },
    bpTitle: "Tension artérielle", readings: (n) => `${n} mesures`,
    last: "Dernière mesure", avgBp: "Moyenne SYS / DIA", avgPul: "Moyenne PUL", count: "Mesures", days: (d, n) => `sur ${d} jours de ${n}`,
    chartsNote: "Comment lire les graphiques : chaque point est la moyenne de toutes les mesures de ce jour (un agrégat), donc 7 points pour 7 jours. Les mesures une à une sont dans la liste en bas et dans les valeurs de la période.",
    whole: "Évolution de la période", dailyAvg: "moyenne de chaque jour", nOf: (n) => (n === 1 ? "1 mesure" : `${n} mesures`),
    morning: "Matin", morningSub: "avant 12 h", evening: "Soir", eveningSub: "dès 17 h",
    pulse: "Pouls (PUL)", pulseSub: "battements par minute",
    values: "Valeurs de la période", hi: "la plus haute", lo: "la plus basse", mean: "moyenne", meanOf: (n) => `moyenne de ${n} mesures`,
    list: "Toutes les mesures", cols: ["Date", "Heure", "AM/PM", "SYS", "DIA", "PUL", "Source"],
    per: { morning: "Matin", afternoon: "Après-midi", evening: "Soir" }, src: { photo: "Photo", voice: "Voix" },
    none: "Aucune mesure sur cette période", noneMoment: "Aucune mesure à ce moment de la journée",
    signinT: "Ouvrez le Web Dashboard depuis l'app", signinP: "Pour entrer sans mot de passe : dans l'app HINT 365, allez dans Rapport et touchez « Web Dashboard ». Le navigateur s'ouvre déjà connecté à votre compte.",
    ckT: "Cookies", ckP: "Le Web Dashboard utilise un seul cookie technique, <b>hint_s</b>, qui vous garde connecté 7 jours après l'avoir ouvert depuis l'app. Il ne contient qu'un code aléatoire, est interne et illisible par les scripts (HttpOnly, Secure, SameSite=Strict). Aucun cookie de profilage, de statistiques, de publicité ou de tiers. Votre choix reste enregistré dans ce navigateur. Détails dans la <a href=\"/privacy#cookie\">politique de confidentialité</a>.",
    ckYes: "J'accepte", ckNo: "Je refuse", ckIsOn: "Actuellement : vous avez accepté le cookie technique.", ckIsOff: "Actuellement : le cookie technique n'est pas enregistré.",
    ckShared: "Cette page en lecture seule n'utilise pas de cookies et n'enregistre rien dans le navigateur.", ckNoT: "Sans cookie, je ne peux pas vous garder connecté", ckNoP: "Le cookie technique sert seulement à vous garder connecté au Web Dashboard. Sans lui, vous pouvez continuer à utiliser l'app. Si vous changez d'avis, rouvrez le Web Dashboard depuis l'app et touchez « J'accepte ».", ckAgain: "Revoir le choix",
    subT: "Votre abonnement a expiré", subP: "Merci d'utiliser HINT 365. Renouvelez l'abonnement annuel dans l'app (Google Play) pour retrouver toutes les fonctions : vos mesures sont en sécurité et reviennent tout de suite.",
    goneT: "Lien expiré", goneP: "Ce lien n'est plus valable : il a expiré ou a été retiré par la personne qui l'a envoyé.",
    sharedB: (a, b, e) => `Rapport partagé par le patient : mesures du ${a} au ${b}. Lien valable jusqu'au ${e}.`,
    shTitle: "Envoyer le rapport au médecin", shIntro: "Choisissez comment l'envoyer : le PDF du rapport part avec un lien en lecture seule et un message déjà rédigé.",
    shExp7: "Le lien est valable 7 jours. La personne qui le reçoit ne voit que les graphiques et les mesures de la période : pas d'e-mail, pas de compte.",
    shClose: "Fermer", shRevoke: "Retirer tous les liens envoyés", shRevoked: "Tous les liens ont été retirés", shRevokeQ: "Rendre immédiatement invalides tous les liens envoyés ?",
    shWorking: "Préparation du PDF et du lien…", shDone: "Envoyé.", shAttach: "Le PDF a été téléchargé : joignez-le au message qui s'est ouvert.",
    footNote: "HINT 365 ne pose pas de diagnostic et n'évalue pas les valeurs : toute évaluation revient au médecin.",
    rights: "Tous droits réservés", terms: "Conditions d'utilisation",
    err: "Quelque chose n'a pas fonctionné. Réessayez.",
    chartAria: (k, a, b) => `${k}, moyennes journalières du ${a} au ${b}`,
   },
  }[LG];

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

  /* ---------- error log ----------
     Script errors met in the browser go to the grouped error log (worker/src/errors.ts): at most 5 per page,
     only when signed in (never on a doctor's link). The server already logs the errors it answers. */
  let logged = 0;
  function logError(code, place, message) {
    if (logged >= 5 || location.pathname.startsWith("/s/")) return;
    logged++;
    fetch("/my/api/log", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, place, message: String(message || "").slice(0, 300) }) }).catch(() => {});
  }
  window.addEventListener("error", (e) => logError("script", (e.filename || "").split("/").pop() + ":" + (e.lineno || 0), e.message));
  window.addEventListener("unhandledrejection", (e) => logError("promise", "app.js", e.reason && (e.reason.message || e.reason)));

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
      const svg = svgEl(el, "svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: "plot", role: "img",
        "aria-label": T.chartAria(keys.map((k) => k.toUpperCase()).join(" / "), date(range.from), date(range.to)) });
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
  const DARK_BAL = { ink: "#EAF0FA", muted: "#8C9BBA", beam: "#6F7FA3", panel: "#1C2B4F", sys: "#B3A7FF", dia: "#5FD3C6", scale: 1.5 };
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
        const spanDays = Math.round((midnight(data.to) - midnight(data.from)) / 864e5) + 1;
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
        for (const r of items) rows.push([day(r.t), time(r.t), ampm(r.period), r.sys, r.dia, r.pul ?? "", T.src[r.source] || r.source]);
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
      return `<tr class="${nd ? "newday" : ""}"><td>${nd ? d : ""}</td><td>${time(r.t)}</td><td>${ampm(r.period)}</td>
        <td class="sys"><b>${r.sys}</b></td><td class="dia"><b>${r.dia}</b></td><td class="pul">${r.pul ?? "–"}</td><td>${T.src[r.source] || r.source}</td></tr>`;
    }).join("");
    return `<div style="overflow-x:auto"><table class="readings"><thead><tr>${T.cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  /* ---------- page ---------- */
  const main = $("main");
  let current = { module: "bp", days: 7, data: null };
    current.days = 7;   // one week only: every reading readable

  function words() {
    $("btn-share").textContent = "✉ " + T.share; $("btn-pdf").textContent = T.pdf; $("btn-csv").textContent = T.csv;
    $("foot-note").textContent = T.footNote; $("rights").textContent = T.rights; $("terms-link").textContent = T.terms; 
    const y = new Date().getFullYear(); $("years").textContent = y > 2026 ? `2026–${y}` : "2026";
    document.documentElement.lang = LG;
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
  /* ---------- send the report to the doctor ----------
     One tap: the user chooses only Email or WhatsApp. Both the PDF and a read-only link (always 7 days) go,
     with a ready message in the phone's language. On a phone the PDF is attached through the system share
     (the browser cannot attach a file to WhatsApp or email otherwise); on a computer it is downloaded and
     the message opens in WhatsApp or the email program, to attach it. */
  const MSG = {
    it: { hello: "Buongiorno,", body: (a, b) => `trasmetto il report pressorio rilevato nel periodo ${a} - ${b}.`, link: (u, e) => `Link al report (valido fino al ${e}): ${u}`, subject: "Report pressorio" },
    en: { hello: "Good morning,", body: (a, b) => `I am sending the blood pressure report recorded in the period ${a} - ${b}.`, link: (u, e) => `Link to the report (valid until ${e}): ${u}`, subject: "Blood pressure report" },
    de: { hello: "Guten Tag,", body: (a, b) => `ich übermittle den Blutdruckbericht für den Zeitraum ${a} - ${b}.`, link: (u, e) => `Link zum Bericht (gültig bis ${e}): ${u}`, subject: "Blutdruckbericht" },
    fr: { hello: "Bonjour,", body: (a, b) => `je vous transmets le rapport de tension relevé sur la période ${a} - ${b}.`, link: (u, e) => `Lien vers le rapport (valable jusqu'au ${e}) : ${u}`, subject: "Rapport de tension" },
  };
  const LANG = (navigator.language || "en").slice(0, 2).toLowerCase();
  const M = MSG[LANG] || MSG.en;
  const fMsgDay = new Intl.DateTimeFormat(MSG[LANG] ? navigator.language : "en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
  let lastShare = null;
  function setupShare() {
    const dlg = $("share");
    $("sh-title").textContent = T.shTitle; $("sh-intro").textContent = T.shIntro;
    $("sh-close").textContent = T.shClose; $("sh-revoke").textContent = T.shRevoke; $("sh-exp").textContent = T.shExp7;
    $("sh-mail").textContent = "✉ Email"; $("sh-wa").textContent = "WhatsApp";
    $("btn-share").onclick = () => { $("sh-status").textContent = ""; dlg.showModal(); };
    const send = async (via) => {
      const status = $("sh-status");
      try {
        status.textContent = T.shWorking;
        // a second tap within 10 minutes reuses the same link instead of creating another one
        const r = lastShare && Date.now() - lastShare.at < 10 * 60e3 ? lastShare.r
          : (lastShare = { at: Date.now(), r: await api("/my/api/share", { method: "POST", body: JSON.stringify({ days: current.days }) }) }).r;
        const text = [M.hello, M.body(fMsgDay.format(r.from), fMsgDay.format(r.to)), "", M.link(r.url, fMsgDay.format(r.expiresAt))].join("\n");
        const { doc, name } = await buildPdf();
        const file = new File([doc.output("blob")], name, { type: "application/pdf" });
        // on a phone: the PDF and the message together, through the system share (the user picks WhatsApp or email)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: M.subject, text }); status.textContent = T.shDone; return; }
          catch (e) { if (e && e.name === "AbortError") { status.textContent = ""; return; } }
        }
        // on a computer: the PDF is downloaded, the message opens with the link; the PDF is attached by hand
        doc.save(name);
        const href = via === "wa" ? "https://wa.me/?text=" + encodeURIComponent(text)
          : `mailto:?subject=${encodeURIComponent(M.subject)}&body=${encodeURIComponent(text)}`;
        window.open(href, "_blank", "noopener");
        status.textContent = T.shAttach;
      } catch (e) { logError("share", "Web/send-to-doctor", e && e.message); status.textContent = T.err; }
    };
    $("sh-mail").onclick = () => send("mail");
    $("sh-wa").onclick = () => send("wa");
    $("sh-revoke").onclick = async () => { if (!confirm(T.shRevokeQ)) return; try { await api("/my/api/shares", { method: "DELETE" }); alert(T.shRevoked); } catch { alert(T.err); } };
  }

  /* ---------- cookie consent ----------
     The only cookie is the technical session cookie hint_s. It is set only after the person accepts it here;
     the choice (accepted, and which version of this notice) is kept in this browser's local storage. */
  const CK_KEY = "hint.cookies", CK_VER = "1";
  const ckGet = () => { try { return localStorage.getItem(CK_KEY); } catch { return null; } };
  const ckSet = (v) => { try { v == null ? localStorage.removeItem(CK_KEY) : localStorage.setItem(CK_KEY, v); } catch {} };
  // the notice; "state" adds the current choice on top, "info" shows only an OK (pages that set no cookie)
  function cookieBanner(opts = {}) {
    return new Promise((done) => {
      const box = document.createElement("div");
      box.className = "cookie"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
      const state = opts.state ? `<p class="ck-state">${opts.state}</p>` : "";
      const buttons = opts.info ? `<button class="btn primary" type="button" data-v="ok">OK</button>`
        : `<button class="btn" type="button" data-v="no">${T.ckNo}</button><button class="btn primary" type="button" data-v="yes">${T.ckYes}</button>`;
      box.innerHTML = `<div class="cookie-in"><h3>${T.ckT}</h3>${state}<p>${opts.info ? T.ckShared : T.ckP}</p><div class="cookie-b">${buttons}</div></div>`;
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
  function bindCookieLink(shared) {
    const a = $("cookie-link"); if (!a) return;
    a.textContent = T.ckT;
    a.onclick = async (e) => {
      e.preventDefault();
      if (shared) { await cookieBanner({ info: true }); return; }
      const yes = await cookieBanner({ state: ckGet() === "yes:" + CK_VER ? T.ckIsOn : T.ckIsOff });
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
    setupShare();
    load();
  }

  /* ---------- the owner's area ----------
     Usage numbers per anonymous account code: when it joined, when it was last used, how many readings.
     Never a value, a report or a name. The server refuses all of it to anyone but the owner. */
  const AD = IT ? {
    tab: "Admin", title: "Area del proprietario", sub: "La vedi solo tu · solo totali: nessuna misura, nessun report, nessun nome",
    upd: "Aggiornato", users: "Utenti", usersU: "in totale", aiOn: "Con funzionalità AI", aiOnU: "chiave Anthropic attiva", aiOff: "Senza funzionalità AI", aiOffU: "solo l'app",
    rd: "Misure", split: (v, f) => `${v} a voce · ${f} con Scan`, aiSp: "Spesa AI", aiSpU: "in totale, sui crediti Anthropic degli utenti",
    errs: "Errori", errsU: "in totale, ultimi 90 giorni",
    stT: "Spazio database", stOf: (a, b) => `${a} <span>di ${b}</span>`, stNote: (pc) => `${pc} usato · piano gratuito Cloudflare D1 · misure oltre 365 giorni cancellate ogni notte`,
    vT: "Versioni dell'app", vNew: (v) => `Versione più recente: ${v}`, vNone: "Nessuna versione bloccata: tutte le app installate funzionano.",
    vMin: (v) => `Bloccate tutte le versioni precedenti alla ${v}: mostrano solo il link per scaricare l'ultima.`,
    vOff: (v) => `Blocca le versioni precedenti alla ${v}`, vOn: "Sblocca tutte le versioni",
    vAskOff: (v) => `Tutte le app precedenti alla ${v} smettono subito di funzionare, su ogni telefono, finché non si installa l'ultima. I dati restano. Confermi?`,
    vAskOn: "Tutte le versioni installate tornano a funzionare. Confermi?",
  } : {
    tab: "Admin", title: "Owner's area", sub: "Only you see it · totals only: no readings, no reports, no names",
    upd: "Updated", users: "Users", usersU: "in total", aiOn: "With AI features", aiOnU: "Anthropic key on", aiOff: "Without AI features", aiOffU: "the app only",
    rd: "Readings", split: (v, f) => `${v} by voice · ${f} with Scan`, aiSp: "AI spending", aiSpU: "in total, on the users' own Anthropic credit",
    errs: "Errors", errsU: "in total, last 90 days",
    stT: "Database space", stOf: (a, b) => `${a} <span>of ${b}</span>`, stNote: (pc) => `${pc} used · Cloudflare D1 free plan · readings older than 365 days deleted every night`,
    vT: "App versions", vNew: (v) => `Newest version: ${v}`, vNone: "No version blocked: every installed app works.",
    vMin: (v) => `Every version older than ${v} is blocked: it shows only the link to download the latest.`,
    vOff: (v) => `Block versions older than ${v}`, vOn: "Unblock every version",
    vAskOff: (v) => `Every app older than ${v} stops working at once, on every phone, until the latest is installed. The data stay. Confirm?`,
    vAskOn: "Every installed version works again. Confirm?",
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
    const pcText = pc.toLocaleString(LOCALE, { maximumFractionDigits: pc < 1 ? 2 : 1 }) + " %";
    main.innerHTML = `
      <div class="bar"><h1>${AD.title}</h1><span class="grow"></span><span class="sub">${AD.upd} ${time(d.at)}</span></div>
      <p class="note">${AD.sub}</p>
      <section class="tiles adm">
        ${tile(AD.users, t.users, AD.usersU)}
        ${tile(AD.aiOn, t.aiOn, AD.aiOnU)}
        ${tile(AD.aiOff, t.aiOff, AD.aiOffU)}
        ${tile(AD.rd, t.readings, AD.split(t.voice, t.photo))}
        ${tile(AD.aiSp, "$" + t.aiSpentUsd.toFixed(2), AD.aiSpU)}
        ${tile(AD.errs, t.errors, AD.errsU)}
      </section>
      <div class="card space">
        <div class="space-h"><span class="l">${AD.stT}</span><span class="v">${AD.stOf(mb(st.dbBytes), mb(st.freeLimitBytes))}</span></div>
        <div class="meter" role="img" aria-label="${pcText}"><i style="width:${Math.max(pc, 0.6)}%"></i></div>
        <p class="muted small">${AD.stNote(pcText)}</p>
      </div>
      <div class="card"><div class="card-h"><h2>${AD.vT}</h2></div>
        <p>${v.newest ? AD.vNew(ver(v.newest)) : ""}</p>
        <p>${v.min ? AD.vMin(ver(v.min)) : AD.vNone}</p>
        <div class="send" style="margin:8px 0 6px">
          ${v.newest && v.min < v.newest ? `<button class="btn" type="button" id="adm-off">${AD.vOff(ver(v.newest))}</button>` : ""}
          ${v.min ? `<button class="btn ghost" type="button" id="adm-on">${AD.vOn}</button>` : ""}
        </div>
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
  // the A4 report as a jsPDF document (the same pages as the app)
  async function buildPdf() {
    // the PDF libraries (jsPDF, svg2pdf, MIT licence, served from this site) are loaded only when needed
    if (!window.jspdf) await loadScript("/my/vendor/jspdf-4.2.1.umd.min.js");
    if (!window.svg2pdf) await loadScript("/my/vendor/svg2pdf-2.8.1.umd.min.js");
    const box = $("print");
    window.HintReport.render(box, current.data);
    box.classList.add("building");
    try {
      const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4", compress: true });
      const pages = [...box.querySelectorAll(".a4 svg")];
      for (let i = 0; i < pages.length; i++) {
        if (i) doc.addPage("a4");
        await doc.svg(pages[i], { x: 0, y: 0, width: 595.28, height: 841.89 });
      }
      return { doc, name: `HINT-${T.bpTitle.replace(/\s+/g, "-")}-${day(current.data.to).replace(/[./]/g, "-")}.pdf` };
    } finally { box.classList.remove("building"); }
  }
  async function printReport() {
    if (!current.data || !window.HintReport) return;
    const btn = $("btn-pdf"); btn.disabled = true;
    try {
      const { doc, name } = await buildPdf();
      doc.save(name);
    } catch (e) {
      logError("pdf", "Web/PDF", e && e.message);
      // if anything goes wrong, the browser's own "Save as PDF" still gives the same pages
      setTimeout(() => window.print(), 50);
    } finally { btn.disabled = false; }
  }

  async function startShared(token) {
    bindCookieLink(true);
    // the doctor's view: only the PDF button
    $("actions").hidden = false;
    for (const id of ["btn-share", "btn-csv"]) $(id).hidden = true;
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
