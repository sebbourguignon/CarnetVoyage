#!/usr/bin/env node
/* ==========================================================================
   simuler-classement.js — crée deux faux membres avec une progression de
   chasse et de quiz fictive, pour tester le classement (podium) sans
   attendre que la vraie famille ait joué.

   Usage :
     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
       node outils/simuler-classement.js salo2026

   Crée (ou réutilise) deux comptes de test — "Léo (test)" et "Nina (test)",
   emails test-leo@… et test-nina@… — les rattache au voyage donné en tant
   que simples membres, puis leur fabrique une progression plausible :
   une partie des objectifs de chasse cochés (proportions différentes pour
   chacun, afin d'obtenir un vrai écart au classement) et un score de quiz
   déjà "corrigé". Rien de tout ça ne touche à ta propre progression.

   Jetable : à relancer autant de fois que nécessaire pendant qu'on met au
   point le classement, à supprimer une fois qu'on a de vrais joueurs.
   Voir outils/inviter-membre.js pour le mécanisme de création de compte
   (même approche, sans dépendance npm, module natif `https`).
   ========================================================================== */

"use strict";

const https = require("https");
const { URL } = require("url");

function echouer(message) {
  console.error("\nERREUR — " + message);
  process.exit(1);
}

const slug = process.argv[2];
if (!slug) {
  echouer("usage : node outils/simuler-classement.js <slug-du-voyage>");
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  echouer("variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises.");
}

const BASE = SUPABASE_URL.replace(/\/+$/, "");
const REST = BASE + "/rest/v1";

// Deux profils fictifs, avec des proportions de chasse et des scores de
// quiz différents pour que le podium ait un vrai relief (pas deux ex-aequo).
const FAUX_MEMBRES = [
  { email: "test-leo@carnetvoyage.invalid", prenom: "Léo (test)", proportionChasse: 0.75, proportionQuiz: 0.9 },
  { email: "test-nina@carnetvoyage.invalid", prenom: "Nina (test)", proportionChasse: 0.4, proportionQuiz: 0.6 },
];
const MOT_DE_PASSE_FICTIF = "mot-de-passe-jetable-simulation";

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

function headersAuth() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
  };
}

