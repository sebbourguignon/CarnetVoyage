import sharp from "sharp";

const VERSION_VARIANTE="pdf-max1100-q68-v3";
const normaliserVersion=v=>Buffer.from(String(v||"original")).toString("base64url").slice(0,80);
export const cheminVariante=(modele,photo)=>`${modele.voyage.id}/${modele.membreId}/${photo.id}/${normaliserVersion(photo.version)}-${VERSION_VARIANTE}.jpg`;
export const orientationDepuisRatio=r=>r>1.12?"landscape":r<.88?"portrait":"square";
async function concurrence(elements,limite,traiter){const resultats=new Array(elements.length);let suivant=0;async function worker(){while(suivant<elements.length){const i=suivant++;resultats[i]=await traiter(elements[i],i);}}await Promise.all(Array.from({length:Math.min(limite,elements.length)},worker));return resultats;}

export async function preparerVariantesPersistantes(client,modele,signaler=async()=>{}){
  const mesures={cache_persistant_hits:0,cache_persistant_misses:0,telechargement_originaux_ms:0,creation_variantes_ms:0,depot_variantes_ms:0};
  const photos=[...new Map(modele.journees.flatMap(j=>j.photos||[]).map(p=>[p.id,p])).values()];
  const contenus=new Map(),debutLectures=performance.now();
  // Les variantes sont petites : six lectures parallèles réduisent fortement
  // la latence du chemin chaud, sans décoder plusieurs originaux en mémoire.
  await concurrence(photos,10,async(photo,index)=>{
    await signaler(`variante_persistante:${index+1}/${photos.length}`);
    const contenu=(await client.storage.from("carnets").download(cheminVariante(modele,photo))).data;
    if(contenu){mesures.cache_persistant_hits++;contenus.set(photo.id,contenu);}else mesures.cache_persistant_misses++;
  });
  mesures.lecture_cache_ms=performance.now()-debutLectures;
  await concurrence(photos.filter(photo=>!contenus.has(photo.id)),2,async(photo)=>{
      const chemin=cheminVariante(modele,photo);
      const debutTelechargement=performance.now(),reponse=await fetch(photo.url);
      if(!reponse.ok)throw Object.assign(new Error(`image inaccessible (${reponse.status})`),{code:"IMAGE_ILLISIBLE"});
      const original=Buffer.from(await reponse.arrayBuffer());mesures.telechargement_originaux_ms+=performance.now()-debutTelechargement;
      const debutCreation=performance.now(),jpeg=await sharp(original,{failOn:"error"}).rotate().resize({width:1100,height:1100,fit:"inside",withoutEnlargement:true}).jpeg({quality:68,chromaSubsampling:"4:2:0",progressive:true}).toBuffer();
      mesures.creation_variantes_ms+=performance.now()-debutCreation;
      const debutDepot=performance.now(),depot=await client.storage.from("carnets").upload(chemin,jpeg,{contentType:"image/jpeg",cacheControl:"31536000",upsert:false});
      if(depot.error&&!/already exists|duplicate/i.test(depot.error.message||""))throw depot.error;
      mesures.depot_variantes_ms+=performance.now()-debutDepot;contenus.set(photo.id,new Blob([jpeg],{type:"image/jpeg"}));
  });
  await concurrence(photos,10,async(photo)=>{
    const contenu=contenus.get(photo.id);
    const octets=Buffer.from(await contenu.arrayBuffer()),meta=await sharp(octets).metadata();
    if(!meta.width||!meta.height)throw Object.assign(new Error("dimensions d’image absentes"),{code:"IMAGE_ILLISIBLE"});
    photo.width=meta.width;photo.height=meta.height;photo.ratio=meta.width/meta.height;photo.orientation=orientationDepuisRatio(photo.ratio);photo.dataUrl=`data:image/jpeg;base64,${octets.toString("base64")}`;
    photo.url=undefined;photo.storagePath=undefined;
  });
  for(const k of Object.keys(mesures))mesures[k]=Math.round(mesures[k]);
  return mesures;
}
