# HINT 365 · GDPR compliance (EU) and Swiss FADP

Status: 28.09.2026 · prepared by the developer (Claude) for the architect (Human) · **not legal advice**:
the points marked *legal review* should be confirmed by a data-protection lawyer before the Play Store launch.

## 1. Does the GDPR apply to us? Yes.

- **Pseudonymous is not anonymous.** HINT 365 keeps readings under an anonymous account code and an HMAC
  fingerprint of the Google account, never a name or an email. That is *pseudonymisation* (GDPR Art. 4(5)):
  the person can still be singled out (same Google account → same diary, a phone key, IP fingerprints).
  Recital 26: pseudonymised data *is* personal data. Only truly anonymous data (no way back to a person) is outside the GDPR.
- **It is health data.** Blood pressure and pulse are "data concerning health" (Art. 4(15)), a special category
  (Art. 9): processing is forbidden unless an exception applies. Ours is **explicit consent** (Art. 9(2)(a)).
- **Territorial scope.** The data is stored in the EU (Cloudflare D1, EU jurisdiction) and the app is offered to
  people in the EU (Italian, German, French) → Art. 3(1)/(2). The household exemption (Art. 2(2)(c)) does not
  apply once the app is offered to people outside the family, and certainly not on the Play Store.
- **Switzerland.** The owner and the service are run from Switzerland: the revised Swiss FADP (nDSG, in force since
  1.9.2023) applies as well. It is close to the GDPR; health data is "sensitive personal data" there too.

## 2. Roles

| Party | Role | Basis |
|---|---|---|
| Owner of HINT 365 (Human) | **Controller** (Art. 4(7)) | decides purposes and means |
| Cloudflare (Worker, D1, logs) | **Processor** (Art. 28) | Cloudflare's Data Processing Addendum is part of its self-serve terms: to check it is accepted on the account |
| ~~Anthropic (reading the photo)~~ | Removed in terms v19 (01.10.2026): no AI provider; keys, costs and AI readings deleted from D1 by the nightly purge | none |
| Google (Sign in with Google, Play Billing, speech recognition on the phone) | Independent controller for its own services | Google's terms and privacy policy |

## 3. What is already in place

| GDPR requirement | Where it is met |
|---|---|
| Data minimisation (Art. 5(1)(c)) | no name, no email (HMAC fingerprint only), photos discarded, error log without reading values and without digits, IP only as SHA-256 for limits |
| Storage limitation (Art. 5(1)(e)) | readings max 365 days (nightly purge), errors 90 days, sessions and doctor links 7 days, limit counters ≤ 2 days |
| Security (Art. 32) | signed requests with a phone key, replay protection, rate limits, CSP and security headers, no stored third-party keys, fingerprints for codes/cookies/links, daily security tests (`security-tests.yml`) |
| Privacy by design (Art. 25) | the owner's Admin tab shows counts only, never values or names; only the Worker touches D1 |
| Consent and proof (Art. 7) | consent at first sign-in (`consent_at`), terms accepted and recorded in `acceptances` (append-only) |
| Right to erasure (Art. 17) | delete one reading, all readings, or the account, at once, from the app |
| Cookies (ePrivacy) | one technical cookie, set only after consent, declared in terms and privacy |
| Data in the EU | D1 bound to the EU jurisdiction |

## 4. Gaps to close before the Play Store (ordered)

| # | Gap | Article | What to do | Who |
|---|---|---|---|---|
| G1 | The privacy policy does not name the controller (name and postal address) | 13(1)(a) | Add the owner's name or business name, address and a privacy contact email | **Human** gives the data |
| G2 | Consent text did not say "health data" and "explicit consent" in words | 9(2)(a), 7 | **Done 28.09.2026**: sign-in note (IT/EN/DE/FR), terms v15 and privacy page | — |
| G3 | Transfers outside the EU were not described (Anthropic, Google are US companies) | 13(1)(f), 44–49 | **Done**: named in terms v15 and privacy, with the providers' safeguards. *Legal review* of the wording | — |
| G4 | Workers can run at the Cloudflare edge outside the EU (the database stays in the EU) | 44 | **Stated** in terms v15 and privacy; restricting it needs Cloudflare's regional services (paid). *Legal review* | Human decides |
| G5 | No full export in a machine-readable format (only the 7-day PDF/Excel) | 15, 20 | "Download all my data" (CSV/JSON of every reading, up to 365 days) in the Web Dashboard, or answer requests by email within one month | Claude builds, Human approves |
| G6 | Right to object/restrict and the one-month answer time were not stated | 12(3), 18, 21 | **Done**: terms v15 and privacy | — |
| G7 | EU representative: the controller is in Switzerland and offers the app to people in the EU; the exemption does not cover regular processing of health data | 27 | Appoint a representative in an EU country (there are services for this, from about 100–300 €/year) | **Human** |
| G8 | Record of processing activities | 30 | Draft below (section 5); keep it in `docs/compliance/` | Claude (done as draft) |
| G9 | Data protection impact assessment: likely needed (health data, new technology, AI) | 35 | Short DPIA from the threat model in `docs/testing/test-report-2026-09-28.md` | Claude drafts, Human signs |
| G10 | Personal-data breach procedure (72 hours to the authority, then the users if high risk) | 33, 34 | One-page procedure: who notices (error log, security tests), who decides, who notifies (FDPIC / Italian Garante), template text | Claude drafts |
| G11 | Processor agreements checked and filed | 28 | Confirm Cloudflare DPA accepted on the account; (Anthropic no longer used since terms v19) | Human (account owner) |
| G12 | The acceptance record kept after deletion lacked its legal basis | 17(3)(e), 6(1)(f) | **Done**: legitimate interest, terms v15 and privacy | — |

