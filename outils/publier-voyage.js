#!/usr/bin/env node
/* ==========================================================================
   publier-voyage.js — insère un fichier JSON de voyage dans Supabase.

   Usage :
     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node outils/publier-voyage.js voyages/salo2026.json

   Aucune dépendance npm : les requêtes HTTP passent par le module natif
   `https`, pas par `fetch` (indisponible avant Node 18, et ce script doit
   tourner tel quel sur le Node déjà installé sur cette machine).

   Ordre d'insertion (respecte les clés étrangères) :
     voyages → journees → observations → quiz_questions → lieux
     → badges → badge_conditions (résolues après coup, une fois les
     observations en base et leurs UUID connus)

   En cas d'échec à une étape, le script s'arrête immédiatement avec un
   message clair et un exit code 1. Il ne tente aucun rattrapage : l'état
   partiel en base est signalé, pas caché.
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const { URL } = require("url");

function echouer(message) {
  console.error("\nERREUR — " + message);
  console.error("Arrêt du script. L'état de la base peut être partiellement rempli — vérifier avant de relancer.");
  process.exit(1);
}

// --- arguments et variables d'environnement -------------------------------
const cheminJson = process.argv[2];
if (!cheminJson) {
  echouer("usage : node outils/publier-voyage.js <chemin-du-json-voyage>");
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  echouer("variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises.");
}

let donnees;
try {
  donnees = JSON.parse(fs.readFileSync(path.resolve(cheminJson), "utf8"));
} catch (e) {
  echouer("lecture/parsing de " + cheminJson + " impossible : " + e.message);
}

const REST = SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1";

// --- requête HTTPS brute (module natif `https`, pas de fetch) -------------
// Node 11 n'a pas fetch global ; on construit la requête POST à la main,
// headers Supabase compris, et on parse la réponse JSON nous-mêmes.
function requeteHttps(url, options, corpsTexte) {
  return new Promise((resolve, reject) => {
    const requete = https.request(url, options, (reponse) => {
      let donneesRecues = "";
      reponse.setEncoding("utf8");
      reponse.on("data", (morceau) => { donneesRecues += morceau; });
      reponse.on("end", () => {
        resolve({ statut: reponse.statusCode, corps: donneesRecues });
      });
    });
    requete.on("error", reject);
    if (corpsTexte) requete.write(corpsTexte);
    requete.end();
  });
}

// --- appel générique à l'API REST Supabase --------------------------------
async function post(table, corps, options) {
  const unique = (options && options.unique) || false;
  const corpsTexte = JSON.stringify(corps);
  const url = new URL(REST + "/" + table);

  const reponse = await requeteHttps(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(corpsTexte),
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
      Prefer: "return=representation",
    },
  }, corpsTexte);

  const texte = reponse.corps;
  if (reponse.statut < 200 || reponse.statut >= 300) {
    throw new Error(
      "POST " + table + " a échoué (HTTP " + reponse.statut + ") : " + texte
    );
  }

  let json;
  try {
    json = texte ? JSON.parse(texte) : [];
  } catch (e) {
    throw new Error("réponse non-JSON de " + table + " : " + texte);
  }

  if (unique) {
    if (!Array.isArray(json) || json.length !== 1) {
      throw new Error("réponse inattendue pour " + table + " (une seule ligne attendue) : " + texte);
    }
    return json[0];
  }
  return json;
}

// --- programme principal ---------------------------------------------------
async function main() {
  console.log("Publication de " + cheminJson + " vers " + SUPABASE_URL);

  // 1) voyage ----------------------------------------------------------------
  let voyage;
  try {
    voyage = await post("voyages", donnees.voyage, { unique: true });
  } catch (e) {
    echouer("insertion du voyage : " + e.message);
  }
  console.log("Voyage inséré : " + voyage.slug + " (id " + voyage.id + ")");

  // 2) journees ----------------------------------------------------------------
  const ancreVersJourneeId = {};
  let compteJournees = 0;
  let compteObservations = 0;
  let compteQuiz = 0;
  let compteLieux = 0;

  // index { ancre + "||" + ou } -> id observation, pour résoudre les
  // badge_conditions plus tard sans requête supplémentaire.
  const observationParAncreEtOu = {};

  for (const j of donnees.journees) {
    const corpsJournee = Object.assign({}, j, { voyage_id: voyage.id });
    delete corpsJournee.observations;
    delete corpsJournee.quiz_questions;
    delete corpsJournee.lieux;

    let ligneJournee;
    try {
      ligneJournee = await post("journees", corpsJournee, { unique: true });
    } catch (e) {
      echouer("insertion de la journée " + j.ancre + " : " + e.message);
    }
    ancreVersJourneeId[j.ancre] = ligneJournee.id;
    compteJournees++;

    // observations
    if (j.observations && j.observations.length) {
      const corpsObs = j.observations.map((o) =>
        Object.assign({}, o, { journee_id: ligneJournee.id })
      );
      let lignesObs;
      try {
        lignesObs = await post("observations", corpsObs);
      } catch (e) {
        echouer("insertion des observations de " + j.ancre + " : " + e.message);
      }
      lignesObs.forEach((o) => {
        observationParAncreEtOu[j.ancre + "||" + o.ou] = o.id;
      });
      compteObservations += lignesObs.length;
    }

    // quiz_questions
    if (j.quiz_questions && j.quiz_questions.length) {
      const corpsQuiz = j.quiz_questions.map((q) =>
        Object.assign({}, q, { journee_id: ligneJournee.id })
      );
      let lignesQuiz;
      try {
        lignesQuiz = await post("quiz_questions", corpsQuiz);
      } catch (e) {
        echouer("insertion du quiz de " + j.ancre + " : " + e.message);
      }
      compteQuiz += lignesQuiz.length;
    }

    // lieux
    if (j.lieux && j.lieux.length) {
      const corpsLieux = j.lieux.map((l) =>
        Object.assign({}, l, { journee_id: ligneJournee.id })
      );
      let lignesLieux;
      try {
        lignesLieux = await post("lieux", corpsLieux);
      } catch (e) {
        echouer("insertion des lieux de " + j.ancre + " : " + e.message);
      }
      compteLieux += lignesLieux.length;
    }

    console.log(
      "  journée " + j.ancre + " — " +
      (j.observations || []).length + " observations, " +
      (j.quiz_questions || []).length + " questions, " +
      (j.lieux || []).length + " lieux"
    );
  }

  console.log(
    "Journées insérées : " + compteJournees +
    " (observations : " + compteObservations +
    ", quiz : " + compteQuiz +
    ", lieux : " + compteLieux + ")"
  );

  // 3) badges ----------------------------------------------------------------
  let compteBadges = 0;
  let compteBadgeConditions = 0;
  const badgesAConditionsBrutes = [];

  for (const b of donnees.badges) {
    const corpsBadge = {
      nom: b.nom,
      resume: b.resume,
      icone: b.icone,
      seuil_niveau3: b.seuil_niveau3,
      seuil_total: b.seuil_total,
      seuil_journees_corrigees: b.seuil_journees_corrigees,
      seuil_points_quiz: b.seuil_points_quiz,
      ordre: b.ordre,
      voyage_id: voyage.id,
    };
    let ligneBadge;
    try {
      ligneBadge = await post("badges", corpsBadge, { unique: true });
    } catch (e) {
      echouer("insertion du badge « " + b.nom + " » : " + e.message);
    }
    compteBadges++;

    if (b.conditions_brutes && b.conditions_brutes.length) {
      badgesAConditionsBrutes.push({ badgeId: ligneBadge.id, nom: b.nom, conditions: b.conditions_brutes });
    }
  }

  console.log("Badges insérés : " + compteBadges);

  // 4) badge_conditions — résolution {jour, ou} -> observation_id ------------
  for (const entree of badgesAConditionsBrutes) {
    const corpsConditions = [];
    for (const c of entree.conditions) {
      const clef = c.jour + "||" + c.ou;
      const observationId = observationParAncreEtOu[clef];
      if (!observationId) {
        echouer(
          "badge « " + entree.nom + "» : impossible de résoudre la condition {jour: " +
          c.jour + ", ou: " + JSON.stringify(c.ou) + "} — aucune observation correspondante en base."
        );
      }
      corpsConditions.push({ badge_id: entree.badgeId, observation_id: observationId });
    }
    if (corpsConditions.length) {
      try {
        const lignes = await post("badge_conditions", corpsConditions);
        compteBadgeConditions += lignes.length;
      } catch (e) {
        echouer("insertion des badge_conditions du badge « " + entree.nom + " » : " + e.message);
      }
    }
  }

  console.log("Badge_conditions insérées : " + compteBadgeConditions);

  console.log("\nPublication terminée avec succès.");
  console.log(
    "Résumé — journées : " + compteJournees +
    " · observations : " + compteObservations +
    " · quiz_questions : " + compteQuiz +
    " · lieux : " + compteLieux +
    " · badges : " + compteBadges +
    " · badge_conditions : " + compteBadgeConditions
  );
}

main().catch((e) => {
  echouer("erreur inattendue : " + (e && e.stack ? e.stack : e));
});
