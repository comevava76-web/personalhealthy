// Public pages of HINT: the home page and the privacy policy, linked from Google's sign-in screen.
// Plain HTML served by this same server; Italian and English on the same page.

const style = `
  :root { --bg:#0F1D38; --panel:#172B50; --ink:#EAF0FA; --muted:#9AAACA; --coral:#F2545B; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:760px; margin:0 auto; padding:32px 20px 56px; }
  header { display:flex; align-items:center; gap:14px; margin-bottom:28px; }
  header svg { width:52px; height:52px; flex:none; }
  h1 { font-size:28px; letter-spacing:3px; margin:0; }
  header p { margin:0; color:var(--muted); font-size:14px; }
  h2 { font-size:20px; margin:32px 0 8px; }
  h3 { font-size:16px; margin:20px 0 4px; }
  p, li { color:#D6DEEC; }
  a { color:var(--coral); }
  .box { background:var(--panel); border-radius:14px; padding:4px 20px 16px; margin-top:18px; }
  .muted { color:var(--muted); font-size:14px; }
  hr { border:0; border-top:1px solid #2A3F66; margin:36px 0; }
`;
const logo = `<svg viewBox="0 0 108 108" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#1C335E"/><stop offset="1" stop-color="#0F1D38"/></linearGradient></defs>
  <rect width="108" height="108" rx="24" fill="url(#g)"/>
  <path d="M13,57.2 H33.5 L38.9,49.7 L44.3,57.2 H48.6 L55.1,27 L62.1,84.2 L68,57.2 H74.5 L79.9,51.8 L85.3,57.2 H95"
   fill="none" stroke="#F2545B" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function page(title: string, body: string): Response {
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${style}</style></head>
<body><main><header>${logo}<div><h1>HINT</h1><p>HealthyInstantTracker</p></div></header>${body}</main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

function contactLine(email: string, it: boolean): string {
  if (email) return it
    ? `Per domande o per esercitare i tuoi diritti scrivi a <a href="mailto:${email}">${email}</a>.`
    : `For questions or to exercise your rights, write to <a href="mailto:${email}">${email}</a>.`;
  return it
    ? "Per domande o per esercitare i tuoi diritti usa l'email di assistenza mostrata nella schermata di accesso Google di HINT."
    : "For questions or to exercise your rights, use the support email shown on HINT's Google sign-in screen.";
}

export function homePage(): Response {
  return page("HINT · HealthyInstantTracker", `
<p><strong>HINT</strong> è un diario della pressione per Android. Fotografi il display del misuratore, oppure detti i valori a voce, e l'app registra massima, minima e battiti con data e ora. Prepara un report in PDF ed Excel da mandare al medico.</p>
<p>L'app non valuta i valori e non dà consigli medici: la valutazione spetta al medico.</p>
<p><a href="/privacy">Informativa sulla privacy</a></p>
<hr>
<p><strong>HINT</strong> is a blood-pressure diary for Android. Photograph the monitor's display, or say the values aloud, and the app records systolic, diastolic and pulse with date and time. It prepares a PDF and Excel report for the doctor.</p>
<p>The app does not assess the values and gives no medical advice: that is up to the doctor.</p>
<p><a href="/privacy">Privacy policy</a></p>`);
}

export function privacyPage(contactEmail: string): Response {
  return page("HINT · Privacy", `
