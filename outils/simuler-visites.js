#!/usr/bin/env node
/* ==========================================================================
   simuler-visites.js — génère de fausses lignes "visites" pour les comptes
   de test "Léo (test)" et "Nina (test)" (déjà créés par
   simuler-classement.js), pour faire vivre le tableau de bord Fréquentation
   de l'onglet Admin pendant qu'on met au point son affichage — sans
   attendre que la vraie famille utilise l'application.

   Usage :
     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
       node outils/simuler-visites.js salo2026

   Fabrique, sur les quatorze derniers jours, un nombre de visites et une
   répartition d'onglets différents par profil de test (proportions
   déterministes, pas de vrai hasard, pour pouvoir comparer avant/après un
   changement d'affichage sans que les chiffres bougent à chaque relance) :
   - Léo (test) : usage quotidien et soutenu, surtout Agenda et Chasse
   - Nina (test) : usage plus rare, surtout Accueil et Urgences

   Jetable : à relancer autant de fois que nécessaire pendant qu'on
   travaille sur le tableau de bord, à supprimer une fois la vraie famille
   partie en voyage (voir outils/simuler-classement.js pour la même
   politique appliquée au classement).
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
  echouer("usage : node outils/simuler-visites.js <slug-du-voyage>");
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  echouer("variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises.");
}

const BASE = SUPABASE_URL.replace(/\/+$/, "");
const REST = BASE + "/rest/v1";

// Mêmes comptes que simuler-classement.js : réutilisés tels quels, jamais
// recréés ici (le script échoue si l'un des deux n'existe pas encore —
// lancer d'abord simuler-classement.js).
const PROFILS = [
  {
    email: "test-leo@carnetvoyage.invalid",
    // un jour sur deux, deux à trois onglets consultés, séances de 3 à 9 min.
    frequenceJours: 2, onglets: ["aujourdhui", "jours", "jours", "chasse"], dureeMin: 3, dureeMax: 9,
  },
  {
    email: "test-nina@carnetvoyage.invalid",
    // un jour sur cinq, un ou deux onglets, séances plus courtes.
    frequenceJours: 5, onglets: ["aujourdhui", "urgences"], dureeMin: 1, dureeMax: 4,
  },
];
const NB_JOURS = 14;

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

async function post(chemin, corpsObjet, entetesSupp) {
  const corps = JSON.stringify(corpsObjet);
  const url = new URL(REST + chemin);
  const reponse = await requeteHttps(url, {
    method: "POST",
    headers: Object.assign({}, headersAuth(), {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(corps),
    }, entetesSupp || {}),
  }, corps);
  if (reponse.statut < 200 || reponse.statut >= 300) {
    throw new Error("POST " + chemin + " a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }
  return reponse.corps ? JSON.parse(reponse.corps) : [];
}

async function trouverUtilisateur(email) {
  const url = new URL(BASE + "/auth/v1/admin/users?email=" + encodeURIComponent(email));
  const reponse = await requeteHttps(url, { method: "GET", headers: headersAuth() });
  if (reponse.statut < 200 || reponse.statut >= 300) {
    throw new Error("recherche du compte " + email + " a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }
  const json = JSON.parse(reponse.corps);
  const utilisateurs = json.users || json;
  const trouve = Array.isArray(utilisateurs) ? utilisateurs.find((u) => u.email === email) : null;
  if (!trouve) {
    throw new Error(
      "aucun compte pour " + email + " — lancer d'abord : node outils/simuler-classement.js " + slug
    );
  }
  return trouve.id;
}

// Tirage déterministe (pas de Math.random) : mêmes résultats à chaque
// relance, pour comparer l'avant/après d'un changement d'affichage.
function pseudoAleatoire(graine) {
  const x = Math.sin(graine) * 10000;
  return x - Math.floor(x);
}

async function main() {
  const voyages = await get("/voyages?slug=eq." + encodeURIComponent(slug) + "&select=id");
  if (!voyages.length) throw new Error("aucun voyage trouvé pour le slug « " + slug + " ».");
  const voyageId = voyages[0].id;

  for (const profil of PROFILS) {
    const utilisateurId = await trouverUtilisateur(profil.email);
    let visitesCreees = 0;

    for (let i = NB_JOURS - 1; i >= 0; i--) {
      const graine = utilisateurId.length + i * 7.13;
      if (Math.floor(pseudoAleatoire(graine) * profil.frequenceJours) !== 0) continue;

      const jour = new Date();
      jour.setDate(jour.getDate() - i);
      jour.setHours(9 + Math.floor(pseudoAleatoire(graine + 1) * 10), Math.floor(pseudoAleatoire(graine + 2) * 60), 0, 0);

      const nbOnglets = 1 + Math.floor(pseudoAleatoire(graine + 3) * profil.onglets.length);
      const onglets = [];
      for (let k = 0; k < nbOnglets; k++) {
        const nom = profil.onglets[Math.floor(pseudoAleatoire(graine + 4 + k) * profil.onglets.length)];
        const heure = new Date(jour.getTime() + k * 45000);
        onglets.push({ onglet: nom, le: heure.toISOString() });
      }
      const dureeSecondes = Math.round(
        (profil.dureeMin + pseudoAleatoire(graine + 5) * (profil.dureeMax - profil.dureeMin)) * 60
      );

      await post("/visites", {
        voyage_id: voyageId,
        utilisateur_id: utilisateurId,
        debutee_le: jour.toISOString(),
        derniere_activite_le: new Date(jour.getTime() + dureeSecondes * 1000).toISOString(),
        duree_secondes: dureeSecondes,
        onglets_vus: onglets,
      });
      visitesCreees++;
    }

    console.log(profil.email + " : " + visitesCreees + " visite(s) simulée(s) sur " + NB_JOURS + " jours.");
  }

  console.log("\nTerminé. Recharge l'onglet Admin (connecté avec un compte admin) pour voir le tableau de bord.");
}

main().catch((e) => {
  echouer("erreur inattendue : " + (e && e.stack ? e.stack : e));
});
