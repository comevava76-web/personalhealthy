import { NOTICE_TEXT, NOTICE_VERSION } from "./notices";
// Public pages of HINT 365: the home page and the privacy policy, linked from Google's sign-in screen.
// Plain HTML served by this same server; Italian and English on the same page.

const style = `
  :root { --bg:#0F1D38; --panel:#172B50; --ink:#EAF0FA; --muted:#9AAACA; --accent:#8C7BF2; }
  * { box-sizing:border-box; }
  table.costs { width:100%; border-collapse:collapse; margin:8px 0 14px; font-size:14px; }
  table.costs th, table.costs td { text-align:left; vertical-align:top; padding:8px; border-bottom:1px solid #2A3F66; }
  table.costs th { color:var(--muted); font-weight:600; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:760px; margin:0 auto; padding:32px 20px 56px; }
  header { display:flex; align-items:center; gap:14px; margin-bottom:28px; }
  header svg { width:52px; height:52px; flex:none; }
  h1 { font-size:28px; letter-spacing:3px; margin:0; }
  header p { margin:0; color:var(--muted); font-size:14px; }
  h2 { font-size:20px; margin:32px 0 8px; }
  h3 { font-size:16px; margin:20px 0 4px; }
  p, li { color:#D6DEEC; }
  a { color:var(--accent); }
  .box { background:var(--panel); border-radius:14px; padding:4px 20px 16px; margin-top:18px; }
  .muted { color:var(--muted); font-size:14px; }
  .btn { display:inline-block; background:var(--accent); color:#fff; text-decoration:none; font-weight:600; padding:14px 22px; border-radius:14px; }
  hr { border:0; border-top:1px solid #2A3F66; margin:36px 0; }
`;
const logo = `<svg viewBox="0 0 108 108" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#1C335E"/><stop offset="1" stop-color="#0F1D38"/></linearGradient></defs>
  <rect width="108" height="108" rx="24" fill="url(#g)"/>
  <path d="M13,57.2 H33.5 L38.9,49.7 L44.3,57.2 H48.6 L55.1,27 L62.1,84.2 L68,57.2 H74.5 L79.9,51.8 L85.3,57.2 H95"
   fill="none" stroke="#8C7BF2" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** 2026, or 2026–<this year> from next year on: updates itself every year. */
function copyrightYears(): string {
  const y = new Date().getUTCFullYear();
  return y > 2026 ? `2026–${y}` : "2026";
}

function page(title: string, body: string): Response {
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${style}</style></head>
<body><main><header>${logo}<div><h1>HINT 365</h1><p>HealthyInstantTracker</p></div></header>${body}
<footer class="muted"><hr>HINT 365 · HealthyInstantTracker · © ${copyrightYears()} · Tutti i diritti riservati · All rights reserved<br>
<a href="/">Home</a> · <a href="/terms">Condizioni d'uso · Terms of use</a> · <a href="/privacy">Privacy</a></footer></main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

function contactLine(email: string, it: boolean): string {
  if (email) return it
    ? `Per domande o per esercitare i tuoi diritti scrivi a <a href="mailto:${email}">${email}</a>.`
    : `For questions or to exercise your rights, write to <a href="mailto:${email}">${email}</a>.`;
  return it
    ? "Per domande o per esercitare i tuoi diritti usa l'email di assistenza mostrata nella schermata di accesso Google di HINT 365."
    : "For questions or to exercise your rights, use the support email shown on HINT 365's Google sign-in screen.";
}

export function homePage(): Response {
  return page("HINT 365 · HealthyInstantTracker", `
