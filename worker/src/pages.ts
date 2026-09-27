// Public pages of HINT: the home page and the privacy policy, linked from Google's sign-in screen.
// Plain HTML served by this same server; Italian and English on the same page.

const style = `
  :root { --bg:#0F1D38; --panel:#172B50; --ink:#EAF0FA; --muted:#9AAACA; --accent:#8C7BF2; }
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
    ? "Per domande o per esercitare i tuoi diritti usa l'email di assistenza mostrata nella schermata di accesso Google di HINT."
    : "For questions or to exercise your rights, use the support email shown on HINT's Google sign-in screen.";
}

export function homePage(): Response {
  return page("HINT 365 · HealthyInstantTracker", `
<p><strong>HINT</strong> è un diario della pressione per Android. Fotografi il display del misuratore, oppure detti i valori a voce, e l'app registra SYS, DIA e PUL con data e ora. Prepara un report in PDF ed Excel da mandare al medico.</p>
<p>L'app non valuta i valori, non fa diagnosi e non dà consigli medici: la valutazione spetta al medico. Leggi le <a href="/terms">condizioni d'uso</a>.</p>
<p><a class="btn" href="/download">Scarica l'app per Android</a></p>
<p class="muted">Dopo il download apri il file e consenti l'installazione. All'avvio tocchi "Accedi con Google": se cambi telefono, ritrovi tutto allo stesso modo.</p>
<p><a href="/HINT-Guida-IT.pdf">Guida all'uso (PDF)</a> · <a href="/privacy">Informativa sulla privacy</a> · <a href="/terms">Condizioni d'uso</a></p>
<hr>
<p><strong>HINT</strong> is a blood-pressure diary for Android. Photograph the monitor's display, or say the values aloud, and the app records SYS, DIA and PUL with date and time. It prepares a PDF and Excel report for the doctor.</p>
<p>The app does not assess the values, makes no diagnosis and gives no medical advice: that is up to the doctor. Read the <a href="/terms">terms of use</a>.</p>
<p><a class="btn" href="/download">Download the Android app</a></p>
<p class="muted">After the download, open the file and allow the installation. At first start tap "Sign in with Google": on a new phone you find everything again the same way.</p>
<p><a href="/HINT-Guide-EN.pdf">User guide (PDF)</a> · <a href="/privacy">Privacy policy</a> · <a href="/terms">Terms of use</a></p>`);
}

export function privacyPage(contactEmail: string): Response {
  return page("HINT 365 · Privacy", `
