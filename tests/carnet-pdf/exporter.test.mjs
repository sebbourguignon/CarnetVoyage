import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { exporterCarnet, supprimerTemporaire } from "../../netlify/functions/carnet-pdf/exporter.mjs";

async function image(id,portrait=false){
  const width=portrait?900:1400, height=portrait?1400:900;
  const buffer=await sharp({create:{width,height,channels:3,background:{r:80+id*10,g:130,b:170}}}).jpeg({quality:95}).toBuffer();
  return {id:String(id),dataUrl:`data:image/jpeg;base64,${buffer.toString("base64")}`,legende:`Légende ${id}`,storagePath:`${id}.jpg`,width,height,ratio:width/height,orientation:portrait?"portrait":"landscape"};
}

test("export Chromium léger avec portraits, paysages, journée sans photo et régénération",{skip:process.platform!=="linux"&&!process.env.PUPPETEER_EXECUTABLE_PATH,timeout:120000},async(t)=>{
  const photos=await Promise.all([image(1),image(2,true),image(3),image(4,true)]);
  const modele=()=>({version:1,voyage:{titre:"Été d’Italie",dateDebut:"2026-08-01",dateFin:"2026-08-02"},statistiques:{journeesIllustrees:1,photos:4},journees:[
    {id:"a",carnetTerminee:true,date:"2026-08-01",lieu:"Vérone",titre:"Vérone",introduction:"Une journée d’été.",recit:"Un récit avec des accents et l’apostrophe d’aujourd’hui.",tempsForts:["Arènes","Piazza"],distance:"60 km",duree:"45 min",photos:structuredClone(photos)},
    {id:"b",carnetTerminee:true,date:"2026-08-02",lieu:"Salò",titre:"Salò",introduction:"",recit:"Une journée sans photographie.",tempsForts:[],distance:"",duree:"",photos:[]}
  ]});
  for(let passage=0;passage<2;passage++){
    const resultat=await exporterCarnet(modele());
    try{
      const octets=await readFile(resultat.chemin);
      assert.ok(octets.length<1.5*1024*1024,`PDF trop lourd: ${octets.length}`);
      const pdf=await PDFDocument.load(octets);
      assert.equal(pdf.getPageCount(),4);
      const images=[...pdf.context.enumerateIndirectObjects()].filter(([,o])=>o instanceof PDFRawStream&&o.dict.get(PDFName.of("Subtype"))===PDFName.of("Image"));
      assert.ok(images.length>=4);
      assert.ok(images.every(([,o])=>o.dict.get(PDFName.of("Filter"))===PDFName.of("DCTDecode")));
      if(process.env.CARNET_PDF_KEEP) t.diagnostic(`PDF conservé: ${resultat.chemin}`);
    } finally { if(!process.env.CARNET_PDF_KEEP) await supprimerTemporaire(resultat.chemin); }
  }
});
