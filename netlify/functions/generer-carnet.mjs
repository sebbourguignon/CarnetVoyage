import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { exporterCarnet, supprimerTemporaire } from "./carnet-pdf/exporter.mjs";

export default async (requete) => {
  let client, travailId, cheminTemporaire;
  try {
    const autorisation=requete.headers.get("authorization") || "";
    const corps=await requete.json();
    travailId=corps.travail_id;
    const projets={
      "https://cgxnrgkalhfyfkpesshq.supabase.co":"sb_publishable_fbZPyz9G6UIBWwU00phJig_fQegJUl9",
      "https://ozjbkpgoatagqyrlxdry.supabase.co":"sb_publishable_Jz82ewEk0V8Qdq-6jRSXQg_WMxjVo5h"
    };
    const clePublique=projets[corps.supabase_url];
    if(!/^Bearer\s+\S+$/i.test(autorisation) || !travailId || !clePublique) return new Response(null,{status:400});
    client=createClient(corps.supabase_url,clePublique,{global:{headers:{Authorization:autorisation}},auth:{persistSession:false}});
    const lecture=await client.from("carnet_travaux").select("*, voyages(slug)").eq("id",travailId).single();
    if(lecture.error || !lecture.data) return new Response(null,{status:404});
    const modele=lecture.data.modele;
    const signalerEtape=async (etape)=>{
      const suivi=await client.from("carnet_travaux").update({
        statut:"en_cours",diagnostic:{etape},maj_le:new Date().toISOString()
      }).eq("id",travailId);
      if(suivi.error) console.error("suivi carnet:",suivi.error);
    };
    await client.from("carnet_travaux").update({statut:"en_cours",modele:{},diagnostic:{etape:"initialisation"},maj_le:new Date().toISOString()}).eq("id",travailId);
    const resultat=await exporterCarnet(modele,signalerEtape);
    cheminTemporaire=resultat.chemin;
    const chemin=`${lecture.data.voyage_id}/${lecture.data.membre_id}/${travailId}.pdf`;
    const depot=await client.storage.from("carnets").upload(chemin,await readFile(cheminTemporaire),{contentType:"application/pdf",upsert:true});
    if(depot.error) throw depot.error;
    await client.from("carnet_travaux").update({statut:"termine",chemin_pdf:chemin,diagnostic:resultat.diagnostic,modele:{},maj_le:new Date().toISOString()}).eq("id",travailId);
    return new Response(null,{status:204});
  } catch(erreur) {
    console.error("generer-carnet:",erreur);
    if(client && travailId) await client.from("carnet_travaux").update({statut:"erreur",erreur:String(erreur?.message || erreur).slice(0,500),diagnostic:{code:erreur?.code || "ECHEC_GENERATION"},modele:{},maj_le:new Date().toISOString()}).eq("id",travailId).catch(()=>{});
    return new Response(null,{status:500});
  } finally { await supprimerTemporaire(cheminTemporaire); }
};

export const config={background:true,path:"/.netlify/functions/generer-carnet"};
