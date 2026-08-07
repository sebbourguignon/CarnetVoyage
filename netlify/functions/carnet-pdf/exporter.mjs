import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { decodePDFRawStream, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { construireHtml, verifierJourneesTerminees } from "./template.mjs";

const QUALITE = 82;
// Netlify alloue un conteneur borné : un seul worker libvips et aucun cache
// natif évitent les arrêts brutaux lors de plusieurs déclinaisons d'une photo.
sharp.concurrency(1);
sharp.cache(false);
const CHEMIN_CHROMIUM=process.env.PUPPETEER_EXECUTABLE_PATH?Promise.resolve(process.env.PUPPETEER_EXECUTABLE_PATH):chromium.executablePath();
async function preparerPhotos(modele, signalerEtape, mesures) {
  const photoCouverture=modele.journees.flatMap((journee)=>journee.photos).find(Boolean);
  for(const journee of modele.journees){const originales=journee.photos||[],principales=originales.length<=4?originales:originales.slice(0,3),galerie=originales.length>=5?originales.slice(3):[];journee.photos=principales;journee.galeries=galerie.length?[galerie]:[];}
  modele.couverturePhoto=photoCouverture;
  mesures.cache_images_hits=modele.statistiques.photos;
  await signalerEtape("variantes_pretes");
}

function extraireBase64(texte) {
  const resultat = texte.match(/donneesBase64\s*=\s*"([A-Za-z0-9+/=]+)"/);
  if(!resultat) throw new Error("police embarquée illisible");
  return resultat[1];
}

async function recomprimerImagesLossless(octets,generateur={}) {
  const document = await PDFDocument.load(octets);
  document.setTitle("Carnet de voyage");document.setCreator(`Carnet PDF ${generateur.functionVersion||"locale"}`);document.setSubject(`Build ${generateur.buildSha||"local"}`);document.setKeywords(["carnet-voyage",generateur.functionVersion||"local",generateur.buildSha||"local"]);
  let converties=0;
  for(const [reference, objet] of document.context.enumerateIndirectObjects()) {
    if(!(objet instanceof PDFRawStream) || objet.dict.get(PDFName.of("Subtype")) !== PDFName.of("Image")) continue;
    if(objet.dict.get(PDFName.of("Filter")) !== PDFName.of("FlateDecode")) continue;
    if(String(objet.dict.get(PDFName.of("ColorSpace"))) !== "/DeviceRGB" || String(objet.dict.get(PDFName.of("BitsPerComponent"))) !== "8") continue;
    const largeur=Number(String(objet.dict.get(PDFName.of("Width"))));
    const hauteur=Number(String(objet.dict.get(PDFName.of("Height"))));
    const pixels=decodePDFRawStream(objet).decode();
    if(pixels.length !== largeur*hauteur*3) continue;
    const jpeg=await sharp(pixels,{raw:{width:largeur,height:hauteur,channels:3}}).jpeg({quality:QUALITE,chromaSubsampling:"4:2:0",progressive:false}).toBuffer();
    const dictionnaire=objet.dict.clone(document.context);
    dictionnaire.set(PDFName.of("Filter"),PDFName.of("DCTDecode"));
    dictionnaire.delete(PDFName.of("DecodeParms"));
    document.context.assign(reference,PDFRawStream.of(dictionnaire,jpeg));
    converties++;
  }
  const resultat=await document.save({useObjectStreams:false});
  return { octets:resultat, pages:document.getPageCount(), images:[...document.context.enumerateIndirectObjects()].filter(([,o])=>o instanceof PDFRawStream&&o.dict.get(PDFName.of("Subtype"))===PDFName.of("Image")).length, converties };
}

export async function exporterCarnet(modele, signalerEtape = async () => {}) {
  const temporaire=`/tmp/carnet-${randomUUID()}.pdf`;
  let navigateur;const departTotal=performance.now(),mesures={telechargement_photos_ms:0,optimisation_images_ms:0,cache_images_hits:0};
  async function phase(nom,fn){const d=performance.now();const r=await fn();mesures[`${nom}_ms`]=Math.round(performance.now()-d);return r;}
  try {
    await signalerEtape("optimisation_images");
    await phase("preparation_images",()=>preparerPhotos(modele,signalerEtape,mesures));
    // `import.meta.url` change de répertoire après le bundling Netlify : les
    // fichiers inclus restent, eux, sous la racine de la fonction (/var/task).
    const racineFonction=process.env.LAMBDA_TASK_ROOT || process.cwd();
    await phase("chargement_polices",async()=>{modele.polices={
      bodoni:extraireBase64(await readFile(resolve(racineFonction,"supabase/functions/generer-carnet/BodoniModa_Variable.ts"),"utf8")),
      plex:extraireBase64(await readFile(resolve(racineFonction,"supabase/functions/generer-carnet/IBMPlexSans_Variable.ts"),"utf8"))
    };});
    const html=await phase("construction_html",async()=>{verifierJourneesTerminees(modele);return construireHtml(modele);});
    await signalerEtape("demarrage_chromium");
    const executablePath=await phase("preparation_chromium",()=>CHEMIN_CHROMIUM);
    navigateur=await phase("lancement_chromium",()=>puppeteer.launch({args:chromium.args,executablePath,headless:true}));
    await signalerEtape("rendu_html");
    const page=await navigateur.newPage();
    // Le document est autonome (polices et photographies embarquées). Attendre
    // `networkidle0` garde inutilement Chromium dans sa phase la plus coûteuse
    // et pouvait faire interrompre le worker Netlify avant la création du PDF.
    await phase("rendu_html",async()=>{await page.setContent(html,{waitUntil:"domcontentloaded",timeout:120000});await page.emulateMediaType("print");await page.evaluate(async()=>{await document.fonts.ready;await window.__carnetPhotosReady;});});
    await signalerEtape("creation_pdf");
    await phase("creation_pdf",()=>page.pdf({path:temporaire,format:"A4",printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,tagged:true,timeout:120000}));
    await signalerEtape("optimisation_pdf");
    const brut=await readFile(temporaire);
    const optimise=await phase("optimisation_pdf",()=>recomprimerImagesLossless(brut,modele.generateur));
    await writeFile(temporaire,optimise.octets);mesures.temps_total_ms=Math.round(performance.now()-departTotal);mesures.telechargement_photos_ms=Math.round(mesures.telechargement_photos_ms);mesures.optimisation_images_ms=Math.round(mesures.optimisation_images_ms);
    const poids=optimise.octets.length;
    const budgetMo=Number(process.env.PDF_BUDGET_MB || Math.max(1.5,modele.statistiques.photos*0.2));
    return {
      chemin:temporaire,
      diagnostic:{pages:optimise.pages,images:optimise.images,photos:modele.statistiques.photos,poids_octets:poids,poids_mo:Number((poids/1024/1024).toFixed(2)),poids_moyen_photo_ko:modele.statistiques.photos?Math.round(poids/1024/modele.statistiques.photos):0,images_lossless_converties:optimise.converties,budget_mo:budgetMo,budget_depasse:poids/1024/1024>budgetMo,profil:mesures}
    };
  } catch(erreur) {
    if(/heap|memory|allocation/i.test(String(erreur?.message))) erreur.code="MEMOIRE_INSUFFISANTE";
    throw erreur;
  } finally {
    if(navigateur) await navigateur.close().catch(()=>{});
  }
}

export async function supprimerTemporaire(chemin) { if(chemin) await unlink(chemin).catch(()=>{}); }
