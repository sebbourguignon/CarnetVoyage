// Bibliothèque d'icônes line-art (trait seul, jamais de remplissage plein)
// pour le bandeau "LES TEMPS FORTS / DÉTAILS DU JOUR" de la page récit --
// remplace l'ancienne icône unique "goutte de repère" répétée pour chaque
// lieu (jugée peu lisible/répétitive dans les maquettes de référence,
// 2026-08-05). Chaque icône est dessinée dans une boîte locale homogène de
// 20x20, même épaisseur de trait par défaut (1.3pt à l'échelle 1), pour
// rester interchangeable dans le bandeau sans réglage au cas par cas.
//
// x,y = coin bas-gauche de la boîte 20x20*taille/20 en coordonnées PDF.
// Toutes dessinées via page.drawSvgPath()/drawEllipse() (mêmes primitives
// que ornements.ts/illustrations.ts) -- drawSvgPath inverse l'axe Y, donc
// les coordonnées ci-dessous sont recopiées telles quelles depuis un
// repère SVG local (Y vers le bas), voir illustrations.ts pour la même
// convention.

import { PDFPage, RGB } from "npm:pdf-lib@1.17.1";

export type NomIconeBandeau =
  | "amphitheatre"
  | "coeur"
  | "tour"
  | "arche"
  | "chateau"
  | "route"
  | "horloge"
  | "meteo"
  | "appareilPhoto"
  | "lieu";

interface OptsIcone {
  x: number;
  y: number; // coin bas-gauche de la boîte
  taille: number; // côté de la boîte, en pt
  color: RGB;
}

function ancre(o: OptsIcone) {
  const s = o.taille / 20;
  return { x: o.x, y: o.y + 20 * s, scale: s, borderColor: o.color, borderWidth: 1.3 / s };
}

/** Amphithéâtre : arc de gradins concentriques incurvé (Arena di Verona). */
function amphitheatre(page: PDFPage, o: OptsIcone) {
  const a = ancre(o);
  page.drawSvgPath("M1,17 A9,7 0 0 1 19,17", a);
  page.drawSvgPath("M3.5,17 A6.5,5 0 0 1 16.5,17", a);
  page.drawSvgPath("M6,17 A4,3 0 0 1 14,17", a);
  page.drawSvgPath("M1,17 L19,17", a);
}

/** Cœur (contour fin) -- Casa di Giulietta, ou "ambiance inoubliable". */
function coeur(page: PDFPage, o: OptsIcone) {
  const a = ancre(o);
  page.drawSvgPath(
    "M10,17 C10,17 2,11.5 2,6.8 C2,3.6 4.5,2 7,2 C8.6,2 9.6,2.9 10,3.6 C10.4,2.9 11.4,2 13,2 C15.5,2 18,3.6 18,6.8 C18,11.5 10,17 10,17 Z",
    a,
  );
}

/** Tour / campanile : rectangle vertical fin surmonté d'un toit pointu. */
function tour(page: PDFPage, o: OptsIcone) {
  const a = ancre(o);
  page.drawSvgPath("M6,18 L6,6 L14,6 L14,18", a);
  page.drawSvgPath("M6,18 L14,18", a);
  page.drawSvgPath("M4.5,6 L10,1.5 L15.5,6", a);
  page.drawSvgPath("M8.5,14 L11.5,14 M8.5,10.5 L11.5,10.5", a);
}

/** Arche gothique isolée -- Arche Scaligere. */
function arche(page: PDFPage, o: OptsIcone) {
  const a = ancre(o);
  page.drawSvgPath("M3,18 L3,10 C3,5 7,2 10,2 C13,2 17,5 17,10 L17,18", a);
  page.drawSvgPath("M3,18 L17,18", a);
  page.drawSvgPath("M6,18 L6,11 C6,8 8,6.5 10,6.5 C12,6.5 14,8 14,11 L14,18", a);
}

/** Château fort : silhouette simple à créneaux. */
function chateau(page: PDFPage, o: OptsIcone) {
  const a = ancre(o);
  page.drawSvgPath("M3,18 L3,9 L5,9 L5,7 L7,7 L7,9 L9,9 L9,6 L11,6 L11,9 L13,9 L13,7 L15,7 L15,9 L17,9 L17,18 Z", a);
  page.drawSvgPath("M3,18 L17,18", a);
}

