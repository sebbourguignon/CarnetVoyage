import { createClient } from "npm:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
function reponse(corps:unknown,statut=200){return new Response(JSON.stringify(corps),{status:statut,headers:{...CORS,"Content-Type":"application/json"}});}
function texte(v:unknown,max=1200){return String(v??"").replace(/\s+/g," ").trim().slice(0,max);}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  try{
    const auth=req.headers.get("Authorization");if(!auth)return reponse({error:"authentification requise"},401);
    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
    const utilisateur=await client.auth.getUser();if(utilisateur.error||!utilisateur.data.user)return reponse({error:"session invalide"},401);
    const body=await req.json();
    const faits=Array.isArray(body.faits_confirmes)?body.faits_confirmes.slice(0,30).map((x:unknown)=>texte(x,160)).filter(Boolean):[];
    const moments=Array.isArray(body.moments_forts)?body.moments_forts.slice(0,5).map((x:unknown)=>texte(x,160)).filter(Boolean):[];
    const photos=Array.isArray(body.photos_selectionnees)?body.photos_selectionnees.slice(0,10).map((p:{legende?:unknown;commentaire?:unknown})=>({legende:texte(p?.legende,300),commentaire:texte(p?.commentaire,300)})).filter((p:{legende:string;commentaire:string})=>p.legende||p.commentaire):[];
    const notes=texte(body.notes_personnelles,2000);
    if(!faits.length&&!notes&&!photos.length)return reponse({error:"Confirmez une activité, ajoutez une note ou légendez une photo pour composer le récit."},422);
    const donnees=[`Date : ${texte(body.date,40)}`,`Titre ou itinéraire : ${texte(body.titre_itineraire,300)}`,
      body.distance?`Distance : ${texte(body.distance,80)}`:"",body.duree?`Durée : ${texte(body.duree,80)}`:"",
      body.temperature_reelle!=null?`Température réelle : ${texte(body.temperature_reelle,20)} °C`:"",
      faits.length?`Faits confirmés : ${faits.join(" ; ")}`:"",moments.length?`Moments forts choisis : ${moments.join(" ; ")}`:"",
      photos.length?`Photos légendées : ${photos.map((p:{legende:string;commentaire:string})=>[p.legende,p.commentaire].filter(Boolean).join(" — ")).join(" ; ")}`:"",
      notes?`Notes personnelles : ${notes}`:""].filter(Boolean).join("\n");
    const messages:Array<{role:string;content:string}>=[{role:"system",content:"Compose un récit familial de carnet de voyage de 500 à 800 caractères à partir des seuls faits confirmés, photos légendées et notes personnelles. N’invente aucun lieu, événement ou activité. Évite l’énumération. Utilise un ton naturel, chaleureux et au passé. Réponds uniquement avec le récit, sans titre ni guillemets."},{role:"user",content:donnees}];
    const cle=Deno.env.get("OPENAI_API_KEY");if(!cle)return reponse({error:"génération IA non configurée"},501);
    let resultat="";
    for(let i=0;i<2;i++){
      const appel=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${cle}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",temperature:.6,max_tokens:450,messages})});
      if(!appel.ok){console.error("OpenAI",appel.status,await appel.text());return reponse({error:"Le service de génération est momentanément indisponible."},502);}
      const json=await appel.json();resultat=json?.choices?.[0]?.message?.content?.trim()||"";if(resultat.length>=500&&resultat.length<=800)break;
      messages.push({role:"user",content:`Réécris entre 500 et 800 caractères exactement. Le texte précédent faisait ${resultat.length} caractères.`});
    }
    if(!resultat)return reponse({error:"Réponse vide du service de génération."},502);
    return reponse({texte:resultat,source:"ai"});
  }catch(e){console.error(e);return reponse({error:e instanceof Error?e.message:"erreur inattendue"},500);}
});
