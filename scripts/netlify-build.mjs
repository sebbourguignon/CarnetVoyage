import {readFile, writeFile} from "node:fs/promises";

const indexPath = new URL("../app/index.html", import.meta.url);
let html = await readFile(indexPath, "utf8");
const build = {
  sha: process.env.COMMIT_REF || process.env.COMMIT_SHA || "unknown",
  branch: process.env.BRANCH || process.env.HEAD || "unknown",
  buildTime: new Date().toISOString()
};
const diagnostic = `window.__carnetBuild = ${JSON.stringify(build)};`;
const marker = /window\.__carnetBuild\s*=\s*\{[^;]+\};/;
if (!marker.test(html)) throw new Error("Marqueur __carnetBuild introuvable");
html = html.replace(marker, diagnostic);
await writeFile(indexPath, html);