<p><strong>HINT 365</strong> è un diario della pressione per Android. Fotografi il display del misuratore, oppure detti i valori a voce, e l'app registra SYS, DIA e PUL con data e ora. Prepara un report in PDF ed Excel da mandare al medico.</p>
<p>L'app non valuta i valori, non fa diagnosi e non dà consigli medici: la valutazione spetta al medico. Leggi le <a href="/terms">condizioni d'uso</a>.</p>
<p><strong>Costi.</strong> L'app costa 5 $ all'anno, pagati al proprietario tramite Google Play (disdici quando vuoi): copre l'app e la conservazione delle misure. Le funzionalità AI (Scan del misuratore, già disponibile; ) sono facoltative e si pagano a consumo ad Anthropic, con il tuo credito: il proprietario dell'app non ne incassa nulla. Dettagli nelle <a href="/terms">condizioni d'uso</a>.</p>
<p><a class="btn" href="/download">Scarica l'app per Android</a></p>
<p class="muted">Dopo il download apri il file e consenti l'installazione. All'avvio tocchi "Accedi con Google": se cambi telefono, ritrovi tutto allo stesso modo.</p>
<p><a href="/HINT-Guida-IT.pdf">Guida all'uso (PDF)</a> · <a href="/privacy">Informativa sulla privacy</a> · <a href="/terms">Condizioni d'uso</a></p>
<hr>
<p><strong>HINT 365</strong> is a blood-pressure diary for Android. Photograph the monitor's display, or say the values aloud, and the app records SYS, DIA and PUL with date and time. It prepares a PDF and Excel report for the doctor.</p>
<p>The app does not assess the values, makes no diagnosis and gives no medical advice: that is up to the doctor. Read the <a href="/terms">terms of use</a>.</p>
<p><strong>Costs.</strong> The app costs 5 $ a year, paid to its owner through Google Play (cancel any time): it covers the app and keeping your readings. The AI features (Scan of the monitor, available now; ) are optional and are paid per use to Anthropic, from your own credit: the owner of the app receives none of it. Details in the <a href="/terms">terms of use</a>.</p>
<p><a class="btn" href="/download">Download the Android app</a></p>
<p class="muted">After the download, open the file and allow the installation. At first start tap "Sign in with Google": on a new phone you find everything again the same way.</p>
<p><a href="/HINT-Guide-EN.pdf">User guide (PDF)</a> · <a href="/privacy">Privacy policy</a> · <a href="/terms">Terms of use</a></p>`);
}

export function privacyPage(contactEmail: string): Response {
  return page("HINT 365 · Privacy", `
