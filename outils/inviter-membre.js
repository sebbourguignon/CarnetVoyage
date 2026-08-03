#!/usr/bin/env node
/* ==========================================================================
   inviter-membre.js — crée un compte famille et le rattache à un voyage.

   Usage :
     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
       node outils/inviter-membre.js email@exemple.com "mot de passe" salo2026

   Crée directement le compte avec le mot de passe fourni (pas d'email
   d'invitation Supabase envoyé — évite de dépendre d'un SMTP configuré) :
   à toi de communiquer le mot de passe à la personne par un canal séparé.
   Le compte est aussitôt ajouté à membres_famille pour le voyage donné,
   ce qui débloque le contenu "famille" et le quiz pour cette personne.

   Si l'email existe déjà comme compte Supabase Auth, le script réutilise
   ce compte (ne le recrée pas, n'écrase pas son mot de passe) et se
   contente de l'ajouter à membres_famille s'il n'y est pas déjà.

   Aucune dépendance npm, module natif `https`.
   ========================================================================== */

"use strict";

const https = require("https");
const { URL } = require("url");

function echouer(message) {
  console.error("\nERREUR — " + message);
  process.exit(1);
}

const [email, motDePasse, slug, prenom] = process.argv.slice(2);
if (!email || !motDePasse || !slug) {
  echouer("usage : node outils/inviter-membre.js <email> <mot-de-passe> <slug-du-voyage> [prenom]");
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  echouer("variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises.");
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

async function creerOuTrouverUtilisateur() {
  const corps = JSON.stringify({ email, password: motDePasse, email_confirm: true });
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

  // Email déjà utilisé : on va chercher l'utilisateur existant plutôt que
  // d'échouer, pour pouvoir relancer ce script sans risque sur un voyage
  // supplémentaire.
  const dejaExistant = reponse.statut === 422 || reponse.statut === 400;
  if (!dejaExistant) {
    throw new Error("création du compte a échoué (HTTP " + reponse.statut + ") : " + reponse.corps);
  }

  console.log("Compte déjà existant pour " + email + ", recherche de son id…");
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
  const utilisateurId = await creerOuTrouverUtilisateur();
  const voyageId = await trouverVoyageId();
  await rattacherAuVoyage(utilisateurId, voyageId);
  console.log("\nTerminé. " + email + " peut se connecter avec le mot de passe fourni.");
}

main().catch((e) => {
  echouer("erreur inattendue : " + (e && e.stack ? e.stack : e));
});
