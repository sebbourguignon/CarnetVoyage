import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

async function charger(){
  const source=await readFile(new URL("../../app/carnet-pdf/adaptateur.js",import.meta.url),"utf8");
  const window={};
  vm.runInNewContext(source,{window,document:{createElement(){return{_html:"",set innerHTML(v){this._html=String(v);},get textContent(){return this._html.replace(/<[^>]+>/g,"");}};}}});
  return window.CarnetPDFAdaptateur;
}

test("la compatibilité PDF reprend le texte existant et toutes les photos du membre",async()=>{
  const adaptateur=await charger();
  const modele=await adaptateur.adapter({carnet:{titre:"Voyage"},voyageId:"v",slug:"v",utilisateurId:"m",texteJournee:()=>"Récit existant de Vérone",
    urlPhoto:async p=>`signed:${p}`,jours:[{uuid:"j",date:"2026-08-04",titre:"Vérone",accroche:"Introduction",rail1:"60 km",rail2:"45 min",lieux:[{nom:"Arena"}]}],
    photosParJournee:{j:[{id:"p1",membre_id:"m",storage_path:"1.jpg",legende:"Une"},{id:"p2",membre_id:"m",storage_path:"2.jpg",legende:"Deux"},{id:"autre",membre_id:"x",storage_path:"x.jpg"}]}});
  assert.equal(modele.version,1);assert.equal(modele.journees[0].recit,"Récit existant de Vérone");
  assert.deepEqual(Array.from(modele.journees[0].photos,p=>p.id),["p1","p2"]);assert.deepEqual(Array.from(modele.journees[0].tempsForts),["Arena"]);
});
