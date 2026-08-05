// Silhouette vectorielle FIXE de l'Italie -- asset indépendant, jamais
// dérivé des coordonnées d'un voyage particulier (règle explicite du
// 2026-08-05 : "ne jamais transformer une liste de points GPS en contour
// de pays"). Générée une fois pour toutes depuis une vraie frontière
// (Natural Earth via johan/world.geo.json, ITA.geo.json -- coordonnées
// WGS84 publiques), simplifiée par un algorithme de Douglas-Peucker
// (tolérance 0.02°) et projetée dans un repère local 200×300, nord en
// haut. Trois sous-tracés dans le même 'd' (péninsule, Sicile, Sardaigne),
// syntaxe SVG standard -- pdf-lib gère nativement les 'M' multiples dans
// un même chemin.
//
// Régénération si besoin (voir historique de conversation du 2026-08-05
// pour le script complet) : télécharger ITA.geo.json, simplifier chaque
// anneau extérieur par Douglas-Peucker, projeter vers un viewBox fixe.

import { PDFPage, RGB } from "npm:pdf-lib@1.17.1";

export const ITALIE_VIEWBOX = { largeur: 200, hauteur: 300 };

export const ITALIE_PATH =
  "M149.5,212.0 L143.4,225.4 L145.9,230.7 L142.4,239.5 L129.3,233.1 L120.7,231.2 L96.9,222.5 L99.2,213.8 L119.2,215.3 L149.5,212.0 Z " +
  "M41.9,161.2 L52.2,173.3 L49.8,195.9 L42.0,194.8 L35.1,200.5 L28.6,196.0 L27.9,175.4 L24.0,165.6 L33.4,166.5 L41.9,161.2 Z " +
  "M95.9,66.5 L120.3,70.9 L118.5,79.3 L122.5,86.5 L109.0,84.0 L95.1,90.1 L96.1,98.5 L94.0,103.4 L99.6,112.1 L115.5,120.7 L124.1,134.8 L143.1,148.5 L156.5,148.4 L160.6,152.2 L155.8,155.6 L183.6,166.9 L198.2,175.8 L200.0,179.0 L196.8,185.1 L187.4,177.1 L172.5,174.3 L165.4,185.3 L177.7,191.7 L175.7,200.5 L168.5,201.6 L159.4,216.2 L152.3,217.5 L152.4,212.3 L155.9,203.1 L159.6,199.5 L147.7,181.0 L140.6,178.9 L135.6,171.5 L124.6,168.4 L117.3,161.6 L104.7,160.5 L91.3,152.8 L75.7,141.7 L64.1,131.9 L58.8,115.0 L50.3,113.0 L36.5,107.4 L28.6,109.7 L18.8,117.6 L11.7,118.9 L13.6,111.5 L4.4,109.3 L0.0,96.1 L5.9,90.9 L0.9,84.5 L1.6,79.7 L8.9,83.3 L17.2,82.5 L26.7,76.8 L29.7,79.5 L37.8,78.9 L41.5,72.0 L54.1,74.2 L61.6,71.3 L63.0,64.3 L73.3,66.7 L75.3,63.5 L92.1,60.5 L95.9,66.5 Z";

/**
 * Dessine la silhouette dans le rectangle [x, yHaut-hauteur, largeur,
 * hauteur], contour seul (pas de tracé d'étapes : sans coordonnées de
 * voyage fiables sélectionnées par cette fonction, on n'invente aucun
 * itinéraire -- silhouette seule, comme demandé). Opacité recommandée
 * 12-18 % pour rester en filigrane, jamais concurrente du titre.
 */
export function dessinerSilhouetteItalie(page: PDFPage, x: number, yHaut: number, largeur: number, hauteur: number, couleur: RGB, opacite = 0.15) {
  const s = Math.min(largeur / ITALIE_VIEWBOX.largeur, hauteur / ITALIE_VIEWBOX.hauteur);
  const decalageX = x + (largeur - ITALIE_VIEWBOX.largeur * s) / 2;
  const decalageY = yHaut - (hauteur - ITALIE_VIEWBOX.hauteur * s) / 2;
  page.drawSvgPath(ITALIE_PATH, { x: decalageX, y: decalageY, scale: s, borderColor: couleur, borderWidth: 1 / s, opacity: opacite });
}
