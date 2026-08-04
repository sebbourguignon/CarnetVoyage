// Edge Function "generer-texte-ia" — propose un texte de carnet pour une
// journee, ecrit par un LLM (OpenAI gpt-4o-mini) a partir des donnees deja
// en base (titre, accroche, lieux, fil), en alternative au paragraphe
// assemble par gabarit (texteAutoJournee, voir app/index.html et
// generer-carnet). Jamais applique automatiquement : le texte revient au
// client, qui le pose dans la zone de texte modifiable -- l'utilisateur
// choisit de le garder, de le modifier ou de l'ignorer (voir
// construireTexteCarnetJour).
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
    const { voyage_id, journee_id, texte_actuel } = await requete.json();
    if (!voyage_id || !journee_id) {
      return jsonResponse({ error: "voyage_id et journee_id requis" }, 400);
    }
    const texteActuel = typeof texte_actuel === "string" ? texte_actuel.trim() : "";

    const authHeader = requete.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "authentification requise" }, 401);

    const cleOpenAI = Deno.env.get("OPENAI_API_KEY");
    if (!cleOpenAI) return jsonResponse({ error: "génération IA non configurée (clé OpenAI absente)" }, 501);

    // Client scope a l'utilisateur : le RLS (migration 0005) verifie deja
    // qu'il est membre du voyage avant de lui laisser lire la journee.
    const supabaseUtilisateur = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: erreurUser } = await supabaseUtilisateur.auth.getUser();
    if (erreurUser || !userData?.user) return jsonResponse({ error: "session invalide" }, 401);

    const { data: j, error: erreurJournee } = await supabaseUtilisateur
      .from("journees")
      .select("titre, accroche, rail1, fil, lieux(nom, ordre)")
      .eq("id", journee_id).eq("voyage_id", voyage_id).maybeSingle();
    if (erreurJournee || !j) return jsonResponse({ error: "journée introuvable ou accès refusé" }, 404);

    const titre = String(j.titre || "").replace(/<[^>]+>/g, "");
    const accroche = j.accroche ? String(j.accroche).replace(/<[^>]+>/g, "") : "";
    const lieux = (j.lieux || []).slice().sort((a: { ordre: number }, b: { ordre: number }) => a.ordre - b.ordre)
      .map((l: { nom: string }) => l.nom).filter(Boolean);
    const filTexte = (j.fil || []).map((f: { texte: string }) => String(f.texte || "").replace(/<[^>]+>/g, "")).join(" ");

    const faits = [
      `Titre de la journée : ${titre}`,
      j.rail1 ? `Distance/durée : ${j.rail1}` : "",
      accroche ? `Intention de la journée : ${accroche}` : "",
      lieux.length ? `Lieux visités : ${lieux.join(", ")}` : "",
      filTexte ? `Déroulé prévu : ${filTexte}` : "",
    ].filter(Boolean).join("\n");

    // Deux modes (voir conversation de conception) : "amelioration" d'un
    // texte deja saisi a la main (le cas courant — l'utilisateur veut
    // garder ses propres mots/souvenirs, juste les rendre plus fluides),
    // ou generation depuis zero si le champ est vide/encore sur le texte
    // automatique. Dans les deux cas, les faits verifies servent de garde-
    // fou : jamais de fait ajoute qui n'y figure pas, mais le texte saisi
    // par la famille (souvenirs, anecdotes) n'est lui jamais retire ou
    // remis en cause — seule sa formulation peut changer.
    const messages = texteActuel
      ? [
          {
            role: "system",
            content: "Tu améliores un court paragraphe déjà écrit par une famille pour son carnet de voyage papier " +
              "(clarté, fluidité, ton chaleureux à la première personne du pluriel \"nous\"), sans changer son sens " +
              "ni retirer les souvenirs ou détails personnels qu'il contient. Des informations de référence sur la " +
              "journée sont fournies pour t'aider à clarifier ou enrichir la formulation — règle absolue : n'ajoute " +
              "aucun fait, horaire, tarif ou détail qui ne figure ni dans le texte original ni dans ces informations " +
              "de référence. Réponds uniquement avec le paragraphe amélioré, sans titre ni guillemets, longueur " +
              "similaire au texte d'origine.",
          },
          { role: "user", content: `Informations de référence sur la journée :\n${faits}\n\nTexte à améliorer :\n${texteActuel}` },
        ]
      : [
          {
            role: "system",
            content: "Tu écris un court paragraphe (80 à 120 mots) pour le carnet de voyage papier d'une famille. " +
              "Ton chaleureux et simple, à la première personne du pluriel (\"nous\"), sans emphase touristique. " +
              "Règle absolue : n'invente aucun fait, horaire, tarif ou détail qui n'est pas dans les informations " +
              "fournies ci-dessous — tu peux reformuler et relier ces informations entre elles, jamais en ajouter. " +
              "Réponds uniquement avec le paragraphe, sans titre ni guillemets.",
          },
          { role: "user", content: faits },
        ];

    const reponseOpenAI = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${cleOpenAI}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.7, max_tokens: 260, messages }),
    });

    if (!reponseOpenAI.ok) {
      const detail = await reponseOpenAI.text();
      console.error("generer-texte-ia: échec OpenAI", reponseOpenAI.status, detail);
      return jsonResponse({ error: "le service de génération est momentanément indisponible" }, 502);
    }
    const donnees = await reponseOpenAI.json();
    const texte = donnees?.choices?.[0]?.message?.content?.trim();
    if (!texte) return jsonResponse({ error: "réponse vide du service de génération" }, 502);

    return jsonResponse({ texte });
  } catch (e) {
    console.error("generer-texte-ia:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "erreur inattendue" }, 500);
  }
});
