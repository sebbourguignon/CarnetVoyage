// Ornements décoratifs pour la nouvelle identité visuelle du PDF (carnet
// "magazine de voyage" -- direction validée en conversation le 2026-08-05,
// à partir d'une maquette de référence, PDF-only : l'app à l'écran reste en
// Officina Bodoniana, voir CLAUDE.md). Purement décoratif -- rien ici ne
// représente une donnée du voyage (la carte d'Italie est une silhouette
// stylisée, pas une carte géographique précise).

import {
  appendBezierCurve,
  clip,
  closePath,
  degrees,
  endPath,
  lineTo,
  moveTo,
  PDFFont,
  PDFImage,
  PDFPage,
  popGraphicsState,
  pushGraphicsState,
  RGB,
} from "npm:pdf-lib@1.17.1";
import { ITALIE_PATH, ITALIE_VIEWBOX } from "./italie.ts";

const KAPPA = 0.5522847498; // constante de l'approximation d'un quart de cercle par bézier cubique

/**
 * Découpe et dessine une image en "cover" (recadrée, jamais déformée ni
 * letterboxée) dans un cadre à sommet en arche -- signature visuelle de la
 * couverture. Le clip est construit à la main (rectangle + deux béziers
 * pour le demi-cercle du haut) : pdf-lib n'expose pas de primitive
 * "rounded/arched rect" toute faite, seulement les opérateurs bas niveau.
 */
export function dessinerPhotoArche(page: PDFPage, img: PDFImage, x: number, yHaut: number, largeur: number, hauteur: number) {
  const rayon = largeur / 2;
  const yBas = yHaut - hauteur;
  const yDepartArc = yHaut - rayon;
  const cx = x + rayon;
  page.pushOperators(
    pushGraphicsState(),
    moveTo(x, yBas),
    lineTo(x, yDepartArc),
    appendBezierCurve(x, yDepartArc + rayon * KAPPA, cx - rayon * KAPPA, yHaut, cx, yHaut),
    appendBezierCurve(cx + rayon * KAPPA, yHaut, x + largeur, yDepartArc + rayon * KAPPA, x + largeur, yDepartArc),
    lineTo(x + largeur, yBas),
    closePath(),
    clip(),
    endPath(),
  );
  const echelle = Math.max(largeur / img.width, hauteur / img.height);
  const lw = img.width * echelle, lh = img.height * echelle;
  page.drawImage(img, { x: x - (lw - largeur) / 2, y: yBas - (lh - hauteur) / 2, width: lw, height: lh });
  page.pushOperators(popGraphicsState());
}

/**
 * Répartit chaque caractère le long de la moitié haute d'un cercle, centré
 * sur angleCentre (convention mathématique standard : 0° = droite, 90° =
 * haut, y vers le haut comme le reste de la page -- drawText, à la
 * différence de drawSvgPath, n'inverse pas l'axe). rotate = angleChar-90
 * pour que le sommet de chaque lettre pointe vers l'extérieur du cercle.
 */
export function texteCourbe(
  page: PDFPage,
  texte: string,
  cx: number,
  cy: number,
  rayon: number,
  taille: number,
  font: PDFFont,
  color: RGB,
  angleCentre = 90,
) {
  const caracteres = Array.from(texte);
  const largeurs = caracteres.map((c) => font.widthOfTextAtSize(c, taille));
  const largeurTotale = largeurs.reduce((a, b) => a + b, 0);
  const circonference = 2 * Math.PI * rayon;
  let angle = angleCentre + ((largeurTotale / circonference) * 360) / 2;
  for (let i = 0; i < caracteres.length; i++) {
    const w = largeurs[i];
    const angleChar = angle - ((w / circonference) * 360) / 2;
    const rad = (angleChar * Math.PI) / 180;
    const x = cx + rayon * Math.cos(rad);
    const y = cy + rayon * Math.sin(rad);
    page.drawText(caracteres[i], {
      x, y, size: taille, font, color, rotate: degrees(angleChar - 90),
    });
    angle -= (w / circonference) * 360;
  }
}

