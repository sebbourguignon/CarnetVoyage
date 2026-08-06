// Edge Function "generer-texte-ia" — propose un texte de carnet pour une
// journée, écrit par OpenAI à partir de la préparation explicitement
// enregistrée par le membre. Le programme initial (accroche, fil, lieux
// non confirmés, restaurants et pratique) n'est jamais lu par cette fonction.
// La proposition revient au navigateur sans aucune écriture en base.
//
// Cout : gpt-4o-mini, quelques centaines de tokens par appel (prompt +
// reponse courte), de l'ordre du centime d'euro. Cle API dans le secret
// OPENAI_API_KEY (jamais vue ni saisie par Claude, voir conversation du
// 2026-08-04 -- poser un secret est une action que l'utilisateur execute
// lui-meme).
//
// Consigne stricte au modele : ne jamais inventer d'horaire, de tarif,
// de duree ou un fait absent des donnees fournies -- meme regle que le
// reste du projet (CLAUDE.md, "jamais de donnee inventee"), rappelee
// explicitement dans le prompt.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (requete) => {
  if (requete.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { carnet_journee_id } = await requete.json();
    if (!carnet_journee_id) return jsonResponse({ error: "carnet_journee_id requis" }, 400);

    const authHeader = requete.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "authentification requise" }, 401);

    const cleOpenAI = Deno.env.get("OPENAI_API_KEY");
    if (!cleOpenAI) return jsonResponse({ error: "génération IA non configurée (clé OpenAI absente)" }, 501);

    // Client limité à l'utilisateur : les policies de la migration 0023
    // empêchent de lire la préparation d'un autre membre.
    const supabaseUtilisateur = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: erreurUser } = await supabaseUtilisateur.auth.getUser();
    if (erreurUser || !userData?.user) return jsonResponse({ error: "session invalide" }, 401);

    const { data: preparation, error: erreurPreparation } = await supabaseUtilisateur
      .from("carnet_journees")
      .select("id, notes_manuelles, temperature_reelle, journees(date, titre, rail1, rail2)")
      .eq("id", carnet_journee_id).maybeSingle();
    if (erreurPreparation || !preparation) return jsonResponse({ error: "préparation introuvable ou accès refusé" }, 404);

    const [faitsResultat, photosResultat] = await Promise.all([
      supabaseUtilisateur.from("carnet_faits_confirmes").select("libelle, ordre")
        .eq("carnet_journee_id", carnet_journee_id).order("ordre"),
      supabaseUtilisateur.from("carnet_photos_selectionnees")
        .select("legende_carnet, ordre, photos(legende)")
        .eq("carnet_journee_id", carnet_journee_id).order("ordre"),
    ]);
    if (faitsResultat.error || photosResultat.error) return jsonResponse({ error: "préparation incomplète ou inaccessible" }, 403);

    const j = Array.isArray(preparation.journees) ? preparation.journees[0] : preparation.journees;
    const faitLabels = (faitsResultat.data || []).map((f: { libelle: string }) => String(f.libelle || "").trim()).filter(Boolean);
    const legendes = (photosResultat.data || []).map((p: { legende_carnet?: string; photos?: { legende?: string } | { legende?: string }[] }) => {
      const photo = Array.isArray(p.photos) ? p.photos[0] : p.photos;
      return String(p.legende_carnet || photo?.legende || "").trim();
    }).filter(Boolean);
    const donneesConfirmees = [
      `Date : ${j?.date || ""}`,
      `Titre ou itinéraire : ${String(j?.titre || "").replace(/<[^>]+>/g, "")}`,
      j?.rail1 ? `Distance : ${j.rail1}` : "",
      j?.rail2 ? `Durée : ${j.rail2}` : "",
      preparation.temperature_reelle != null ? `Température réelle : ${preparation.temperature_reelle} °C` : "",
      faitLabels.length ? `Faits confirmés : ${faitLabels.join(" ; ")}` : "",
      legendes.length ? `Légendes et commentaires des photos sélectionnées : ${legendes.join(" ; ")}` : "",
      preparation.notes_manuelles ? `Notes manuelles : ${preparation.notes_manuelles}` : "",
    ].filter(Boolean).join("\n");
    if (!faitLabels.length && !legendes.length && !preparation.notes_manuelles) {
      return jsonResponse({ error: "confirmez au moins un fait, une légende ou une note avant de composer le récit" }, 422);
    }

    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: "Compose un récit familial de carnet de voyage de 500 à 800 caractères à partir des seuls faits confirmés. " +
          "N’invente aucun lieu, événement ou activité. Évite l’énumération. Utilise un ton naturel, chaleureux et au passé. " +
          "Ne transforme jamais une absence d’information en fait. Réponds uniquement avec le récit, sans titre ni guillemets.",
      },
      { role: "user", content: donneesConfirmees },
    ];

    let texte = "";
    for (let tentative = 0; tentative < 2; tentative++) {
      const reponseOpenAI = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${cleOpenAI}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.6, max_tokens: 450, messages }),
      });
      if (!reponseOpenAI.ok) {
        const detail = await reponseOpenAI.text();
        console.error("generer-texte-ia: échec OpenAI", reponseOpenAI.status, detail);
        return jsonResponse({ error: "le service de génération est momentanément indisponible" }, 502);
      }
      const donnees = await reponseOpenAI.json();
      texte = donnees?.choices?.[0]?.message?.content?.trim() || "";
      if (texte.length >= 500 && texte.length <= 800) break;
      console.warn("generer-texte-ia: nouvelle tentative après longueur hors cible", texte.length);
      messages.push({
        role: "user",
        content: `Réécris le récit entre 500 et 800 caractères exactement. La proposition précédente faisait ${texte.length} caractères.`,
      });
    }
    if (!texte) return jsonResponse({ error: "réponse vide du service de génération" }, 502);
    // Une variation résiduelle de longueur ne doit pas faire planter l’interface :
    // le texte reste un brouillon modifiable et soumis à validation humaine.
    if (texte.length < 500 || texte.length > 800) console.warn("generer-texte-ia: brouillon hors cible accepté", texte.length);

    return jsonResponse({ texte, source: "ai", validated: false });
  } catch (e) {
    console.error("generer-texte-ia:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "erreur inattendue" }, 500);
  }
});
