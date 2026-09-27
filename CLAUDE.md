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
- **Mai segreti nel repository**: chiavi e token solo nei secrets di GitHub o sul server.