/**
 * Répartit chaque caractère le long de la moitié BASSE d'un cercle, texte
 * lisible normalement (pas la tête en bas) -- pour ça, les caractères sont
 * parcourus de droite à gauche et chaque lettre pivotée de 180° de plus que
 * texteCourbe : le sommet de la lettre pointe vers le centre du cercle, pas
 * vers l'extérieur, exactement l'effet d'un tampon/timbre classique.
 */
export function texteCourbeBas(
  page: PDFPage,
  texte: string,
  cx: number,
  cy: number,
  rayon: number,
  taille: number,
  font: PDFFont,
  color: RGB,
  angleCentre = 270,
) {
  const caracteres = Array.from(texte);
  const largeurs = caracteres.map((c) => font.widthOfTextAtSize(c, taille));
  const largeurTotale = largeurs.reduce((a, b) => a + b, 0);
  const circonference = 2 * Math.PI * rayon;
  // on parcourt de droite (angle le plus grand) à gauche pour que le texte
  // se lise dans le bon sens une fois chaque lettre retournée de 180°.
  let angle = angleCentre - ((largeurTotale / circonference) * 360) / 2;
  for (let i = 0; i < caracteres.length; i++) {
    const w = largeurs[i];
    const angleChar = angle + ((w / circonference) * 360) / 2;
    const rad = (angleChar * Math.PI) / 180;
    const x = cx + rayon * Math.cos(rad);
    const y = cy + rayon * Math.sin(rad);
    page.drawText(caracteres[i], {
      x, y, size: taille, font, color, rotate: degrees(angleChar - 90 + 180),
    });
    angle += (w / circonference) * 360;
  }
}

/**
 * Sceau circulaire "ITALIE · SOUVENIRS DE FAMILLE" -- élément signature
 * répété en tête de page, esprit tampon de voyageur. Deux anneaux fins
 * concentriques, texte du haut et du bas tous deux courbés le long du
 * cercle (maquette de référence), petits points/losanges séparateurs à
 * gauche et à droite, scène miniature au centre.
 */
export function dessinerSceau(page: PDFPage, cx: number, cy: number, rayon: number, labelHaut: string, labelBas: string, font: PDFFont, dessinerMotifCentral: (page: PDFPage, cx: number, cy: number) => void, color: RGB) {
  page.drawEllipse({ x: cx, y: cy, xScale: rayon, yScale: rayon, borderColor: color, borderWidth: 1.1 });
  page.drawEllipse({ x: cx, y: cy, xScale: rayon - 5, yScale: rayon - 5, borderColor: color, borderWidth: 0.6 });
  const rayonTexte = rayon - 12;
  texteCourbe(page, `· ${labelHaut} ·`, cx, cy, rayonTexte, Math.max(5.4, rayon * 0.135), font, color, 90);
  texteCourbeBas(page, labelBas, cx, cy, rayonTexte, Math.max(4.1, rayon * 0.1), font, color, 270);
  // petits losanges séparateurs, niveau médian gauche/droite
  const dLos = Math.max(1.6, rayon * 0.045);
  for (const signe of [-1, 1]) {
    const px = cx + signe * (rayon - 2.5);
    page.drawSvgPath(`M${-dLos},0 L0,${-dLos} L${dLos},0 L0,${dLos} Z`, { x: px, y: cy, scale: 1, color });
  }
  dessinerMotifCentral(page, cx, cy);
}

