import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { decodePDFRawStream, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { construireHtml } from "./template.mjs";

const QUALITE = 82;
const DIMENSIONS = {
  couverture: [1380, 1035], principale: [706, 529], secondaire: [690, 517], petite: [548, 411],
  galerie0: [690, 511], galerie1: [522, 411], galerie2: [487, 404], galerie3: [325, 298], galerie4: [824, 256]
};

async function telecharger(url) {
  const reponse = await fetch(url);
  if(!reponse.ok) throw Object.assign(new Error(`image inaccessible (${reponse.status})`), { code: "IMAGE_ILLISIBLE" });
  return Buffer.from(await reponse.arrayBuffer());
}

async function jpegPourCadre(source, [largeurCadre, hauteurCadre]) {
  const image = sharp(source, { failOn: "error" }).rotate();
  const meta = await image.metadata();
  if(!meta.width || !meta.height) throw Object.assign(new Error("dimensions d’image absentes"), { code: "IMAGE_ILLISIBLE" });
  const echelle = Math.min(1, Math.max(largeurCadre / meta.width, hauteurCadre / meta.height));
  const largeur = Math.max(1, Math.round(meta.width * echelle));
  const hauteur = Math.max(1, Math.round(meta.height * echelle));
  return image.resize({ width: largeur, height: hauteur, fit: "fill", withoutEnlargement: true })
    .jpeg({ quality: QUALITE, chromaSubsampling: "4:2:0", mozjpeg: true }).toBuffer();
}

async function preparerPhotos(modele) {
  const sources = new Map();
  async function source(photo) {
    if(!sources.has(photo.id)) sources.set(photo.id, telecharger(photo.url));
    return sources.get(photo.id);
  }
  async function variante(photo, role) {
    const jpeg = await jpegPourCadre(await source(photo), DIMENSIONS[role]);
    return { ...photo, url: undefined, storagePath: undefined, dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}` };
  }
  for(const journee of modele.journees) {
    const originales=journee.photos;
    const preparees=[];
    for(let i=0;i<Math.min(3,originales.length);i++) {
      const role = i === 0 ? "principale" : i === 1 ? "secondaire" : i === 2 ? "petite" : `galerie${(i-3)%5}`;
      preparees.push(await variante(originales[i], role));
    }
    journee.photos=preparees;
    let photosGalerie=[];
    if(originales.length === 4) photosGalerie=[...originales, originales[0]];
    else if(originales.length >= 5) photosGalerie=originales;
    journee.galeries=[];
    for(let debut=0;debut<photosGalerie.length;debut+=5) {
      const groupe=[];
      for(const [index,photo] of photosGalerie.slice(debut,debut+5).entries()) groupe.push(await variante(photo,`galerie${index}`));
      journee.galeries.push(groupe);
    }
  }
  const premiere = modele.journees.find((j)=>j.photos.length);
  if(premiere) {
    // La source signée est encore disponible dans la carte locale `sources`.
    const jpeg = await jpegPourCadre(await sources.get(premiere.photos[0].id), DIMENSIONS.couverture);
    modele.couverturePhoto = { ...premiere.photos[0], dataUrl:`data:image/jpeg;base64,${jpeg.toString("base64")}` };
  }
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
    const jpeg=await sharp(pixels,{raw:{width:largeur,height:hauteur,channels:3}}).jpeg({quality:QUALITE,chromaSubsampling:"4:2:0",mozjpeg:true}).toBuffer();
    const dictionnaire=objet.dict.clone(document.context);
    dictionnaire.set(PDFName.of("Filter"),PDFName.of("DCTDecode"));
    dictionnaire.delete(PDFName.of("DecodeParms"));
    document.context.assign(reference,PDFRawStream.of(dictionnaire,jpeg));
    converties++;
  }
  const resultat=await document.save({useObjectStreams:false});
  return { octets:resultat, pages:document.getPageCount(), images:[...document.context.enumerateIndirectObjects()].filter(([,o])=>o instanceof PDFRawStream&&o.dict.get(PDFName.of("Subtype"))===PDFName.of("Image")).length, converties };
}

export async function exporterCarnet(modele) {
  const temporaire=`/tmp/carnet-${randomUUID()}.pdf`;
  let navigateur;
  try {
    await preparerPhotos(modele);
    modele.polices={
      bodoni:extraireBase64(await readFile(new URL("../../../supabase/functions/generer-carnet/BodoniModa_Variable.ts",import.meta.url),"utf8")),
      plex:extraireBase64(await readFile(new URL("../../../supabase/functions/generer-carnet/IBMPlexSans_Variable.ts",import.meta.url),"utf8"))
    };
    const executablePath=process.env.PUPPETEER_EXECUTABLE_PATH || await chromium.executablePath();
    navigateur=await puppeteer.launch({args:chromium.args,executablePath,headless:true});
    const page=await navigateur.newPage();
    await page.setContent(construireHtml(modele),{waitUntil:"networkidle0",timeout:120000});
    await page.emulateMediaType("print");
    await page.evaluate(()=>document.fonts.ready);
    await page.pdf({path:temporaire,format:"A4",printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,tagged:true,timeout:120000});
    const brut=await readFile(temporaire);
    const optimise=await recomprimerImagesLossless(brut);
    await writeFile(temporaire,optimise.octets);
    const poids=optimise.octets.length;
    const budgetMo=Number(process.env.PDF_BUDGET_MB || Math.max(1.5,modele.statistiques.photos*0.2));
    return {
      chemin:temporaire,
      diagnostic:{pages:optimise.pages,images:optimise.images,photos:modele.statistiques.photos,poids_octets:poids,poids_mo:Number((poids/1024/1024).toFixed(2)),poids_moyen_photo_ko:modele.statistiques.photos?Math.round(poids/1024/modele.statistiques.photos):0,images_lossless_converties:optimise.converties,budget_mo:budgetMo,budget_depasse:poids/1024/1024>budgetMo}
    };
  } catch(erreur) {
    if(/heap|memory|allocation/i.test(String(erreur?.message))) erreur.code="MEMOIRE_INSUFFISANTE";
    throw erreur;
  } finally {
    if(navigateur) await navigateur.close().catch(()=>{});
  }
}

export async function supprimerTemporaire(chemin) { if(chemin) await unlink(chemin).catch(()=>{}); }
