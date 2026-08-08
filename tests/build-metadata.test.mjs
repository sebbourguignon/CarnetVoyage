import test from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync=promisify(execFile);
const fichiers=["app/index.html","app/build-info.json","netlify/functions/carnet-pdf/build.generated.mjs"];

test("le build synchronise frontend, build-info et fonctions",async()=>{
  const originaux=await Promise.all(fichiers.map(f=>readFile(f,"utf8")));
  const sha="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  try{
    await execFileAsync(process.execPath,["scripts/netlify-build.mjs"],{
      env:{...process.env,COMMIT_REF:sha,BRANCH:"test",CONTEXT:"branch-deploy",CARNET_BUILD_WRITE:"1"}
    });
    const index=await readFile(fichiers[0],"utf8"),info=JSON.parse(await readFile(fichiers[1],"utf8")),module=await readFile(fichiers[2],"utf8");
    const frontend=JSON.parse(index.match(/window\.__carnetBuild\s*=\s*(\{[^;]+\});/)[1]);
    assert.equal(frontend.sha,sha);
    assert.equal(info.sha,sha);
    assert.equal(info.buildSha,sha);
    assert.match(module,new RegExp(`CARNET_BUILD_SHA=${JSON.stringify(sha)}`));
  }finally{
    await Promise.all(fichiers.map((f,i)=>writeFile(f,originaux[i])));
  }
});