async function get(chemin) {
  const url = new URL(REST + chemin);
  const reponse = await requeteHttps(url, { method: "GET", headers: headersAuth() });
  if (reponse.statut < 200 || reponse.statut >= 300) {
    throw new Error("GET " + chemin + " a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }
  return reponse.corps ? JSON.parse(reponse.corps) : [];
}

async function creerOuTrouverUtilisateur(email) {
  const corps = JSON.stringify({ email, password: MOT_DE_PASSE_FICTIF, email_confirm: true });
  const url = new URL(BASE + "/auth/v1/admin/users");
  const reponse = await requeteHttps(url, {
    method: "POST",
    headers: Object.assign({}, headersAuth(), {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(corps),
    }),
  }, corps);

  const json = reponse.corps ? JSON.parse(reponse.corps) : {};
  if (reponse.statut >= 200 && reponse.statut < 300) {
    console.log("Compte créé : " + email + " (id " + json.id + ")");
    return json.id;
  }

  const dejaExistant = reponse.statut === 422 || reponse.statut === 400;
  if (!dejaExistant) {
    throw new Error("création du compte a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }
  const urlListe = new URL(BASE + "/auth/v1/admin/users?email=" + encodeURIComponent(email));
  const reponseListe = await requeteHttps(urlListe, { method: "GET", headers: headersAuth() });
  if (reponseListe.statut < 200 || reponseListe.statut >= 300) {
    throw new Error("recherche du compte existant a échoué (HTTP " + reponseListe.statut + ") : " + reponseListe.corps);
  }
  const jsonListe = JSON.parse(reponseListe.corps);
  const utilisateurs = jsonListe.users || jsonListe;
  const trouve = Array.isArray(utilisateurs) ? utilisateurs.find((u) => u.email === email) : null;
  if (!trouve) throw new Error("impossible de retrouver le compte existant pour " + email);
  console.log("Compte déjà existant pour " + email + ".");
  return trouve.id;
}

async function rattacherAuVoyage(utilisateurId, voyageId, prenom) {
  const corps = JSON.stringify({ voyage_id: voyageId, utilisateur_id: utilisateurId, prenom, role: "membre" });
  const url = new URL(REST + "/membres_famille");
  const reponse = await requeteHttps(url, {
    method: "POST",
    headers: Object.assign({}, headersAuth(), {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(corps),
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
  }, corps);
  if (reponse.statut < 200 || reponse.statut >= 300) {
    throw new Error("ajout à membres_famille a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }
}

// Reprend le tirage aléatoire mais déterministe par proportion plutôt qu'un
// vrai Math.random() : chaque relance du script produit la même simulation,
// plus simple à comparer avant/après un changement du classement.
function coche(index, total, proportion) {
  return (index % total) < Math.round(total * proportion);
}

async function upsertProgression(voyageId, utilisateurId, observationsCochees, quizScore) {
  const corps = JSON.stringify({
    voyage_id: voyageId,
    utilisateur_id: utilisateurId,
    observations_cochees: observationsCochees,
    quiz_score: quizScore,
    quiz_corrige: true,
    quiz_corrige_le: new Date().toISOString(),
    maj_le: new Date().toISOString(),
  });
  const url = new URL(REST + "/progression?on_conflict=voyage_id,utilisateur_id");
  const reponse = await requeteHttps(url, {
    method: "POST",
    headers: Object.assign({}, headersAuth(), {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(corps),
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
  }, corps);
  if (reponse.statut < 200 || reponse.statut >= 300) {
    throw new Error("upsert progression a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }
}

async function main() {
  const voyages = await get("/voyages?slug=eq." + encodeURIComponent(slug) + "&select=id");
  if (!voyages.length) throw new Error("aucun voyage trouvé pour le slug « " + slug + " ».");
  const voyageId = voyages[0].id;

  // même construction d'id que ENTREES_REGARDER côté app/index.html :
  // "<ancre de la journée>-r<index dans observations, trié par ordre>".
  const journees = await get(
    "/journees?voyage_id=eq." + voyageId + "&select=ancre,ordre,observations(id,ordre)&order=ordre.asc"
  );
  const idsEntrees = [];
  journees.forEach((j) => {
    (j.observations || [])
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .forEach((o, i) => idsEntrees.push(j.ancre + "-r" + i));
  });
  if (!idsEntrees.length) throw new Error("aucune observation de chasse trouvée pour ce voyage.");

  const idsJournees = (await get("/journees?voyage_id=eq." + voyageId + "&select=id")).map((j) => j.id);
  const nbQuestions = (await get(
    "/quiz_questions?select=id&journee_id=in.(" + idsJournees.join(",") + ")"
  )).length;
  const POINTS_PAR_QUESTION = 10; // valeur d'affichage seulement, cohérente avec un score plausible

  for (const membre of FAUX_MEMBRES) {
    const utilisateurId = await creerOuTrouverUtilisateur(membre.email);
    await rattacherAuVoyage(utilisateurId, voyageId, membre.prenom);

    const cochees = {};
    idsEntrees.forEach((id, i) => {
      if (coche(i, idsEntrees.length, membre.proportionChasse)) cochees[id] = true;
    });
    const quizScore = Math.round(nbQuestions * membre.proportionQuiz) * POINTS_PAR_QUESTION;

    await upsertProgression(voyageId, utilisateurId, cochees, quizScore);
    console.log(
      membre.prenom + " : " + Object.keys(cochees).length + "/" + idsEntrees.length +
      " objectifs cochés, score quiz " + quizScore + "."
    );
  }

  console.log("\nTerminé. Recharge l'application pour voir le classement mis à jour.");
}

main().catch((e) => {
  echouer("erreur inattendue : " + (e && e.stack ? e.stack : e));
});
