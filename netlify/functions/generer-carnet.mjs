import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { exporterCarnet, supprimerTemporaire } from "./carnet-pdf/exporter.mjs";
import { preparerVariantesPersistantes } from "./carnet-pdf/variantes.mjs";

export default async (requete) => {
  let client, travailId, cheminTemporaire;const debutTotal=performance.now(),profilFonction={};
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
    const debutLecture=performance.now(),lecture=await client.from("carnet_travaux").select("*, voyages(slug)").eq("id",travailId).single();profilFonction.chargement_donnees_ms=Math.round(performance.now()-debutLecture);
    if(lecture.error || !lecture.data) return new Response(null,{status:404});
    const modele=lecture.data.modele;modele.membreId=lecture.data.membre_id;
    const signalerEtape=async (etape)=>{
      const suivi=await client.from("carnet_travaux").update({
        statut:"en_cours",diagnostic:{etape},maj_le:new Date().toISOString()
      }).eq("id",travailId);
      if(suivi.error) console.error("suivi carnet:",suivi.error);
    };
    await client.from("carnet_travaux").update({statut:"en_cours",modele:{},diagnostic:{etape:"initialisation"},maj_le:new Date().toISOString()}).eq("id",travailId);
    const debutVariantes=performance.now(),profilVariantes=await preparerVariantesPersistantes(client,modele,signalerEtape);profilFonction.variantes_persistantes_ms=Math.round(performance.now()-debutVariantes);
    const resultat=await exporterCarnet(modele,signalerEtape);resultat.diagnostic.profil_variantes=profilVariantes;
    cheminTemporaire=resultat.chemin;
    const chemin=`${lecture.data.voyage_id}/${lecture.data.membre_id}/${travailId}.pdf`;
    const debutTransfert=performance.now(),depot=await client.storage.from("carnets").upload(chemin,await readFile(cheminTemporaire),{contentType:"application/pdf",upsert:true});profilFonction.transfert_pdf_ms=Math.round(performance.now()-debutTransfert);
    if(depot.error) throw depot.error;
    resultat.diagnostic.profil_fonction=profilFonction;profilFonction.temps_total_ms=Math.round(performance.now()-debutTotal);
    await client.from("carnet_travaux").update({statut:"termine",chemin_pdf:chemin,diagnostic:resultat.diagnostic,modele:{},maj_le:new Date().toISOString()}).eq("id",travailId);
    return new Response(null,{status:204});
  } catch(erreur) {
    console.error("generer-carnet:",erreur);
    if(client && travailId) {
      try {
        const suivi=await client.from("carnet_travaux").update({statut:"erreur",erreur:String(erreur?.message || erreur).slice(0,500),diagnostic:{code:erreur?.code || "ECHEC_GENERATION"},modele:{},maj_le:new Date().toISOString()}).eq("id",travailId);
        if(suivi.error) console.error("suivi erreur carnet:",suivi.error);
      } catch(erreurSuivi) { console.error("suivi erreur carnet:",erreurSuivi); }
    }
    return new Response(null,{status:500});
  } finally { await supprimerTemporaire(cheminTemporaire); }
};

export const config={background:true,path:"/.netlify/functions/generer-carnet"};