<h2>Informativa sulla privacy</h2>
<p class="muted">Ultimo aggiornamento: 27 settembre 2026</p>
<div class="box">
<h3>Chi tratta i dati</h3>
<p>HINT è un'app privata, gestita da una persona per sé, la famiglia e gli amici. ${contactLine(contactEmail, true)}</p>
<h3>Quali dati</h3>
<ul>
<li><strong>Account Google:</strong> l'email e un codice identificativo che Google assegna al tuo account. Servono solo a ritrovare il tuo diario, anche su un nuovo telefono. Non leggiamo nient'altro del tuo account Google.</li>
<li><strong>Misure:</strong> massima, minima, battiti, data e ora di ogni misura, il momento della giornata, e se il valore viene da una foto o dalla voce.</li>
<li><strong>Chiave del telefono:</strong> una chiave anonima creata e custodita nel telefono, che firma le richieste. L'app si apre con impronta, volto o blocco schermo del telefono; questi restano nel telefono e non ci arrivano mai.</li>
<li><strong>Credito:</strong> il costo stimato di ogni lettura di foto.</li>
<li>Se paghi tu le letture: la tua chiave Anthropic, conservata cifrata e mai rimandata al telefono.</li>
</ul>
<h3>Foto e voce</h3>
<p>La foto del display viene inviata ad <strong>Anthropic</strong> (Claude) solo per leggere i numeri e non viene conservata da HINT. La voce viene trascritta dal riconoscimento vocale del telefono (di solito Google); a HINT arrivano solo i tre numeri.</p>
<h3>Dove stanno i dati e chi li vede</h3>
<p>Su server <strong>Cloudflare</strong>, con il database vincolato all'<strong>Unione Europea</strong>. Gli altri utenti non vedono i tuoi dati. Chi gestisce il servizio può accedere al database solo per manutenzione. Non vendiamo né cediamo i dati e non facciamo pubblicità.</p>
<h3>Per quanto tempo</h3>
<p>Finché hai l'account. Puoi cancellare singole misure, tutte le misure, oppure l'account con tutti i dati, dall'app (scheda Report, "Vedi tutte le misure"; scheda Credito, "Elimina il mio account"). La cancellazione è immediata e definitiva.</p>
<h3>Perché</h3>
<p>Solo per offrirti il diario che hai chiesto, con il tuo consenso dato al primo accesso. Sono dati sulla salute: li usiamo per nient'altro.</p>
<h3>I tuoi diritti</h3>
<p>Puoi chiedere di vedere, correggere o cancellare i tuoi dati, e revocare il consenso eliminando l'account. Puoi anche rivolgerti all'autorità per la protezione dei dati del tuo paese (in Svizzera l'IFPDT, in Italia il Garante).</p>
</div>
<hr>
<h2>Privacy policy</h2>
<p class="muted">Last updated: 27 September 2026</p>
<div class="box">
<h3>Who handles the data</h3>
<p>HINT is a private app, run by one person for themselves, their family and friends. ${contactLine(contactEmail, false)}</p>
<h3>What data</h3>
<ul>
<li><strong>Google account:</strong> the email and an identifier Google gives your account, only to find your diary again, also on a new phone. Nothing else of your Google account is read.</li>
<li><strong>Readings:</strong> systolic, diastolic, pulse, date and time of each reading, the time of day, and whether it came from a photo or your voice.</li>
<li><strong>Phone key:</strong> an anonymous key created and kept inside the phone, which signs the requests. The app opens with the phone's fingerprint, face or screen lock; these stay on the phone and never reach us.</li>
<li><strong>Credit:</strong> the estimated cost of each photo reading.</li>
<li>If you pay for your readings: your Anthropic key, stored encrypted and never sent back to the phone.</li>
</ul>
<h3>Photos and voice</h3>
<p>The photo of the display is sent to <strong>Anthropic</strong> (Claude) only to read the numbers, and is not kept by HINT. Speech is transcribed by the phone's speech recognition (usually Google); only the three numbers reach HINT.</p>
<h3>Where the data is and who sees it</h3>
<p>On <strong>Cloudflare</strong> servers, with the database bound to the <strong>European Union</strong>. Other users cannot see your data. The person who runs the service can reach the database only for maintenance. Data is not sold or shared, and there is no advertising.</p>
<h3>How long</h3>
<p>As long as you keep your account. You can delete single readings, all readings, or your account with all its data from the app (Report tab, "See all readings"; Credit tab, "Delete my account"). Deletion is immediate and final.</p>
<h3>Why</h3>
<p>Only to provide the diary you asked for, with the consent you give at your first sign-in. This is health data: it is used for nothing else.</p>
<h3>Your rights</h3>
<p>You can ask to see, correct or delete your data, and withdraw consent by deleting your account. You can also contact your country's data-protection authority (in Switzerland the FDPIC, in Italy the Garante).</p>
</div>`);
}
