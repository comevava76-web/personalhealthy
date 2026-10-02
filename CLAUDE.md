# HINT · regole per chi lavora su questo repository

## Shared handover — mandatory first read for every session

Read **[Checkpoint/HANDOVER.md](Checkpoint/HANDOVER.md)** first for project context, then follow **[AGENTS.md](AGENTS.md)** and the project rules below. This applies to Claude Code, Codex/ChatGPT, Kimi and all developers, including the same tool returning later.

Before closing a session, refresh the handover's current state, append a dated entry identifying the developer/tool and its work, tests, commits/releases, limits and next step, and commit it with the related changes. Keep one living `HANDOVER.md`; use Git for history. Never mark pending work as completed or store secrets/patient data there. The user explicitly chose `Checkpoint/` for this shared handover.

- **Documentazione sempre aggiornata, e sempre solo in inglese.** `docs/architecture/architecture.html` (pagina 1 funzionale, pagina 2 tecnologie)
  (pagina 3: flusso a runtime e CI/CD) va aggiornata a ogni modifica che cambia un flusso, una tecnologia, una regola o una tabella; poi si rigenera il PDF con
  `node docs/architecture/render.cjs` e si committano HTML, PDF e anteprime insieme alla modifica.
- **Materiale demo** in `docs/demo/`: se cambia l'aspetto della dashboard o del PDF, rifare gli screenshot (solo dati di prova,
  mai misure reali).
- **Mai diagnosi**, mai giudizi sui valori; etichette sempre SYS, DIA, PUL; pressione e battiti mai nello stesso grafico;
  grafici di 7 giorni con un punto per giorno (la media del giorno, spiegata prima dei grafici) e il valore accanto, sotto solo i numeri dei giorni, senza scorrimento orizzontale; stesso PDF A4 dall'app e dal web.
- **Tema chiaro e scuro, stessi colori in app e web**: una sola palette (scuro e chiaro) in `MainActivity.kt` (`object C`) e `worker/public/my/style.css` (variabili CSS), valori identici; nel Gestore «Aspetto»: scuro (di base) o chiaro; l'app passa il tema alla Web Dashboard (`&light`/`&dark`), che altrimenti si apre scura. Il Gestore a schede ordinate (numeri, Aspetto, Account, Condividi), mai pulsanti giganti. In Referti il pulsante della Web Dashboard viene subito dopo l'importazione e lo «Storico referti caricati» è l'ultimo, chiuso sotto il numero dei referti finché non lo si tocca. Non salvato nel browser. Ogni colore nuovo va in entrambi i file. In Pressione i due pulsanti per registrare hanno colori diversi: Voce blu calmo (`C.Voice` / `--voice`), Scan viola. Blocco: si usa quello del telefono (nessun PIN dell'app); ogni 14 giorni al massimo un piccolo invito ad attivare impronta/volto o un blocco schermo (`BioNudge`), solo una proposta (scelta di Human).
- **PDF colorati, mai rosso** (chiesto da Human): pressione con banda viola→verde acqua e riga a tre colori SYS/DIA/PUL,
  ombra leggera sotto le linee, riquadri dei valori tinti col colore della misura, tabella con intestazione colorata e righe
  alterne; referti con banda verde acqua→indaco, tabella con intestazione colorata, righe alterne e colonne divise, al più
  cinque date per blocco. Stessi colori nel PDF dell'app (`Report.kt`) e del web (`report.js`, `labsPdf` in `app.js`).
- **Niente rosso**, in nessun grafico, pulsante o logo: SYS viola, DIA verde acqua, PUL ambra; nessun colore deve sembrare
  un giudizio (né problema né «bene»). Unica eccezione, chiesta da Human: lo stato complessivo della console Security
  (Secure verde, Vulnerable arancione, Vulnerable · High risk rosso); gli stati Open/Fixing/Fixed/Failed sempre in inglese.
  Terza eccezione, chiesta da Human: nella console Admin il riquadro «Bilancio» è verde se positivo con margine (copre anche la prova
  di tutti gli utenti), arancione da «In pari» in giù, anche se negativo (mai rosso).
  Seconda eccezione, chiesta da Human: nella tabella dei referti un risultato fuori dal riferimento stampato sullo stesso
  referto è arancione con ↑ o ↓ (solo confronto fra numeri, mai diagnosi).
