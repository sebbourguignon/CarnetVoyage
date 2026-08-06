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
  assert.equal(modele.version,2);assert.equal(modele.journees[0].recit,"Récit existant de Vérone");
  assert.deepEqual(Array.from(modele.journees[0].photos,p=>p.id),["p1","p2"]);assert.deepEqual(Array.from(modele.journees[0].tempsForts),["Arena"]);
});

test("une journée enregistrée utilise uniquement sa préparation",async()=>{
  const adaptateur=await charger();
  const modele=await adaptateur.adapter({carnet:{titre:"Voyage"},voyageId:"v",slug:"v",utilisateurId:"m",texteJournee:()=>"Ancien récit",urlPhoto:async p=>`signed:${p}`,
    jours:[{uuid:"j",date:"2026-08-04",titre:"Vérone",accroche:"Ancienne accroche",rail1:"60 km",rail2:"45 min",lieux:[{nom:"Lieu prévu"}]}],
    photosParJournee:{j:[{id:"p1",membre_id:"m",storage_path:"1.jpg",legende:"Une"},{id:"p2",membre_id:"m",storage_path:"2.jpg",legende:"Deux"}]},
    preparations:[{journee_id:"j",preparation_active:true,carnet_story:"Nouveau récit validé",carnet_story_validated:true,
      carnet_faits_confirmes:[{libelle:"Arena vécue",moment_fort:true,ordre:0},{libelle:"Simple fait",moment_fort:false,ordre:1}],
      carnet_photos_selectionnees:[{photo_id:"p2",ordre:1,principale:true,legende_carnet:"Photo choisie",focal_x:.2,focal_y:.8}]}]});
  const jour=modele.journees[0];assert.equal(jour.recit,"Nouveau récit validé");assert.equal(jour.introduction,"");
  assert.deepEqual(Array.from(jour.photos,p=>p.id),["p2"]);assert.deepEqual(Array.from(jour.tempsForts),["Arena vécue"]);
  assert.equal(jour.photos[0].legende,"Photo choisie");assert.equal(jour.photos[0].focalX,.2);
  assert.doesNotMatch(JSON.stringify(jour),/Ancien récit|Ancienne accroche|Lieu prévu|p1/);
});
