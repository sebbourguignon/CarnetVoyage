#!/usr/bin/env node
/* ==========================================================================
   mettre-a-jour-voyage.js — resynchronise le contenu d'un voyage déjà
   publié avec un fichier JSON édité localement (voyages/<slug>.json).

   Usage :
     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node outils/mettre-a-jour-voyage.js voyages/salo2026.json

   Contrairement à publier-voyage.js (insertion initiale), ce script
   suppose que le voyage existe déjà en base et met à jour :
     - journees : champs scalaires/jsonb en place (UPDATE), jamais
       supprimées ni recréées — leur id est référencé par quiz_questions,
       qu'on ne touche jamais ici.
     - observations, lieux : remplacées entièrement par journée (DELETE
       puis INSERT), car ce sont de simples listes sans historique à
       préserver côté app.
     - badges : champs scalaires en place (UPDATE), badge_conditions
       remplacées entièrement (DELETE puis INSERT, résolues vers les
       nouvelles observations comme dans publier-voyage.js).

   Volontairement non touché : quiz_questions, quiz_reponses,
   progression, membres_famille, visites — l'authentification et la
   correction du quiz suivent un schéma propre à CarnetVoyage (comptes +
   RLS), différent du fichier autonome chiffré d'Italie2026, donc jamais
   resynchronisé depuis son contenu.

   Même politique d'arrêt que publier-voyage.js : au premier échec, le
   script s'arrête avec un message clair — pas de rattrapage silencieux.
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const { URL } = require("url");

function echouer(message) {
  console.error("\nERREUR — " + message);
  console.error("Arrêt du script. L'état de la base peut être partiellement mis à jour — vérifier avant de relancer.");
  process.exit(1);
}

const cheminJson = process.argv[2];
if (!cheminJson) {
  echouer("usage : node outils/mettre-a-jour-voyage.js <chemin-du-json-voyage>");
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

function requeteHttps(url, options, corpsTexte) {
  return new Promise((resolve, reject) => {
    const requete = https.request(url, options, (reponse) => {
      let donneesRecues = "";
      reponse.setEncoding("utf8");
      reponse.on("data", (morceau) => { donneesRecues += morceau; });
      reponse.on("end", () => resolve({ statut: reponse.statusCode, corps: donneesRecues }));
    });
    requete.on("error", reject);
    if (corpsTexte) requete.write(corpsTexte);
    requete.end();
  });
}

async function appel(methode, chemin, corps) {
  const corpsTexte = corps !== undefined ? JSON.stringify(corps) : undefined;
  const url = new URL(REST + chemin);
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
    Prefer: "return=representation",
  };
  if (corpsTexte) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(corpsTexte);
  }
  const reponse = await requeteHttps(url, { method: methode, headers }, corpsTexte);
  if (reponse.statut < 200 || reponse.statut >= 300) {
    throw new Error(methode + " " + chemin + " a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }
  try {
    return reponse.corps ? JSON.parse(reponse.corps) : [];
  } catch (e) {
    throw new Error("réponse non-JSON de " + chemin + " : " + reponse.corps);
  }
}

const get = (chemin) => appel("GET", chemin);
const patch = (chemin, corps) => appel("PATCH", chemin, corps);
const post = (chemin, corps) => appel("POST", chemin, corps);
const del = (chemin) => appel("DELETE", chemin);

async function main() {
  console.log("Mise à jour depuis " + cheminJson + " vers " + SUPABASE_URL);

  const voyages = await get("/voyages?slug=eq." + encodeURIComponent(donnees.voyage.slug) + "&select=id,slug");
  if (!voyages.length) {
    echouer("aucun voyage avec le slug « " + donnees.voyage.slug + " » — utiliser publier-voyage.js pour une première publication.");
  }
  const voyageId = voyages[0].id;
  console.log("Voyage trouvé : " + donnees.voyage.slug + " (id " + voyageId + ")");

  // 1) voyage — champs scalaires du niveau racine (hors thème, pas dans
  //    le périmètre d'un resync de contenu narratif). ------------------------
  // urgences.assuranceAuto ne va jamais dans voyages.urgences (lecture
  // publique sans restriction) : retirée ici, resynchronisée à part dans
  // urgences_famille (RLS réservée aux membres famille, migration 0015).
  const CHAMPS_VOYAGE = ["titre", "titre_suite", "sous_titre", "date_debut", "date_fin", "frise_legende", "a_verifier", "urgences"];
  const corpsVoyage = {};
  CHAMPS_VOYAGE.forEach((c) => { if (donnees.voyage[c] !== undefined) corpsVoyage[c] = donnees.voyage[c]; });
  const assuranceAuto = corpsVoyage.urgences && corpsVoyage.urgences.assuranceAuto;
  if (assuranceAuto) {
    corpsVoyage.urgences = Object.assign({}, corpsVoyage.urgences);
    delete corpsVoyage.urgences.assuranceAuto;
  }
  try {
    await patch("/voyages?id=eq." + voyageId, corpsVoyage);
  } catch (e) {
    echouer("mise à jour du voyage : " + e.message);
  }

  if (assuranceAuto) {
    // supprime puis réinsère (même idiome que observations/lieux plus bas) :
    // plus simple qu'un upsert pour une table à une ligne par voyage.
    try {
      await del("/urgences_famille?voyage_id=eq." + voyageId);
      await post("/urgences_famille", { voyage_id: voyageId, assurance_auto: assuranceAuto });
    } catch (e) {
      echouer("mise à jour de l'assurance auto (réservée famille) : " + e.message);
    }
    console.log("Assurance auto resynchronisée (urgences_famille, réservée aux comptes famille).");
  }

  // 2) journees ---------------------------------------------------------------
  const ancreVersJourneeId = {};
  const observationParAncreEtOu = {};
  let compteJournees = 0, compteObservations = 0, compteLieux = 0;

  const CHAMPS_JOURNEE = [
    "date", "rail1", "rail2", "categorie", "badge", "intensite", "star", "eclipse",
    "anniversaire", "titre", "accroche", "fil", "options_titre", "options", "notes",
    "chapitre", "ordre", "pratique", "carte", "illustration", "manger", "visibilite",
  ];

  for (const j of donnees.journees) {
    const lignesExistantes = await get(
      "/journees?voyage_id=eq." + voyageId + "&ancre=eq." + encodeURIComponent(j.ancre) + "&select=id"
    );
    if (!lignesExistantes.length) {
      echouer("journée " + j.ancre + " absente en base — pas gérée par ce script (créer via une migration de contenu dédiée, pas ici).");
    }
    const journeeId = lignesExistantes[0].id;
    ancreVersJourneeId[j.ancre] = journeeId;

    const corpsJournee = {};
    CHAMPS_JOURNEE.forEach((c) => { if (j[c] !== undefined) corpsJournee[c] = j[c]; });
    try {
      await patch("/journees?id=eq." + journeeId, corpsJournee);
    } catch (e) {
      echouer("mise à jour de la journée " + j.ancre + " : " + e.message);
    }
    compteJournees++;

    // observations : remplacées entièrement (le cascade sur badge_conditions
    // est voulu, elles sont reconstruites à l'étape 3).
    try {
      await del("/observations?journee_id=eq." + journeeId);
    } catch (e) {
      echouer("suppression des observations de " + j.ancre + " : " + e.message);
    }
    if (j.observations && j.observations.length) {
      const corpsObs = j.observations.map((o) => Object.assign({}, o, { journee_id: journeeId }));
      let lignesObs;
      try {
        lignesObs = await post("/observations", corpsObs);
      } catch (e) {
        echouer("insertion des observations de " + j.ancre + " : " + e.message);
      }
      lignesObs.forEach((o) => { observationParAncreEtOu[j.ancre + "||" + o.ou] = o.id; });
      compteObservations += lignesObs.length;
    }

    // lieux : remplacés entièrement, pas de dépendance en aval.
    try {
      await del("/lieux?journee_id=eq." + journeeId);
    } catch (e) {
      echouer("suppression des lieux de " + j.ancre + " : " + e.message);
    }
    if (j.lieux && j.lieux.length) {
      const corpsLieux = j.lieux.map((l) => Object.assign({}, l, { journee_id: journeeId }));
      let lignesLieux;
      try {
        lignesLieux = await post("/lieux", corpsLieux);
      } catch (e) {
        echouer("insertion des lieux de " + j.ancre + " : " + e.message);
      }
      compteLieux += lignesLieux.length;
    }

    console.log("  journée " + j.ancre + " — " + (j.observations || []).length + " observations, " + (j.lieux || []).length + " lieux");
  }

  console.log("Journées mises à jour : " + compteJournees + " (observations : " + compteObservations + ", lieux : " + compteLieux + ")");

  // 3) badges + badge_conditions ----------------------------------------------
  let compteBadges = 0, compteBadgeConditions = 0;
  const CHAMPS_BADGE = ["resume", "icone", "seuil_niveau3", "seuil_total", "seuil_journees_corrigees", "seuil_points_quiz", "ordre"];

  for (const b of donnees.badges) {
    const lignesExistantes = await get(
      "/badges?voyage_id=eq." + voyageId + "&nom=eq." + encodeURIComponent(b.nom) + "&select=id"
    );
    if (!lignesExistantes.length) {
      echouer("badge « " + b.nom + " » absent en base — pas géré par ce script (ajout de badge hors périmètre).");
    }
    const badgeId = lignesExistantes[0].id;

    const corpsBadge = {};
    CHAMPS_BADGE.forEach((c) => { if (b[c] !== undefined) corpsBadge[c] = b[c]; });
    try {
      await patch("/badges?id=eq." + badgeId, corpsBadge);
    } catch (e) {
      echouer("mise à jour du badge « " + b.nom + " » : " + e.message);
    }
    compteBadges++;

    try {
      await del("/badge_conditions?badge_id=eq." + badgeId);
    } catch (e) {
      echouer("suppression des conditions du badge « " + b.nom + " » : " + e.message);
    }
    if (b.conditions_brutes && b.conditions_brutes.length) {
      const corpsConditions = b.conditions_brutes.map((c) => {
        const observationId = observationParAncreEtOu[c.jour + "||" + c.ou];
        if (!observationId) {
          echouer(
            "badge « " + b.nom + " » : impossible de résoudre la condition {jour: " + c.jour +
            ", ou: " + JSON.stringify(c.ou) + "} — aucune observation correspondante en base."
          );
        }
        return { badge_id: badgeId, observation_id: observationId };
      });
      try {
        const lignes = await post("/badge_conditions", corpsConditions);
        compteBadgeConditions += lignes.length;
      } catch (e) {
        echouer("insertion des conditions du badge « " + b.nom + " » : " + e.message);
      }
    }
  }

  console.log("Badges mis à jour : " + compteBadges + " (badge_conditions : " + compteBadgeConditions + ")");
  console.log("\nMise à jour terminée avec succès.");
}

main().catch((e) => {
  echouer("erreur inattendue : " + (e && e.stack ? e.stack : e));
});
