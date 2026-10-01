// Web Dashboard: the personal web dashboard of HINT 365.
// Opened from the app already signed in (see worker/src/web.ts), or as a read-only link shared with the doctor (/s/...).
// Each part of the dashboard is a module in MODULES: blood pressure now, lab results later. A module gets its data
// from /my/api/data?module=<id> and draws itself in the page; sign-in, periods, sharing and export are shared by all.
// The charts are drawn by this file as SVG: no library and no request to third parties.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  // light or dark: what the app says ("&light" / "&dark" in the link it opens), otherwise the device's setting.
  // Kept only in the address, never stored in the browser.
  const themeAsked = (location.hash.match(/(?:^#|&)(light|dark)\b/) || [])[1] || "";
  const themeNow = () => themeAsked || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  document.documentElement.dataset.theme = themeNow();
  matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
    document.documentElement.dataset.theme = themeNow(); (window.__hintRedraw || []).forEach((f) => f());
  });
  // the page speaks the browser's language: Italian, German, French, otherwise English
  const L2 = (navigator.language || "en").slice(0, 2).toLowerCase();
  const LG = ["it", "de", "fr"].includes(L2) ? L2 : "en";
  document.documentElement.lang = LG;
  const IT = LG === "it";
  const LOCALE = { it: "it-CH", de: "de-CH", fr: "fr-CH", en: "en-GB" }[LG];
  const TZ = "Europe/Zurich";
  // the moment of the day in the tables, short to save space: before 12:00 AM, after PM
  const ampm = (p) => (p === "morning" ? "AM" : "PM");

  /* ---------- words ---------- */
  const T = {
   it: {
    st: { avg: "Media del periodo", pul: "PUL medio", m: "Media mattina", e: "Media sera", hiS: "SYS più alta", hiD: "DIA più alta", lo: "Valore più basso", pr: "PUL, min–max", nIn: (n, d) => `${n} misure in ${d} giorni`, perMin: "al minuto" },
    share: "Condividi", pdf: "Scarica PDF", csv: "Excel",
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
    signinT: "Apri Web Dashboard dall'app", signinP: "Per entrare senza password: nell'app HINT 365 tocca «Report» nella barra in basso. Il browser si apre già collegato al tuo account.",
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
    st: { avg: "Period average", pul: "Average PUL", m: "Morning average", e: "Evening average", hiS: "Highest SYS", hiD: "Highest DIA", lo: "Lowest value", pr: "PUL, min–max", nIn: (n, d) => `${n} readings on ${d} days`, perMin: "per minute" },
    share: "Share", pdf: "Download PDF", csv: "Excel",
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
    signinT: "Open Web Dashboard from the app", signinP: "To come in without a password: in the HINT 365 app tap “Reports” in the bar at the bottom. The browser opens already signed in to your account.",
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
    st: { avg: "Mittel des Zeitraums", pul: "PUL-Mittel", m: "Mittel morgens", e: "Mittel abends", hiS: "Höchster SYS", hiD: "Höchster DIA", lo: "Tiefster Wert", pr: "PUL, min–max", nIn: (n, d) => `${n} Messungen an ${d} Tagen`, perMin: "pro Minute" },
    share: "Teilen", pdf: "PDF herunterladen", csv: "Excel",
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
    signinT: "Web Dashboard aus der App öffnen", signinP: "Ohne Passwort hinein: In der App HINT 365 unten in der Leiste «Berichte» tippen. Der Browser öffnet sich bereits mit Ihrem Konto verbunden.",
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
    st: { avg: "Moyenne de la période", pul: "PUL moyen", m: "Moyenne du matin", e: "Moyenne du soir", hiS: "SYS la plus haute", hiD: "DIA la plus haute", lo: "Valeur la plus basse", pr: "PUL, min–max", nIn: (n, d) => `${n} mesures sur ${d} jours`, perMin: "par minute" },
    share: "Partager", pdf: "Télécharger PDF", csv: "Excel",
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
    signinT: "Ouvrez le Web Dashboard depuis l'app", signinP: "Pour entrer sans mot de passe : dans l'app HINT 365, touchez « Rapports » dans la barre du bas. Le navigateur s'ouvre déjà connecté à votre compte.",
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
  // the theme's colours (style.css, the same as the app): read when drawing, so dark and light both follow
  const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COL = new Proxy({}, { get: (_, k) => cssv("--" + k) });          // sys, dia, pul: no red, it would read as "a problem"
  const TXT = new Proxy({}, { get: (_, k) => cssv("--" + k + "-t") });
  const NS = "http://www.w3.org/2000/svg";
  const fRange = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: "numeric", month: "short" });
  const redraws = []; window.__hintRedraw = redraws;
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
        svgEl(svg, "line", { x1: L, x2: R, y1: Y(v), y2: Y(v), stroke: cssv("--grid"), "stroke-width": 1 });
        svgEl(svg, "text", { x: R + 8, y: Y(v) + 4, class: "ax" }, v);
      }
      // under each place, only the day of the month
      slots.forEach((sl, i) => svgEl(svg, "text", { x: X(i), y: B + 20, class: "day", "text-anchor": "middle" }, new Date(sl.day).getUTCDate()));
      const dots = [];
      for (const k of [...keys].reverse()) {
        const p = slots.map((sl, i) => (sl.v[k] != null ? { x: X(i), y: Y(sl.v[k]), v: sl.v[k], k } : null)).filter(Boolean);
        if (p.length > 1) svgEl(svg, "path", { d: "M" + p.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" L"), fill: "none", stroke: COL[k], "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" });
        for (const q of p) svgEl(svg, "circle", { cx: q.x, cy: q.y, r: 5, fill: COL[k], stroke: cssv("--panel"), "stroke-width": 2 });
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
      const cross = svgEl(svg, "line", { x1: 0, x2: 0, y1: TOP - 10, y2: B, stroke: cssv("--muted"), "stroke-width": 1, "stroke-dasharray": "2 3", visibility: "hidden" });
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

  // the morning / evening balance, the same drawing as in the PDF (report.js), in the colours of the theme
  const balTheme = () => ({ ink: cssv("--ink"), muted: cssv("--muted"), beam: cssv("--day"), panel: cssv("--panel2"), sys: cssv("--sys-t"), dia: cssv("--dia-t"), scale: 1.5 });
  function drawBalance(el, items) {
    const draw = () => {
      el.innerHTML = "";
      const W = el.clientWidth, H = 214;
      const svg = svgEl(el, "svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
      window.HintReport.balance(svg, 2, 4, W - 4, H - 8, items, balTheme());
    };
    draw(); redraws.push(draw);
  }

  const LAB = {
    it: { title: "Referti", above: "sopra il riferimento", below: "sotto il riferimento", note: "Risultati letti sul telefono dai referti che hai caricato: una colonna per ogni data di referto, una riga per ogni esame. Un trattino: esame non presente in quel referto. In arancione con ↑ o ↓ un risultato fuori dal riferimento stampato sul referto. Nessuna interpretazione medica.", empty: "Importa un referto dall’app per iniziare lo storico.", test: "Esame", del: "Elimina", delQ: (d) => `Eliminare tutti i risultati del ${d}? Il referto potrà essere caricato di nuovo.`, period: "Restano finché li elimini", delAll: "Elimina tutti i referti", delAllQ: "Eliminare tutti i risultati dei referti? Non si possono recuperare.", share: "Condividi il PDF delle analisi. Il documento originale non è incluso.", ref: "rif.", pdfCount: (r, t) => `${r} ${r === 1 ? "referto" : "referti"} · ${t} esami`, pdfGen: (d) => `Generato il ${d}`, pdfNote: "Valori come stampati sui referti, letti sul telefono. In arancione con un piccolo triangolo un risultato fuori dal riferimento stampato sullo stesso referto: solo un confronto fra numeri.", pdfDisc: "Documento preparato dal paziente, senza valutazioni sui valori. La valutazione clinica spetta al medico.", pdfPage: (a, b) => `Pagina ${a} di ${b}` },
    en: { title: "Lab results", above: "above the reference", below: "below the reference", note: "Results read on your phone from the reports you uploaded: one column per report date, one row per test. A dash: test not in that report. In orange with ↑ or ↓: a result outside the reference printed on the report. No medical interpretation.", empty: "Import a lab report in the app to start your history.", test: "Test", del: "Delete", delQ: (d) => `Delete all results of ${d}? The report can be imported again.`, period: "Kept until you delete them", delAll: "Delete all lab results", delAllQ: "Delete all lab results? They cannot be recovered.", share: "Share the lab results PDF. The original document is not included.", ref: "ref.", pdfCount: (r, t) => `${r} ${r === 1 ? "report" : "reports"} · ${t} tests`, pdfGen: (d) => `Generated on ${d}`, pdfNote: "Values as printed on the reports, read on the phone. In orange with a small triangle: a result outside the reference printed on the same report, only a comparison of numbers.", pdfDisc: "Document prepared by the patient, with no assessment of the values. Clinical evaluation is up to the doctor.", pdfPage: (a, b) => `Page ${a} of ${b}` },
    de: { title: "Laborbefunde", above: "über der Referenz", below: "unter der Referenz", note: "Auf Ihrem Telefon aus den hochgeladenen Befunden gelesene Werte: eine Spalte pro Befunddatum, eine Zeile pro Test. Ein Strich: Test nicht in diesem Befund. Orange mit ↑ oder ↓: ein Wert außerhalb der auf dem Befund gedruckten Referenz. Keine medizinische Interpretation.", empty: "Importieren Sie einen Laborbefund in der App, um den Verlauf zu starten.", test: "Test", del: "Löschen", delQ: (d) => `Alle Werte vom ${d} löschen? Der Befund kann erneut importiert werden.`, period: "Gespeichert, bis Sie sie löschen", delAll: "Alle Laborwerte löschen", delAllQ: "Alle Laborwerte löschen? Sie können nicht wiederhergestellt werden.", share: "PDF der Laborwerte teilen. Das Originaldokument ist nicht enthalten.", ref: "Ref.", pdfCount: (r, t) => `${r} ${r === 1 ? "Befund" : "Befunde"} · ${t} Tests`, pdfGen: (d) => `Erstellt am ${d}`, pdfNote: "Werte wie auf den Befunden gedruckt, auf dem Telefon gelesen. Orange mit kleinem Dreieck: ein Wert außerhalb der auf demselben Befund gedruckten Referenz, nur ein Zahlenvergleich.", pdfDisc: "Vom Patienten erstelltes Dokument, ohne Bewertung der Werte. Die klinische Beurteilung ist Sache des Arztes.", pdfPage: (a, b) => `Seite ${a} von ${b}` },
    fr: { title: "Analyses", above: "au-dessus de la référence", below: "en dessous de la référence", note: "Résultats lus sur votre téléphone à partir des comptes rendus importés : une colonne par date, une ligne par analyse. Un tiret : analyse absente de ce compte rendu. En orange avec ↑ ou ↓ : un résultat hors de la référence imprimée sur le compte rendu. Aucune interprétation médicale.", empty: "Importez un compte rendu dans l’application pour commencer votre historique.", test: "Analyse", del: "Supprimer", delQ: (d) => `Supprimer tous les résultats du ${d} ? Le compte rendu pourra être importé à nouveau.`, period: "Conservés jusqu’à ce que vous les supprimiez", delAll: "Supprimer toutes les analyses", delAllQ: "Supprimer tous les résultats d’analyses ? Ils ne pourront pas être récupérés.", share: "Partager le PDF des analyses. Le document original n’est pas inclus.", ref: "réf.", pdfCount: (r, t) => `${r} ${r === 1 ? "compte rendu" : "comptes rendus"} · ${t} analyses`, pdfGen: (d) => `Généré le ${d}`, pdfNote: "Valeurs telles qu'imprimées sur les comptes rendus, lues sur le téléphone. En orange avec un petit triangle : un résultat hors de la référence imprimée sur le même compte rendu, une simple comparaison de nombres.", pdfDisc: "Document préparé par le patient, sans évaluation des valeurs. L'évaluation clinique revient au médecin.", pdfPage: (a, b) => `Page ${a} sur ${b}` },
  }[LG];
  const labLabel = x => x.code ? (window.HintLabLabels[LG][x.code] || x.name || x.code) : x.name;
  // one row per test across laboratories: same key as the app and the server (worker/src/labs.ts)
  const labKey = x => x.code || "n:" + String(x.name).normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim() + (x.unit === "%" ? "|%" : "");
  const htmlSafe = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function labRows(data) { return data.items.flatMap(report => report.items.map(x => ({ ...x, t: report.t }))); }
  /**
   * The table grows with the reports: one column per report date (oldest on the left, reports of the same day
   * together), one row per test ever measured, in the order they first appear. A test missing on a date shows a dash.
   */
  function labMatrix(data) {
    const days = [...new Set(data.items.map(r => r.t))].sort((a, b) => a - b);
    const tests = new Map();
    for (const x of labRows(data).sort((a, b) => a.t - b.t)) {
      const k = labKey(x);
      if (!tests.has(k)) tests.set(k, { label: labLabel(x), cells: new Map() });
      tests.get(k).cells.set(x.t, x);
    }
    return { days, tests: [...tests.values()] };
  }
  /**
   * Compared only with the reference printed next to it on the same report: 1 above, -1 below, 0 inside or not
   * comparable (qualitative, "< x" results, other references). A comparison, not a diagnosis (same rule in the app).
   */
  function outOfRange(x) {
    if (/^[<>≤≥]/.test(x.value.trim())) return 0;
    const v = Number(x.value.trim().replace(',', '.')); if (!Number.isFinite(v) || x.value.trim() === '') return 0;
    const r = x.reference.trim().replaceAll(',', '.').replace('–', '-');
    let m = r.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
    if (m) return v < +m[1] ? -1 : v > +m[2] ? 1 : 0;
    m = r.match(/^([<>≤≥])\s*(\d+(?:\.\d+)?)$/);
    if (m) { const k = +m[2]; return { '<': v >= k ? 1 : 0, '≤': v > k ? 1 : 0, '>': v <= k ? -1 : 0, '≥': v < k ? -1 : 0 }[m[1]]; }
    return 0;
  }
  function renderLabs(main, data) {
    const rows = labRows(data), { days, tests } = labMatrix(data);
    const head = `<thead><tr><th class="lab-test" scope="col">${LAB.test}</th>${days.map(t => `<th scope="col" class="lab-day"><span>${day(t)}</span><button type="button" class="lab-del" data-t="${t}" aria-label="${LAB.del} ${day(t)}">${LAB.del}</button></th>`).join('')}</tr></thead>`;
    // the unit sits with each value: laboratories may measure the same test in different units
    const body = tests.map(r => `<tr><th scope="row" class="lab-test">${htmlSafe(r.label)}</th>${days.map(t => {
      const x = r.cells.get(t);
      if (!x) return `<td class="na" aria-label="—">–</td>`;
      const o = outOfRange(x);
      return `<td${o ? ` class="out" title="${o > 0 ? LAB.above : LAB.below}"` : ''}><b>${htmlSafe(x.value)}${x.unit ? `<span class="u"> ${htmlSafe(x.unit)}</span>` : ''}${o ? `<span class="arrow" aria-label="${o > 0 ? LAB.above : LAB.below}">${o > 0 ? '↑' : '↓'}</span>` : ''}</b>${x.reference ? `<small>${LAB.ref} ${htmlSafe(x.reference)}</small>` : ''}</td>`;
    }).join('')}</tr>`).join('');
    main.innerHTML = `<div class="bar"><h1>${LAB.title}</h1><span>${LAB.period}</span></div><p class="note">${LAB.note}</p>${!rows.length ? `<section class="card"><p>${LAB.empty}</p></section>` : `<section class="card"><div class="table-wrap lab-wrap"><table class="lab-matrix">${head}<tbody>${body}</tbody></table></div><p class="lab-foot"><button type="button" class="lab-del lab-del-all">${LAB.delAll}</button></p></section>`}`;
    const all = main.querySelector(".lab-del-all");
    if (all) all.onclick = async () => {
      if (!confirm(LAB.delAllQ)) return;
      all.disabled = true;
      try { await api("/my/api/labs", { method: "DELETE", body: JSON.stringify({ all: true }) }); load(); }
      catch (e) { all.disabled = false; if (e.status === 401) signedOut(); else message(T.err, ""); }
    };
    main.querySelectorAll(".lab-del[data-t]").forEach(b => b.onclick = async () => {
      const t = Number(b.dataset.t);
      if (!confirm(LAB.delQ(day(t)))) return;
      b.disabled = true;
      try { await api("/my/api/labs", { method: "DELETE", body: JSON.stringify({ t }) }); load(); }
      catch (e) { b.disabled = false; if (e.status === 401) signedOut(); else message(T.err, ""); }
    });
  }

  /* ---------- modules ---------- */
  const MODULES = {
    labs: { title: () => LAB.title, render: renderLabs },
    bp: {
      title: () => T.bp,
      render(main, data, ctx) {
        const items = data.items;
        const n = items.length;
        const per = `${fRange.formatRange(data.from, data.to)} · ${T.dailyAvg}`;   // e.g. "21–27 set · media di ogni giorno"
        main.innerHTML = `
          ${ctx.banner || ""}
          <div class="bar">
            <div><h1>${T.bpTitle}</h1><div class="sub">${date(data.from)} – ${date(data.to)} · ${T.readings(n)}</div></div>
            <span class="grow"></span>${ctx.pills || ""}
          </div>
          ${n ? `
          <p class="note">ⓘ ${T.chartsNote}</p>
          <section class="card"><div class="card-h"><h2>${T.whole}</h2><span class="sub">${per}</span><div class="legend" id="lg-all"></div></div><div class="chart" id="ch-all"></div></section>
          <section class="tiles stats">${stats(items)}</section>
          <section class="card"><div class="bal" id="bal"></div></section>
          <section class="card"><div class="card-h"><h2>${T.pulse}</h2><span class="sub">${per}</span><div class="legend" id="lg-p"></div></div><div class="chart small" id="ch-p"></div></section>
          <section class="card"><details${ctx.shared ? " open" : ""}><summary>${T.list} (${n})</summary>${table(items)}</details></section>
          ` : `<div class="card"><div class="empty" style="height:200px">${T.none}</div></div>`}`;
        ctx.bindPills && ctx.bindPills();
        if (!n) return;
        lineChart($("ch-all"), $("lg-all"), items, ["sys", "dia"], data);
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

  // the eight boxes of the Report in the app (stats() in Core.kt), in pairs: averages, morning and evening, peaks, pulse
  function stats(items) {
    const mean = (l, k) => { const v = l.map((r) => r[k]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    const bp = (l) => (l.length ? `${mean(l, "sys")}/${mean(l, "dia")}` : "–");
    const by = (k, hi) => items.reduce((a, b) => (a == null || (hi ? b[k] > a[k] : b[k] < a[k]) ? b : a), null);
    const at = (r) => (r ? `${day(r.t)} · ${time(r.t)}` : "");
    const pair = (r) => (r ? `${r.sys}/${r.dia}` : "–");
    const m = items.filter((r) => r.period === "morning"), e = items.filter((r) => r.period === "evening");
    const puls = items.map((r) => r.pul).filter((x) => x != null);
    const box = (c, l, v, u, w) => `<div class="tile" style="--c:${c}"><div class="l">${l}</div><div class="v">${v}${u ? `<small>${u}</small>` : ""}</div><div class="w">${w}</div></div>`;
    const hiS = by("sys", true), hiD = by("dia", true), lo = by("sys", false);
    return [
      box("var(--line)", T.st.avg, bp(items), "mmHg", T.st.nIn(items.length, new Set(items.map((r) => day(r.t))).size)),
      box(COL.pul, T.st.pul, mean(items, "pul") ?? "–", "bpm", T.st.perMin),
      box("var(--line)", "☀ " + T.st.m, bp(m), m.length ? "mmHg" : "", T.nOf(m.length)),
      box("var(--line)", "☾ " + T.st.e, bp(e), e.length ? "mmHg" : "", T.nOf(e.length)),
      box(COL.sys, T.st.hiS, pair(hiS), "mmHg", at(hiS)),
      box(COL.dia, T.st.hiD, pair(hiD), "mmHg", at(hiD)),
      box("var(--line)", T.st.lo, pair(lo), "mmHg", at(lo)),
      box(COL.pul, T.st.pr, puls.length ? `${Math.min(...puls)}–${Math.max(...puls)}` : "–", "bpm", T.st.perMin),
    ].join("");
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
    $("btn-share").textContent = "✉ " + T.share; $("btn-pdf").textContent = T.pdf;
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
      const data = await api(`/my/api/data?module=${current.module}&days=${current.module === "labs" ? 365 : current.days}`);
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
    $("btn-share").onclick = () => { $("sh-status").textContent = ""; $("sh-intro").textContent = current.module === "labs" ? LAB.share : T.shIntro; $("sh-exp").hidden = $("sh-revoke").hidden = current.module === "labs"; dlg.showModal(); };
    const send = async (via) => {
      const status = $("sh-status");
      try {
        status.textContent = T.shWorking;
        if (current.module === "labs") {
          const { doc, name } = await buildPdf();
          const file = new File([doc.output("blob")], name, { type: "application/pdf" });
          if (navigator.canShare?.({ files: [file] })) {
            try { await navigator.share({ files: [file], title: LAB.title }); status.textContent = T.shDone; return; }
            catch (e) { if (e?.name === "AbortError") { status.textContent = ""; return; } }
          }
          doc.save(name);
          window.open(via === "wa" ? "https://wa.me/?text=" + encodeURIComponent(LAB.title) : "mailto:?subject=" + encodeURIComponent(LAB.title), "_blank", "noopener");
          status.textContent = T.shAttach; return;
        }
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
    $("sh-revoke").onclick = async () => { if (!confirm(T.shRevokeQ)) return; try { await api("/my/api/shares", { method: "DELETE" }); lastShare = null; alert(T.shRevoked); } catch { alert(T.err); } };
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
    // "&admin": opened from the owner's button in the app. The owner's area is not a tab of the dashboard.
    const wantAdmin = /(?:^#|&)admin\b/.test(location.hash);
    // "&labs" / "&bp": the tab to open on, from where the person was in the app (blood pressure if not said)
    const wantMod = (location.hash.match(/(?:^#|&)(bp|labs)\b/) || [])[1];
    const tail = themeAsked ? "&" + themeAsked : "";
    const home = wantAdmin ? "/my/#admin" + tail : wantMod ? "/my/#" + wantMod + tail : themeAsked ? "/my/#" + themeAsked : "/my/";
    if (!(await cookiesOk())) { if (m) history.replaceState(null, "", "/my/"); return cookiesRefused(); }
    if (m) {
      history.replaceState(null, "", home);
      try { await api("/my/session", { method: "POST", body: JSON.stringify({ code: m[1] }) }); } catch (e) { /* expired: fall through to the cookie, if any */ }
    }
    let me;
    try { me = await api("/my/api/me"); } catch (e) { return signedOut(); }
    $("actions").hidden = false;
    // blood pressure first, then the lab results; the app says which tab to open on (&bp, &labs)
    const order = ["bp", "labs"].filter((id) => me.modules.includes(id)).concat(me.modules.filter((id) => id !== "bp" && id !== "labs"));
    // opened from the app: one page only, the one of where the person was (no tabs to switch)
    if (wantMod && me.modules.includes(wantMod) && MODULES[wantMod]) { current.module = wantMod; $("modules").hidden = true; }
    $("modules").innerHTML = order.map((id) => `<button type="button" data-m="${id}" class="${id === current.module ? "on" : ""}">${MODULES[id] ? MODULES[id].title() : id}</button>`).join("");
    $("modules").onclick = (e) => {
      const id = e.target.dataset.m; if (!id || !MODULES[id]) return;
      [...$("modules").children].forEach((b) => b.classList.toggle("on", b.dataset.m === id));
      if (location.hash) history.replaceState(null, "", themeAsked ? "/my/#" + themeAsked : "/my/");
      $("actions").hidden = false; current.module = id; load();
    };
    $("btn-pdf").onclick = printReport;
    setupShare();
    // the owner's area: only from the owner's button in the app; the server answers it only for the owner
    if (wantAdmin && me.isOwner) {
      // the console shows the numbers only: no Blood pressure / Lab results tabs above it
      $("modules").hidden = true;
      $("actions").hidden = true;
      return loadAdmin();
    }
    load();
  }

  /* ---------- the owner's area ----------
     Usage numbers per anonymous account code: when it joined, when it was last used, how many readings.
     Never a value, a report or a name. The server refuses all of it to anyone but the owner. */
  const AD = IT ? {
    tab: "Admin", title: "Area del proprietario", sub: "La vedi solo tu · solo totali: nessuna misura, nessun report, nessun nome",
    upd: "Aggiornato", users: "Utenti", usersU: "in totale", labs: "Referti", labsU: "salvati, di tutti gli utenti",
    rd: "Misure", split: (v, f) => `${v} a voce` + (f ? ` · ${f} con la vecchia Scan` : ""),
    errs: "Errori", errsU: "in totale, ultimi 90 giorni",
    stT: "Spazio database", stOf: (a, b) => `${a} <span>di ${b}</span>`, stNote: (pc) => `${pc} usato · piano gratuito Cloudflare D1 · misure oltre 365 giorni cancellate ogni notte`,
    vT: "Versioni dell'app", vNew: (v) => `Versione più recente: ${v}`, vNone: "Nessuna versione bloccata: tutte le app installate funzionano.",
    vMin: (v) => `Bloccate tutte le versioni precedenti alla ${v}: mostrano solo il link per scaricare l'ultima.`,
    vOff: (v) => `Blocca le versioni precedenti alla ${v}`, vOn: "Sblocca tutte le versioni",
    vAskOff: (v) => `Tutte le app precedenti alla ${v} smettono subito di funzionare, su ogni telefono, finché non si installa l'ultima. I dati restano. Confermi?`,
    vAskOn: "Tutte le versioni installate tornano a funzionare. Confermi?",
    secT: "Sicurezza e vulnerabilità", secOpen: "Apri la console",
    kVc: "Vulnerabilità · codice app", kVcU: "server, web, segreti", kVm: "Vulnerabilità · Android / iOS", kVmU: "librerie dell'app sul telefono",
    kDf: "Difetti aperti", kDfU: "problemi reali ancora da chiudere", kCm: "Compliance non coperta", kCmU: (p, o) => `${p} parziali · ${o} aperti`, obGo: "Apri Observability →",
    obT: "Observability", obOpen: "Apri Observability", obSub: "Vulnerabilità, compliance UE e Svizzera, problemi incontrati dagli utenti e come sono stati risolti, esiti dei caricamenti. Solo codici e conteggi: nessun valore, nessun nome.",
    obSum: (c, o, p) => `Compliance ${c.ok}/${c.all} · ${o} vulnerabilità aperte · ${p} problemi aperti`,
    obVul: "Vulnerabilità aperte", obVulU: "librerie, codice, segreti", obCmp: "Compliance", obCmpU: (p, o) => `${p} parziali · ${o} aperti`, obPrb: "Problemi aperti", obPrbU: "errori reali, ultimi 90 giorni", obImp: "Referti caricati", obImpU: (f) => `ultimi 30 giorni · ${f} non salvati`,
    obCmpT: "Compliance UE e Svizzera (GDPR, LPD)", obCmpN: (d) => `Autovalutazione dello sviluppatore, non parere legale · rivista il ${d} · fonte docs/compliance/gdpr.md`,
    obCmpCols: ["", "Ambito", "Requisito", "Norma", "Stato", "Evidenza · prossimo passo"],
    obPrbT: "Problemi e risoluzioni", obPrbN: "Dal registro errori (90 giorni) e dal registro dei problemi su git: causa, correzione e pull request.",
    obPrbCols: ["Problema", "Dove", "Versioni", "Volte", "Ultima", "Stato", "Causa · correzione"],
    obEvT: "Caricamento referti · ultimi 30 giorni", obEvN: "Esiti contati dal server e motivi dei rifiuti sul telefono. Solo codici.",
    obEvCols: ["Esito", "Volte", "Versioni", "Ultimo"], obSecOpen: "Console di sicurezza →", selAll: "Seleziona tutte", selNone: "Deseleziona tutte", obProof: "Dossier PDF, paragrafo", obNew: "nuovo, da analizzare",
    secSum: (s) => `${s.vulnerable} librerie vulnerabili su ${s.libraries ?? "?"} · ${s.code} nel nostro codice · ${s.secrets} segreti`,
    secNone: "Nessuna scansione ancora: la prima gira stanotte alle 06:10.", secAt: (d) => `Ultima scansione: ${d}`,
    back: "← Admin", conT: "Console di sicurezza",
    conSub: "Scansione di ogni notte (06:10) su OSV.dev, Semgrep e gitleaks. Rischio: gravità dell'avviso e, se valutato, la nostra.",
    kLib: "Librerie controllate", kLibU: (full) => full ? "albero completo dell'app" : "solo quelle dichiarate", kVul: "Librerie vulnerabili", kVulU: "con un avviso pubblicato",
    kCode: "Nostro codice", kCodeU: "segnalazioni Semgrep", kSec: "Segreti", kSecU: "nel repository (gitleaks)",
    libT: "Librerie vulnerabili", codeT: "Nostro codice", secsT: "Segreti nel repository",
    cols: ["Libreria", "Versione", "Dove", "Rischio", "Corretta in", "Fonte", "Piano"], ccols: ["Regola", "Dove", "Rischio", "Fonte", "Piano"],
    none: "Niente da segnalare.", plan: "piano", line: "riga", fixCol: "Fix", all: "tutte", fixBtn: (n) => `Fix (${n})`, fixing: "in corso",
    fixAsk: (n) => `Avviare la correzione di ${n} segnalazioni? Claude prepara le modifiche; quelle piccole vengono unite dopo i controlli, quelle grandi aspettano te.`,
    fixOk: (u) => `Richiesta inviata. Segui qui: ${u}`, fixOff: "Fix non è ancora attivo: manca il token GitHub del server (vedi docs/security/vulnerability-management.md).",
    fixHint: "Seleziona le righe e premi Fix: Claude prepara la correzione seguendo il processo.", triage: "da valutare", ours: "nostro", run: "dettagli dell'esecuzione", noFix: "nessuna correzione",
  } : {
    tab: "Admin", title: "Owner's area", sub: "Only you see it · totals only: no readings, no reports, no names",
    upd: "Updated", users: "Users", usersU: "in total", labs: "Lab reports", labsU: "saved, all users",
    rd: "Readings", split: (v, f) => `${v} by voice` + (f ? ` · ${f} with the former Scan` : ""),
    errs: "Errors", errsU: "in total, last 90 days",
    stT: "Database space", stOf: (a, b) => `${a} <span>of ${b}</span>`, stNote: (pc) => `${pc} used · Cloudflare D1 free plan · readings older than 365 days deleted every night`,
    vT: "App versions", vNew: (v) => `Newest version: ${v}`, vNone: "No version blocked: every installed app works.",
    vMin: (v) => `Every version older than ${v} is blocked: it shows only the link to download the latest.`,
    vOff: (v) => `Block versions older than ${v}`, vOn: "Unblock every version",
    vAskOff: (v) => `Every app older than ${v} stops working at once, on every phone, until the latest is installed. The data stay. Confirm?`,
    vAskOn: "Every installed version works again. Confirm?",
    secT: "Security and vulnerabilities", secOpen: "Open the console",
    kVc: "Vulnerabilities · app code", kVcU: "server, web, secrets", kVm: "Vulnerabilities · Android / iOS", kVmU: "libraries of the phone app",
    kDf: "Open defects", kDfU: "real problems still to close", kCm: "Compliance not covered", kCmU: (p, o) => `${p} partial · ${o} open`, obGo: "Open Observability →",
    obT: "Observability", obOpen: "Open Observability", obSub: "Vulnerabilities, EU and Swiss compliance, problems users met and how they were solved, import outcomes. Codes and counts only: no value, no name.",
    obSum: (c, o, p) => `Compliance ${c.ok}/${c.all} · ${o} open vulnerabilities · ${p} open problems`,
    obVul: "Open vulnerabilities", obVulU: "libraries, code, secrets", obCmp: "Compliance", obCmpU: (p, o) => `${p} partial · ${o} open`, obPrb: "Open problems", obPrbU: "real errors, last 90 days", obImp: "Reports imported", obImpU: (f) => `last 30 days · ${f} not saved`,
    obCmpT: "EU and Swiss compliance (GDPR, FADP)", obCmpN: (d) => `Developer's self-assessment, not legal advice · reviewed ${d} · source docs/compliance/gdpr.md`,
    obCmpCols: ["", "Area", "Requirement", "Law", "Status", "Evidence · next step"],
    obPrbT: "Problems and resolutions", obPrbN: "From the error log (90 days) and the problem registry in git: cause, fix and pull request.",
    obPrbCols: ["Problem", "Where", "Versions", "Times", "Last", "Status", "Cause · fix"],
    obEvT: "Lab report import · last 30 days", obEvN: "Outcomes counted by the server and reasons for refusals on the phone. Codes only.",
    obEvCols: ["Outcome", "Times", "Versions", "Last"], obSecOpen: "Security console →", selAll: "Select all", selNone: "Select none", obProof: "PDF dossier, section", obNew: "new, to analyse",
    secSum: (s) => `${s.vulnerable} vulnerable libraries out of ${s.libraries ?? "?"} · ${s.code} in our code · ${s.secrets} secrets`,
    secNone: "No scan yet: the first runs tonight at 06:10.", secAt: (d) => `Last scan: ${d}`,
    back: "← Admin", conT: "Security console",
    conSub: "Nightly scan (06:10) on OSV.dev, Semgrep and gitleaks. Risk: the advisory's severity and, once assessed, ours.",
    kLib: "Libraries checked", kLibU: (full) => full ? "the app's full tree" : "declared ones only", kVul: "Vulnerable libraries", kVulU: "with a published advisory",
    kCode: "Our code", kCodeU: "Semgrep findings", kSec: "Secrets", kSecU: "in the repository (gitleaks)",
    libT: "Vulnerable libraries", codeT: "Our code", secsT: "Secrets in the repository",
    cols: ["Library", "Version", "Where", "Risk", "Fixed in", "Source", "Plan"], ccols: ["Rule", "Where", "Risk", "Source", "Plan"],
    none: "Nothing to report.", plan: "plan", line: "line", fixCol: "Fix", all: "all", fixBtn: (n) => `Fix (${n})`, fixing: "in progress",
    fixAsk: (n) => `Start fixing ${n} findings? Claude prepares the changes; small ones are merged after the checks, large ones wait for you.`,
    fixOk: (u) => `Request sent. Follow it here: ${u}`, fixOff: "Fix is not active yet: the server's GitHub token is missing (see docs/security/vulnerability-management.md).",
    fixHint: "Select the rows and press Fix: Claude prepares the fix following the process.", triage: "to assess", ours: "ours", run: "run details", noFix: "no fix yet",
  };
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const mb = (b) => (b / 1048576).toLocaleString(LOCALE, { maximumFractionDigits: b < 10485760 ? 2 : 0 }) + " MB";
  const ver = (n) => "0.1." + n;
  async function loadAdmin() {
    main.innerHTML = `<div class="loading"><span class="pulse"></span></div>`;
    let d, o;
    try { [d, o] = await Promise.all([api("/my/api/admin/overview"), api("/my/api/admin/observability")]); }
    catch (e) { if (e.status === 401) return signedOut(); return message(T.err, ""); }
    const v = d.versions;
    // four numbers only: open vulnerabilities (the app's own code, the phone app's libraries), open defects, compliance
    // controls not fully covered; orange when something is open
    const ctl = o.compliance.controls, cnt = (st) => ctl.filter((c) => c.status === st).length;
    const defects = openDefects(o).length;
    const tile = (l, val, w, warn) => `<div class="tile ${warn ? "t-warn" : "t-ok"}"><div class="l">${l}</div><div class="v">${val}</div><div class="w">${w}</div></div>`;
    main.innerHTML = `
      <div class="bar"><h1>${AD.title}</h1><span class="grow"></span><span class="sub">${AD.upd} ${time(o.at)}</span></div>
      <section class="tiles adm four">
        ${tile(AD.kVc, o.openByPlace.code, AD.kVcU, o.openByPlace.code > 0)}
        ${tile(AD.kVm, o.openByPlace.mobile, AD.kVmU, o.openByPlace.mobile > 0)}
        ${tile(AD.kDf, defects, AD.kDfU, defects > 0)}
        ${tile(AD.kCm, cnt("partial") + cnt("open"), AD.kCmU(cnt("partial"), cnt("open")), cnt("open") > 0)}
      </section>
      <div class="card sec"><div class="card-h"><h2>${AD.obT}</h2></div>
        <p class="muted small">${AD.obSub}</p>
        <div class="send" style="margin:12px 0 6px"><button class="btn glow" type="button" id="adm-obs">${AD.obGo}</button></div>
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
    $("adm-obs").onclick = () => loadObservability();
  }

  /* ---------- Observability (owner only): vulnerabilities, compliance, problems and how they were solved, import
     outcomes. Everything is a code or a count: never a value, a report or a person. ---------- */
  const OB_STATE = { compliant: ["ok", "Compliant"], partial: ["warn", "Partial"], open: ["open", "Open"],
    fixed: ["ok", "Fixed"], fixing: ["fixing", "Fixing"], no_action: ["muted", "No action"], new: ["open", "Open"] };
  const obChip = (s) => { const [c, l] = OB_STATE[s] || OB_STATE.open; return `<span class="ob s-${c}">${l}</span>`; };
  // three tabs, each with its number: open problems (first), compliance, vulnerabilities (with Fix)
  // defects still open: errors with no registry entry yet or one still open/fixing, and registry problems open/fixing
  function openDefects(d) {
    const open = (st) => ["open", "fixing"].includes(st);
    const live = d.errors.filter((e) => !e.problem || open(e.problem.status));
    const reg = d.problems.filter((p) => open(p.status) && !d.errors.some((e) => e.problem && e.problem.id === p.id));
    return [...live, ...reg.map((p) => ({ registryOnly: p }))];
  }

  async function loadObservability(tab = "problems") {
    main.innerHTML = `<div class="loading"><span class="pulse"></span></div>`;
    let d;
    try { d = await api("/my/api/admin/observability"); } catch (e) { if (e.status === 401) return signedOut(); return message(T.err, ""); }
    const ctl = d.compliance.controls, cnt = (s) => ctl.filter((c) => c.status === s).length;
    const openVul = d.openFindings.reduce((a, b) => a + b.n, 0);
    const probs = openDefects(d);
    const link = (u, label) => (u && /^https:\/\//.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>` : "");
    // green when nothing is open; orange when something is: an open problem, an open vulnerability, or a compliance
    // control with no cover at all ("Open"; "Partial" alone stays green)
    const tabs = [["problems", AD.obPrb, probs.length, AD.obPrbU, probs.length > 0], ["compliance", AD.obCmp, `${cnt("compliant")}/${ctl.length}`, AD.obCmpU(cnt("partial"), cnt("open")), cnt("open") > 0],
      ["vulns", AD.obVul, openVul, AD.obVulU, openVul > 0]];
    main.innerHTML = `
      <div class="bar"><button class="btn ghost" type="button" id="ob-back">${AD.back}</button><h1>${AD.obT}</h1><span class="grow"></span><span class="sub">${AD.upd} ${time(d.at)}</span></div>
      <p class="note">${AD.obSub}</p>
      <div class="tiles adm ob-tabs" role="tablist">${tabs.map(([id, l, v, w, warn]) => `<button type="button" role="tab" class="tile ob-tab ${warn ? "t-warn" : "t-ok"}" data-tab="${id}" aria-selected="${id === tab}">
        <span class="l">${l}</span><span class="v">${v}</span><span class="w">${w}</span></button>`).join("")}</div>
      <div id="ob-body" role="tabpanel"></div>`;
    const body = $("ob-body");
    const show = (id) => {
      clearTimeout(secTimer);
      main.querySelectorAll(".ob-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === id)));
      if (id === "vulns") return loadSecurity(body);
      if (id === "compliance") {
        body.innerHTML = `<div class="card"><div class="card-h"><h2>${AD.obCmpT}</h2></div><p class="muted small">${AD.obCmpN(esc(d.compliance.reviewed))}</p>
          <div class="table-wrap"><table class="list ob-t"><thead><tr>${AD.obCmpCols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>
          ${ctl.map((c) => `<tr><td class="muted small">${esc(c.id)}</td><td>${esc(c.area)}</td><td>${esc(c.requirement)}</td><td class="small">${esc(c.law)}</td><td>${obChip(c.status)}</td>
            <td class="small">${esc(c.evidence)}${c.next ? `<br><b>→</b> ${esc(c.next)}` : ""}<br><a href="${esc(d.compliance.dossier)}#${esc(c.id)}" target="_blank" rel="noopener">${AD.obProof} ${esc(c.id)} →</a></td></tr>`).join("")}
          </tbody></table></div></div>`;
        return;
      }
      body.innerHTML = `<div class="card"><div class="card-h"><h2>${AD.obPrbT}</h2></div><p class="muted small">${AD.obPrbN}</p>
        <div class="table-wrap"><table class="list ob-t"><thead><tr>${AD.obPrbCols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>
        ${probs.filter((e) => !e.registryOnly).map((e) => { const p = e.problem; return `<tr><td>${p ? `<b>${esc(p.id)}</b> ${esc(p.title)}` : `<code>${esc(e.code)}</code> <span class="muted small">${AD.obNew}</span>`}</td>
          <td class="small"><code>${esc(e.place)}</code> · ${esc(e.source)}</td><td class="small">${esc(e.versions || "")}</td><td>${e.n}</td><td class="small">${day(e.last_at)}</td>
          <td>${obChip(p ? p.status : "new")}</td><td class="small">${p ? `${esc(p.cause)}<br><b>→</b> ${esc(p.fix)} ${link(p.pr, "PR")}${p.fixedIn ? ` · ${esc(p.fixedIn)}` : ""}` : "—"}</td></tr>`; }).join("") || `<tr><td colspan="7">${AD.none}</td></tr>`}
        ${probs.filter((e) => e.registryOnly).map((e) => e.registryOnly).map((p) => `<tr class="old"><td><b>${esc(p.id)}</b> ${esc(p.title)}</td><td class="small">${esc(p.match?.place || p.match?.code || "")}</td>
          <td class="small">${esc(p.versions || "")}</td><td>—</td><td class="small">${esc(p.found)}</td><td>${obChip(p.status)}</td><td class="small">${esc(p.cause)}<br><b>→</b> ${esc(p.fix)} ${link(p.pr, "PR")}</td></tr>`).join("")}
        </tbody></table></div></div>
        <div class="card"><div class="card-h"><h2>${AD.obEvT}</h2></div><p class="muted small">${AD.obEvN}</p>
        <div class="table-wrap"><table class="list ob-t"><thead><tr>${AD.obEvCols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>
        ${[...d.events.map((e) => ({ code: e.code, n: e.n, versions: e.versions, last_at: e.last_at })),
           ...d.errors.filter((e) => /^lab_|^import_failed$/.test(e.code)).map((e) => ({ code: e.code + " (" + e.source + ")", n: e.n, versions: e.versions, last_at: e.last_at }))]
          .map((e) => `<tr><td><code>${esc(e.code)}</code></td><td>${e.n}</td><td class="small">${esc(e.versions || "")}</td><td class="small">${day(e.last_at)}</td></tr>`).join("") || `<tr><td colspan="4">${AD.none}</td></tr>`}
        </tbody></table></div></div>`;
    };
    // on a phone each row becomes a card: every cell carries the name of its column
    const label = () => body.querySelectorAll("table.ob-t").forEach((t) => {
      const hs = [...t.querySelectorAll("thead th")].map((h) => h.textContent);
      t.querySelectorAll("tbody tr").forEach((r) => [...r.children].forEach((td, i) => (td.dataset.l = hs[i] || "")));
    });
    main.querySelectorAll(".ob-tab").forEach((b) => (b.onclick = () => { show(b.dataset.tab); label(); }));
    $("ob-back").onclick = () => { clearTimeout(secTimer); loadAdmin(); };
    show(tab); label();
  }

  /* ---------- the Security console (owner only): results of the nightly scans, written by CI into D1 ---------- */
  // host: the Vulnerabilities tab of Observability; without it, the console fills the page with its own back button
  async function loadSecurity(host) {
    const root = host || main;
    root.innerHTML = `<div class="loading"><span class="pulse"></span></div>`;
    let d;
    try { d = await api("/my/api/admin/security"); } catch (e) { if (e.status === 401) return signedOut(); return message(T.err, ""); }
    const s = d.scan, items = d.items || [];
    secItems = items; secScan = s;
    const link = (u, label) => (u && /^https:\/\//.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>` : "—");
    const risk = (x) => {
      const r = String(x.rating || x.severity || "").toUpperCase();
      const cls = { CRITICAL: "r-crit", HIGH: "r-high", MODERATE: "r-mod", MEDIUM: "r-mod", LOW: "r-low" }[r] || "r-low";
      const extra = x.rating && x.severity && x.rating !== x.severity ? ` <span class="muted small">(${esc(x.severity)} → ${AD.ours})</span>` : (!x.rating && x.kind === "library" ? ` <span class="muted small">${AD.triage}</span>` : "");
      return `<span class="risk ${cls}">${esc(r || "?")}</span>${extra}`;
    };
    // the state of a finding, in English whatever the page language: Open → Fixing → Fixed | Failed
    const keyOf = (x) => [x.kind, x.ref, x.name, x.location || ""].join("|");
    const state = secState;
    const libs = items.filter((x) => x.kind === "library"), code = items.filter((x) => x.kind === "code"), secs = items.filter((x) => x.kind === "secret");
    const tile = (l, val, w) => `<div class="tile"><div class="l">${l}</div><div class="v">${val}</div><div class="w">${w}</div></div>`;
    const L = AD.cols, C = AD.ccols;
    // the first column: a box to pick the row for Fix, and the state once a fix was requested
    const pick = (x) => `<td data-l="${AD.fixCol}" class="pick"><input type="checkbox" class="fx" aria-label="${AD.fixCol} ${esc(x.name)}"
      data-k="${esc(x.kind)}" data-r="${esc(x.ref)}" data-n="${esc(x.name)}" data-l="${esc(x.location || "")}"${x.fix_status === "fixing" ? " disabled" : ""}>
      <span class="st" data-key="${esc(keyOf(x))}">${state(x.fix_status, x.fix_detail || x.fix_url, x.fix_note)}</span></td>`;
    const head = (cols, kind) => `<thead><tr><th class="pick"><input type="checkbox" class="fx-all" data-kind="${kind}" aria-label="${AD.all}"></th>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
    const libRows = libs.map((x) => `<tr>${pick(x)}<td data-l="${L[0]}"><code>${esc(x.name)}</code></td><td data-l="${L[1]}">${esc(x.version || "")}</td>
      <td data-l="${L[2]}" class="muted small">${esc(x.location || "")}</td><td data-l="${L[3]}">${risk(x)}</td>
      <td data-l="${L[4]}">${esc(x.fixed || AD.noFix)}</td><td data-l="${L[5]}">${link(x.source_url, x.ref)}</td><td data-l="${L[6]}">${link(x.plan_url, AD.plan)}</td></tr>`).join("");
    const otherRows = (arr) => arr.map((x) => `<tr>${pick(x)}<td data-l="${C[0]}"><code>${esc(x.ref)}</code></td><td data-l="${C[1]}" class="muted small">${esc(x.location || x.name)}</td>
      <td data-l="${C[2]}">${risk(x)}</td><td data-l="${C[3]}">${link(x.source_url, AD.line)}</td><td data-l="${C[4]}">${link(x.plan_url, AD.plan)}</td></tr>`).join("");
    const table = (cols, rows, kind) => rows ? `<div class="tbl"><table class="list" data-kind="${kind}">${head(cols, kind)}<tbody>${rows}</tbody></table></div>` : `<p class="muted">${AD.none}</p>`;
    root.innerHTML = `<span id="sec-live" hidden></span>
      ${host ? "" : `<div class="bar"><button class="btn ghost small" type="button" id="sec-back">${AD.back}</button><h1>${AD.conT}</h1></div>`}
      <p class="note">${AD.conSub}${s ? ` ${AD.secAt(day(s.at) + " " + time(s.at))}${s.runUrl ? " · " + link(s.runUrl, AD.run) : ""}` : ""}</p>
      ${s ? `<div id="sec-overall">${s.complete === true && Date.now() - s.at < 48 * 3600e3 ? overall(items) : `<p class="note">Scan incomplete or stale — last findings retained</p>`}</div>` : ""}
      ${s ? `<section class="tiles adm four">
        ${tile(AD.kLib, s.libraries ?? "?", AD.kLibU(s.fullTree))}
        ${tile(AD.kVul, s.vulnerable, AD.kVulU)}
        ${tile(AD.kCode, s.code, AD.kCodeU)}
        ${tile(AD.kSec, s.secrets, AD.kSecU)}
      </section>` : `<p class="muted">${AD.secNone}</p>`}
      <div class="card"><div class="card-h"><h2>${AD.libT}</h2></div>${table(L, libRows, "library")}</div>
      <div class="card"><div class="card-h"><h2>${AD.codeT}</h2></div>${table(C, otherRows(code), "code")}</div>
      <div class="card"><div class="card-h"><h2>${AD.secsT}</h2></div>${table(C, otherRows(secs), "secret")}</div>
      ${items.length ? `<div class="fixbar"><p class="muted small" id="fx-msg" role="status">${AD.fixHint}</p>
        <button class="btn ghost" type="button" id="fx-every">${AD.selAll}</button><button class="btn" type="button" id="fx-go" disabled>${AD.fixBtn(0)}</button></div>` : ""}`;
    const boxes = () => [...root.querySelectorAll("input.fx")];
    const count = () => {
      const n = boxes().filter((b) => b.checked).length, go = $("fx-go");
      if (go) { go.disabled = !n; go.textContent = AD.fixBtn(n); }
    };
    root.querySelectorAll("input.fx").forEach((b) => (b.onchange = count));
    root.querySelectorAll("input.fx-all").forEach((a) => (a.onchange = () => {
      a.closest("table").querySelectorAll("input.fx").forEach((b) => (b.checked = a.checked)); count();
    }));
    // select every open finding at once (on a phone the table headers, with their boxes, are hidden)
    const every = $("fx-every");
    if (every) every.onclick = () => {
      const free = boxes().filter((b) => !b.disabled), on = free.some((b) => !b.checked);
      free.forEach((b) => (b.checked = on)); root.querySelectorAll("input.fx-all").forEach((a) => (a.checked = on));
      every.textContent = on ? AD.selNone : AD.selAll; count();
    };
    const go = $("fx-go");
    if (go) go.onclick = async () => {
      const chosen = boxes().filter((b) => b.checked).map((b) => ({ kind: b.dataset.k, ref: b.dataset.r, name: b.dataset.n, location: b.dataset.l }));
      if (!chosen.length || !confirm(AD.fixAsk(chosen.length))) return;
      go.disabled = true;
      try {
        const r = await api("/my/api/admin/security/fix", { method: "POST", body: JSON.stringify({ items: chosen }) });
        $("fx-msg").innerHTML = AD.fixOk(link(r.issueUrl, r.issueUrl.replace(/^https:\/\/github\.com\//, "")));
        boxes().filter((b) => b.checked).forEach((b) => {
          b.checked = false; b.disabled = true;
          const cell = b.parentElement.querySelector(".st"); if (cell) cell.innerHTML = state("fixing", r.issueUrl, "");
        });
        count(); watch();
      } catch (e) {
        $("fx-msg").textContent = e.status === 503 ? AD.fixOff : T.err;
        count();
      }
    };
    if (!host) $("sec-back").onclick = () => { clearTimeout(secTimer); loadAdmin(); };
    watch();
  }
  let secTimer = 0, secItems = [], secScan = null;
  // Overall status of the system, always in English: Secure (green) when nothing is open; Vulnerable (orange) while a
  // finding is open; Vulnerable · High risk (red) while a high or critical one is open. Our rating wins over the advisory's.
  function overall(items) {
    const open = items.filter((x) => x.fix_status !== "fixed");
    const lvl = (x) => String(x.rating || x.severity || "").toUpperCase();
    const high = open.filter((x) => lvl(x) === "CRITICAL" || lvl(x) === "HIGH").length;
    const [cls, label] = !open.length ? ["ok", "No open findings"] : high ? ["high", "Vulnerable · High risk"] : ["warn", "Vulnerable"];
    const detail = !open.length ? "No open findings" : `${open.length} open finding${open.length === 1 ? "" : "s"}${high ? ` · ${high} high or critical` : ""}`;
    return `<div class="overall o-${cls}" role="status"><span class="dot" aria-hidden="true"></span><span class="lab">Overall status</span>
      <b>${label}</b><span class="det">${detail}</span></div>`;
  }
  const secEsc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function secState(st, url, note) {
    const s2 = { fixing: "fixing", fixed: "fixed", failed: "failed" }[st] || "open";
    const label = { open: "Open", fixing: "Fixing", fixed: "Fixed", failed: "Failed" }[s2];
    const chip = `<span class="state s-${s2}"${note ? ` title="${secEsc(note)}"` : ""}>${s2 === "fixing" ? '<i class="spin" aria-hidden="true"></i>' : ""}${label}</span>`;
    return url && /^https:\/\//.test(url) ? `<a href="${secEsc(url)}" target="_blank" rel="noopener">${chip}</a>` : chip;
  }
  function watch() {
    clearTimeout(secTimer);
    const busy = () => !!document.querySelector(".st .s-fixing");
    if (!busy()) return;
    secTimer = setTimeout(async function tick() {
      if (!document.getElementById("sec-live")) return;           // the console was left
      if (document.hidden) { secTimer = setTimeout(tick, 8000); return; }
      try {
        const d = await api("/my/api/admin/security/status");
        for (const x of d.items || []) {
          const k = [x.kind, x.ref, x.name, x.location || ""].join("|");
          const cell = [...document.querySelectorAll(".st")].find((c) => c.dataset.key === k);
          if (!cell) continue;
          const html = secState(x.status, x.detail_url || x.issue_url, x.note);
          if (cell.innerHTML !== html) cell.innerHTML = html;
          const box = cell.parentElement.querySelector("input.fx");
          if (box) box.disabled = x.status === "fixing";
          const it = secItems.find((y) => [y.kind, y.ref, y.name, y.location || ""].join("|") === k);
          if (it) it.fix_status = x.status;
        }
        const ov = document.getElementById("sec-overall");
        if (ov && secScan?.complete === true && Date.now() - secScan.at < 48 * 3600e3) { const html = overall(secItems); if (ov.innerHTML !== html) ov.innerHTML = html; }
      } catch {}
      if (busy()) secTimer = setTimeout(tick, 8000);
    }, 8000);
  }

  // PDF: the same A4 report as the app, built from the readings on screen, then the browser's "Save as PDF"
  function loadScript(src) {
    return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  }
  /**
   * The lab results as an A4 PDF: a teal-to-indigo band (never red) with the title, then the same table as on screen,
   * up to five report dates per block, with a coloured header row, alternate row tints and thin column lines.
   * A result outside the reference printed on the same report is orange with a small triangle (▲ above, ▼ below).
   */
  function labsPdf() {
    const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
    const { days, tests } = labMatrix(current.data);
    // the standard PDF font has no µ, en dash or curly quote: plain equivalents
    const safe = (v) => String(v).replaceAll("µ", "u").replaceAll("–", "-").replaceAll("’", "'");
    const L = 40, R = 555, PW = 595;
    const A = [15, 140, 128], B = [59, 76, 184];   // teal → indigo
    const INK = [19, 34, 63], MUTED = [91, 107, 136], LINE = [227, 232, 240], ZEBRA = [244, 247, 253], OUT = [199, 106, 18], OUT_BG = [255, 241, 227];
    const mix = (k) => A.map((a, i) => Math.round(a + (B[i] - a) * k));
    function band(h, bar) {
      for (let x = 0; x < PW; x += 3) { doc.setFillColor(...mix(x / PW)); doc.rect(x, 0, PW - x, h, "F"); }   // each strip runs to the end: no seams
      [[15, 140, 128], [109, 91, 208], [183, 134, 11]].forEach((c, i) => { doc.setFillColor(...c); doc.rect(i * PW / 3, h, PW / 3 + 0.5, bar, "F"); });
    }
    function smallHeader() {
      band(40, 2);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.text("HINT 365 · " + safe(LAB.title), L, 25);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(222, 244, 241); doc.text(safe(LAB.period), R, 25, { align: "right" });
    }
    // page 1: the large band
    band(104, 3);
    doc.setGState(new doc.GState({ opacity: 0.14 })); doc.setFillColor(255, 255, 255);
    doc.circle(470, 52, 34, "F"); doc.circle(522, 34, 22, "F"); doc.circle(536, 82, 14, "F");
    doc.setGState(new doc.GState({ opacity: 1 }));
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(222, 244, 241); doc.text("HINT 365 · HEALTHYINSTANTTRACKER", L, 30, { charSpace: 1.2 });
    doc.setFont("helvetica", "normal"); doc.text(safe(LAB.pdfGen(day(Date.now()))), R, 30, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(255, 255, 255); doc.text(safe(LAB.title), L, 62);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(240, 250, 249);
    doc.text(days.length ? `${day(days[0])} - ${day(days[days.length - 1])}` : "", L, 82);
    doc.setFontSize(8); doc.setTextColor(222, 244, 241); doc.text(safe(LAB.pdfCount(days.length, tests.length)), L, 96);
    doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(safe(LAB.pdfNote), R - L), L, 124);
    let y = 146;
    if (!days.length) { doc.setFontSize(10); doc.setTextColor(...INK); doc.text(safe(LAB.empty), L, y + 10); }
    // at most five dates side by side, the blocks as even as possible (6 dates: 3 + 3, not 5 + 1)
    const W0 = 150, per = Math.ceil(days.length / Math.ceil(days.length / 5 || 1));
    for (let i = 0; i < days.length; i += per) {
      const cols = days.slice(i, i + per), CW = Math.min(100, (R - L - W0) / cols.length), TW = W0 + cols.length * CW;
      const head = () => {
        for (let x = 0; x < TW; x += 3) { doc.setFillColor(...mix(x / TW)); doc.rect(L + x, y, TW - x, 24, "F"); }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
        doc.text(safe(LAB.test), L + 8, y + 15.5);
        cols.forEach((t, j) => doc.text(day(t), L + W0 + j * CW + CW / 2, y + 15.5, { align: "center" }));
        y += 24;
      };
      if (y > 700) { doc.addPage(); smallHeader(); y = 64; }
      const top = y; head();
      let row = 0, blockTop = top;
      const frame = (bottom) => {   // thin column lines and a frame around the block on this page
        doc.setDrawColor(...LINE); doc.setLineWidth(0.6);
        for (let j = 0; j < cols.length; j++) doc.line(L + W0 + j * CW, blockTop + 24, L + W0 + j * CW, bottom);
        doc.roundedRect(L, blockTop, TW, bottom - blockTop, 3, 3, "S");
      };
      for (const r of tests) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
        const name = doc.splitTextToSize(safe(r.label), W0 - 14);
        const hasRef = cols.some((t) => r.cells.get(t)?.reference);
        const h = Math.max(name.length * 10 + 10, hasRef ? 28 : 20);
        if (y + h > 790) { frame(y); doc.addPage(); smallHeader(); y = 64; blockTop = y; head(); row = 0; }
        if (row % 2) { doc.setFillColor(...ZEBRA); doc.rect(L, y, TW, h, "F"); }
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
        doc.text(name, L + 8, y + 13);
        cols.forEach((t, j) => {
          const x = r.cells.get(t), cx = L + W0 + j * CW + CW / 2;
          if (!x) { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text("-", cx, y + 13, { align: "center" }); return; }
          const o = outOfRange(x);
          if (o) { doc.setFillColor(...OUT_BG); doc.rect(L + W0 + j * CW + 0.5, y + 0.5, CW - 1, h - 1, "F"); }
          const v = safe(x.value), u = x.unit ? " " + safe(x.unit) : "";
          doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); const vw = doc.getTextWidth(v);
          doc.setFont("helvetica", "normal"); doc.setFontSize(7); const uw = doc.getTextWidth(u);
          const total = vw + uw + (o ? 9 : 0); let x0 = cx - total / 2;
          doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...(o ? OUT : INK)); doc.text(v, x0, y + 13);
          doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text(u, x0 + vw, y + 13);
          if (o) {   // the arrow, drawn as a small triangle (the PDF font has no arrows)
            const ax = x0 + vw + uw + 3; doc.setFillColor(...OUT);
            if (o > 0) doc.triangle(ax, y + 12, ax + 6, y + 12, ax + 3, y + 6, "F"); else doc.triangle(ax, y + 6, ax + 6, y + 6, ax + 3, y + 12, "F");
          }
          if (x.reference) {
            doc.setFontSize(6.5); doc.setTextColor(...MUTED);
            doc.text(doc.splitTextToSize(safe(LAB.ref + " " + x.reference), CW - 8)[0], cx, y + 23, { align: "center" });
          }
        });
        y += h; row++;
      }
      frame(y);
      y += 20;
    }
    // the same footer on every page
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setDrawColor(217, 224, 234); doc.setLineWidth(0.8); doc.line(L, 806, R, 806);
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
      doc.text(safe(LAB.pdfDisc), L, 820);
      doc.setFontSize(7); doc.text(safe(LAB.pdfPage(p, n)), R, 820, { align: "right" });
    }
    return doc;
  }
  // the A4 report as a jsPDF document (the same pages as the app)
  async function buildPdf() {
    // the PDF libraries (jsPDF, svg2pdf, MIT licence, served from this site) are loaded only when needed
    if (!window.jspdf) await loadScript("/my/vendor/jspdf-4.2.1.umd.min.js");
    if (current.module === "labs") {
      return { doc: labsPdf(), name: "HINT-lab-results.pdf" };
    }
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
    for (const id of ["btn-share"]) $(id).hidden = true;
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
