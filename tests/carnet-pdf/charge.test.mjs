import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { exporterCarnet, supprimerTemporaire } from "../../netlify/functions/carnet-pdf/exporter.mjs";

test("charge de quatre journées de 20 photographies",{skip:process.env.CARNET_PDF_LOAD_TEST!=="1",timeout:240000},async(t)=>{
  const photos=[];
  for(let i=0;i<80;i++){
    const portrait=i%3===0, width=portrait?900:1400, height=portrait?1400:900;
    const jpeg=await sharp({create:{width,height,channels:3,background:{r:60+i%150,g:100+i%100,b:150+i%80}}}).jpeg({quality:94}).toBuffer();
    photos.push({id:String(i),url:`data:image/jpeg;base64,${jpeg.toString("base64")}`,storagePath:`${i}.jpg`,legende:`Photographie ${i+1}`});
  }
  const journees=Array.from({length:4},(_,jour)=>({id:`jour-${jour}`,date:`2026-07-0${jour+1}`,lieu:"Italie",titre:`Italie, étape ${jour+1}`,
    recit:"Un récit de voyage.",tempsForts:[],distance:"",duree:"",temperature:"",compacte:false,photos:photos.slice(jour*20,(jour+1)*20)}));
  const modele={version:2,voyage:{titre:"Grand voyage",dateDebut:"2026-07-01",dateFin:"2026-07-20"},statistiques:{journeesIllustrees:4,photos:80},journees};
  const resultat=await exporterCarnet(modele);
  try{
    assert.equal(resultat.diagnostic.pages,18);
    assert.ok(resultat.diagnostic.poids_mo<=20,`PDF de ${resultat.diagnostic.poids_mo} Mo`);
    assert.equal(resultat.diagnostic.photos,80);
    t.diagnostic(`${resultat.diagnostic.pages} pages, ${resultat.diagnostic.poids_mo} Mo, ${resultat.diagnostic.poids_moyen_photo_ko} Ko/photo`);
  } finally { await supprimerTemporaire(resultat.chemin); }
});
