import test from "node:test";
import assert from "node:assert/strict";

globalThis.window=globalThis;
await import("../../app/carnet-pdf/client.js");

test("un second lancement simultané est ignoré et le verrou retombe après erreur",async()=>{
  let liberer;
  const attente=new Promise((resolve)=>{liberer=resolve;});
  const options={
    construireModele:()=>attente,
    supabase:{from:()=>({insert:()=>({select:()=>({single:async()=>({error:new Error("test")})})})})},
    voyageId:"v"
  };
  const consoleErreur=console.error; console.error=()=>{};
  const premier=CarnetPDFClient.generer(options).catch(()=>null);
  assert.equal(await CarnetPDFClient.generer(options),null);
  liberer({}); await premier; console.error=consoleErreur;
  assert.equal(CarnetPDFClient.estEnCours(),false);
});
