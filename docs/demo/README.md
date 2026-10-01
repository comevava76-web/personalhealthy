# Materiale per la demo di HINT

Screenshot da usare per l'animazione che mostra come funziona l'app. Sono fatti con **dati di prova**
(nessuna misura reale), sul server in locale, con la versione del 28.09.2026 (app 0.1.89): tabelle con AM/PM.

| File | Cosa mostra |
|---|---|
| `web-01-dashboard-computer.png` | Web Dashboard sul computer, pagina intera: riquadri, grafici, valori del periodo |
| `web-02-grafico-con-cursore.png` | Il grafico del periodo con il cursore su una misura (giorno, ora, SYS, DIA) |
| `web-03-invia-al-medico.png` | «Invia al medico»: solo Email o WhatsApp, PDF + link di sola lettura per 7 giorni |
| `web-04-dashboard-telefono.png` | Web Dashboard sul telefono, prima schermata |
| `web-05-dashboard-telefono-intera.png` | Web Dashboard sul telefono, pagina intera |
| `web-06-vista-del-medico.png` | Cosa vede il medico aprendo il link |
| `web-07-tema-chiaro.png` | Web Dashboard nel tema chiaro (computer), stessi colori dell'app |
| `labs-it-mobile-light.png` | Tabella dei referti nel tema chiaro, sul telefono |
| `report-dal-web.pdf` | Il PDF A4 dalla dashboard (stesso modello del PDF dell'app) |
| `lab-results.pdf` | Il PDF dei referti dalla dashboard (dati di prova) |

Mancano gli screenshot dell'app Android: vanno fatti sul telefono con dati di prova
(non con misure reali), in quest'ordine per la storia della demo:

1. Accesso con Google e condizioni d'uso
2. Schermata Pressione (ultima misura, settimana)
3. Registra a voce: ascolto e conferma dei valori
4. Scan (funzionalità AI attive): foto del display e valori letti
5. Pressione, in fondo: Invia PDF, Invia Excel, Web Dashboard
6. Icona Dashboard nella barra in basso → Web Dashboard sulla scheda Pressione (si apre il browser già collegato)
6b. Referti: Importa referto, barra di avanzamento, storico dei caricamenti per giorno
7. Admin: crediti, chiave, identità, «Esci da questo telefono»

Storia suggerita per l'animazione: misuro (voce o foto) → vedo i numeri → apro Web Dashboard → mando il link al medico →
il medico apre il report e scarica il PDF.

Per rifare gli screenshot web (automatico, solo dati di prova):

```bash
bash docs/testing/harness/setup-local.sh /tmp/qa
cd docs/testing/harness && NODE_PATH=<node_modules globali> HINT_WORKER_DIR=/tmp/qa/w node demo-shots.mjs
```
