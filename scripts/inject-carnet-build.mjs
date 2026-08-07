import {execFileSync} from "node:child_process";
import {writeFile} from "node:fs/promises";
const sha=process.env.COMMIT_REF||execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
await Promise.all([
  writeFile(new URL("../netlify/functions/carnet-build.generated.mjs",import.meta.url),`export const CARNET_BUILD_SHA=${JSON.stringify(sha)};\n`),
  writeFile(new URL("../app/build-info.json",import.meta.url),JSON.stringify({buildSha:sha,clientVersion:"carnet-client-v4"})+"\n")
]);
