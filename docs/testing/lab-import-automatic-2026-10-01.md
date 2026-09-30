# Automatic lab report import — 2026-10-01

Decisions by Human (chat, 30.09–01.10.2026): local reading only (PDF and photos, no other files); every test saved, also
outside the catalog, with its printed name; no duplicates (file fingerprint; the same test on the same date is unique);
older reports saved with their printed date; lab results never deleted automatically, only by the user; web table with one row per test and one
column per report date, a dash when missing, no charts, orange ↑/↓ outside the printed reference; delete a whole date;
the import runs in the background with visible stages.

## Reports from different laboratories

- One row per test: catalog tests by their code (synonyms included: urea = azotemia, ALT = GPT, glucose = glicemia…);
  other tests by the printed name without case, accents or punctuation. Urea and uric acid are different tests: two rows.
- The unit is shown with each value, not in the first column: the same test may be measured in different units by
  different laboratories. Values are never converted; each is compared only with the reference on its own report.
- A few qualifiers after a catalog name are accepted ("a digiuno", "calcolato", "sierico"…); any other added words
  (for example "Glucosio nelle urine") keep the line unreadable, so it can never land on the blood row.

## What changed

- App: `LabsParser.kt` (plain Kotlin) reads the whole text: catalog rows keep their strict grammar; other rows need a
  name, a result and a known unit or a printed interval. Any line that looks like a result and is not understood,
  a missing or ambiguous date, a future date or the same test twice stops the report: nothing is saved.
- App: `LabImport` runs outside the screen; stages Processing → Scanning → Uploading → saved/failed, each shown at least
  0.9 s, completion only after the server's answer. No preview, no editing, no date picker.
- Server: `validateLabImport` accepts `auto` imports with `fileHash`, custom names (bounded characters, ≤ 8 words),
  dates from 2000; `saveLab` skips identical same-day rows, rejects a different same-day value (409), stores the report
  and the HMAC file fingerprint (`lab_files`) in one batch. The nightly purge never deletes lab results; the web deletes a date or all of them.
- Web: `/my/api/labs` DELETE (a whole date, fingerprints included); matrix table and A4 PDF with the same layout.
- Terms version 17 (4 languages) and privacy: where the data are (document at rest only on the phone; in transit over
  HTTPS only date and values as printed plus the file fingerprint, no name or reference to the person; on the server
  only those), automatic saving, kept until the user deletes them (GDPR Art. 5(1)(e): purpose is the complete history),
  orange arrows as a numeric comparison only.

## Verification (synthetic data only)

- 15 Kotlin parser tests (plain JVM, same sources as `android/app/src/test`), including a mixed report with tests outside
  the catalog, personal details that must never become tests, unreadable rows, date rules and range comparison.
- `labs-security.mjs`: old dates, custom names, fingerprint duplicates, same-day duplicates and conflicts, day deletion,
  re-import after deletion. `functional.mjs`: all checks green, plus PU6 (the nightly job never deletes lab results).
- `labs-ui.mjs`: 8 browser views (4 languages × phone/desktop), union of tests, dash cells, arrows, no charts, PDF,
  column deletion.

## Limits

- Real laboratory layouts vary: a report with lines the parser does not understand is refused (safe, but the user must
  use the laboratory PDF or a better photo). Phone-photo OCR has not been measured on real reports.
- Multi-line references (for example lipid "desirable/high" tables) are skipped only when they carry no unit; otherwise
  the report is refused.
- The Android build and the on-phone flow are verified by CI and by Human with the APK.
