// Système de design centralisé du PDF carnet -- palette, typo, grille,
// espacements. Toute valeur de style utilisée par plus d'un composant doit
// vivre ici, pas être recopiée en dur dans index.ts ou composants.ts
// (demande explicite du 2026-08-05 : centraliser plutôt qu'éparpiller des
// constantes en tête de fichier).

import { hexVersRgb, PaletteBandeau } from "./illustrations.ts";

// --- grille de page --------------------------------------------------------
export const GRILLE = {
  largeur: 595.28, // A4 portrait, points
  hauteur: 841.89,
  marge: 56,
  // un motif isolé dans le plan le plus lointain (ex. un clocher seul) peut
  // approcher le haut de son repère local -- une marge de respiration évite
  // qu'il n'affleure le tout bord de page quand un bandeau part de y=hauteur.
  margeBandeau: 40,
  espaceFooter: 60,
  gouttiere: 14, // espace horizontal par défaut entre deux colonnes
};

// Dimensions éditoriales récurrentes. Elles constituent le contrat des
// gabarits et évitent qu'une page de test impose ses coordonnées aux autres.
export const COMPOSITION = {
  filetMargeX: 36,
  piedY: 32,
  couverture: { photoHaut: 782, photoHauteur: 404, largeurTitre: 330 },
  recit: { bandeauHaut: 158, espacePhotoTexte: 18 },
  galerie: { haut: 780, basUtile: 70, espace: 14 },
  cloture: { carteLargeur: 285, carteHauteur: 430, opaciteCarte: 0.18 },
};

/**
 * Répartit `largeurTotale` en `n` colonnes de même largeur séparées par la
 * gouttière -- grille à colonnes logiques (demandée explicitement en
 * conversation le 2026-08-05), utilisée par tout composant qui pose des
 * cases côte à côte plutôt que de recalculer largeur/gouttière au cas par
 * cas. Retourne, pour chaque colonne, son x de départ et sa largeur ;
 * `proportions` (optionnel) permet des colonnes inégales (ex. [0.62, 0.38]
 * pour une photo principale + une secondaire) -- doit sommer à 1.
 */
export function colonnes(n: number, largeurTotale: number, x0 = 0, gouttiere = GRILLE.gouttiere, proportions?: number[]): { x: number; largeur: number }[] {
  const parts = proportions && proportions.length === n ? proportions : Array(n).fill(1 / n);
  const largeurDisponible = largeurTotale - gouttiere * (n - 1);
  const resultat: { x: number; largeur: number }[] = [];
  let x = x0;
  for (let i = 0; i < n; i++) {
    const largeur = largeurDisponible * parts[i];
    resultat.push({ x, largeur });
    x += largeur + gouttiere;
  }
  return resultat;
}

// --- palette (Officina Bodoniana écran + accents ajoutés pour le PDF,
// voir app/index.html :root pour les valeurs partagées) -------------------
// Palette exacte des maquettes de référence (2026-08-05) -- noms conservés
// en italien/français pour rester cohérents avec le reste du fichier, mais
// les valeurs hex sont désormais celles fournies par l'utilisateur, pas une
// approximation. mapFill/mapStroke sont dédiées à la carte d'Italie
// stylisée (voir ornements.ts::dessinerCarteItalie).
export const PALETTE = {
  carta: hexVersRgb("#F7F2E9"), // PAPER
  cartaDeep: hexVersRgb("#EFE7D8"),
  inchiostro: hexVersRgb("#242321"), // INK
  grigio: hexVersRgb("#69655F"), // MUTED_TEXT
  rosso: hexVersRgb("#B64332"), // TERRACOTTA
  blu: hexVersRgb("#1F2A3D"),
  oliva: hexVersRgb("#7E8560"), // OLIVE
  sauge: hexVersRgb("#A7AD91"), // SAGE
  sable: hexVersRgb("#DDD2C3"), // SAND
  argent: hexVersRgb("#DDD2C3"),
  mapFill: hexVersRgb("#F0E7DA"), // MAP_FILL
  mapStroke: hexVersRgb("#D5C8B7"), // MAP_STROKE
};

export const PALETTE_BANDEAU: PaletteBandeau = {
  paperDeep: PALETTE.cartaDeep,
  papier: PALETTE.carta,
  pietra: hexVersRgb("#8E8A7C"),
  lago: hexVersRgb("#0F4A4E"),
  lagoMid: hexVersRgb("#2A7D80"),
  sole: hexVersRgb("#9C7A2E"),
  oliva: hexVersRgb("#67794F"),
};

// --- hiérarchie typographique ----------------------------------------------
// Un rôle = une taille + un interligne + une police (voir Polices dans
// index.ts pour le mapping police). Les composants lisent ces valeurs
// plutôt que des nombres en dur, pour qu'un changement d'échelle se fasse
// à un seul endroit.
export const TYPO = {
  labelCouverture: { taille: 10.5, interligne: 14 },
  titreCouverture: { taille: 42, interligne: 45 },
  dateCouverture: { taille: 11, interligne: 15 },
  recapCouverture: { taille: 9, interligne: 12 },

  dateJour: { taille: 9.5, interligne: 12 },
  titreJour: { taille: 38, interligne: 41 },
  accrocheJour: { taille: 12.5, interligne: 18 },
  labelSection: { taille: 8, interligne: 11 },
  meta: { taille: 8.5, interligne: 11 },
  corps: { taille: 10.5, interligne: 15.5 },
  legende: { taille: 8.5, interligne: 11 },
  citation: { taille: 12.5, interligne: 17 },

  titreChapitre: { taille: 72, interligne: 76 },
  sousTitreChapitre: { taille: 12, interligne: 16 },

  titreCloture: { taille: 32, interligne: 36 },
  phraseCloture: { taille: 12.5, interligne: 17 },

  folio: { taille: 7.5, interligne: 10 },
};
