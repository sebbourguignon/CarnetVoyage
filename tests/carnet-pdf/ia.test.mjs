import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("l’IA ne lit que la préparation confirmée et ne sauvegarde rien",async()=>{
  const source=await readFile(new URL("../../supabase/functions/generer-texte-ia/index.ts",import.meta.url),"utf8");
  assert.match(source,/carnet_journee_id requis/);
  assert.match(source,/carnet_faits_confirmes/);
  assert.match(source,/carnet_photos_selectionnees/);
  assert.match(source,/500 à 800 caractères/);
  assert.match(source,/N’invente aucun lieu, événement ou activité/);
  assert.match(source,/validated: false/);
  assert.doesNotMatch(source,/\.from\("carnet_journees"\)[\s\S]{0,500}\.update\(/);
  const selectionJournee=source.match(/\.from\("carnet_journees"\)[\s\S]*?\.maybeSingle\(\)/)?.[0] || "";
  assert.doesNotMatch(selectionJournee,/accroche|\bfil\b|lieux\(/);
});
