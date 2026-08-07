import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { exporterCarnet, supprimerTemporaire } from "./carnet-pdf/exporter.mjs";
import { preparerVariantesPersistantes } from "./carnet-pdf/variantes.mjs";
import {CARNET_BUILD_SHA} from "./carnet-pdf/build.generated.mjs";

const VERSION_FONCTION="carnet-pdf-v4";
const BUILD_SHA=CARNET_BUILD_SHA;
export function filtrerModeleTermine(modele,statuts,agenda){const pretes=new Set((statuts||[]).filter(x=>x.carnet_terminee===true).map(x=>x.journee_id)),joursRecus=modele.journees||[],includedDayIds=joursRecus.filter(j=>pretes.has(j.id)).map(j=>j.id),excludedDayIds=(agenda||[]).map(j=>j.id).filter(id=>!pretes.has(id));modele.journees=joursRecus.filter(j=>pretes.has(j.id)).map(j=>({...j,carnetTerminee:true}));modele.statistiques={journeesIllustrees:modele.journees.filter(j=>(j.photos||[]).length).length,photos:modele.journees.reduce((n,j)=>n+(j.photos||[]).length,0)};return{includedDayIds,excludedDayIds};}

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
    const debutStatuts=performance.now();
    const [statuts,agenda]=await Promise.all([
      client.from("carnet_journees").select("journee_id,carnet_terminee").eq("voyage_id",lecture.data.voyage_id).eq("membre_id",lecture.data.membre_id),
      client.from("journees").select("id").eq("voyage_id",lecture.data.voyage_id)
    ]);
    if(statuts.error)throw statuts.error;if(agenda.error)throw agenda.error;
    const {includedDayIds,excludedDayIds}=filtrerModeleTermine(modele,statuts.data,agenda.data);
    if(!modele.journees.length)throw Object.assign(new Error("Aucune journée terminée à inclure."),{code:"AUCUN_CONTENU"});
    modele.generateur={buildSha:BUILD_SHA,functionVersion:VERSION_FONCTION,clientVersion:modele.clientBuild||"inconnue"};
    profilFonction.filtrage_statuts_ms=Math.round(performance.now()-debutStatuts);
    const diagnosticFiltrage={totalAgendaDays:(agenda.data||[]).length,includedDayIds,excludedDayIds,includedDayStatuses:includedDayIds.map(id=>({id,carnet_terminee:true})),includedPhotos:modele.statistiques.photos,includedPagesExpected:2+modele.journees.length+modele.journees.filter(j=>(j.photos||[]).length>=5).length,buildSha:BUILD_SHA,functionVersion:VERSION_FONCTION,clientVersion:modele.clientBuild||"inconnue"};
    console.log("carnet-pdf filtrage",JSON.stringify(diagnosticFiltrage));
    const signalerEtape=async (etape)=>{
      const suivi=await client.from("carnet_travaux").update({
        statut:"en_cours",diagnostic:{etape},maj_le:new Date().toISOString()
      }).eq("id",travailId);
      if(suivi.error) console.error("suivi carnet:",suivi.error);
    };
    await client.from("carnet_travaux").update({statut:"en_cours",modele:{},diagnostic:{etape:"initialisation"},maj_le:new Date().toISOString()}).eq("id",travailId);
    const debutVariantes=performance.now(),profilVariantes=await preparerVariantesPersistantes(client,modele,signalerEtape);profilFonction.variantes_persistantes_ms=Math.round(performance.now()-debutVariantes);
    const resultat=await exporterCarnet(modele,signalerEtape);resultat.diagnostic.profil_variantes=profilVariantes;Object.assign(resultat.diagnostic,diagnosticFiltrage);
    cheminTemporaire=resultat.chemin;
    const chemin=`${lecture.data.voyage_id}/${lecture.data.membre_id}/${travailId}.pdf`;
    const debutTransfert=performance.now(),depot=await client.storage.from("carnets").upload(chemin,await readFile(cheminTemporaire),{contentType:"application/pdf",upsert:true});profilFonction.transfert_pdf_ms=Math.round(performance.now()-debutTransfert);
    if(depot.error) throw depot.error;
    resultat.diagnostic.profil_fonction=profilFonction;profilFonction.temps_total_ms=Math.round(performance.now()-debutTotal);
    await client.from("carnet_travaux").update({statut:"termine",chemin_pdf:chemin,diagnostic:resultat.diagnostic,modele:{},maj_le:new Date().toISOString()}).eq("id",travailId);
    return new Response(null,{status:204,headers:{"X-Carnet-Build":BUILD_SHA,"X-Carnet-Function-Version":VERSION_FONCTION,"Server-Timing":`data;dur=${profilFonction.chargement_donnees_ms+profilFonction.filtrage_statuts_ms}, variants;dur=${profilFonction.variantes_persistantes_ms}, total;dur=${profilFonction.temps_total_ms}`}});
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
