import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {cheminVariante,orientationDepuisRatio,preparerVariantesPersistantes} from "../../netlify/functions/carnet-pdf/variantes.mjs";

test("la clé persistante dépend de la photo, de sa version et de la variante",()=>{
  const modele={voyage:{id:"v"},membreId:"m"};
  assert.notEqual(cheminVariante(modele,{id:"p",version:"1"}),cheminVariante(modele,{id:"p",version:"2"}));
  assert.equal(orientationDepuisRatio(1.5),"landscape");assert.equal(orientationDepuisRatio(.7),"portrait");assert.equal(orientationDepuisRatio(1),"square");
});

test("une variante persistante conserve le ratio et évite l'original lors d'un hit",async()=>{
  const jpeg=await sharp({create:{width:1200,height:800,channels:3,background:"#887766"}}).jpeg().toBuffer();let fetchs=0;
  const bucket={download:async()=>({data:new Blob([jpeg],{type:"image/jpeg"})}),upload:async()=>({error:null})};
  const client={storage:{from:()=>bucket}},photo={id:"p",version:"v1",url:"https://original.invalid/p.jpg"},modele={voyage:{id:"v"},membreId:"m",journees:[]};modele.journees=[{photos:[photo]}];
  const ancien=global.fetch;global.fetch=async()=>{fetchs++;throw new Error("ne doit pas être appelé");};
  try{const mesures=await preparerVariantesPersistantes(client,modele);assert.equal(fetchs,0);assert.equal(mesures.cache_persistant_hits,1);assert.equal(photo.ratio,1.5);assert.equal(photo.orientation,"landscape");assert.match(photo.dataUrl,/^data:image\/jpeg;base64,/);}finally{global.fetch=ancien;}
});