G2, G3, G4, G6 and G12 were approved by Human ("GDPR e cookie devono stare nel disclaimer") and are in the terms
**version 15** (new section "Data protection (GDPR and Swiss FADP)", app and `/terms`; cookies were already there):
every user accepts again at the next opening. Still open: G1, G5, G7, G9, G10, G11.

## 5. Record of processing activities (Art. 30, draft)

| Processing | Purpose | Data subjects | Data | Recipients | Retention | Legal basis |
|---|---|---|---|---|---|---|
| Blood-pressure diary | keep, chart and share one's own readings | app users (18+) | SYS, DIA, PUL, date/time, moment, source | Cloudflare (processor) | 365 days | explicit consent, Art. 9(2)(a) |
| Lab results | keep one's own lab history, one table across laboratories | app users (18+) | report date; test code or name as printed, value, unit and reference as printed; HMAC fingerprint of the file. **Not**: the document, its text, name, surname, date of birth or any other identifier (the document stays at rest only on the phone; in transit only these fields over HTTPS/TLS, requests signed by the phone key) | Cloudflare (processor) | until the user deletes them (a date, all, a report, the account): the purpose is the complete history, the user controls it (Art. 5(1)(e)); never deleted automatically | explicit consent, Art. 9(2)(a) |
| ~~Reading a photo of the display with Anthropic~~ | removed in terms v19 (01.10.2026) | — | — | — | — |
| Reading a photo of the display on the phone (Scan, terms v20) | record a reading without typing or speaking | app users (18+) | the photo is processed **only on the phone** (own digit reader, bundled ML Kit) and deleted; only the three confirmed numbers are sent, as a voice reading. Retake reasons counted as codes in `event_log` | Cloudflare (processor), for the three numbers | as the readings (365 days); the photo is not kept | explicit consent, Art. 9(2)(a) |
| Account and sign-in | find the diary again, secure access | users | HMAC of Google id, phone public key, consent time | Google (sign-in) | while the account exists | contract, Art. 6(1)(b) |
| Doctor links and web sessions | show the report to the doctor chosen by the user | users, doctors | token fingerprint, period | the doctor | 7 days | consent / contract |
| Terms acceptance record | proof | users | code, phone model, versions, text fingerprint, date | — | kept after deletion | Art. 6(1)(f) / legal claims |
| Error log | fix problems | users | code, place, version, anonymous code | — | 90 days | legitimate interest, Art. 6(1)(f) |
| Abuse limits | protect the service | anyone calling the API | SHA-256 of IP, counters | — | ≤ 2 days | legitimate interest |
| Subscription | know whether the year is paid | paying users | Play token, state, end date | Google Play | while the account exists | contract |

## 6. Beyond the GDPR (to keep in mind)

- **Medical devices (EU MDR / Swiss MedDO):** software that only records, stores and displays values without
  interpreting them is generally not a medical device (MDCG 2019-11). This is why the rules forbid diagnosis,
  judgement and "good/bad" colours: keep it that way. *Legal review* before adding any interpretation.
- **Lab table, out-of-range marks (01.10.2026, asked by Human):** a lab result outside the reference interval printed on
  the same report is shown in orange with ↑/↓. It repeats a comparison the report itself already makes (no threshold of
  ours, no diagnosis, no advice, and the terms say so). Keep it a plain comparison with the printed reference; *legal
  review* before the Play Store launch.
- **Pseudonymized, not anonymous:** lab results carry no name, but they are linked to the account (and through the
  Google HMAC to a person): they remain personal health data. Documents and texts must say "pseudonymized", never "anonymous".
- **Google Play:** the Data safety form and the Health apps declaration must match this document.