<h2>Informativa sulla privacy</h2>
<p class="muted">Ultimo aggiornamento: 27 settembre 2026</p>
<div class="box">
<h3>Chi tratta i dati</h3>
<p>HINT è un'app privata, gestita da una persona per sé, la famiglia e gli amici. ${contactLine(contactEmail, true)}</p>
<h3>Quali dati</h3>
<ul>
<li><strong>Account Google:</strong> solo un'impronta cifrata del codice che Google assegna al tuo account, per ritrovare il tuo diario anche su un nuovo telefono. La tua email non viene salvata: resta sul tuo telefono. Non leggiamo nient'altro del tuo account Google.</li>
<li><strong>Misure:</strong> SYS, DIA e PUL (massima, minima, battiti), data e ora di ogni misura, il momento della giornata, e se il valore viene da una foto o dalla voce.</li>
<li><strong>Chiave del telefono:</strong> una chiave anonima creata e custodita nel telefono, che firma le richieste. L'app si apre con impronta, volto o blocco schermo del telefono; questi restano nel telefono e non ci arrivano mai.</li>
<li><strong>Credito:</strong> il costo stimato di ogni lettura di foto.</li>
<li><strong>Chiave Anthropic:</strong> la tua chiave, con cui paghi le letture delle tue foto, conservata cifrata e mai rimandata al telefono.</li>
</ul>
<h3>Foto e voce</h3>
<p>La foto del display viene inviata ad <strong>Anthropic</strong> (Claude) solo per leggere i numeri e non viene conservata da HINT. La voce viene trascritta dal riconoscimento vocale del telefono (di solito Google); a HINT arrivano solo i tre numeri.</p>
<h3>Dove stanno i dati e chi li vede</h3>
<p>Su server <strong>Cloudflare</strong>, con il database vincolato all'<strong>Unione Europea</strong>. Gli altri utenti non vedono i tuoi dati. Chi gestisce il servizio può accedere al database solo per manutenzione. Non vendiamo né cediamo i dati e non facciamo pubblicità. Condizioni dei fornitori: <a href="https://www.cloudflare.com/privacypolicy">Cloudflare</a>, <a href="https://www.anthropic.com/legal/commercial-terms">Anthropic (condizioni)</a>, <a href="https://www.anthropic.com/legal/privacy">Anthropic (privacy)</a>, <a href="https://policies.google.com/privacy">Google</a>.</p>
<h3>Per quanto tempo</h3>
<p>Le misure al massimo 365 giorni: ogni giorno quelle più vecchie di un anno vengono cancellate automaticamente (dalle copie di sicurezza del database spariscono entro 30 giorni). Il resto finché hai l'account. Puoi cancellare singole misure, tutte le misure, oppure l'account con tutti i dati, dall'app (scheda Report, "Vedi tutte le misure"; scheda Admin, "Elimina il mio account"). La cancellazione è immediata e definitiva. Resta solo la registrazione della tua accettazione delle <a href="/terms">condizioni d'uso</a> (account, telefono, data e ora), conservata come prova.</p>
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
<li><strong>Google account:</strong> only an encrypted fingerprint of the identifier Google gives your account, to find your diary again, also on a new phone. Your email is not saved: it stays on your phone. Nothing else of your Google account is read.</li>
<li><strong>Readings:</strong> SYS, DIA and PUL (systolic, diastolic, pulse), date and time of each reading, the time of day, and whether it came from a photo or your voice.</li>
<li><strong>Phone key:</strong> an anonymous key created and kept inside the phone, which signs the requests. The app opens with the phone's fingerprint, face or screen lock; these stay on the phone and never reach us.</li>
<li><strong>Credit:</strong> the estimated cost of each photo reading.</li>
<li><strong>Anthropic key:</strong> your key, which pays for your photo readings, stored encrypted and never sent back to the phone.</li>
</ul>
<h3>Photos and voice</h3>
<p>The photo of the display is sent to <strong>Anthropic</strong> (Claude) only to read the numbers, and is not kept by HINT. Speech is transcribed by the phone's speech recognition (usually Google); only the three numbers reach HINT.</p>
<h3>Where the data is and who sees it</h3>
<p>On <strong>Cloudflare</strong> servers, with the database bound to the <strong>European Union</strong>. Other users cannot see your data. The person who runs the service can reach the database only for maintenance. Data is not sold or shared, and there is no advertising. Providers' terms: <a href="https://www.cloudflare.com/privacypolicy">Cloudflare</a>, <a href="https://www.anthropic.com/legal/commercial-terms">Anthropic (terms)</a>, <a href="https://www.anthropic.com/legal/privacy">Anthropic (privacy)</a>, <a href="https://policies.google.com/privacy">Google</a>.</p>
<h3>How long</h3>
<p>Readings for at most 365 days: every day, those older than one year are deleted automatically (they disappear from the database backups within 30 days). Everything else as long as you keep your account. You can delete single readings, all readings, or your account with all its data from the app (Report tab, "See all readings"; Admin tab, "Delete my account"). Deletion is immediate and final. Only the record of your acceptance of the <a href="/terms">terms of use</a> (account, phone, date and time) is kept, as proof.</p>
<h3>Why</h3>
<p>Only to provide the diary you asked for, with the consent you give at your first sign-in. This is health data: it is used for nothing else.</p>
<h3>Your rights</h3>
<p>You can ask to see, correct or delete your data, and withdraw consent by deleting your account. You can also contact your country's data-protection authority (in Switzerland the FDPIC, in Italy the Garante).</p>
</div>`);
}

/** The terms of use and notice every user accepts in the app before using it. Same text as in the app. */
export function termsPage(): Response {
  return page("HINT 365 · Condizioni d'uso / Terms of use", `