- **Referti**: PDF o foto letti solo sul telefono, in background con stati visibili (Elaborazione → Scansione → Caricamento →
  salvato); si salva tutto o niente (una data certa, ogni riga compresa, anche esami fuori catalogo col nome stampato);
  mai due volte lo stesso file (impronta HMAC in `lab_files`) né lo stesso esame nella stessa data; referti vecchi salvati con
  la loro data; i risultati dei referti non si cancellano mai in automatico: restano finché l'utente li elimina (una data,
  tutti, un referto nell'app o l'account). Il documento resta sul telefono, in transito solo data e valori come stampati
  (mai nome o riferimenti alla persona), sul server solo quelli: va scritto così in condizioni e privacy. Sul web una tabella: righe = esami, colonne = date, trattino se manca,
  nessun grafico; si elimina una data intera. Il testo delle condizioni nell'app si genera con `worker/scripts/sync-notice.mjs`.
- **Conservazione**: misure della pressione al massimo 365 giorni (cancellazione automatica ogni notte); risultati dei referti
  finché l'utente li elimina; le accettazioni delle condizioni restano
  come prova. Se cambia, aggiornare condizioni d'uso (nuova versione), privacy e documento.
- **Nessuna email nel database**: dell'account Google si salva solo un'impronta HMAC (`googleId` in `worker/src/index.ts`);
  l'email resta sul telefono. Nessuna funzione deve reintrodurla.
- **Mai segreti nel repository**: chiavi e token solo nei secrets di GitHub o sul server.
- **Nome**: sempre «HINT 365» nei testi per l'utente (app, web, PDF, guide, condizioni).
- **Lingue**: italiano, tedesco, francese, inglese. Se il telefono o il browser è in un'altra lingua (georgiano, spagnolo,
  bulgaro…) tutto è in inglese: testi (`values/`), date e giorni (`appLocale()` in `Core.kt`, inglese britannico),
  condizioni e risposte del server (`X-Lang`), Web Dashboard (`app.js`).
- **Condizioni d'uso vincolanti**: mostrate alla prima installazione, a ogni aggiornamento dell'app e quando cambia il testo
  (`DISCLAIMER_VERSION` in app e server); se il testo cambia, nuova versione anche su `/terms`.
- **Disattivazione a distanza**: ogni richiesta dell'app porta `X-App-Version`; il server blocca le versioni sotto
  `app_min_version`, quelle in `app_blocked` o tutte con `app_off` (tabella `settings`). Si comanda dall'app (gestore) o da
  Actions → *App versions*. Non togliere questo controllo.
