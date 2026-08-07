import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import("../../app/carnet-pdf/modele.js");
const modele=globalThis.CarnetPreparationModele;

test("un ancien carnet_textes devient un brouillon legacy non validé",()=>{
  const preparation=modele.normaliserPreparation(null,{texte:" Ancien récit "});
  assert.equal(preparation.carnetStory,"Ancien récit");
  assert.equal(preparation.carnetStorySource,"legacy");
  assert.equal(preparation.carnetStoryValidated,false);
});

test("les limites sont quotidiennes et ne créent aucun quota voyage",()=>{
  const preparation=modele.normaliserPreparation(null,null);
  assert.equal(modele.analyserJournee(preparation,[],Array.from({length:10},(_,i)=>({photoId:String(i)}))).erreurs.length,0);
  assert.match(modele.analyserJournee(preparation,[],Array.from({length:11},(_,i)=>({photoId:String(i)}))).erreurs[0],/10 photos/);
  assert.equal("PHOTOS_MAX_VOYAGE" in modele,false);
});

test("une journée vide reste compacte et le programme prévu est désactivé",()=>{
  const preparation=modele.normaliserPreparation(null,null);
  assert.equal(preparation.afficherProgrammePrevu,false);
  assert.equal(modele.analyserJournee(preparation,[],[]).compacte,true);
});

test("un à cinq moments forts sont acceptés sans minimum artificiel",()=>{
  const preparation=modele.normaliserPreparation(null,null);
  for(let n=0;n<=5;n++){
    const faits=Array.from({length:n},(_,i)=>({libelle:String(i),momentFort:true}));
    assert.equal(modele.analyserJournee(preparation,faits,[]).erreurs.length,0);
  }
  const six=Array.from({length:6},(_,i)=>({libelle:String(i),momentFort:true}));
  assert.match(modele.analyserJournee(preparation,six,[]).erreurs[0],/5 moments/);
});

test("la migration est additive et migre les textes en legacy",async()=>{
  const sql=await readFile(new URL("../../supabase/migrations/0023_preparation_carnet.sql",import.meta.url),"utf8");
  assert.match(sql,/create table carnet_journees/i);
  assert.match(sql,/create table carnet_faits_confirmes/i);
  assert.match(sql,/create table carnet_photos_selectionnees/i);
  assert.match(sql,/select voyage_id, journee_id, membre_id, texte, 'legacy', false/i);
  assert.doesNotMatch(sql,/drop table\s+carnet_textes/i);
  assert.match(sql,/maximum de 20 photos par journée/i);
});

test("l’activation de la préparation est explicite et rétrocompatible",async()=>{
  const sql=await readFile(new URL("../../supabase/migrations/0024_activation_preparation_carnet.sql",import.meta.url),"utf8");
  assert.match(sql,/preparation_active boolean not null default false/i);
  assert.doesNotMatch(sql,/update\s+carnet_journees/i);
});

test("la passe ergonomique ajoute une validation finale et limite à dix photos",async()=>{
  const sql=await readFile(new URL("../../supabase/migrations/0025_ergonomie_preparation_carnet.sql",import.meta.url),"utf8");
  assert.match(sql,/carnet_terminee boolean not null default false/i);
  assert.match(sql,/recit_source_hash text/i);
  assert.match(sql,/maximum de 10 photos par journée/i);
  assert.doesNotMatch(sql,/delete from carnet_/i);
});
