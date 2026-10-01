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
- **Tema chiaro e scuro, stessi colori in app e web**: una sola palette (scuro e chiaro) in `MainActivity.kt` (`object C`) e `worker/public/my/style.css` (variabili CSS), valori identici; nel Gestore «Aspetto»: come il telefono, chiaro o scuro; l'app passa il tema alla Web Dashboard (`&light`/`&dark`), che altrimenti segue il dispositivo. Non salvato nel browser. Ogni colore nuovo va in entrambi i file.
- **PDF colorati, mai rosso** (chiesto da Human): pressione con banda viola→verde acqua e riga a tre colori SYS/DIA/PUL,
  ombra leggera sotto le linee, riquadri dei valori tinti col colore della misura, tabella con intestazione colorata e righe
  alterne; referti con banda verde acqua→indaco, tabella con intestazione colorata, righe alterne e colonne divise, al più
  cinque date per blocco. Stessi colori nel PDF dell'app (`Report.kt`) e del web (`report.js`, `labsPdf` in `app.js`).
- **Niente rosso**, in nessun grafico, pulsante o logo: SYS viola, DIA verde acqua, PUL ambra; nessun colore deve sembrare
  un giudizio (né problema né «bene»). Unica eccezione, chiesta da Human: lo stato complessivo della console Security
  (Secure verde, Vulnerable arancione, Vulnerable · High risk rosso); gli stati Open/Fixing/Fixed/Failed sempre in inglese.
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
- **Condizioni d'uso vincolanti**: mostrate alla prima installazione, a ogni aggiornamento dell'app e quando cambia il testo
  (`DISCLAIMER_VERSION` in app e server); se il testo cambia, nuova versione anche su `/terms`.
- **Disattivazione a distanza**: ogni richiesta dell'app porta `X-App-Version`; il server blocca le versioni sotto
  `app_min_version`, quelle in `app_blocked` o tutte con `app_off` (tabella `settings`). Si comanda dall'app (gestore) o da
  Actions → *App versions*. Non togliere questo controllo.
- **Abbonamento**: 5 US$ all'anno (costi dell'app e spazio delle misure) via Google Play (`hint365_annual`), spento finché l'owner non lo accende; l'owner non paga.
  Senza abbonamento valido solo il messaggio di cortesia per rinnovare; i dati restano. Del pagamento si salvano solo token,
  stato e scadenza. Solo l'owner (primo account, `is_admin`) può accendere l'abbonamento o disattivare versioni dell'app.
- **Accesso e cookie dichiarati**: l'accesso è Sign in with Google (OAuth 2.0 / OpenID Connect) e va scritto così in condizioni,
  privacy e documento. L'app non usa cookie; la Web Dashboard usa solo il cookie tecnico `hint_s`, salvato solo dopo il consenso
  nell'avviso cookie. Ogni nuovo cookie o dato nel browser va dichiarato nelle condizioni (nuova versione) e nella privacy.
- **Politica dei costi** (tabella in app, condizioni e home): solo l'app, 5 $/anno al proprietario via Google Play; nessun altro
  costo. **Niente AI**: la Scan con Anthropic è stata tolta (condizioni v19, decisione di Human); nessun dato va a fornitori di AI.
  Non reintrodurla senza una nuova decisione di Human (nuova versione delle condizioni, privacy, compliance).
- **Scan della foto del misuratore, senza AI** (condizioni v20, chiesta da Human): la foto si legge solo sul telefono
  (`MonitorReader` nel modulo `android/reader`, poi ML Kit incluso nell'app), si mostra con i numeri letti e si salva solo
  dopo la conferma della persona; la foto non esce mai dal telefono e si cancella. Se non è sicura non indovina: dice il
  motivo e chiede di rifare la foto. Il test di 400 foto generate gira nella CI: **mai un valore sbagliato** (0 WRONG);
  ogni modifica al lettore deve mantenerlo. Al server solo i tre numeri (`/v1/bp/photo`) e i codici degli esiti (`bp_photo_*`).
- **Nell'app niente menu Report**: i report completi si aprono dal pulsante in fondo a Pressione e a Referti. Lo storico in Referti mostra solo i referti salvati; rifiuti e doppioni solo nei log (`error_log`, `event_log`). Il Gestore mostra quante misure e quanti referti, Google e account; niente costi.
- **Link alla Web Dashboard dall'app**: apre solo la pagina da cui si parte (`&bp` pressione, `&labs` referti, `&admin` console), senza le schede per passare all'altra.
- **App semplice, controlli del proprietario solo sul web**: nell'app nessun pulsante che oggi non si usa. L'owner ha
  nella Web Dashboard la console **Admin** (solo quattro numeri: vulnerabilità aperte nel codice dell'app e nelle librerie Android/iOS, difetti aperti, compliance non coperta del tutto; sotto il pulsante a Observability e il blocco versioni; senza le schede Pressione e Referti), aperta dall'icona **Admin** nell'app (l'ultima, solo owner); il tab dell'account nell'app si chiama **Gestore**:
  mai valori delle misure, report o nomi. L'abbonamento resta pronto ma spento finché l'app non esce sul Play Store.
- **Dove gira**: tutto su Cloudflare, un solo Worker (API `/v1`, Web Dashboard `/my`, link `/s`) con D1 in UE; niente Vercel.
  App e browser non toccano mai D1: passa tutto dal Worker.
- **Ruoli**: Human è l'architetto (decide design e priorità in chat, prova ogni APK); Claude sviluppa, testa, unisce, controlla
  il deploy e manda l'APK in chat. **Ogni messaggio a Human che parla dell'app finisce sempre con il link all'APK**:
  https://personalhealthy-api.comevava76.workers.dev/download (servito dal Worker, nessun login GitHub; sempre l'ultima versione).
- **Tutti i documenti in `docs/`** (indice `docs/README.md`: cosa, chi, quando). Ogni aggiunta, modifica o rimozione aggiorna nello
  stesso commit i documenti che tocca: architettura (6 pagine, `node docs/check-layout.cjs`), guide IT/EN con i loro PDF (`node docs/render-guides.cjs`),
  condizioni/privacy/home in `docs/legal/` (`cd worker && node scripts/export-docs.mjs`). Il workflow *Docs check* lo verifica.
- **Registro errori** (`error_log`, `worker/src/errors.ts`, `ErrorReport` nell'app, `app.js` sul web): sintetico, raggruppato per
  giorno/punto/versione con contatore, senza valori delle misure, 90 giorni. Va letto a ogni sessione di lavoro e dopo ogni
  rilascio; ogni nuovo errore diventa una correzione. Ogni nuova funzione che può fallire deve finire nel registro.
- **Observability** (Admin web, solo owner): vulnerabilità, compliance UE/Svizzera (`worker/src/ops/compliance.json`), problemi
  e risoluzioni (`worker/src/ops/problems.json` + `error_log`), esiti dei caricamenti (`event_log`). Solo codici e conteggi.
  Ogni correzione di un problema aggiorna `problems.json` nella stessa PR; ogni cambio di dati, fornitori o sicurezza
  aggiorna `compliance.json`. I bug sicuri si correggono senza chiedere; a Human solo un riassunto.
- **Ciclo continuo**: ogni mattina *Error log report* (Actions, 06:30) apre una issue `error-log` se ci sono errori; la routine
  programmata di Claude (06:48, «HINT 365 · daily error-log check and fix») la legge, corregge i bug piccoli con PR e documenti,
  unisce dopo *Docs check* e riporta nella issue. Le modifiche grandi o alle condizioni aspettano Human.