/** Route sinueuse -- distance/trajet. */
function route(page: PDFPage, o: OptsIcone) {
  const a = ancre(o);
  page.drawSvgPath("M4,18 C4,13 15,15 15,10 C15,6 5,7 5,3", a);
  page.drawSvgPath("M9.2,15.2 L9.6,13.4 M9,9.6 L10,8.2", a);
}

/** Horloge simple -- durée. */
function horloge(page: PDFPage, o: OptsIcone) {
  const s = o.taille / 20;
  page.drawEllipse({ x: o.x + 10 * s, y: o.y + 10 * s, xScale: 8.5 * s, yScale: 8.5 * s, borderColor: o.color, borderWidth: 1.3 });
  page.drawSvgPath("M10,10 L10,4.5 M10,10 L14.5,12", ancre(o));
}

/** Soleil voilé d'un nuage -- météo. */
function meteo(page: PDFPage, o: OptsIcone) {
  const s = o.taille / 20;
  page.drawEllipse({ x: o.x + 8 * s, y: o.y + 13 * s, xScale: 3.6 * s, yScale: 3.6 * s, borderColor: o.color, borderWidth: 1.2 });
  const rayons = ancre(o);
  page.drawSvgPath("M8,7.5 L8,5.5 M3.5,10 L2,10 M4.2,6.2 L2.9,4.9 M11.8,6.2 L13.1,4.9", rayons);
  page.drawSvgPath("M6,17 C4,17 3,15.5 4,14 C4.3,12.6 6,12 7,12.8 C7.6,11 10.5,11.2 11,13 C13,12.7 14,14.3 12.8,15.7 C13.5,17 12,17.8 11,17.5 L6,17.5 Z", rayons);
}

/** Appareil photo -- rectangle + cercle objectif, esprit couverture. */
function appareilPhoto(page: PDFPage, o: OptsIcone) {
  const a = ancre(o);
  page.drawSvgPath("M2,15 L2,6 L6,6 L7.5,3.5 L12.5,3.5 L14,6 L18,6 L18,15 Z", a);
  const s = o.taille / 20;
  page.drawEllipse({ x: o.x + 10 * s, y: o.y + 8.5 * s, xScale: 3.6 * s, yScale: 3.6 * s, borderColor: o.color, borderWidth: 1.2 });
}

/** Goutte de repère de carte (conservée pour "distance depuis Salò"). */
function lieu(page: PDFPage, o: OptsIcone) {
  const a = ancre(o);
  page.drawSvgPath("M10,1 C15,1 19,5 19,10 C19,15 10,24 10,24 C10,24 1,15 1,10 C1,5 5,1 10,1 Z", { ...a, y: o.y + 24 * (o.taille / 20) });
  const s = o.taille / 20;
  page.drawEllipse({ x: o.x + 10 * s, y: o.y + 14 * s, xScale: 3.4 * s, yScale: 3.4 * s, borderColor: o.color, borderWidth: 1.2 });
}

const REGISTRE: Record<NomIconeBandeau, (page: PDFPage, o: OptsIcone) => void> = {
  amphitheatre, coeur, tour, arche, chateau, route, horloge, meteo, appareilPhoto, lieu,
};

export function dessinerIconeBandeau(page: PDFPage, nom: NomIconeBandeau, x: number, y: number, taille: number, color: RGB) {
  REGISTRE[nom](page, { x, y, taille, color });
}

/**
 * Devine une icône plausible à partir du nom d'un lieu -- correspondance
 * par mot-clé, jamais une donnée inventée : si aucun mot-clé ne matche, la
 * goutte de repère générique reste le repli (comportement identique à
 * avant pour les lieux non reconnus).
 */
export function deviverIconePourLieu(nom: string): NomIconeBandeau {
  const n = nom.toLowerCase();
  if (/(arena|amphithéâtre|amphitheatre|colisée|colisee)/.test(n)) return "amphitheatre";
  if (/(giulietta|juliette|coeur|cœur|amour)/.test(n)) return "coeur";
  if (/(torre|tour|campanile|clocher|belfry)/.test(n)) return "tour";
  if (/(arche|arco|porte|arc\b)/.test(n)) return "arche";
  if (/(castello|castel|château|chateau|rocca|fort)/.test(n)) return "chateau";
  if (/(strada|route|via\b|corso)/.test(n)) return "route";
  return "lieu";
}
