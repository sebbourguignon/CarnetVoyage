import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("les scripts intégrés de index.html restent syntaxiquement valides",async()=>{
  const html=await readFile(new URL("../../app/index.html",import.meta.url),"utf8");
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(m=>m[1]).filter(Boolean);
  assert.ok(scripts.length>0);
  scripts.forEach(source=>{ new Function(source); });
});
