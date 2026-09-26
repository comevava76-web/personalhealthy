# PersonalHealthy

A personal health archive. First module: **HealthyInstantTracker**, the Android app for a blood-pressure diary.

HealthyInstantTracker lets you photograph your blood-pressure monitor, reads the values automatically and prepares the report for your doctor.

## How it is built

- **Android app** (`android` folder): phone camera, reading, chart, PDF and Excel report.
- **Server** (`worker` folder): receives the photo, has the AI read the numbers, stores the measurements. Runs for free on Cloudflare.
- **PersonalHealthy database**: a free Cloudflare D1 database called `personalhealthy`, with data bound to the European Union.
  GitHub creates it on the first build, together with its tables (`worker/schema.sql`).
  All data access goes through a single point in the server: if PostgreSQL or Azure is needed one day, the move will be small.
- **GitHub** builds everything by itself: on every update it deploys the server and prepares the APK.

Rules enforced by the server:
- the blood-pressure values come only from reading the photo; the phone cannot change them;
- date and time are those of the shot, checked by the server;
- no names and no emails: each phone has an anonymous key protected inside the phone itself;
- only people who know the family code can activate the app.

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
| `ANTHROPIC_API_KEY` | the key from step 3 |
| `FAMILY_CODE` | a code you make up (at least 6 characters), to give only to family members |

### 5. Build
In the repository open **Actions** → "Build PersonalHealthy" → **Run workflow**. It is ready after 5-8 minutes.

### 6. Install on the phone
1. On the phone, open the repository → **Releases** → download `HealthyInstantTracker-0.1.x.apk`.
2. Open it: Android will ask you to allow installs from this source. Allow it.
3. Open HealthyInstantTracker and enter the family code.

Later versions install over the previous one without losing anything.

## Reading credit
- The **first phone activated** becomes the one of the person who manages the app: activate yours first.
- On the home screen, under "Reading credit", tap **Manage**, enter how much you loaded (for example 5) and tap **Add top-up**.
- For every photo the server subtracts the real cost of the reading, and the app shows the balance and the photos left.
- When the credit is enough for only one more photo, a notification arrives. When the credit is used up, photos are no longer read until you top up.
- The balance is an estimate kept by the server: if it does not match the console, use **Set as current balance**.

## Languages
The app uses the phone's language: English, Italian, German or French (in any other language it appears in English).
PDF and Excel reports, notifications and error messages also follow the phone's language.
The texts are in `android/app/src/main/res/values*/strings.xml`: to add a language, just add a new `values-xx` folder.

## About the personalhealthy.keystore file
It signs the app always with the same key, so updates install over the previous version. This is why the repository must stay **private**.
