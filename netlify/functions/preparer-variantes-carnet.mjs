import {createClient} from "@supabase/supabase-js";
import {preparerVariantesPersistantes} from "./carnet-pdf/variantes.mjs";
import {CARNET_BUILD_CONTEXT} from "./carnet-pdf/build.generated.mjs";
import {DEV_URL,PROD_URL,environmentMismatchResponse} from "./carnet-environment.mjs";

export default async requete=>{
  try{
    const auth=requete.headers.get("authorization")||"",corps=await requete.json();
    const projets={[PROD_URL]:"sb_publishable_fbZPyz9G6UIBWwU00phJig_fQegJUl9",[DEV_URL]:"sb_publishable_Jz82ewEk0V8Qdq-6jRSXQg_WMxjVo5h"},cle=projets[corps.supabase_url];
    if(!cle||!/^Bearer\s+\S+$/i.test(auth)||!corps.voyage_id||!Array.isArray(corps.photo_ids))return new Response(null,{status:400});
    const environnement=environmentMismatchResponse(corps.supabase_url,CARNET_BUILD_CONTEXT);if(environnement)return environnement;
    const client=createClient(corps.supabase_url,cle,{global:{headers:{Authorization:auth}},auth:{persistSession:false}}),utilisateur=await client.auth.getUser();
    if(utilisateur.error||!utilisateur.data.user)return new Response(null,{status:401});
    const lecture=await client.from("photos").select("id,storage_path,cree_le").in("id",corps.photo_ids.slice(0,10));
    if(lecture.error)throw lecture.error;
    const photos=[];for(const p of lecture.data||[]){const sig=await client.storage.from("photos").createSignedUrl(p.storage_path,300);if(sig.data?.signedUrl)photos.push({id:p.id,url:sig.data.signedUrl,storagePath:p.storage_path,version:p.cree_le||p.storage_path});}
    await preparerVariantesPersistantes(client,{voyage:{id:corps.voyage_id},membreId:utilisateur.data.user.id,journees:[{photos}]});
    return new Response(null,{status:204});
  }catch(erreur){console.error("preparer-variantes-carnet:",erreur);return new Response(null,{status:500});}
};
export const config={background:true,path:"/.netlify/functions/preparer-variantes-carnet"};
