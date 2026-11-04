// IndexNow: tells Bing (which ChatGPT search uses), Yandex, Seznam, Naver… which pages are new, changed or gone since
// the previous publish, by comparing sitemap.xml <lastmod>s with the previous commit's. assemble-site.mjs copies this
// file into the site repo as .github/indexnow.mjs; .github/workflows/indexnow.yml runs it after GitHub Pages has
// published (INDEXNOW_HOST and INDEXNOW_KEY come from the workflow; the key is public by design, served at /<key>.txt).
//
//   node .github/indexnow.mjs [--all]     --all: every page in the sitemap
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const { INDEXNOW_HOST: host, INDEXNOW_KEY: key } = process.env;
if (!host || !key) throw new Error("INDEXNOW_HOST and INDEXNOW_KEY must be set");
const parse = (xml) => new Map([...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));
const now = parse(fs.readFileSync("sitemap.xml", "utf8"));
let before = null;
if (!process.argv.includes("--all")) {
  try {
    before = parse(execFileSync("git", ["show", "HEAD~1:sitemap.xml"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    before = null; // first publish (or a shallow checkout): send everything
  }
}
const urls = before
  ? [...[...now].filter(([url, lastmod]) => before.get(url) !== lastmod).map(([url]) => url), ...[...before.keys()].filter((url) => !now.has(url))]
  : [...now.keys()];
if (!urls.length) {
  console.log("IndexNow: no new, changed or removed pages");
  process.exit(0);
}
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: urls.slice(0, 10000) }),
});
console.log(`IndexNow: ${urls.length} URL(s) → HTTP ${res.status}\n  ${urls.join("\n  ")}`);
if (!res.ok) {
  console.log(await res.text());
  process.exit(1);
}
