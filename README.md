# PersonalHealthy

## Developer entry point

Before work, read **[Checkpoint/HANDOVER.md](Checkpoint/HANDOVER.md)** for the current project state and **[AGENTS.md](AGENTS.md)** for the shared handoff protocol. Every developer updates and commits the same handover before closing a session. The overview below contains historical setup information; use the handover for current implementation and release status.

A personal health archive. First module: **HealthyInstantTracker**, the Android app for a blood-pressure diary.

HealthyInstantTracker lets you photograph your blood-pressure monitor, reads the values automatically and prepares the report for your doctor.

## How it is built

- **Android app** (`android` folder): phone camera, reading, chart, PDF and Excel report.
- **Server** (`worker` folder): receives the photo, has the AI read the numbers, stores the measurements. Runs for free on Cloudflare.
- **PersonalHealthy database**: a free Cloudflare D1 database called `personalhealthy`, with data bound to the European Union.
  GitHub creates it on the first build, together with its tables (`worker/schema.sql`).
  All data access goes through a single point in the server: if PostgreSQL or Azure is needed one day, the move will be small.
  Every time column (milliseconds, used for sorting and calculations) has a readable companion ending in `_local`
  with the Swiss time, for example `09262026 14:32` (month, day, year, then 24-hour time).
- **GitHub** builds everything by itself: on every update it deploys the server and prepares the APK.

Rules enforced by the server:
- the blood-pressure values come from reading the photo, and the phone cannot change them; or they are said aloud
  (microphone next to Measure), and then they are marked "voice" in the list, the PDF and the Excel file;
- date and time are those of the shot, checked by the server;
- no names; with Sign in with Google, only the Google email (to find the account again); each phone signs its requests
  with a key protected inside the phone itself;
- only people who know the family code, or who received a single-use invite, can activate the app;
- nobody sees anyone else's readings: each reading belongs to the anonymous code of one phone.

## One-time setup

### 1. GitHub
1. Create a **private** repository called `personalhealthy`.
2. Upload the whole content of this folder, **including the `.github` folder** (on a Mac it is hidden: press Cmd+Shift+. to see it).

### 2. Cloudflare
1. In the Cloudflare dashboard, open **Workers & Pages** at least once so the `workers.dev` address is activated.
2. Go to Profile → **API Tokens** → Create Token → template **"Edit Cloudflare Workers"**.
   Also add the permission **Account → D1 → Edit**. Create the token and copy it.

### 3. Key for the AI reading
1. Go to console.anthropic.com and load a small credit (a few dollars are enough for months of family use).
2. API Keys → Create Key → copy it.

### 4. Secrets on GitHub
In the repository: Settings → Secrets and variables → Actions → **New repository secret**. Create three of them (the Cloudflare Account ID is already in the project):

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from step 2 |
| `AI_API_KEY` | the owner's AI key for the photo Scan (today an Anthropic key; the older name `ANTHROPIC_API_KEY` still works) |
| `FAMILY_CODE` | a code you make up (at least 6 characters), to give only to family members |

A fourth secret, `KEY_ENCRYPTION_KEY`, is created by the build by itself the first time, directly on the server
(it never appears in GitHub, in the logs or in the app). It locks the friends' Anthropic keys (see below).
It is never replaced: a new one would make the stored friend keys unreadable, and each friend would have to paste theirs again.

### 5. Build
In the repository open **Actions** → "Build PersonalHealthy" → **Run workflow**. It is ready after 5-8 minutes.

### 6. Install on the phone
Anyone can download the latest app from the server: `https://personalhealthy-api.comevava76.workers.dev/download`
(the build publishes it there, since the repository is private). The Admin tab has "Share the app", which sends this
link.
1. Open the link on the phone and download `HINT.apk`.
2. Open it: Android will ask you to allow installs from this source. Allow it.
3. Open HINT and tap "Sign in with Google" (or enter an invite, if someone pays your photos).

Later versions install over the previous one without losing anything.

