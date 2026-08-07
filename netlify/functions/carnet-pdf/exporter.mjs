import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { decodePDFRawStream, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { construireHtml } from "./template.mjs";

const QUALITE = 82;
const executerFichier=promisify(execFile);
const CACHE_VARIANTES=new Map();
// Netlify alloue un conteneur borné : un seul worker libvips et aucun cache
// natif évitent les arrêts brutaux lors de plusieurs déclinaisons d'une photo.
sharp.concurrency(1);
sharp.cache(false);
const DIMENSIONS = {
  couverture: [1380, 1035], principale: [706, 529], secondaire: [690, 517], petite: [548, 411],
  galerie0: [690, 511], galerie1: [522, 411], galerie2: [487, 404], galerie3: [325, 298], galerie4: [824, 256]
};

async function telechargerVersFichier(url) {
  const reponse = await fetch(url);
  if(!reponse.ok) throw Object.assign(new Error(`image inaccessible (${reponse.status})`), { code: "IMAGE_ILLISIBLE" });
  if(!reponse.body) throw Object.assign(new Error("image vide"), { code: "IMAGE_ILLISIBLE" });
  const chemin=`/tmp/carnet-image-${randomUUID()}`;
  try {
    await pipeline(Readable.fromWeb(reponse.body),createWriteStream(chemin));
    return chemin;
  } catch(erreur) {
    await unlink(chemin).catch(()=>{});
    throw erreur;
  }
}

async function jpegPourCadre(source, [largeurCadre, hauteurCadre]) {
  const sortie=`/tmp/carnet-jpeg-${randomUUID()}.jpg`;
  // libvips conserve des allocations natives après chaque décodage sous
  // Linux. Un processus court par variante rend toute sa mémoire au système
  // avant de passer à la suivante et protège le conteneur Netlify.
  const programme=`
    import sharp from "sharp";
    const [source,sortie,largeurCadre,hauteurCadre,qualite]=process.argv.slice(1);
    sharp.concurrency(1); sharp.cache(false);
    const image=sharp(source,{failOn:"error"}).rotate();
    const meta=await image.metadata();
    if(!meta.width||!meta.height) throw new Error("dimensions d’image absentes");
    const echelle=Math.min(1,Math.max(Number(largeurCadre)/meta.width,Number(hauteurCadre)/meta.height));
    await image.resize({width:Math.max(1,Math.round(meta.width*echelle)),height:Math.max(1,Math.round(meta.height*echelle)),fit:"fill",withoutEnlargement:true})
      .jpeg({quality:Number(qualite),chromaSubsampling:"4:2:0",progressive:false}).toFile(sortie);
  `;
  try {
    await executerFichier(process.execPath,["--input-type=module","-e",programme,source,sortie,String(largeurCadre),String(hauteurCadre),String(QUALITE)],{timeout:120000});
    return await readFile(sortie);
  } catch(erreur) {
    throw Object.assign(new Error(erreur?.stderr || erreur?.message || "image illisible"),{code:"IMAGE_ILLISIBLE"});
  } finally { await unlink(sortie).catch(()=>{}); }
}

async function enConcurrence(elements,limite,traiter){const resultats=new Array(elements.length);let suivant=0;async function worker(){while(suivant<elements.length){const i=suivant++;resultats[i]=await traiter(elements[i],i);}}await Promise.all(Array.from({length:Math.min(limite,elements.length)},worker));return resultats;}

async function preparerPhotos(modele, signalerEtape, mesures) {
  let numeroVariante=0;
  const sources=new Map(),temporaires=[];
  async function sourcePour(photo){if(!sources.has(photo.id)){sources.set(photo.id,(async()=>{const debut=performance.now();const f=await telechargerVersFichier(photo.url);mesures.telechargement_photos_ms+=performance.now()-debut;temporaires.push(f);return f;})());}return sources.get(photo.id);}
  async function variante(photo, role) {
    await signalerEtape(`optimisation_image:${++numeroVariante}`);
    const cle=`${photo.id}:${photo.version||photo.storagePath}:${role}`;
    if(CACHE_VARIANTES.has(cle)){mesures.cache_images_hits++;return {...photo,url:undefined,storagePath:undefined,dataUrl:CACHE_VARIANTES.get(cle)};}
    const source=await sourcePour(photo),debut=performance.now();
    const jpeg=await jpegPourCadre(source,DIMENSIONS[role]);mesures.optimisation_images_ms+=performance.now()-debut;
    const resultat={...photo,url:undefined,storagePath:undefined,dataUrl:`data:image/jpeg;base64,${jpeg.toString("base64")}`};
    CACHE_VARIANTES.set(cle,resultat.dataUrl);return resultat;
  }
  const photoCouverture=modele.journees.flatMap((journee)=>journee.photos).find(Boolean);
  const travaux=[];
  for(const journee of modele.journees){const originales=journee.photos||[],principales=originales.length<=4?originales:originales.slice(0,3),galerie=originales.length>=5?originales.slice(3):[];journee.photos=new Array(principales.length);journee.galeries=galerie.length?[new Array(galerie.length)]:[];principales.forEach((p,i)=>travaux.push({p,role:i===0?"principale":i===1?"secondaire":"petite",poser:v=>journee.photos[i]=v}));galerie.forEach((p,i)=>travaux.push({p,role:`galerie${Math.min(i,4)}`,poser:v=>journee.galeries[0][i]=v}));}
  await enConcurrence(travaux,2,async t=>t.poser(await variante(t.p,t.role)));
  if(photoCouverture)modele.couverturePhoto=await variante(photoCouverture,"couverture");
  await Promise.all(temporaires.map(f=>unlink(f).catch(()=>{})));
}

function extraireBase64(texte) {
  const resultat = texte.match(/donneesBase64\s*=\s*"([A-Za-z0-9+/=]+)"/);
  if(!resultat) throw new Error("police embarquée illisible");
  return resultat[1];
}

async function recomprimerImagesLossless(octets) {
  const document = await PDFDocument.load(octets);
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
    const html=await phase("construction_html",async()=>construireHtml(modele));
    await signalerEtape("demarrage_chromium");
    const executablePath=process.env.PUPPETEER_EXECUTABLE_PATH || await chromium.executablePath();
    navigateur=await phase("lancement_chromium",()=>puppeteer.launch({args:chromium.args,executablePath,headless:true}));
    await signalerEtape("rendu_html");
    const page=await navigateur.newPage();
    // Le document est autonome (polices et photographies embarquées). Attendre
    // `networkidle0` garde inutilement Chromium dans sa phase la plus coûteuse
    // et pouvait faire interrompre le worker Netlify avant la création du PDF.
    await phase("rendu_html",async()=>{await page.setContent(html,{waitUntil:"domcontentloaded",timeout:120000});await page.emulateMediaType("print");await page.evaluate(()=>document.fonts.ready);});
    await signalerEtape("creation_pdf");
    await phase("creation_pdf",()=>page.pdf({path:temporaire,format:"A4",printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,tagged:true,timeout:120000}));
    await signalerEtape("optimisation_pdf");
    const brut=await readFile(temporaire);
    const optimise=await phase("optimisation_pdf",()=>recomprimerImagesLossless(brut));
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