- **Abbonamento alle funzionalità AI** (decisione di Human del 02.10.2026): l'app è gratuita (voce, referti, grafici,
  report, Web Dashboard) a discrezione dell'owner, che nelle condizioni si riserva di cambiare prezzi, togliere il gratuito, mettere
  tutta l'app a pagamento o ritirarla (con nuova versione delle condizioni; nell'app non va scritto altrove). Si pagano solo le funzionalità AI, oggi lo Scan: 4,99 US$ all'anno via Google Play (`hint365_annual`),
  dopo una prova di 15 giorni dal primo Scan (3 al giorno, al massimo 45 foto), una volta per account Google e per telefono
  (impronte HMAC in `scan_trials`, mai email, tenute al massimo 2 anni). Due giorni prima della fine una notifica
  (`Reminders.aiTrial`). Dopo, senza abbonamento, il pulsante Scan è grigio con «Sblocca questa funzionalità» → `ScanLockScreen`
  (abbonarsi). Un abbonato ha un plafond annuo di 2,50 US$ di AI (`SCAN_YEAR_USD`, dai token del fornitore), tracciato
  nel DB (`scan_usage`: Scan e costo nei 12 mesi dal primo Scan, cancellato con l'account); il pulsante mostra gli Scan che restano;
  finito il plafond, `429 scan_budget`. Nessuna chiave AI personale: la chiave è solo dell'owner (decisione di Human: nessuno la metterebbe). L'owner non paga. Del pagamento si salvano solo token, stato e scadenza. Solo l'owner può disattivare versioni dell'app.
- **Accesso e cookie dichiarati**: l'accesso è Sign in with Google (OAuth 2.0 / OpenID Connect) e va scritto così in condizioni,
  privacy e documento. L'app non usa cookie; la Web Dashboard usa solo il cookie tecnico `hint_s`, salvato solo dopo il consenso
  nell'avviso cookie. Ogni nuovo cookie o dato nel browser va dichiarato nelle condizioni (nuova versione) e nella privacy.
- **Politica dei costi** (tabella in app, condizioni e home): app gratuita; funzionalità AI 15 giorni gratis, poi 4,99 $/anno al
  proprietario via Google Play; nessun altro costo di HINT 365. Gli Scan della prova e degli abbonati li paga l'owner (chiave
  AI nel secret del Worker). Conti e scenari in `docs/business/owner-economics.md`.
- **Scan della foto del misuratore con l'AI** (condizioni v21, decisione di Human del 02.10.2026: il lettore senza AI delle
  v20 non leggeva i display veri; far inserire una chiave a tutti sarebbe un deterrente). Pulsante Scan con la bacchetta e le stelline (`ic_ai_wand`):
  **3 Scan al giorno per persona** (prova di 15 giorni, poi abbonamento), pagati dall'owner: la foto del solo display va al Worker (`POST /v1/bp/photo/read`,
  mai salvata né registrata) e da lì ad Anthropic (`claude-haiku-4-5`, il più economico, chiave nel secret `AI_API_KEY`, nome generico perché il fornitore può cambiare, impostato dalla
  pipeline dal secret GitHub omonimo (vale ancora il vecchio `ANTHROPIC_API_KEY`); senza secret lo Scan risponde `scan_off`). Limite `SCAN_FREE`=3/giorno, owner 30; prova finita senza abbonamento = `402 scan_locked`.
  La chiave sta nel secret GitHub `AI_API_KEY` (cifrato, mai visibile, anche con repository pubblico) oppure direttamente in
  Cloudflare (Worker → Settings → Variables and Secrets): il deploy non la cancella. I numeri si mostrano e si salvano solo dopo la conferma; valori non
  plausibili = rifare la foto. Si salvano solo i tre numeri (`/v1/bp/photo`) e i codici degli esiti (`bp_photo_*`).
  Il modulo `android/reader` (MonitorReader) resta nel repository ma l'app non lo usa più.
- **Nell'app niente menu Report**: i report completi si aprono dal pulsante in fondo a Pressione e a Referti. Lo storico in Referti mostra solo i referti salvati; rifiuti e doppioni solo nei log (`error_log`, `event_log`). Il Gestore mostra quante misure e quanti referti, Google e account; niente costi.
- **Link alla Web Dashboard dall'app**: apre solo la pagina da cui si parte (`&bp` pressione, `&labs` referti, `&admin` console), senza le schede per passare all'altra.
- **App semplice, controlli del proprietario solo sul web**: nell'app nessun pulsante che oggi non si usa. L'owner ha
  nella Web Dashboard la console **Admin** (quattro numeri: vulnerabilità aperte nel codice dell'app e nelle librerie Android/iOS, difetti aperti, compliance non coperta del tutto; poi «Conti in breve», quattro riquadri colorati con la palette, mai rosso (incassato, speso in AI, utenti, spesa massima della prova stimata per quegli utenti e ogni 100: il limite vero resta il tetto sulla console del fornitore AI); poi le tabelle **Consumi** (Scan e costo AI per mese) e **Entrate e uscite** (abbonamenti, entrate, dopo Google Play, uscite AI, differenza: stime, da `ai_spend_daily` e `sub_sales_daily`, solo totali); sotto il pulsante a Observability e il blocco versioni; senza le schede Pressione e Referti), aperta dall'icona **Admin** nell'app (l'ultima, solo owner); il tab dell'account nell'app si chiama **Gestore**:
  mai valori delle misure, report o nomi. L'abbonamento resta pronto ma spento finché l'app non esce sul Play Store.
