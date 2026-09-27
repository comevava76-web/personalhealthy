// Writes the public pages (terms of use, privacy policy, home) into docs/legal/, from the same code the site serves,
// so the documents in the repository can never differ from what people read and accept.
//   cd worker && node scripts/export-docs.mjs
// The "Docs check" workflow runs it on every pull request and fails if docs/legal is not up to date.
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../docs/legal");
const bundle = await build({ entryPoints: [resolve(here, "../src/pages.ts")], bundle: true, format: "esm", write: false, platform: "neutral" });
const pages = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));

mkdirSync(out, { recursive: true });
const docs = {
  "terms.html": pages.termsPage(),
  "privacy.html": pages.privacyPage(""),   // the contact email is a repository variable: left out of the copy
  "home.html": pages.homePage(),
};
for (const [name, res] of Object.entries(docs)) {
  writeFileSync(resolve(out, name), await res.text());
  console.log("docs/legal/" + name);
}