/** Icône ligne minimaliste (trait, jamais de remplissage) -- vocabulaire cohérent avec les silhouettes de illustrations.ts. */
export function dessinerIcone(page: PDFPage, nom: "lieu" | "horloge", x: number, y: number, taille: number, color: RGB) {
  const s = taille / 20;
  if (nom === "lieu") {
    // goutte de repère de carte
    page.drawSvgPath(
      "M10,1 C15,1 19,5 19,10 C19,15 10,24 10,24 C10,24 1,15 1,10 C1,5 5,1 10,1 Z",
      { x, y: y + 24 * s, scale: s, borderColor: color, borderWidth: 1.3 / s },
    );
    page.drawEllipse({ x: x + 10 * s, y: y + 14 * s, xScale: 3.4 * s, yScale: 3.4 * s, borderColor: color, borderWidth: 1.2 / s });
  } else {
    page.drawEllipse({ x: x + 10 * s, y: y + 10 * s, xScale: 9 * s, yScale: 9 * s, borderColor: color, borderWidth: 1.3 / s });
    page.drawSvgPath("M10,10 L10,3 M10,10 L15,12", { x, y: y + 20 * s, scale: s, borderColor: color, borderWidth: 1.3 / s });
  }
}

/**
 * Motif d'arche italienne (esprit arcade/porche), pour le centre du sceau
 * -- remplace le cyprès seul, jugé trop abstrait pour être identifiable en
 * petit corps. cx/cy = point de sol (centre de la base de l'arche).
 */
export function dessinerMotifArche(page: PDFPage, cx: number, cy: number, taille: number, color: RGB) {
  // ancre : local y=20 (pieds de l'arche) doit tomber sur cy (le sol) --
  // drawSvgPath inverse l'axe Y (voir illustrations.ts), donc y de l'ancre
  // doit être cy + 20*s pour que le tracé "remonte" au-dessus de cy.
  const s = taille / 20;
  const ancre = { x: cx - 10 * s, y: cy + 20 * s, scale: s, borderColor: color, borderWidth: 1.3 / s };
  page.drawSvgPath("M2,20 L2,9 A8,8 0 0 1 18,9 L18,20", ancre);
  page.drawSvgPath("M2,20 L18,20", ancre);
}

/**
 * Scène miniature du sceau : loggia à arche à gauche, cyprès fin au
 * centre-droit, deux à trois lignes d'horizon en dessous -- remplace le
 * motif "obélisque abstrait" jugé peu identifiable dans les maquettes de
 * référence. Tout en line-art (aucun remplissage), une seule couleur.
 * cx/cy = point de sol de la scène (le centre du sceau).
 */
export function dessinerMotifScene(page: PDFPage, cx: number, cy: number, taille: number, color: RGB) {
  const s = taille / 40;
  const largeur = 1.1 / s;
  // Repère local 40x40, sol en y=30 (drawSvgPath : axe Y local vers le bas,
  // donc ancre.y = cy + 30*s pour que y_local=30 retombe sur cy).
  const ancre = { x: cx - 20 * s, y: cy + 30 * s, scale: s, borderColor: color, borderWidth: largeur };
  // loggia (bâtiment simple + arche), à gauche de la scène
  page.drawSvgPath("M3,30 L3,16 A6,6 0 0 1 15,16 L15,30", ancre);
  page.drawSvgPath("M1,30 L17,30", ancre);
  page.drawSvgPath("M3,16 L3,10 L15,10 L15,16", ancre);
  // cyprès fin, à droite de la loggia
  const cxCypres = 27, hCypres = 24, yBaseCypres = 30;
  page.drawSvgPath(
    `M${cxCypres},${yBaseCypres - hCypres} C${cxCypres + 3.4},${yBaseCypres - hCypres * 0.6} ${cxCypres + 2.2},${yBaseCypres - hCypres * 0.2} ${cxCypres + 2.6},${yBaseCypres} ` +
      `M${cxCypres},${yBaseCypres - hCypres} C${cxCypres - 3.4},${yBaseCypres - hCypres * 0.6} ${cxCypres - 2.2},${yBaseCypres - hCypres * 0.2} ${cxCypres - 2.6},${yBaseCypres}`,
    ancre,
  );
  // horizon : 2 lignes fines évoquant collines/rive de lac
  page.drawSvgPath("M0,33 Q10,31 20,33 T40,33", ancre);
  page.drawSvgPath("M0,36.5 Q12,35 24,36.5 T40,36.5", ancre);
}

