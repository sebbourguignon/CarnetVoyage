import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("l’IA utilise uniquement le payload local confirmé et ne lit pas le programme",async()=>{
  const source=await readFile(new URL("../../supabase/functions/generer-texte-ia/index.ts",import.meta.url),"utf8");
  assert.match(source,/body\.faits_confirmes/);
  assert.match(source,/body\.photos_selectionnees/);
  assert.match(source,/body\.notes_personnelles/);
  assert.match(source,/500 à 800 caractères/);
  assert.match(source,/N’invente aucun lieu, événement ou activité/);
  assert.doesNotMatch(source,/\.from\("(?:carnet_journees|journees|lieux|observations)"\)/);
  assert.doesNotMatch(source,/accroche|parking|reservation|restaurant/);
});
