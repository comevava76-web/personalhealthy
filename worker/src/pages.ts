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
<p><strong>Costi.</strong> L'app costa 5 $ all'anno, pagati al proprietario tramite Google Play (disdici quando vuoi): copre l'app e la conservazione delle misure. Le funzionalità AI (Scan delle foto, documenti resi anonimi) sono facoltative e si pagano a consumo ad Anthropic, con il tuo credito: il proprietario dell'app non ne incassa nulla. Dettagli nelle <a href="/terms">condizioni d'uso</a>.</p>
<p><a class="btn" href="/download">Scarica l'app per Android</a></p>
<p class="muted">Dopo il download apri il file e consenti l'installazione. All'avvio tocchi "Accedi con Google": se cambi telefono, ritrovi tutto allo stesso modo.</p>
<p><a href="/HINT-Guida-IT.pdf">Guida all'uso (PDF)</a> · <a href="/privacy">Informativa sulla privacy</a> · <a href="/terms">Condizioni d'uso</a></p>
<hr>
<p><strong>HINT 365</strong> is a blood-pressure diary for Android. Photograph the monitor's display, or say the values aloud, and the app records SYS, DIA and PUL with date and time. It prepares a PDF and Excel report for the doctor.</p>
<p>The app does not assess the values, makes no diagnosis and gives no medical advice: that is up to the doctor. Read the <a href="/terms">terms of use</a>.</p>
<p><strong>Costs.</strong> The app costs 5 $ a year, paid to its owner through Google Play (cancel any time): it covers the app and keeping your readings. The AI features (Scan of photos, anonymous documents) are optional and are paid per use to Anthropic, from your own credit: the owner of the app receives none of it. Details in the <a href="/terms">terms of use</a>.</p>
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
<h3>Foto e voce</h3>
<p>La foto del display viene inviata ad <strong>Anthropic</strong> (Claude) solo per leggere i numeri e non viene conservata da HINT 365. La voce viene trascritta dal riconoscimento vocale del telefono (di solito Google); a HINT 365 arrivano solo i tre numeri.</p>
<h3 id="cookie">Accesso (OAuth) e cookie</h3>
<p>L'accesso usa <strong>Accedi con Google</strong> (standard OAuth 2.0 e OpenID Connect): Google ci consegna un token firmato, che verifichiamo; non riceviamo mai la tua password. L'app non usa cookie. La Web Dashboard usa un solo cookie tecnico, <code>hint_s</code> (codice casuale, di prima parte, HttpOnly, Secure, SameSite=Strict, durata 7 giorni), salvato solo dopo che lo accetti; nel browser resta anche la tua scelta (<code>hint.cookies</code>). Nessun cookie di profilazione, statistica, pubblicità o di terze parti. Puoi rivedere la scelta dal link «Cookie» in fondo alla Web Dashboard.</p>
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
<h3>Photos and voice</h3>
<p>The photo of the display is sent to <strong>Anthropic</strong> (Claude) only to read the numbers, and is not kept by HINT 365. Speech is transcribed by the phone's speech recognition (usually Google); only the three numbers reach HINT 365.</p>
<h3 id="cookie-en">Sign-in (OAuth) and cookies</h3>
<p>Sign-in uses <strong>Sign in with Google</strong> (the OAuth 2.0 and OpenID Connect standards): Google hands us a signed token, which we check; we never receive your password. The app uses no cookies. The Web Dashboard uses a single technical cookie, <code>hint_s</code> (a random code, first-party, HttpOnly, Secure, SameSite=Strict, lasting 7 days), saved only after you accept it; your choice is also kept in the browser (<code>hint.cookies</code>). No profiling, statistics, advertising or third-party cookies. You can review the choice from the “Cookies” link at the bottom of the Web Dashboard.</p>
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
<h3>Cos&#x27;è HINT 365</h3>
<p>HINT 365 serve solo ad annotare, conservare e rappresentare in grafici e tabelle i valori che misuri tu con il tuo apparecchio. Nient&#x27;altro.</p>
<h3>Non è un dispositivo medico</h3>
<p>HINT 365 non misura nulla, non interpreta i dati, non fa diagnosi, non dà consigli, non suggerisce terapie e non dice se un valore è normale o no.</p>
<h3>Decide solo il medico</h3>
<p>Ogni valutazione, e ogni decisione di iniziare, cambiare o sospendere un farmaco, spetta esclusivamente al tuo medico. I dati di HINT 365 servono solo per mostrarli al tuo medico. Non cambiare mai una terapia sulla base dell&#x27;app.</p>
<h3>Emergenze</h3>
<p>Se stai male, hai sintomi o valori che ti preoccupano, non affidarti all&#x27;app: chiama il medico o il numero di emergenza (144 in Svizzera, 112 in Europa).</p>
<h3>L&#x27;esattezza dei dati è a tuo carico</h3>
<p>Sei tu a inserire i valori, a voce, da foto o a mano, e ne sei responsabile. La lettura automatica di foto e voce può sbagliare: controlla ogni valore prima di salvarlo e prima di condividerlo.</p>
<h3>Uso personale e sicurezza del telefono</h3>
<p>HINT 365 è per uso personale e non commerciale: inserisci solo i tuoi valori, o quelli di una persona che ti ha dato il suo consenso. Chi può aprire il tuo telefono può vedere i tuoi dati: proteggilo con blocco schermo e impronta. Non usare l&#x27;app in modo illecito o per disturbarne il funzionamento.</p>
<h3>Costi e a chi vanno</h3>
<table class="costs"><tr><th>Cosa</th><th>Costo</th><th>A chi va</th></tr><tr><td>HINT 365: app, grafici, report, Web Dashboard, conservazione delle misure</td><td>5 $ all&#x27;anno, disdici quando vuoi</td><td>Al proprietario dell&#x27;app, tramite Google Play</td></tr><tr><td>Funzionalità AI (facoltative): Scan delle foto, documenti resi anonimi</td><td>A consumo, circa 0,006 $ a foto</td><td>Ad Anthropic, dal tuo credito</td></tr></table>
<p>HINT 365 ha due costi separati, pagati a soggetti diversi.</p>
<p>1) L&#x27;abbonamento a HINT 365: 5 dollari USA all&#x27;anno (o l&#x27;equivalente nella tua valuta, mostrato da Google Play prima del pagamento), pagati al proprietario dell&#x27;app tramite Google Play, anche con Google Pay. Copre i costi dell&#x27;app e lo spazio per conservare le tue misure, e dà l&#x27;app completa: misure a voce e a mano, grafici, report PDF ed Excel, promemoria, Web Dashboard e link per il medico. Si rinnova ogni anno finché non lo disdici: puoi disdire in qualsiasi momento da Google Play e resta attivo fino alla fine dell&#x27;anno già pagato. Per i rimborsi valgono le regole di Google Play. HINT 365 non vede né la tua carta né il tuo nome. Finché il proprietario non attiva l&#x27;abbonamento, l&#x27;app è gratuita. Se l&#x27;abbonamento scade, l&#x27;app mostra solo un invito a rinnovarlo: le misure restano conservate (con la regola dei 365 giorni) e tornano disponibili subito dopo il rinnovo.</p>
<p>2) Le funzionalità AI, facoltative: la lettura delle foto del misuratore (Scan) e, in arrivo, dei documenti medici resi anonimi. Per attivarle serve un tuo credito prepagato presso Anthropic, a consumo: scala solo quando usi le funzionalità AI (circa 0,006 dollari a foto). Lo paghi direttamente ad Anthropic, secondo le sue condizioni: il proprietario di HINT 365 non ne incassa nulla. Il credito è tuo: lo gestisci su Anthropic e puoi usarlo anche per altri scopi. Consumi e costo per foto mostrati nell&#x27;app sono stime: fa fede solo il tuo conto Anthropic.</p>
<p>Senza funzionalità AI non paghi nient&#x27;altro oltre all&#x27;abbonamento.</p>
<h3>Accesso con Google (OAuth) e cookie</h3>
<p>L&#x27;accesso usa «Accedi con Google», basato sugli standard OAuth 2.0 e OpenID Connect: Google ti chiede il consenso e consegna all&#x27;app un token firmato, che HINT 365 verifica con le chiavi pubbliche di Google. HINT 365 non riceve mai la tua password Google e del token conserva solo l&#x27;impronta cifrata dell&#x27;account. L&#x27;app non usa cookie. La Web Dashboard usa un solo cookie tecnico, «hint_s», necessario per tenerti collegato per 7 giorni: contiene solo un codice casuale, è di prima parte e non è leggibile dagli script (HttpOnly, Secure, SameSite=Strict). Viene salvato solo dopo che lo accetti nell&#x27;avviso sui cookie, e nel browser resta salvata anche la tua scelta; puoi rivederla in ogni momento dal link «Cookie» in fondo alla pagina. Nessun cookie di profilazione, di statistica, di pubblicità o di terze parti. I link di sola lettura per il medico non salvano cookie.</p>
<h3>Dove sono i tuoi dati</h3>
<p>Le misure sono salvate su un cloud in Europa (Cloudflare, Unione Europea), legate a un codice anonimo dell&#x27;account e non al tuo nome: HINT 365 non chiede e non conserva nome, cognome, indirizzo o telefono. HINT 365 non salva la tua email: del tuo account Google conserva solo un&#x27;impronta cifrata, da cui non si può risalire né all&#x27;account né all&#x27;email, e che serve a ritrovare i tuoi dati quando accedi. L&#x27;email resta soltanto sul tuo telefono. Finché il servizio è attivo puoi recuperarli in qualsiasi momento, su qualsiasi telefono, accedendo con Google, ed esportarli in PDF o Excel: ti consigliamo di farlo ogni tanto. I dati non vengono mai venduti né usati per pubblicità. Solo la foto del display viene inviata ad Anthropic per leggere i numeri, e HINT 365 non la conserva. Le misure si conservano al massimo 365 giorni: ogni giorno quelle più vecchie di un anno vengono cancellate automaticamente, e dalle copie di sicurezza del database spariscono entro 30 giorni. Se vuoi tenerle più a lungo, esportale in PDF o Excel. Puoi cancellare le misure o l&#x27;intero account quando vuoi, dall&#x27;app. I dettagli sono nell&#x27;informativa sulla privacy.</p>
<h3>Fornitori e loro condizioni</h3>
<p>HINT 365 si appoggia a servizi di altre aziende, ognuna con le proprie condizioni, che ti invitiamo a leggere. Cloudflare: server e database in Europa; le foto e i file ci passano solo per essere elaborati, senza essere salvati (<a href="https://www.cloudflare.com/privacypolicy">cloudflare.com/privacypolicy</a>). Anthropic: lettura delle foto con la tua chiave (<a href="https://www.anthropic.com/legal/commercial-terms">anthropic.com/legal/commercial-terms</a> e <a href="https://www.anthropic.com/legal/privacy">anthropic.com/legal/privacy</a>). Google: accesso con Google, riconoscimento vocale del telefono e pagamento dell&#x27;abbonamento con Google Play (<a href="https://policies.google.com/privacy">policies.google.com/privacy</a> e <a href="https://play.google.com/about/play-terms/">play.google.com/about/play-terms</a>). Per quello che fanno questi servizi valgono le loro condizioni, non quelle di HINT 365.</p>
<h3>Nessuna garanzia, nessuna responsabilità</h3>
<p>L&#x27;app è fornita così com&#x27;è, senza garanzie di alcun tipo, nemmeno di funzionamento continuo, di arrivo dei promemoria o di conservazione dei dati. Nei limiti massimi consentiti dalla legge, l&#x27;autore declina ogni responsabilità per danni diretti o indiretti derivanti dall&#x27;uso o dal mancato uso dell&#x27;app, da dati inesatti, incompleti o persi, da costi addebitati dai fornitori e da qualsiasi decisione presa sulla base dei dati. Chi usa l&#x27;app se ne assume interamente la responsabilità.</p>
<h3>Modifiche e fine del servizio</h3>
<p>L&#x27;autore può modificare, sospendere o chiudere l&#x27;app e il servizio, anche senza preavviso. Queste condizioni vengono mostrate alla prima installazione, a ogni aggiornamento dell&#x27;app e quando cambiano, e vanno accettate ogni volta: senza accettazione l&#x27;app non si apre. L&#x27;autore può anche disattivare a distanza una versione dell&#x27;app, per esempio per un problema di sicurezza: in quel caso l&#x27;app non si apre finché non installi la versione aggiornata. Puoi smettere di usare HINT 365 e cancellare il tuo account in qualsiasi momento.</p>
<h3>Legge applicabile</h3>
<p>Queste condizioni sono regolate dal diritto svizzero, fatte salve le norme imperative a tutela dei consumatori del paese in cui vivi. Se una clausola risultasse non valida, le altre restano valide.</p>
<h3>La tua accettazione viene registrata</h3>
<p>Toccando «Prendo atto e accetto» confermi di avere almeno 18 anni, di aver letto e compreso queste condizioni d&#x27;uso e avvertenze e di accettarle. La tua accettazione (codice anonimo dell&#x27;account, impronta del telefono, versione e impronta del testo accettato, data e ora) viene salvata nel database di HINT 365 su Cloudflare, nell&#x27;Unione Europea, in un registro separato che si può solo aggiungere e mai modificare. È l&#x27;unica cosa conservata oltre i 365 giorni e anche dopo un&#x27;eventuale cancellazione dell&#x27;account, come prova.</p>
<p class="muted">Versione 11</p>
<hr>
<h2>Terms of use and notice</h2>
<h3>What HINT 365 is</h3>
<p>HINT 365 only helps you note, keep and show in charts and tables the values you measure yourself with your own device. Nothing more.</p>
<h3>It is not a medical device</h3>
<p>HINT 365 measures nothing, does not interpret the data, makes no diagnosis, gives no advice, suggests no treatment and never says whether a value is normal or not.</p>
<h3>Only your doctor decides</h3>
<p>Every assessment, and every decision to start, change or stop a medicine, belongs only to your doctor. HINT 365&#x27;s data are only meant to be shown to your doctor. Never change a treatment because of the app.</p>
<h3>Emergencies</h3>
<p>If you feel unwell, have symptoms or values that worry you, do not rely on the app: call your doctor or the emergency number (144 in Switzerland, 112 in Europe).</p>
<h3>You are responsible for the accuracy of the data</h3>
<p>You enter the values, by voice, from a photo or by hand, and you are responsible for them. The automatic reading of photos and voice can be wrong: check every value before saving it and before sharing it.</p>
<h3>Personal use and phone security</h3>
<p>HINT 365 is for personal, non-commercial use: enter only your own values, or those of a person who has given you their consent. Anyone who can open your phone can see your data: protect it with a screen lock and fingerprint. Do not use the app unlawfully or in a way that disrupts it.</p>
<h3>Costs and who is paid</h3>
<table class="costs"><tr><th>What</th><th>Cost</th><th>Paid to</th></tr><tr><td>HINT 365: app, charts, reports, Web Dashboard, keeping your readings</td><td>5 $ a year, cancel any time</td><td>The owner of the app, through Google Play</td></tr><tr><td>AI features (optional): Scan of photos, anonymous documents</td><td>Pay-per-use, about 0.006 $ a photo</td><td>Anthropic, from your own credit</td></tr></table>
<p>HINT 365 has two separate costs, paid to different parties.</p>
<p>1) The HINT 365 subscription: 5 US dollars a year (or the equivalent in your currency, shown by Google Play before you pay), paid to the owner of the app through Google Play, also with Google Pay. It covers the costs of the app and the space to keep your readings, and gives the complete app: readings by voice and by hand, charts, PDF and Excel reports, reminders, the Web Dashboard and links for the doctor. It renews every year until you cancel: you can cancel at any time in Google Play and it stays active until the end of the year already paid. Refunds follow Google Play&#x27;s rules. HINT 365 sees neither your card nor your name. Until the owner switches the subscription on, the app is free. If the subscription runs out, the app shows only an invitation to renew it: your readings are kept (under the 365-day rule) and come back as soon as you renew.</p>
<p>2) The AI features, optional: reading photos of the monitor (Scan) and, coming, medical documents made anonymous. To turn them on you need your own prepaid credit with Anthropic, pay-per-use: it goes down only when you use the AI features (about 0.006 dollars a photo). You pay it directly to Anthropic, under its terms: the owner of HINT 365 receives none of it. The credit is yours: you manage it on Anthropic and can use it for other things too. The spending and cost per photo shown in the app are estimates: only your Anthropic account is authoritative.</p>
<p>Without the AI features you pay nothing beyond the subscription.</p>
<h3>Sign in with Google (OAuth) and cookies</h3>
<p>Sign-in uses “Sign in with Google”, built on the OAuth 2.0 and OpenID Connect standards: Google asks for your consent and hands the app a signed token, which HINT 365 checks with Google&#x27;s public keys. HINT 365 never receives your Google password, and of the token it keeps only the encrypted fingerprint of the account. The app uses no cookies. The Web Dashboard uses a single technical cookie, “hint_s”, needed to keep you signed in for 7 days: it holds only a random code, is first-party and cannot be read by scripts (HttpOnly, Secure, SameSite=Strict). It is saved only after you accept it in the cookie notice, and your choice is also kept in the browser; you can review it at any time from the “Cookies” link at the bottom of the page. No profiling, statistics, advertising or third-party cookies. The read-only links for the doctor save no cookies.</p>
<h3>Where your data is</h3>
<p>Your readings are kept on a cloud in Europe (Cloudflare, European Union), linked to an anonymous account code and not to your name: HINT 365 does not ask for or keep your name, address or phone number. HINT 365 does not save your email: of your Google account it keeps only an encrypted fingerprint, which cannot be turned back into the account or the email, and which finds your data again when you sign in. The email stays only on your phone. As long as the service is running you can get them back at any time, on any phone, by signing in with Google, and export them to PDF or Excel: we suggest you do so now and then. The data are never sold or used for advertising. Only the photo of the display is sent to Anthropic to read the numbers, and HINT 365 does not keep it. Readings are kept for at most 365 days: every day, those older than one year are deleted automatically, and they disappear from the database backups within 30 days. To keep them longer, export them to PDF or Excel. You can delete your readings or your whole account whenever you like, from the app. The details are in the privacy policy.</p>
<h3>Providers and their terms</h3>
<p>HINT 365 relies on services of other companies, each with its own terms, which we invite you to read. Cloudflare: server and database in Europe; photos and files only pass through it to be processed, without being saved (<a href="https://www.cloudflare.com/privacypolicy">cloudflare.com/privacypolicy</a>). Anthropic: reading of the photos with your own key (<a href="https://www.anthropic.com/legal/commercial-terms">anthropic.com/legal/commercial-terms</a> and <a href="https://www.anthropic.com/legal/privacy">anthropic.com/legal/privacy</a>). Google: Sign in with Google, the phone&#x27;s speech recognition and the subscription payment through Google Play (<a href="https://policies.google.com/privacy">policies.google.com/privacy</a> and <a href="https://play.google.com/about/play-terms/">play.google.com/about/play-terms</a>). For what these services do, their terms apply, not HINT 365&#x27;s.</p>
<h3>No warranty, no liability</h3>
<p>The app is provided as is, without warranty of any kind, including continuous operation, delivery of reminders or keeping of the data. To the fullest extent permitted by law, the author disclaims all liability for any direct or indirect damage arising from the use or non-use of the app, from inaccurate, incomplete or lost data, from costs charged by providers and from any decision taken on the basis of the data. Whoever uses the app takes full responsibility for it.</p>
<h3>Changes and end of the service</h3>
<p>The author may change, suspend or close the app and the service, also without notice. These terms are shown at the first installation, at every update of the app and whenever they change, and must be accepted each time: without acceptance the app does not open. The author may also switch off a version of the app remotely, for example because of a security problem: the app then does not open until you install the updated version. You can stop using HINT 365 and delete your account at any time.</p>
<h3>Governing law</h3>
<p>These terms are governed by Swiss law, without prejudice to the mandatory consumer protection rules of the country where you live. If a clause turns out to be invalid, the others remain valid.</p>
<h3>Your acceptance is recorded</h3>
<p>By tapping “I understand and accept” you confirm that you are at least 18, that you have read and understood these terms of use and notice and that you accept them. Your acceptance (anonymous account code, fingerprint of the phone, version and fingerprint of the accepted text, date and time) is saved in HINT 365&#x27;s database on Cloudflare, in the European Union, in a separate register that can only be added to and never changed. It is the only thing kept beyond 365 days and also after your account is deleted, as proof.</p>
<p class="muted">Version 11</p>`);
}