## User guide
`docs/guide-it.html` and `docs/guide-en.html` are the sources of the user guide; `docs/HINT-Guida-IT.pdf` and
`docs/HINT-Guide-EN.pdf` are made from them with `node docs/render-guides.cjs`. Every document is listed in `docs/README.md`, with who updates it and when. The build serves the PDFs next to the app:
`<server>/HINT-Guida-IT.pdf` and `<server>/HINT-Guide-EN.pdf`, linked from the home page.

## The app
The bar at the bottom has three tabs:
- **Blood pressure** (start screen): the HINT title with the moving ECG trace, the button to measure, the last reading,
  a table of the last 7 days (today included: one value per day, the average of that day's readings, and the pulse),
  and a 7-day summary (highest and average SYS, DIA and PUL). Values are always named SYS, DIA and PUL.
  "Manage readings", in the Account section of the Admin tab, lists every reading to delete one; at its bottom,
  "Delete all readings" (asked twice) deletes every reading and photo reading of this phone, leaving the credit as it is.
  The Report tab, the PDF and the Excel file keep morning and evening apart.
- **Report**: 7, 15 or 30 days, with the chart, averages and the PDF and Excel files for the doctor.
- **Admin**, in four groups: Credits (money left on Anthropic, photos you can still take, recharge), Token (the Anthropic
  key that pays the readings), Readings database (manage or delete readings), Identity (Google account, invites, share
  the app, delete the account).

The chart is the same in the app and in the PDF: one point per day (the day's average) for systolic, diastolic and pulse,
on a plain background. The app never judges the values: no "normal" or "high" labels, no reference lines, no coloured zones.
That is for the doctor.

Values said aloud: the microphone next to Measure listens inside the app (bars that follow the voice, the words shown
as they are said, it stops by itself), using the phone's speech recognition (no AI cost).
Say systolic, diastolic and pulse in this order, for example "127, 80, 70". All three are needed.
The app refuses a missing number, more than three, a diastolic equal to or higher than the systolic, or values a monitor
cannot show, and warns in amber about unusual ones. Like a photo reading, the values are shown full screen and are
saved only after the person taps Save. Date and time are those of the moment they were said (the server accepts
them only within 15 minutes).

Sign in with Google (Web client ID in the build workflow, or the repository variable `GOOGLE_WEB_CLIENT_ID`): Google is used only to create the
account and to find it again on a new phone; every day the app opens with fingerprint or face. Anyone can set up the
app alone, and everyone, the app manager included, pays their own photo readings with their own Anthropic key, set up
inside the app (Admin tab, Token; the key can be pasted from the clipboard with one tap). The app manager only runs the
storage (Cloudflare, free). Voice entry needs no key. Signing in on a new phone moves the account there and disconnects the old phone.
Accounts made before Google can be linked from the Admin tab. Each person can delete their account and all their data
from the Admin tab (the app manager cannot). Stored: the Google email and a stable Google id, plus when the privacy note
was accepted. Without the variable, the app keeps working with invite codes as before.

App lock: the app opens with the phone's fingerprint, face or screen lock (no separate PIN),
and locks again after 2 minutes away. Phones without any screen lock open without it.
New people join with an invite (QR code or typed code). The family code still works in the same field,
as a way back in for the app manager after a reinstall, but the app no longer asks for it.

Reminders: every day at 9:00 and 17:00 (the phone's time) the app sends a notification
"Remember to measure your blood pressure", in the phone's language, with a badge on the app icon.
At midnight both are removed, so the badge never shows more than 2. They keep working after a restart of the phone.
The app sends no notifications about the credit: the Admin tab and a short line on the home show it.

The code is ready for more tabs (for example a future "Analyses" tab for blood tests): see `Tab` in `MainActivity.kt`.

## Reading credit
Each photo is read by an AI service (Anthropic) that you prepay on console.anthropic.com. The app cannot see that balance,
so the server keeps an estimate: the amount you added minus the real cost of every photo.
The estimate never blocks anything: photos are always sent, and only Anthropic stops them when its credit is really finished.
In that case the app says "Your Anthropic credit is finished. Tap Recharge."
- The **first phone activated** becomes the one of the person who manages the app: activate yours first.
- In the **Credit** tab, **Recharge** opens the Anthropic billing page. When you come back to the app it asks how much you added.
- If the estimate does not match Anthropic, tap "The balance is wrong?" and type the amount shown on Anthropic.
- When about one photo is left, a warning appears on the Blood pressure tab (no notification).

## Inviting people
In the **Credit** tab the app manager taps **Invite someone** and chooses:
- **Family member (I pay)**: their photos use your key and your credit, like everyone who uses the family code;
- **Friend (pays own photos)**: their photos use their own Anthropic key and their own prepaid credit.

The app creates a code such as `K7QM-3XRA-9TPE`, shown as text and as a QR code, with a **Share** button.
It works once and for 7 days. On the new phone the person types the code or taps **Scan QR code**.
The family code keeps working as before, as "family member (I pay)".

A friend is guided right after activation: what it costs (about half a cent per photo, from their own credit),
**Open Anthropic** to load credit, **Create my key**, then paste the key and type the amount shown on Anthropic.
The server tests the key with a tiny request and stores it encrypted (AES-GCM) for that person only.
The key is never sent back to the phone. The friend can replace or delete it in their Admin tab.

Credit is kept in separate pools:
- the app manager's pool covers everyone who is paid for (family code and "family member" invites);
- each friend has their own pool: their starting amount, plus their top-ups, minus the cost of their own photos.

Each Admin tab shows only its own pool: friends do not see the manager's balance, and the manager does not see
friends' balances or keys. If a friend's key is refused or their credit is finished, the app tells them and offers
**Recharge** and **Replace key**; the manager's key is never used in their place.

## AI features subscription (Google Play, 4 US$ a year)
The app is free. The subscription unlocks only the AI features (today the photo Scan), bought and renewed through
Google Play (people pay with Google Pay or any method Google Play offers, and cancel in Google Play at any time). Every
person gets a 15-day trial from the first Scan (3 Scans a day), counted once per Google account and per phone; a
notification arrives 2 days before it ends. After that the Scan button is grey until the person subscribes (or adds
their own AI key). A subscriber may use up to 3 US$ of AI a year (3 Scans a day). The owner never pays. Voice, lab
results and the Web Dashboard never depend on the subscription.

To make it work, once:
1. Play Console (one-off 25 US$ developer fee): create the app `ch.personalhealthy.app` and upload the `.aab`
   attached to each release (`HINT365-0.1.N.aab`), at least to the internal-testing track.
2. Monetize → Subscriptions: create `hint365_annual` with one base plan, yearly, auto-renewing, 4 US$ (no Play free trial: the 15-day trial is HINT 365's own).
3. Google Cloud: enable the *Google Play Android Developer API*, create a service account and a JSON key for it.
4. Play Console → Users and permissions: invite the service account's email with *View financial data* and
   *Manage orders and subscriptions*.
5. GitHub → Settings → Secrets → Actions: `PLAY_SERVICE_ACCOUNT` = the whole JSON key. Run the build again.
6. Nothing to switch on: the Scan's lock screen offers the subscription as soon as the app is installed from Google Play.

The server checks every purchase with Google Play (`worker/src/billing.ts`) and keeps only the purchase token,
its state and its end date (`persons.sub_*`). A purchase works only for the account that made it.

## Languages
The app uses the phone's language: English, Italian, German or French (in any other language it appears in English).
PDF and Excel reports, notifications and error messages also follow the phone's language.
The texts are in `android/app/src/main/res/values*/strings.xml`: to add a language, just add a new `values-xx` folder.

## About the personalhealthy.keystore file
It signs the app always with the same key, so updates install over the previous version. This is why the repository must stay **private**.
