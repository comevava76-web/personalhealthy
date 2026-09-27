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
  .btn { display:inline-block; background:var(--coral); color:#fff; text-decoration:none; font-weight:600; padding:14px 22px; border-radius:14px; }
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
<p><strong>HINT</strong> è un diario della pressione per Android. Fotografi il display del misuratore, oppure detti i valori a voce, e l'app registra SYS, DIA e PUL con data e ora. Prepara un report in PDF ed Excel da mandare al medico.</p>
<p>L'app non valuta i valori, non fa diagnosi e non dà consigli medici: la valutazione spetta al medico. Leggi le <a href="/terms">avvertenze</a>.</p>
<p><a class="btn" href="/download">Scarica l'app per Android</a></p>
<p class="muted">Dopo il download apri il file e consenti l'installazione. All'avvio tocchi "Accedi con Google": se cambi telefono, ritrovi tutto allo stesso modo.</p>
<p><a href="/HINT-Guida-IT.pdf">Guida all'uso (PDF)</a> · <a href="/privacy">Informativa sulla privacy</a> · <a href="/terms">Avvertenze</a></p>
<hr>
<p><strong>HINT</strong> is a blood-pressure diary for Android. Photograph the monitor's display, or say the values aloud, and the app records SYS, DIA and PUL with date and time. It prepares a PDF and Excel report for the doctor.</p>
<p>The app does not assess the values, makes no diagnosis and gives no medical advice: that is up to the doctor. Read the <a href="/terms">notice</a>.</p>
<p><a class="btn" href="/download">Download the Android app</a></p>
<p class="muted">After the download, open the file and allow the installation. At first start tap "Sign in with Google": on a new phone you find everything again the same way.</p>
<p><a href="/HINT-Guide-EN.pdf">User guide (PDF)</a> · <a href="/privacy">Privacy policy</a> · <a href="/terms">Notice</a></p>`);
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
<li><strong>Misure:</strong> SYS, DIA e PUL (massima, minima, battiti), data e ora di ogni misura, il momento della giornata, e se il valore viene da una foto o dalla voce.</li>
<li><strong>Chiave del telefono:</strong> una chiave anonima creata e custodita nel telefono, che firma le richieste. L'app si apre con impronta, volto o blocco schermo del telefono; questi restano nel telefono e non ci arrivano mai.</li>
<li><strong>Credito:</strong> il costo stimato di ogni lettura di foto.</li>
<li><strong>Chiave Anthropic:</strong> la tua chiave, con cui paghi le letture delle tue foto, conservata cifrata e mai rimandata al telefono.</li>
</ul>
<h3>Foto e voce</h3>
<p>La foto del display viene inviata ad <strong>Anthropic</strong> (Claude) solo per leggere i numeri e non viene conservata da HINT. La voce viene trascritta dal riconoscimento vocale del telefono (di solito Google); a HINT arrivano solo i tre numeri.</p>
<h3>Dove stanno i dati e chi li vede</h3>
<p>Su server <strong>Cloudflare</strong>, con il database vincolato all'<strong>Unione Europea</strong>. Gli altri utenti non vedono i tuoi dati. Chi gestisce il servizio può accedere al database solo per manutenzione. Non vendiamo né cediamo i dati e non facciamo pubblicità.</p>
<h3>Per quanto tempo</h3>
<p>Finché hai l'account. Puoi cancellare singole misure, tutte le misure, oppure l'account con tutti i dati, dall'app (scheda Report, "Vedi tutte le misure"; scheda Admin, "Elimina il mio account"). La cancellazione è immediata e definitiva. Resta solo la registrazione della tua accettazione delle <a href="/terms">avvertenze</a> (email, account, telefono, data e ora), conservata come prova.</p>
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
<li><strong>Readings:</strong> SYS, DIA and PUL (systolic, diastolic, pulse), date and time of each reading, the time of day, and whether it came from a photo or your voice.</li>
<li><strong>Phone key:</strong> an anonymous key created and kept inside the phone, which signs the requests. The app opens with the phone's fingerprint, face or screen lock; these stay on the phone and never reach us.</li>
<li><strong>Credit:</strong> the estimated cost of each photo reading.</li>
<li><strong>Anthropic key:</strong> your key, which pays for your photo readings, stored encrypted and never sent back to the phone.</li>
</ul>
<h3>Photos and voice</h3>
<p>The photo of the display is sent to <strong>Anthropic</strong> (Claude) only to read the numbers, and is not kept by HINT. Speech is transcribed by the phone's speech recognition (usually Google); only the three numbers reach HINT.</p>
<h3>Where the data is and who sees it</h3>
<p>On <strong>Cloudflare</strong> servers, with the database bound to the <strong>European Union</strong>. Other users cannot see your data. The person who runs the service can reach the database only for maintenance. Data is not sold or shared, and there is no advertising.</p>
<h3>How long</h3>
<p>As long as you keep your account. You can delete single readings, all readings, or your account with all its data from the app (Report tab, "See all readings"; Admin tab, "Delete my account"). Deletion is immediate and final. Only the record of your acceptance of the <a href="/terms">notice</a> (email, account, phone, date and time) is kept, as proof.</p>
<h3>Why</h3>
<p>Only to provide the diary you asked for, with the consent you give at your first sign-in. This is health data: it is used for nothing else.</p>
<h3>Your rights</h3>
<p>You can ask to see, correct or delete your data, and withdraw consent by deleting your account. You can also contact your country's data-protection authority (in Switzerland the FDPIC, in Italy the Garante).</p>
</div>`);
}

