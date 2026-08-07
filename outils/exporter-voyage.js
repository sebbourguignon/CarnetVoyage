#!/usr/bin/env node
/* ==========================================================================
   exporter-voyage.js — relit un voyage depuis Supabase et réécrit son JSON.

   Usage :
     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node outils/exporter-voyage.js salo2026

   À lancer après toute édition ciblée faite directement en base, pour que
   voyages/<slug>.json reste le miroir exact de ce qui est publié — jamais
   périmé. Écrase le fichier existant sans confirmation : c'est voulu, la
   base est la source de vérité une fois le voyage publié.

   Aucune dépendance npm, module natif `https` (voir publier-voyage.js pour
   le pourquoi).
   ========================================================================== */

import fs from "fs";
import path from "path";
import https from "https";
import { URL, fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function echouer(message) {
  console.error("\nERREUR — " + message);
  process.exit(1);
}

const slug = process.argv[2];
if (!slug) {
  echouer("usage : node outils/exporter-voyage.js <slug-du-voyage>");
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  echouer("variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises.");
}

const REST = SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1";

function requeteHttps(url, options) {
  return new Promise((resolve, reject) => {
    const requete = https.request(url, options, (reponse) => {
      let donneesRecues = "";
      reponse.setEncoding("utf8");
      reponse.on("data", (morceau) => { donneesRecues += morceau; });
      reponse.on("end", () => resolve({ statut: reponse.statusCode, corps: donneesRecues }));
    });
    requete.on("error", reject);
    requete.end();
  });
}

async function get(chemin) {
  const url = new URL(REST + chemin);
  const reponse = await requeteHttps(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
    },
  });
  if (reponse.statut < 200 || reponse.statut >= 300) {
    throw new Error("GET " + chemin + " a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }
  try {
    return JSON.parse(reponse.corps);
  } catch (e) {
    throw new Error("réponse non-JSON pour " + chemin + " : " + reponse.corps);
  }
}

// Retire les colonnes internes qui n'ont pas leur place dans le JSON source
// (id, timestamps, clés étrangères) — le JSON reste le format d'entrée de
// publier-voyage.js, pas un dump brut de la base.
function nettoyer(ligne, champsARetirer) {
  const copie = Object.assign({}, ligne);
  champsARetirer.forEach((c) => delete copie[c]);
  return copie;
}

async function main() {
  console.log("Export du voyage « " + slug + " » depuis " + SUPABASE_URL);

  const voyages = await get("/voyages?slug=eq." + encodeURIComponent(slug));
  if (!voyages.length) {
    echouer("aucun voyage trouvé pour le slug « " + slug + " ».");
  }
  const voyage = voyages[0];

  const journees = await get(
    "/journees?voyage_id=eq." + voyage.id + "&order=ordre.asc"
  );

  let totalObs = 0, totalQuiz = 0, totalLieux = 0;

  for (const j of journees) {
    const [observations, quizQuestions, lieux] = await Promise.all([
      get("/observations?journee_id=eq." + j.id + "&order=ordre.asc"),
      get("/quiz_questions?journee_id=eq." + j.id + "&order=ordre.asc"),
      get("/lieux?journee_id=eq." + j.id + "&order=ordre.asc"),
    ]);
    // reponse_correcte vit dans quiz_reponses (réservée admin par RLS, voir
    // migration 0008), pas dans quiz_questions — on la rejoint ici à la main
    // avant que nettoyer() ne retire les id dont on a encore besoin.
    let reponsesParQuestionId = {};
    if (quizQuestions.length) {
      const ids = quizQuestions.map((q) => q.id).join(",");
      const reponses = await get("/quiz_reponses?question_id=in.(" + ids + ")");
      reponses.forEach((r) => { reponsesParQuestionId[r.question_id] = r.reponse_correcte; });
    }
    j.observations = observations.map((o) => nettoyer(o, ["id", "journee_id"]));
    j.quiz_questions = quizQuestions.map((q) =>
      Object.assign(nettoyer(q, ["id", "journee_id"]), { reponse_correcte: reponsesParQuestionId[q.id] })
    );
    j.lieux = lieux.map((l) => nettoyer(l, ["id", "journee_id"]));
    totalObs += observations.length;
    totalQuiz += quizQuestions.length;
    totalLieux += lieux.length;

    delete j.id;
    delete j.voyage_id;
  }

  const badgesBruts = await get(
    "/badges?voyage_id=eq." + voyage.id + "&order=ordre.asc"
  );

  // Reconstitue conditions_brutes {jour, ou} à partir de badge_conditions,
  // en repassant par les observations déjà chargées ci-dessus (évite une
  // requête supplémentaire par badge).
  const observationIdVersRef = {};
  journees.forEach((j) => {
    // j.observations a déjà perdu son id — on le récupère via une requête
    // séparée pour cette table de correspondance uniquement.
  });
  // Requête dédiée : id d'observation -> {ancre journée, ou}, nécessaire
  // pour résoudre badge_conditions sans avoir gardé les id plus haut.
  const observationsAvecJournee = await get(
    "/observations?select=id,ou,journee_id,journees(ancre)&journees.voyage_id=eq." + voyage.id
  );
  observationsAvecJournee.forEach((o) => {
    if (o.journees) {
      observationIdVersRef[o.id] = { jour: o.journees.ancre, ou: o.ou };
    }
  });

  let totalConditions = 0;
  for (const b of badgesBruts) {
    const conditions = await get("/badge_conditions?badge_id=eq." + b.id);
    if (conditions.length) {
      b.conditions_brutes = conditions
        .map((c) => observationIdVersRef[c.observation_id])
        .filter(Boolean);
      totalConditions += conditions.length;
    }
    delete b.id;
    delete b.voyage_id;
  }

  const sortie = {
    voyage: nettoyer(voyage, ["id", "cree_le"]),
    journees,
    badges: badgesBruts,
  };

  const cheminSortie = path.resolve(__dirname, "..", "voyages", slug + ".json");
  fs.writeFileSync(cheminSortie, JSON.stringify(sortie, null, 2) + "\n");

  console.log("Écrit : " + cheminSortie);
  console.log(
    "Résumé — journées : " + journees.length +
    " · observations : " + totalObs +
    " · quiz_questions : " + totalQuiz +
    " · lieux : " + totalLieux +
    " · badges : " + badgesBruts.length +
    " · badge_conditions : " + totalConditions
  );
}

main().catch((e) => {
  echouer("erreur inattendue : " + (e && e.stack ? e.stack : e));
});