- **Poteri dell'owner solo sul suo telefono** (chiesto da Human: l'email da sola non basta): console Admin, versioni e impostazioni
  funzionano solo dal telefono registrato come owner (`owner_key`); chi ruba l'account Google e lo sposta su un altro telefono non li ha.
  Su un telefono nuovo dell'owner, Gestore chiede il **codice segreto da owner** (secret `OWNER_CODE`, 5 tentativi al giorno);
  riserva: Actions → *Owner phone*. Non togliere questo controllo.
- **Dove gira**: tutto su Cloudflare, un solo Worker (API `/v1`, Web Dashboard `/my`, link `/s`) con D1 in UE; niente Vercel.
  App e browser non toccano mai D1: passa tutto dal Worker.
- **Ruoli**: Human è l'architetto (decide design e priorità in chat, prova ogni APK); Claude sviluppa, testa, unisce, controlla
  il deploy e manda l'APK in chat. **Ogni messaggio a Human che parla dell'app finisce sempre con il link all'APK**:
  https://personalhealthy-api.comevava76.workers.dev/download (servito dal Worker, nessun login GitHub; sempre l'ultima versione).
- **Tutti i documenti in `docs/`** (indice `docs/README.md`: cosa, chi, quando). Ogni aggiunta, modifica o rimozione aggiorna nello
  stesso commit i documenti che tocca: architettura (6 pagine, `node docs/check-layout.cjs`), guide IT/EN con i loro PDF (`node docs/render-guides.cjs`),
  condizioni/privacy/home in `docs/legal/` (`cd worker && node scripts/export-docs.mjs`, poi i PDF con `node docs/legal/render.cjs`); costi e guadagni dell'owner in `docs/business/` (`node docs/business/render.cjs`). Tutti i documenti stanno nella cartella `docs/` del repository (chiesto da Human). Il workflow *Docs check* lo verifica.
- **Registro errori** (`error_log`, `worker/src/errors.ts`, `ErrorReport` nell'app, `app.js` sul web): sintetico, raggruppato per
  giorno/punto/versione con contatore, senza valori delle misure, 90 giorni. Va letto a ogni sessione di lavoro e dopo ogni
  rilascio; ogni nuovo errore diventa una correzione. Ogni nuova funzione che può fallire deve finire nel registro.
- **Observability** (Admin web, solo owner): vulnerabilità, compliance UE/Svizzera (`worker/src/ops/compliance.json`), problemi
  e risoluzioni (`worker/src/ops/problems.json` + `error_log`). Gli esiti dei caricamenti (`event_log`) restano nel registro, non nella pagina (chiesto da Human). Solo codici e conteggi.
  Ogni correzione di un problema aggiorna `problems.json` nella stessa PR; ogni cambio di dati, fornitori o sicurezza
  aggiorna `compliance.json`. I bug sicuri si correggono senza chiedere; a Human solo un riassunto.
- **Ciclo continuo**: ogni mattina *Error log report* (Actions, 06:30) apre una issue `error-log` se ci sono errori; la routine
  programmata di Claude (06:48, «HINT 365 · daily error-log check and fix») la legge, corregge i bug piccoli con PR e documenti,
  unisce dopo *Docs check* e riporta nella issue. Le modifiche grandi o alle condizioni aspettano Human.