/** The notice every user accepts in the app before using it (version 2). Same text as in the app. */
export function termsPage(): Response {
  return page("HINT · Avvertenze / Notice", `
<h2>Avvertenze importanti</h2>
<h3>Cos&#x27;è HINT</h3>
<p>HINT serve solo ad annotare, conservare e rappresentare in grafici e tabelle i valori che misuri tu con il tuo apparecchio. Nient&#x27;altro.</p>
<h3>Non è un dispositivo medico</h3>
<p>HINT non misura nulla, non interpreta i dati, non fa diagnosi, non dà consigli, non suggerisce terapie e non dice se un valore è normale o no.</p>
<h3>L&#x27;esattezza dei dati è a tuo carico</h3>
<p>Sei tu a inserire i valori, a voce, da foto o a mano, e ne sei responsabile. La lettura automatica di foto e voce può sbagliare: controlla ogni valore prima di salvarlo e prima di condividerlo.</p>
<h3>Decide solo il medico</h3>
<p>Ogni valutazione, e ogni decisione di iniziare, cambiare o sospendere un farmaco, spetta esclusivamente al tuo medico. I dati di HINT servono solo per mostrarli al tuo medico. Non cambiare mai una terapia sulla base dell&#x27;app.</p>
<h3>Emergenze</h3>
<p>Se stai male, hai sintomi o valori che ti preoccupano, non affidarti all&#x27;app: chiama il medico o il numero di emergenza (144 in Svizzera, 112 in Europa).</p>
<h3>Nessuna garanzia, nessuna responsabilità</h3>
<p>L&#x27;app è fornita così com&#x27;è, senza garanzie di alcun tipo, nemmeno di funzionamento continuo o di conservazione dei dati. Nei limiti massimi consentiti dalla legge, l&#x27;autore declina ogni responsabilità per danni diretti o indiretti derivanti dall&#x27;uso o dal mancato uso dell&#x27;app, da dati inesatti, incompleti o persi, e da qualsiasi decisione presa sulla base dei dati. Chi usa l&#x27;app se ne assume interamente la responsabilità.</p>
<h3>Dove sono i tuoi dati</h3>
<p>Le misure sono salvate su un cloud in Europa (Cloudflare, Unione Europea), legate a un codice anonimo dell&#x27;account e non al tuo nome: HINT non chiede e non conserva nome, cognome, indirizzo o telefono. L&#x27;email di Google serve solo per accedere e per ritrovare i dati. Puoi recuperarli in qualsiasi momento, su qualsiasi telefono, accedendo con Google, ed esportarli in PDF o Excel. Non vengono mai venduti né usati per pubblicità. Solo la foto del display viene inviata ad Anthropic per leggere i numeri, e non viene conservata.</p>
<h3>La tua accettazione viene registrata</h3>
<p>Toccando «Prendo atto e accetto» confermi di avere almeno 18 anni, di aver letto e compreso queste avvertenze e di accettarle. Conserviamo la tua accettazione (email, account, telefono, versione del testo, data e ora) come prova, anche dopo un&#x27;eventuale cancellazione dell&#x27;account.</p>
<hr>
<h2>Important notice</h2>
<h3>What HINT is</h3>
<p>HINT only helps you note, keep and show in charts and tables the values you measure yourself with your own device. Nothing more.</p>
<h3>It is not a medical device</h3>
<p>HINT measures nothing, does not interpret the data, makes no diagnosis, gives no advice, suggests no treatment and never says whether a value is normal or not.</p>
<h3>You are responsible for the accuracy of the data</h3>
<p>You enter the values, by voice, from a photo or by hand, and you are responsible for them. The automatic reading of photos and voice can be wrong: check every value before saving it and before sharing it.</p>
<h3>Only your doctor decides</h3>
<p>Every assessment, and every decision to start, change or stop a medicine, belongs only to your doctor. HINT&#x27;s data are only meant to be shown to your doctor. Never change a treatment because of the app.</p>
<h3>Emergencies</h3>
<p>If you feel unwell, have symptoms or values that worry you, do not rely on the app: call your doctor or the emergency number (144 in Switzerland, 112 in Europe).</p>
<h3>No warranty, no liability</h3>
<p>The app is provided as is, without warranty of any kind, including continuous operation or keeping of the data. To the fullest extent permitted by law, the author disclaims all liability for any direct or indirect damage arising from the use or non-use of the app, from inaccurate, incomplete or lost data, and from any decision taken on the basis of the data. Whoever uses the app takes full responsibility for it.</p>
<h3>Where your data is</h3>
<p>Your readings are kept on a cloud in Europe (Cloudflare, European Union), linked to an anonymous account code and not to your name: HINT does not ask for or keep your name, address or phone number. Your Google email is only used to sign in and to find your data again. You can get them back at any time, on any phone, by signing in with Google, and export them to PDF or Excel. They are never sold or used for advertising. Only the photo of the display is sent to Anthropic to read the numbers, and it is not kept.</p>
<h3>Your acceptance is recorded</h3>
<p>By tapping “I understand and accept” you confirm that you are at least 18, that you have read and understood this notice and that you accept it. We keep your acceptance (email, account, phone, version of the text, date and time) as proof, also after your account is deleted.</p>
<p class="muted">Versione 2 · Version 2</p>
<p><a href="/">HINT</a> · <a href="/privacy">Privacy</a></p>`);
}
