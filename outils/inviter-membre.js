#!/usr/bin/env node
/* ==========================================================================
   inviter-membre.js — invite un compte famille par e-mail et le rattache
   à un voyage.

   Usage :
     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... SITE_URL=https://salo2026.netlify.app \
       node outils/inviter-membre.js email@exemple.com salo2026 [prenom] [role: admin|membre]

   Appelle l'API d'invitation de Supabase Auth (/auth/v1/invite) : le
   compte est créé sans mot de passe, un e-mail part avec un lien qui
   ramène la personne sur SITE_URL avec un jeton de session temporaire.
   C'est app/index.html qui détecte ce jeton au chargement (voir
   gererLienInvitation) et affiche l'écran « Choisissez votre mot de
   passe » — personne, pas même l'organisateur, ne connaît le mot de
   passe final de quelqu'un d'autre.

   SITE_URL doit correspondre à une URL de redirection autorisée dans
   Supabase (Authentication → URL Configuration → Redirect URLs) : sans
   ça, l'invitation part mais le lien échoue à la validation.

   Si l'email existe déjà comme compte Supabase Auth, le script ne
   renvoie pas d'invitation (l'API refuse de toute façon) et se contente
   de rattacher le compte existant à membres_famille.

   Aucune dépendance npm, module natif `https`.
   ========================================================================== */

"use strict";

const https = require("https");
const { URL } = require("url");

function echouer(message) {
  console.error("\nERREUR — " + message);
  process.exit(1);
}

const [email, slug, prenom, role] = process.argv.slice(2);
if (!email || !slug) {
  echouer("usage : node outils/inviter-membre.js <email> <slug-du-voyage> [prenom] [role: admin|membre]");
}
if (role && role !== "admin" && role !== "membre") {
  echouer("role invalide : « " + role + " » — attendu admin ou membre.");
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.SITE_URL;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  echouer("variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises.");
}
if (!SITE_URL) {
  echouer("variable d'environnement SITE_URL requise (ex. https://salo2026.netlify.app) — c'est là que le lien d'invitation ramène la personne.");
}

const BASE = SUPABASE_URL.replace(/\/+$/, "");

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

async function inviterOuTrouverUtilisateur() {
  const corps = JSON.stringify({ email });
  const url = new URL(BASE + "/auth/v1/invite?redirect_to=" + encodeURIComponent(SITE_URL));
  const reponse = await requeteHttps(url, {
    method: "POST",
    headers: Object.assign({}, headersAuth(), {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(corps),
    }),
  }, corps);

  const json = reponse.corps ? JSON.parse(reponse.corps) : {};

  if (reponse.statut >= 200 && reponse.statut < 300) {
    console.log("Invitation envoyée à " + email + " (id " + json.id + ")");
    return json.id;
  }

  // Email déjà utilisé : on va chercher l'utilisateur existant plutôt que
  // d'échouer, pour pouvoir relancer ce script sans risque sur un voyage
  // supplémentaire.
  const dejaExistant = reponse.statut === 422 || reponse.statut === 400;
  if (!dejaExistant) {
    throw new Error("invitation a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }

  console.log("Compte déjà existant pour " + email + ", aucune invitation renvoyée — recherche de son id…");
  const urlListe = new URL(BASE + "/auth/v1/admin/users?email=" + encodeURIComponent(email));
  const reponseListe = await requeteHttps(urlListe, { method: "GET", headers: headersAuth() });
  if (reponseListe.statut < 200 || reponseListe.statut >= 300) {
    throw new Error("recherche du compte existant a échoué (HTTP " + reponseListe.statut + ") : " + reponseListe.corps);
  }
  const jsonListe = JSON.parse(reponseListe.corps);
  const utilisateurs = jsonListe.users || jsonListe;
  const trouve = Array.isArray(utilisateurs) ? utilisateurs.find((u) => u.email === email) : null;
  if (!trouve) {
    throw new Error("impossible de retrouver le compte existant pour " + email);
  }
  return trouve.id;
}

async function trouverVoyageId() {
  const url = new URL(BASE + "/rest/v1/voyages?slug=eq." + encodeURIComponent(slug) + "&select=id");
  const reponse = await requeteHttps(url, { method: "GET", headers: headersAuth() });
  if (reponse.statut < 200 || reponse.statut >= 300) {
    throw new Error("recherche du voyage a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }
  const lignes = JSON.parse(reponse.corps);
  if (!lignes.length) {
    throw new Error("aucun voyage trouvé pour le slug « " + slug + " ».");
  }
  return lignes[0].id;
}

async function rattacherAuVoyage(utilisateurId, voyageId) {
  const ligne = { voyage_id: voyageId, utilisateur_id: utilisateurId };
  if (prenom) ligne.prenom = prenom;
  if (role) ligne.role = role;
  const corps = JSON.stringify(ligne);
  const url = new URL(BASE + "/rest/v1/membres_famille");
  const reponse = await requeteHttps(url, {
    method: "POST",
    headers: Object.assign({}, headersAuth(), {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(corps),
      Prefer: "resolution=ignore-duplicates,return=representation",
    }),
  }, corps);

  if (reponse.statut < 200 || reponse.statut >= 300) {
    throw new Error("ajout à membres_famille a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }
  const lignes = reponse.corps ? JSON.parse(reponse.corps) : [];
  if (lignes.length) {
    console.log("Ajouté à membres_famille pour le voyage « " + slug + " ».");
  } else {
    console.log("Déjà membre de la famille pour le voyage « " + slug + " » (aucun doublon créé).");
  }
}

async function main() {
  const utilisateurId = await inviterOuTrouverUtilisateur();
  const voyageId = await trouverVoyageId();
  await rattacherAuVoyage(utilisateurId, voyageId);
  console.log("\nTerminé. " + email + " doit ouvrir le lien reçu par e-mail pour choisir son mot de passe.");
}

main().catch((e) => {
  echouer("erreur inattendue : " + (e && e.stack ? e.stack : e));
});
