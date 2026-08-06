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
function options(preparation){return {carnet:{titre:"Voyage",titreSuite:"test"},voyageId:"v",slug:"v",utilisateurId:"m",urlPhoto:async p=>`signed:${p}`,
  jours:[{uuid:"j",date:"2026-08-01",titre:"Étape",accroche:"Accroche interdite",fil:"Ancien programme",rail1:"10 km",rail2:"20 min",lieux:[{nom:"Lieu seulement prévu"}]}],
  photosParJournee:{j:[{id:"p1",membre_id:"m",storage_path:"1.jpg",legende:"Une"},{id:"p2",membre_id:"m",storage_path:"2.jpg",legende:"Deux"}]},preparations:[preparation]};}

test("l’adaptateur n’exporte que le récit validé, les faits confirmés et les photos sélectionnées",async()=>{
  const a=await charger();const modele=await a.adapter(options({journee_id:"j",carnet_story:"Brouillon legacy",carnet_story_validated:false,
    afficher_programme_prevu:false,carnet_faits_confirmes:[{libelle:"Visite vécue",moment_fort:true,ordre:0}],carnet_photos_selectionnees:[{photo_id:"p2",ordre:0,principale:true,legende_carnet:"Choisie"}]}));
  assert.equal(modele.version,2);assert.equal(modele.journees.length,1);assert.equal(modele.journees[0].recit,"");
  assert.deepEqual(Array.from(modele.journees[0].tempsForts),["Visite vécue"]);assert.deepEqual(Array.from(modele.journees[0].photos,p=>p.id),["p2"]);
  assert.equal(modele.journees[0].introduction,undefined);assert.doesNotMatch(JSON.stringify(modele),/Accroche interdite|Lieu seulement prévu|Brouillon legacy/);
});

test("une journée vide reste présente et son programme est opt-in",async()=>{
  const a=await charger();const modele=await a.adapter(options({journee_id:"j",carnet_story_validated:false,afficher_programme_prevu:true,carnet_faits_confirmes:[],carnet_photos_selectionnees:[]}));
  assert.equal(modele.journees[0].compacte,true);assert.deepEqual(Array.from(modele.journees[0].programmePrevu),["Ancien programme","Lieu seulement prévu"]);
});