<h2>Condizioni d&#x27;uso e avvertenze</h2>
<h3>Cos&#x27;è HINT</h3>
<p>HINT serve solo ad annotare, conservare e rappresentare in grafici e tabelle i valori che misuri tu con il tuo apparecchio. Nient&#x27;altro.</p>
<h3>Non è un dispositivo medico</h3>
<p>HINT non misura nulla, non interpreta i dati, non fa diagnosi, non dà consigli, non suggerisce terapie e non dice se un valore è normale o no.</p>
<h3>Decide solo il medico</h3>
<p>Ogni valutazione, e ogni decisione di iniziare, cambiare o sospendere un farmaco, spetta esclusivamente al tuo medico. I dati di HINT servono solo per mostrarli al tuo medico. Non cambiare mai una terapia sulla base dell&#x27;app.</p>
<h3>Emergenze</h3>
<p>Se stai male, hai sintomi o valori che ti preoccupano, non affidarti all&#x27;app: chiama il medico o il numero di emergenza (144 in Svizzera, 112 in Europa).</p>
<h3>L&#x27;esattezza dei dati è a tuo carico</h3>
<p>Sei tu a inserire i valori, a voce, da foto o a mano, e ne sei responsabile. La lettura automatica di foto e voce può sbagliare: controlla ogni valore prima di salvarlo e prima di condividerlo.</p>
<h3>Uso personale e sicurezza del telefono</h3>
<p>HINT è per uso personale e non commerciale: inserisci solo i tuoi valori, o quelli di una persona che ti ha dato il suo consenso. Chi può aprire il tuo telefono può vedere i tuoi dati: proteggilo con blocco schermo e impronta. Non usare l&#x27;app in modo illecito o per disturbarne il funzionamento.</p>
<h3>Costi della lettura delle foto</h3>
<p>La lettura delle foto è facoltativa e usa la tua chiave Anthropic: il costo viene addebitato da Anthropic sul tuo conto, secondo le sue condizioni. HINT non incassa nulla. Saldo, foto rimanenti e costo per foto mostrati nell&#x27;app sono stime indicative: fa fede solo il conto Anthropic.</p>
<h3>Dove sono i tuoi dati</h3>
<p>Le misure sono salvate su un cloud in Europa (Cloudflare, Unione Europea), legate a un codice anonimo dell&#x27;account e non al tuo nome: HINT non chiede e non conserva nome, cognome, indirizzo o telefono. HINT non salva la tua email: del tuo account Google conserva solo un&#x27;impronta cifrata, da cui non si può risalire né all&#x27;account né all&#x27;email, e che serve a ritrovare i tuoi dati quando accedi. L&#x27;email resta soltanto sul tuo telefono. Finché il servizio è attivo puoi recuperarli in qualsiasi momento, su qualsiasi telefono, accedendo con Google, ed esportarli in PDF o Excel: ti consigliamo di farlo ogni tanto. I dati non vengono mai venduti né usati per pubblicità. Solo la foto del display viene inviata ad Anthropic per leggere i numeri, e HINT non la conserva. Le misure si conservano al massimo 365 giorni: ogni giorno quelle più vecchie di un anno vengono cancellate automaticamente, e dalle copie di sicurezza del database spariscono entro 30 giorni. Se vuoi tenerle più a lungo, esportale in PDF o Excel. Puoi cancellare le misure o l&#x27;intero account quando vuoi, dall&#x27;app. I dettagli sono nell&#x27;informativa sulla privacy.</p>
<h3>Fornitori e loro condizioni</h3>
<p>HINT si appoggia a servizi di altre aziende, ognuna con le proprie condizioni, che ti invitiamo a leggere. Cloudflare: server e database in Europa; le foto e i file ci passano solo per essere elaborati, senza essere salvati (<a href="https://www.cloudflare.com/privacypolicy">cloudflare.com/privacypolicy</a>). Anthropic: lettura delle foto con la tua chiave (<a href="https://www.anthropic.com/legal/commercial-terms">anthropic.com/legal/commercial-terms</a> e <a href="https://www.anthropic.com/legal/privacy">anthropic.com/legal/privacy</a>). Google: accesso con Google e riconoscimento vocale del telefono (<a href="https://policies.google.com/privacy">policies.google.com/privacy</a>). Per quello che fanno questi servizi valgono le loro condizioni, non quelle di HINT.</p>
<h3>Nessuna garanzia, nessuna responsabilità</h3>
<p>L&#x27;app è fornita così com&#x27;è, senza garanzie di alcun tipo, nemmeno di funzionamento continuo, di arrivo dei promemoria o di conservazione dei dati. Nei limiti massimi consentiti dalla legge, l&#x27;autore declina ogni responsabilità per danni diretti o indiretti derivanti dall&#x27;uso o dal mancato uso dell&#x27;app, da dati inesatti, incompleti o persi, da costi addebitati dai fornitori e da qualsiasi decisione presa sulla base dei dati. Chi usa l&#x27;app se ne assume interamente la responsabilità.</p>
<h3>Modifiche e fine del servizio</h3>
<p>L&#x27;autore può modificare, sospendere o chiudere l&#x27;app e il servizio, anche senza preavviso. Quando queste condizioni cambiano, l&#x27;app mostra la nuova versione e chiede di accettarla di nuovo: senza accettazione l&#x27;app non si apre. Puoi smettere di usare HINT e cancellare il tuo account in qualsiasi momento.</p>
<h3>Legge applicabile</h3>
<p>Queste condizioni sono regolate dal diritto svizzero, fatte salve le norme imperative a tutela dei consumatori del paese in cui vivi. Se una clausola risultasse non valida, le altre restano valide.</p>
<h3>La tua accettazione viene registrata</h3>
<p>Toccando «Prendo atto e accetto» confermi di avere almeno 18 anni, di aver letto e compreso queste condizioni d&#x27;uso e avvertenze e di accettarle. La tua accettazione (codice anonimo dell&#x27;account, impronta del telefono, versione e impronta del testo accettato, data e ora) viene salvata nel database di HINT su Cloudflare, nell&#x27;Unione Europea, in un registro separato che si può solo aggiungere e mai modificare. È l&#x27;unica cosa conservata oltre i 365 giorni e anche dopo un&#x27;eventuale cancellazione dell&#x27;account, come prova.</p>
<p class="muted">Versione 7</p>
<hr>
<h2>Terms of use and notice</h2>
<h3>What HINT is</h3>
<p>HINT only helps you note, keep and show in charts and tables the values you measure yourself with your own device. Nothing more.</p>
<h3>It is not a medical device</h3>
<p>HINT measures nothing, does not interpret the data, makes no diagnosis, gives no advice, suggests no treatment and never says whether a value is normal or not.</p>
<h3>Only your doctor decides</h3>
<p>Every assessment, and every decision to start, change or stop a medicine, belongs only to your doctor. HINT&#x27;s data are only meant to be shown to your doctor. Never change a treatment because of the app.</p>
<h3>Emergencies</h3>
<p>If you feel unwell, have symptoms or values that worry you, do not rely on the app: call your doctor or the emergency number (144 in Switzerland, 112 in Europe).</p>
<h3>You are responsible for the accuracy of the data</h3>
<p>You enter the values, by voice, from a photo or by hand, and you are responsible for them. The automatic reading of photos and voice can be wrong: check every value before saving it and before sharing it.</p>
<h3>Personal use and phone security</h3>
<p>HINT is for personal, non-commercial use: enter only your own values, or those of a person who has given you their consent. Anyone who can open your phone can see your data: protect it with a screen lock and fingerprint. Do not use the app unlawfully or in a way that disrupts it.</p>
<h3>Cost of reading photos</h3>
<p>Reading photos is optional and uses your own Anthropic key: the cost is charged by Anthropic to your account, under its terms. HINT collects no money. The balance, photos left and cost per photo shown in the app are estimates: only your Anthropic account is authoritative.</p>
<h3>Where your data is</h3>
<p>Your readings are kept on a cloud in Europe (Cloudflare, European Union), linked to an anonymous account code and not to your name: HINT does not ask for or keep your name, address or phone number. HINT does not save your email: of your Google account it keeps only an encrypted fingerprint, which cannot be turned back into the account or the email, and which finds your data again when you sign in. The email stays only on your phone. As long as the service is running you can get them back at any time, on any phone, by signing in with Google, and export them to PDF or Excel: we suggest you do so now and then. The data are never sold or used for advertising. Only the photo of the display is sent to Anthropic to read the numbers, and HINT does not keep it. Readings are kept for at most 365 days: every day, those older than one year are deleted automatically, and they disappear from the database backups within 30 days. To keep them longer, export them to PDF or Excel. You can delete your readings or your whole account whenever you like, from the app. The details are in the privacy policy.</p>
<h3>Providers and their terms</h3>
<p>HINT relies on services of other companies, each with its own terms, which we invite you to read. Cloudflare: server and database in Europe; photos and files only pass through it to be processed, without being saved (<a href="https://www.cloudflare.com/privacypolicy">cloudflare.com/privacypolicy</a>). Anthropic: reading of the photos with your own key (<a href="https://www.anthropic.com/legal/commercial-terms">anthropic.com/legal/commercial-terms</a> and <a href="https://www.anthropic.com/legal/privacy">anthropic.com/legal/privacy</a>). Google: Sign in with Google and the phone&#x27;s speech recognition (<a href="https://policies.google.com/privacy">policies.google.com/privacy</a>). For what these services do, their terms apply, not HINT&#x27;s.</p>
<h3>No warranty, no liability</h3>
<p>The app is provided as is, without warranty of any kind, including continuous operation, delivery of reminders or keeping of the data. To the fullest extent permitted by law, the author disclaims all liability for any direct or indirect damage arising from the use or non-use of the app, from inaccurate, incomplete or lost data, from costs charged by providers and from any decision taken on the basis of the data. Whoever uses the app takes full responsibility for it.</p>
<h3>Changes and end of the service</h3>
<p>The author may change, suspend or close the app and the service, also without notice. When these terms change, the app shows the new version and asks you to accept it again: without acceptance the app does not open. You can stop using HINT and delete your account at any time.</p>
<h3>Governing law</h3>
<p>These terms are governed by Swiss law, without prejudice to the mandatory consumer protection rules of the country where you live. If a clause turns out to be invalid, the others remain valid.</p>
<h3>Your acceptance is recorded</h3>
<p>By tapping “I understand and accept” you confirm that you are at least 18, that you have read and understood these terms of use and notice and that you accept them. Your acceptance (anonymous account code, fingerprint of the phone, version and fingerprint of the accepted text, date and time) is saved in HINT&#x27;s database on Cloudflare, in the European Union, in a separate register that can only be added to and never changed. It is the only thing kept beyond 365 days and also after your account is deleted, as proof.</p>
<p class="muted">Version 7</p>`);
}
