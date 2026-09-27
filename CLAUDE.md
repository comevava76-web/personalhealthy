# HINT · regole per chi lavora su questo repository

- **Documentazione sempre aggiornata.** `docs/architecture/architettura.html` (pagina 1 funzionale, pagina 2 tecnologie)
  va aggiornata a ogni modifica che cambia un flusso, una tecnologia, una regola o una tabella; poi si rigenera il PDF con
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
