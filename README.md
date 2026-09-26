# PersonalHealthy

Archivio personale della salute. Primo modulo: **Battito**, l'app Android per il diario della pressione.

Battito serve a fotografare il misuratore di pressione, leggere i valori in automatico e preparare il report per il medico.

## Come è fatto

- **app Android** (cartella `android`): fotocamera del telefono, lettura, grafico, report PDF ed Excel.
- **server** (cartella `worker`): riceve la foto, fa leggere i numeri all'AI, salva le misure. Gira gratis su Cloudflare.
- **database PersonalHealthy**: Cloudflare D1 chiamato `personalhealthy`, gratuito, con i dati vincolati all'Unione Europea.
  Lo crea GitHub alla prima costruzione, insieme alle tabelle (`worker/schema.sql`).
  Tutto l'accesso ai dati passa da un solo punto del server: il giorno in cui servirà PostgreSQL o Azure, il passaggio sarà piccolo.
- **GitHub** costruisce tutto da solo: a ogni aggiornamento pubblica il server e prepara l'APK.

Regole garantite dal server:
- i valori li decide solo la lettura della foto, il telefono non può cambiarli;
- data e ora sono quelle dello scatto, controllate dal server;
- nessun nome né email: ogni telefono ha una chiave anonima protetta al suo interno;
- solo chi conosce il codice di famiglia può attivare l'app.

## Da fare una volta sola

### 1. GitHub
1. Crea un repository **privato** chiamato `battito`.
2. Carica tutto il contenuto di questa cartella, **compresa la cartella `.github`** (su Mac è nascosta: premi Cmd+Shift+. per vederla).

### 2. Cloudflare
1. Nel pannello di Cloudflare apri **Workers e Pages** almeno una volta, così si attiva l'indirizzo `workers.dev`.
2. Vai su Profilo → **API Tokens** → Create Token → modello **"Edit Cloudflare Workers"**.
   Aggiungi anche il permesso **Account → D1 → Edit**. Crea il token e copialo.

### 3. Chiave per la lettura AI
1. Vai su console.anthropic.com, carica un piccolo credito (bastano pochi dollari per mesi di uso familiare).
2. API Keys → Create Key → copiala.

### 4. Segreti su GitHub
Nel repository: Settings → Secrets and variables → Actions → **New repository secret**. Creane tre (l'Account ID di Cloudflare è già nel progetto):

| Nome | Valore |
|---|---|
| `CLOUDFLARE_API_TOKEN` | il token del punto 2 |
| `ANTHROPIC_API_KEY` | la chiave del punto 3 |
| `FAMILY_CODE` | un codice inventato da te (almeno 6 caratteri), da dare solo ai familiari |

### 5. Costruzione
Nel repository apri **Actions** → "Costruisci PersonalHealthy" → **Run workflow**. Dopo 5-8 minuti è pronto.

### 6. Installazione sul telefono
1. Dal telefono apri il repository → **Releases** → scarica `PersonalHealthy-0.1.x.apk`.
2. Aprilo: Android chiederà di consentire l'installazione da questa fonte. Consenti.
3. Apri Battito e inserisci il codice di famiglia.

Le versioni successive si installano sopra la precedente, senza perdere nulla.

## Credito per le letture
- Il **primo telefono attivato** diventa quello di chi gestisce l'app: attivalo tu per primo.
- In home, sotto "Credito letture", tocca **Gestisci** e scrivi quanto hai caricato (per esempio 5) con **Aggiungi ricarica**.
- A ogni foto il server sottrae il costo reale della lettura e l'app mostra saldo e foto rimanenti.
- Quando il credito basta per una sola foto arriva una notifica. A credito finito le foto non vengono più lette finché non ricarichi.
- Il saldo è una stima tenuta dal server: se non coincide con la console, usa **Imposta come saldo attuale**.

## Lingue
L'app usa la lingua del telefono: inglese, italiano, tedesco o francese (in tutte le altre lingue appare in inglese).
Anche report PDF ed Excel, notifiche e messaggi di errore seguono la lingua del telefono.
I testi sono in `android/app/src/main/res/values*/strings.xml`: per aggiungere una lingua basta una nuova cartella `values-xx`.

## Nota sul file personalhealthy.keystore
Serve a firmare l'app sempre con la stessa chiave, così gli aggiornamenti si installano sopra. Per questo il repository deve restare **privato**.