<h2>Informativa sulla privacy</h2>
<p class="muted">Ultimo aggiornamento: 29 settembre 2026</p>
<div class="box">
<h3>Chi tratta i dati</h3>
<p>HINT 365 è un'app privata, gestita da una persona per sé, la famiglia e gli amici. ${contactLine(contactEmail, true)}</p>
<h3>Quali dati</h3>
<ul>
<li><strong>Account Google:</strong> solo un'impronta cifrata del codice che Google assegna al tuo account, per ritrovare il tuo diario anche su un nuovo telefono. La tua email non viene salvata: resta sul tuo telefono. Non leggiamo nient'altro del tuo account Google.</li>
<li><strong>Misure:</strong> SYS, DIA e PUL (massima, minima, battiti), data e ora di ogni misura, il momento della giornata, e se il valore viene da una foto o dalla voce.</li>
<li><strong>Chiave del telefono:</strong> una chiave anonima creata e custodita nel telefono, che firma le richieste. L'app si apre con impronta, volto o blocco schermo del telefono; questi restano nel telefono e non ci arrivano mai.</li>
<li><strong>Credito:</strong> il costo stimato di ogni lettura di foto.</li>
<li><strong>Chiave Anthropic:</strong> la tua chiave, con cui paghi le letture delle tue foto, conservata cifrata e mai rimandata al telefono.</li>
<li><strong>Abbonamento:</strong> il codice dell'acquisto che Google Play assegna all'abbonamento, il suo stato e la data di scadenza, per sapere se è pagato. Il pagamento lo gestisce Google Play: non vediamo né carta né nome.</li>
</ul>
<h3>Referti</h3><p>Documenti PDF e immagini sono elaborati sul telefono. Non riceviamo documento, testo completo o generalità del paziente. Dopo la conferma riceviamo solo analisi, valori, unità, intervalli e date, associati all’account per storico e andamenti, con conservazione fino a 365 giorni.</p>
<h3>Foto e voce</h3>
<p>La foto del display viene inviata ad <strong>Anthropic</strong> (Claude) solo per leggere i numeri e non viene conservata da HINT 365. La voce viene trascritta dal riconoscimento vocale del telefono (di solito Google); a HINT 365 arrivano solo i tre numeri.</p>
<h3 id="cookie">Accesso (OAuth) e cookie</h3>
<p>L'accesso usa <strong>Accedi con Google</strong> (standard OAuth 2.0 e OpenID Connect): Google ci consegna un token firmato, che verifichiamo; non riceviamo mai la tua password. L'app non usa cookie. La Web Dashboard usa un solo cookie tecnico, <code>hint_s</code> (codice casuale, di prima parte, HttpOnly, Secure, SameSite=Strict, durata 7 giorni), salvato solo dopo che lo accetti; nel browser resta anche la tua scelta (<code>hint.cookies</code>). Nessun cookie di profilazione, statistica, pubblicità o di terze parti. Puoi rivedere la scelta dal link «Cookie» in fondo alla Web Dashboard.</p>
<h3>Dove stanno i dati e chi li vede</h3>
<p>Gli errori tecnici incontrati usando l'app finiscono in un registro sintetico, senza i valori delle misure e legato solo al codice anonimo, conservato 90 giorni, per correggere i problemi. Il proprietario dell'app vede solo numeri d'uso legati al codice anonimo (data di iscrizione, ultimo accesso, quante misure, quali funzioni usi), mai i valori delle misure, i report o il tuo nome. Per difendere il servizio dagli abusi, il server conta le richieste per un'ora o un giorno usando solo un'impronta cifrata (SHA-256) dell'indirizzo IP, mai l'indirizzo stesso; i contatori si cancellano entro due giorni. Su server <strong>Cloudflare</strong>, con il database vincolato all'<strong>Unione Europea</strong>. Gli altri utenti non vedono i tuoi dati. Chi gestisce il servizio può accedere al database solo per manutenzione. Non vendiamo né cediamo i dati e non facciamo pubblicità. Condizioni dei fornitori: <a href="https://www.cloudflare.com/privacypolicy">Cloudflare</a>, <a href="https://www.anthropic.com/legal/commercial-terms">Anthropic (condizioni)</a>, <a href="https://www.anthropic.com/legal/privacy">Anthropic (privacy)</a>, <a href="https://policies.google.com/privacy">Google</a>.</p>
<h3>Per quanto tempo</h3>
<p>Le misure al massimo 365 giorni: ogni giorno quelle più vecchie di un anno vengono cancellate automaticamente (dalle copie di sicurezza del database spariscono entro 30 giorni). Il resto finché hai l'account. Puoi cancellare singole misure, tutte le misure, oppure l'account con tutti i dati, dall'app (scheda Report, "Vedi tutte le misure"; scheda Admin, "Elimina il mio account"). La cancellazione è immediata e definitiva. Resta solo la registrazione della tua accettazione delle <a href="/terms">condizioni d'uso</a> (account, telefono, data e ora), conservata come prova.</p>
<h3>Perché</h3>
<p>Solo per offrirti il diario che hai chiesto. Sono dati sulla salute: valgono il GDPR e la LPD svizzera anche se il codice è anonimo. La base è il tuo <strong>consenso esplicito</strong> (GDPR art. 9 par. 2 lett. a), dato al primo accesso e con l'accettazione delle condizioni; il registro degli errori, i limiti contro gli abusi e la registrazione dell'accettazione si basano sul legittimo interesse (art. 6 par. 1 lett. f). Nessuna decisione automatizzata, nessun uso per altro. Il titolare è il proprietario di HINT 365; Cloudflare tratta i dati per suo conto (responsabile del trattamento). Anthropic e Google sono negli Stati Uniti: per la foto del display, l'accesso e il pagamento valgono le garanzie per i trasferimenti che ciascuno offre (Data Privacy Framework UE-USA o Clausole contrattuali standard). Le pagine possono essere servite da un centro dati Cloudflare vicino a te; il database resta nell'Unione Europea.</p>
<h3>I tuoi diritti</h3>
<p>Puoi chiedere di vedere, correggere o cancellare i tuoi dati, di riceverli in un formato di file comune, di limitarne o contestarne l'uso, e revocare il consenso eliminando l'account: rispondiamo entro un mese. Puoi anche rivolgerti all'autorità per la protezione dei dati del tuo paese (in Svizzera l'IFPDT, in Italia il Garante).</p>
</div>
<hr>
<h2>Privacy policy</h2>
<p class="muted">Last updated: 29 September 2026</p>
<div class="box">
<h3>Who handles the data</h3>
<p>HINT 365 is a private app, run by one person for themselves, their family and friends. ${contactLine(contactEmail, false)}</p>
<h3>What data</h3>
<ul>
<li><strong>Google account:</strong> only an encrypted fingerprint of the identifier Google gives your account, to find your diary again, also on a new phone. Your email is not saved: it stays on your phone. Nothing else of your Google account is read.</li>
<li><strong>Readings:</strong> SYS, DIA and PUL (systolic, diastolic, pulse), date and time of each reading, the time of day, and whether it came from a photo or your voice.</li>
<li><strong>Phone key:</strong> an anonymous key created and kept inside the phone, which signs the requests. The app opens with the phone's fingerprint, face or screen lock; these stay on the phone and never reach us.</li>
<li><strong>Credit:</strong> the estimated cost of each photo reading.</li>
<li><strong>Anthropic key:</strong> your key, which pays for your photo readings, stored encrypted and never sent back to the phone.</li>
<li><strong>Subscription:</strong> the purchase code Google Play gives the subscription, its state and its end date, to know whether it is paid. Google Play handles the payment: we see neither card nor name.</li>
</ul>
<h3>Lab reports</h3><p>PDFs and images are processed on the phone. Source documents, full text and patient identifiers are not uploaded. After confirmation, test codes, values, units, reference intervals and dates are stored with the account for history and trends, for up to 365 days.</p>
<h3>Photos and voice</h3>
<p>The photo of the display is sent to <strong>Anthropic</strong> (Claude) only to read the numbers, and is not kept by HINT 365. Speech is transcribed by the phone's speech recognition (usually Google); only the three numbers reach HINT 365.</p>
<h3 id="cookie-en">Sign-in (OAuth) and cookies</h3>
<p>Sign-in uses <strong>Sign in with Google</strong> (the OAuth 2.0 and OpenID Connect standards): Google hands us a signed token, which we check; we never receive your password. The app uses no cookies. The Web Dashboard uses a single technical cookie, <code>hint_s</code> (a random code, first-party, HttpOnly, Secure, SameSite=Strict, lasting 7 days), saved only after you accept it; your choice is also kept in the browser (<code>hint.cookies</code>). No profiling, statistics, advertising or third-party cookies. You can review the choice from the “Cookies” link at the bottom of the Web Dashboard.</p>
<h3>Where the data is and who sees it</h3>
<p>Technical errors met while using the app go into a short error log, without reading values and tied only to the anonymous code, kept 90 days, to fix problems. The owner of the app sees only usage numbers tied to the anonymous code (when you joined, when you last opened the app, how many readings, which features you use), never the values of your readings, your reports or your name. To protect the service from abuse, the server counts requests per hour or day using only an encrypted fingerprint (SHA-256) of the IP address, never the address itself; the counters are deleted within two days. On <strong>Cloudflare</strong> servers, with the database bound to the <strong>European Union</strong>. Other users cannot see your data. The person who runs the service can reach the database only for maintenance. Data is not sold or shared, and there is no advertising. Providers' terms: <a href="https://www.cloudflare.com/privacypolicy">Cloudflare</a>, <a href="https://www.anthropic.com/legal/commercial-terms">Anthropic (terms)</a>, <a href="https://www.anthropic.com/legal/privacy">Anthropic (privacy)</a>, <a href="https://policies.google.com/privacy">Google</a>.</p>
<h3>How long</h3>
<p>Readings for at most 365 days: every day, those older than one year are deleted automatically (they disappear from the database backups within 30 days). Everything else as long as you keep your account. You can delete single readings, all readings, or your account with all its data from the app (Report tab, "See all readings"; Admin tab, "Delete my account"). Deletion is immediate and final. Only the record of your acceptance of the <a href="/terms">terms of use</a> (account, phone, date and time) is kept, as proof.</p>
<h3>Why</h3>
<p>Only to provide the diary you asked for. This is health data: the GDPR and the Swiss FADP apply even though the code is anonymous. The basis is your <strong>explicit consent</strong> (GDPR Art. 9(2)(a)), given at the first sign-in and with the acceptance of the terms; the error log, the limits against abuse and the record of your acceptance rest on legitimate interest (Art. 6(1)(f)). No automated decisions, no other use. The controller is the owner of HINT 365; Cloudflare processes the data on its behalf (processor). Anthropic and Google are in the United States: for the photo of the display, the sign-in and the payment, the transfer safeguards each of them provides apply (EU-US Data Privacy Framework or Standard Contractual Clauses). The pages may be served from a Cloudflare data centre near you; the database stays in the European Union.</p>
<h3>Your rights</h3>
<p>You can ask to see, correct or delete your data, to receive it in a common file format, to restrict or object to its use, and withdraw consent by deleting your account: we answer within one month. You can also contact your country's data-protection authority (in Switzerland the FDPIC, in Italy the Garante).</p>
</div>`);
}

/** The terms of use and notice every user accepts in the app before using it. Same text as in the app. */
export function termsPage(language = "en"): Response {
  const lang = Object.hasOwn(NOTICE_TEXT, language) ? language : "en";
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const text = NOTICE_TEXT[lang].split("\n\n").map((block, i) => {
    const [title, ...body] = block.split("\n");
    return `<${i === 0 ? "h2" : "h3"}>${escape(title)}</${i === 0 ? "h2" : "h3"}>${body.length ? `<p>${escape(body.join(" "))}</p>` : ""}`;
  }).join("\n");
  return page("HINT 365", `<nav><a href="?lang=it">Italiano</a> · <a href="?lang=en">English</a> · <a href="?lang=de">Deutsch</a> · <a href="?lang=fr">Français</a></nav>${text}<p>Version ${NOTICE_VERSION}</p><p><a href="/privacy">Privacy</a></p>`);
}
