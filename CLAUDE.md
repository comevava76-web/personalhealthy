# HINT · regole per chi lavora su questo repository

- **Documentazione sempre aggiornata, e sempre solo in inglese.** `docs/architecture/architecture.html` (pagina 1 funzionale, pagina 2 tecnologie)
  (pagina 3: flusso a runtime e CI/CD) va aggiornata a ogni modifica che cambia un flusso, una tecnologia, una regola o una tabella; poi si rigenera il PDF con
  `node docs/architecture/render.cjs` e si committano HTML, PDF e anteprime insieme alla modifica.
- **Materiale demo** in `docs/demo/`: se cambia l'aspetto della dashboard o del PDF, rifare gli screenshot (solo dati di prova,
  mai misure reali).
- **Mai diagnosi**, mai giudizi sui valori; etichette sempre SYS, DIA, PUL; pressione e battiti mai nello stesso grafico;
  grafici di 7 giorni con un punto per giorno (la media del giorno, spiegata prima dei grafici) e il valore accanto, sotto solo i numeri dei giorni, senza scorrimento orizzontale; stesso PDF A4 dall'app e dal web.
- **Niente rosso**, in nessun grafico, pulsante o logo: SYS viola, DIA verde acqua, PUL ambra; nessun colore deve sembrare
  un giudizio (né problema né «bene»).
- **Conservazione**: misure al massimo 365 giorni (cancellazione automatica ogni notte); le accettazioni delle condizioni restano
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
- **Politica dei costi** (tabella in app, condizioni e home): l'app 5 $/anno al proprietario via Google Play; le funzionalità AI
  sono facoltative, a consumo, pagate dall'utente ad Anthropic con il proprio credito (mai al proprietario). Mai chiamarle
  «Standard/Premium»: si dice «funzionalità AI attive / non attive», «Attiva AI».
- **App semplice, controlli del proprietario solo sul web**: nell'app nessun pulsante che oggi non si usa. L'owner ha
  nella Web Dashboard la scheda **Admin** (utenti per codice anonimo, numeri d'uso, spazio D1, blocco versioni):
  mai valori delle misure, report o nomi. L'abbonamento resta pronto ma spento finché l'app non esce sul Play Store.
- **Dove gira**: tutto su Cloudflare, un solo Worker (API `/v1`, Web Dashboard `/my`, link `/s`) con D1 in UE; niente Vercel.
  App e browser non toccano mai D1: passa tutto dal Worker.
- **Ruoli**: Angelo è l'architetto (decide design e priorità in chat, prova ogni APK); Claude sviluppa, testa, unisce, controlla
  il deploy e manda l'APK in chat.