// L'ancienne "carte stylisée" (silhouette inventée à partir d'une simple
// courbe de Bézier, sans rapport avec la vraie forme de l'Italie) a été
// retirée le 2026-08-05 -- règle explicite : ne jamais afficher une fausse
// silhouette géographique. Remplacée par italie.ts (dessinerSilhouetteItalie),
// un tracé fixe dérivé d'une vraie frontière (Natural Earth), indépendant
// des coordonnées d'un voyage particulier.

/** Petit paraphe décoratif (esprit filet + brindille) posé au bout d'une règle. */
export function dessinerParaphe(page: PDFPage, x: number, y: number, color: RGB) {
  page.drawSvgPath("M0,0 C4,-3 8,2 12,-2 C15,-4 17,0 20,-2", { x, y, scale: 1, borderColor: color, borderWidth: 1 });
  page.drawEllipse({ x: x + 21, y: y - 2.6, xScale: 1.6, yScale: 2.6, color });
}

/**
 * Carte d'Italie stylisée : silhouette (italie.ts, tracé fixe dérivé d'une
 * vraie frontière) remplie très pâle (mapFill/mapStroke), tracé d'itinéraire
 * en pointillés terracotta serpentant nord-sud À L'INTÉRIEUR de la
 * silhouette (pas des coordonnées réelles de voyage -- règle explicite,
 * voir commentaire d'en-tête d'italie.ts : jamais de vraie donnée GPS
 * transformée en tracé), et un petit marqueur cercle à chaque extrémité.
 * `opaciteFond` régit la silhouette (grand filigrane couverture/clôture vs.
 * petit coin page récit) ; le tracé/marqueurs restent toujours bien
 * visibles (règle "carte jamais grise/invisible").
 */
export function dessinerCarteItalie(
  page: PDFPage,
  x: number,
  yHaut: number,
  largeur: number,
  hauteur: number,
  couleurContour: RGB,
  couleurFond: RGB,
  couleurRoute: RGB,
  couleurMarqueur: RGB,
  couleurCentreMarqueur: RGB,
  opaciteFond = 1,
) {
  const s = Math.min(largeur / ITALIE_VIEWBOX.largeur, hauteur / ITALIE_VIEWBOX.hauteur);
  const decalageX = x + (largeur - ITALIE_VIEWBOX.largeur * s) / 2;
  const decalageY = yHaut - (hauteur - ITALIE_VIEWBOX.hauteur * s) / 2;
  const ancre = { x: decalageX, y: decalageY, scale: s };
  page.drawSvgPath(ITALIE_PATH, { ...ancre, color: couleurFond, opacity: opaciteFond * 0.9 });
  page.drawSvgPath(ITALIE_PATH, { ...ancre, borderColor: couleurContour, borderWidth: 1 / s, opacity: opaciteFond });

  // tracé d'itinéraire schématique nord->sud, à l'intérieur du viewBox de
  // la silhouette (100,60) en haut jusqu'à (60,215) en bas -- purement
  // décoratif, aucune coordonnée réelle.
  const points: [number, number][] = [
    [100, 60], [92, 90], [104, 118], [88, 148], [96, 178], [78, 200], [66, 215],
  ];
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) d += ` L${points[i][0]},${points[i][1]}`;
  page.drawSvgPath(d, { ...ancre, borderColor: couleurRoute, borderWidth: 1.6 / s, borderDashArray: [3 / s, 3 / s], opacity: opaciteFond });

  const rMarqueur = 3;
  for (const [px, py] of [points[0], points[points.length - 1]]) {
    const cxPage = decalageX + px * s, cyPage = decalageY - py * s;
    page.drawEllipse({ x: cxPage, y: cyPage, xScale: rMarqueur, yScale: rMarqueur, color: couleurCentreMarqueur, borderColor: couleurRoute, borderWidth: 1.1, opacity: opaciteFond });
  }
}
