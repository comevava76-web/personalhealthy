# Materiale per la demo di HINT

Screenshot da usare per l'animazione che mostra come funziona l'app. Sono fatti con **dati di prova**
(nessuna misura reale), sul server in locale, con la versione del 27.09.2026 (app 0.1.60).

| File | Cosa mostra |
|---|---|
| `web-01-dashboard-computer.png` | Web Dashboard sul computer, pagina intera: riquadri, grafici, valori del periodo |
| `web-02-grafico-con-cursore.png` | Il grafico del periodo con il cursore su una misura (giorno, ora, SYS, DIA) |
| `web-03-invia-al-medico.png` | «Invia al medico»: link di sola lettura, WhatsApp, email, copia |
| `web-04-dashboard-telefono.png` | Web Dashboard sul telefono, prima schermata |
| `web-05-dashboard-telefono-intera.png` | Web Dashboard sul telefono, pagina intera |
| `web-06-vista-del-medico.png` | Cosa vede il medico aprendo il link |
| `report-dal-web.pdf` | Il PDF A4 dalla dashboard (stesso modello del PDF dell'app) |

Mancano gli screenshot dell'app Android: vanno fatti sul telefono con dati di prova
(non con misure reali), in quest'ordine per la storia della demo:

1. Accesso con Google e condizioni d'uso
2. Schermata Pressione (ultima misura, settimana)
3. Registra a voce: ascolto e conferma dei valori
4. Scansiona (Upgrade): foto del display e valori letti
5. Report: 7 giorni, grafico, riquadri, PDF ed Excel
6. Report → Web Dashboard (si apre il browser già collegato)
7. Admin: crediti, chiave, identità, «Esci da questo telefono»

Storia suggerita per l'animazione: misuro (voce o foto) → vedo i numeri → apro Web Dashboard → mando il link al medico →
il medico apre il report e scarica il PDF.

Per rifare gli screenshot web: avviare il server in locale (`npx wrangler dev --local` nella cartella `worker`,
con dati di prova nel database locale) e aprire `/my/`.
