// Port PDF (pdf-lib) de app/illustrations.js -- meme vocabulaire visuel que
// l'app (silhouettes plates par catégorie), mais dessine directement sur une
// PDFPage au lieu de produire du SVG DOM. Ne reprend que les 17 motifs
// reellement utilises par voyages/*.json (voir illustration[] de chaque
// journee) plus "eclipse" (motif dedie du 12 aout, hors registre app comme
// dans illustrations.js).
//
// Tous les chemins sont dessines via page.drawSvgPath() : pdf-lib inverse
// deja l'axe Y pour cette methode (voir operations.js, commentaire "SVG path
// Y axis is opposite pdf-lib's") -- les coordonnees ci-dessous sont donc
// recopiees telles quelles depuis illustrations.js (espace SVG local, Y vers
// le bas), aucune inversion manuelle necessaire. Seule différence : la
// couleur est une valeur hex resolue au prealable (voir nuance()), pas une
// variable CSS color-mix -- Deno n'a pas de moteur CSS.

import { PDFPage, RGB, rgb } from "npm:pdf-lib@1.17.1";

export function hexVersRgb(hex: string): RGB {
  const n = hex.replace("#", "");
  return rgb(
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Équivalent de nuance()/color-mix() : mélange linéaire deux couleurs hex. */
export function nuance(couleurPure: RGB, fond: RGB, pourcentage: number): RGB {
  const t = pourcentage / 100;
  return rgb(lerp(fond.red, couleurPure.red, t), lerp(fond.green, couleurPure.green, t), lerp(fond.blue, couleurPure.blue, t));
}

type Dessin = (cx: number, cy: number, s: number, page: PDFPage, ax: number, ay: number, echelleGlobale: number, couleur: RGB) => void;

function chemin(page: PDFPage, d: string, x: number, y: number, scale: number, couleur: RGB) {
  page.drawSvgPath(d, { x, y, scale, color: couleur });
}
function trait(page: PDFPage, x1: number, y1: number, x2: number, y2: number, x: number, y: number, scale: number, largeur: number, couleur: RGB) {
  page.drawSvgPath(`M${x1},${y1} L${x2},${y2}`, { x, y, scale, borderColor: couleur, borderWidth: largeur / scale });
}

// --- bandes (largeur, hauteur, base -> silhouette pleine largeur) ---------

export function collines(page: PDFPage, ax: number, ay: number, s: number, largeur: number, hauteur: number, base: number, fill: RGB) {
  let d = "M0," + base, x = 0, i = 0;
  const pas = 130;
  while (x < largeur) {
    const h = hauteur * (0.5 + 0.5 * Math.abs(Math.cos(i * 1.3)));
    const xf = Math.min(x + pas, largeur);
    d += " Q" + (x + pas / 2) + "," + (base - h) + " " + xf + "," + base;
    x = xf; i++;
  }
  d += " Z";
  chemin(page, d, ax, ay, s, fill);
}

export function lac(page: PDFPage, ax: number, ay: number, s: number, largeur: number, hauteur: number, base: number, fill: RGB) {
  let d = "M0," + base, x = 0, i = 0;
  const pas = 70;
  while (x <= largeur) {
    const h = hauteur * 0.14 * Math.sin(i * 1.1);
    d += " L" + x + "," + (base + h);
    x += pas; i++;
  }
  d += " L" + largeur + "," + (base + hauteur) + " L0," + (base + hauteur) + " Z";
  chemin(page, d, ax, ay, s, fill);
}

export function vagues(page: PDFPage, ax: number, ay: number, s: number, largeur: number, hauteur: number, base: number, fill: RGB) {
  let d = "M0," + base, x = 0, i = 0;
  const pas = 40;
  while (x < largeur) {
    const h = hauteur * 0.45 * (i % 2 === 0 ? 1 : 0.2);
    const xf = Math.min(x + pas, largeur);
    d += " Q" + (x + pas / 2) + "," + (base - h) + " " + xf + "," + base;
    x = xf; i++;
  }
  d += " L" + largeur + "," + (base + hauteur * 0.5) + " L0," + (base + hauteur * 0.5) + " Z";
  chemin(page, d, ax, ay, s, fill);
}

export function route(page: PDFPage, ax: number, ay: number, s: number, largeur: number, hauteur: number, base: number, fill: RGB, papier: RGB) {
  const w0 = hauteur * 0.9, w1 = largeur * 0.1, cx = largeur / 2;
  const d = "M" + (cx - w0 / 2) + "," + base + " L" + (cx - w1 / 2) + "," + (base - hauteur) +
    " L" + (cx + w1 / 2) + "," + (base - hauteur) + " L" + (cx + w0 / 2) + "," + base + " Z";
  chemin(page, d, ax, ay, s, fill);
  const n = 5;
  for (let i = 1; i < n; i++) {
    const t = i / n, yy = base - t * hauteur;
    trait(page, cx - 1.5, yy, cx + 1.5, yy - (hauteur / n) * 0.5, ax, ay, s, 2.4, papier);
  }
}

export function vigne(page: PDFPage, ax: number, ay: number, s: number, largeur: number, hauteur: number, base: number, fill: RGB) {
  let x = 6;
  const pas = 26;
  while (x < largeur) {
    trait(page, x, base, x + 9, base - hauteur, ax, ay, s, 3, fill);
    x += pas;
  }
}

// --- objets (cx, cy = point de sol) ----------------------------------------

export function chateau(page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) {
  const w = 46 * echelle, h = 40 * echelle, x0 = cx - w / 2, y0 = cy - h;
  chemin(page, `M${x0},${y0} H${x0 + w} V${y0 + h} H${x0} Z`, ax, ay, s, fill);
  for (let i = 1; i < 4; i += 2) {
    chemin(page, `M${x0 + (w * i) / 4},${y0 - 8 * echelle} H${x0 + (w * (i + 1)) / 4} V${y0} H${x0 + (w * i) / 4} Z`, ax, ay, s, fill);
  }
  const tw = 14 * echelle;
  chemin(page, `M${x0 - tw * 0.3},${y0 - 16 * echelle} H${x0 - tw * 0.3 + tw} V${y0 + h + 16 * echelle} H${x0 - tw * 0.3} Z`, ax, ay, s, fill);
}

export function clocher(page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) {
  const w = 22 * echelle, h = 42 * echelle, x0 = cx - w / 2, y0 = cy - h;
  chemin(page, `M${x0},${y0} H${x0 + w} V${cy} H${x0} Z`, ax, ay, s, fill);
  chemin(page, `M${x0},${y0} L${cx},${y0 - 11 * echelle} L${x0 + w},${y0} Z`, ax, ay, s, fill);
}

export function cypres(page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) {
  const w = 13 * echelle, h = 58 * echelle;
  const d = "M" + cx + "," + (cy - h) +
    " C" + (cx + w) + "," + (cy - h * 0.6) + " " + (cx + w * 0.6) + "," + (cy - h * 0.15) + " " + (cx + w * 0.75) + "," + cy +
    " L" + (cx - w * 0.75) + "," + cy +
    " C" + (cx - w * 0.6) + "," + (cy - h * 0.15) + " " + (cx - w) + "," + (cy - h * 0.6) + " " + cx + "," + (cy - h) + " Z";
  chemin(page, d, ax, ay, s, fill);
}

export function pin(page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) {
  const trH = 30 * echelle, trW = 4 * echelle;
  chemin(page, `M${cx - trW / 2},${cy - trH} H${cx + trW / 2} V${cy} H${cx - trW / 2} Z`, ax, ay, s, fill);
  const rx = 24 * echelle, ry = 13 * echelle, cyEllipse = cy - trH - ry * 0.5;
  chemin(page, ellipsePath(cx, cyEllipse, rx, ry), ax, ay, s, fill);
}

export function olivier(page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) {
  const trH = 16 * echelle;
  page.drawSvgPath(`M${cx},${cy} q${3 * echelle},-${trH * 0.5} 0,-${trH}`, {
    x: ax, y: ay, scale: s, borderColor: fill, borderWidth: (3 * echelle) / s,
  });
  chemin(page, ellipsePath(cx, cy - trH - 10 * echelle, 13 * echelle, 13 * echelle), ax, ay, s, fill);
}

export function platane(page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) {
  const trH = 22 * echelle, trW = 5 * echelle, rx = 34 * echelle, ry = 18 * echelle;
  chemin(page, `M${cx - trW / 2},${cy - trH} H${cx + trW / 2} V${cy} H${cx - trW / 2} Z`, ax, ay, s, fill);
  chemin(page, ellipsePath(cx, cy - trH - ry * 0.6, rx, ry), ax, ay, s, fill);
}

export function pont(page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) {
  const w = 76 * echelle, x0 = cx - w / 2, yPont = cy - 46 * echelle, sw = 3 * echelle;
  trait(page, x0, yPont, x0 + w, yPont, ax, ay, s, sw, fill);
  for (let i = 0; i < 5; i++) {
    const px = x0 + (w * (i + 0.5)) / 5;
    trait(page, px, yPont, px, cy, ax, ay, s, sw * 0.7, fill);
  }
}

export function rocher(page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) {
  const d = "M" + (cx - 24 * echelle) + "," + cy +
    " Q" + (cx - 26 * echelle) + "," + (cy - 22 * echelle) + " " + (cx - 6 * echelle) + "," + (cy - 26 * echelle) +
    " Q" + (cx + 16 * echelle) + "," + (cy - 30 * echelle) + " " + (cx + 24 * echelle) + "," + (cy - 10 * echelle) +
    " Q" + (cx + 28 * echelle) + "," + cy + " " + (cx + 24 * echelle) + "," + cy + " Z";
  chemin(page, d, ax, ay, s, fill);
}

export function aiguilles(page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) {
  const n = 6, w = 60 * echelle, x0 = cx - w / 2;
  for (let i = 0; i < n; i++) {
    const xx = x0 + (w * (i + 0.5)) / n, h = (18 + (i % 3) * 10) * echelle, bw = 5 * echelle;
    chemin(page, `M${xx - bw},${cy} L${xx},${cy - h} L${xx + bw},${cy} Z`, ax, ay, s, fill);
  }
}

export function dolmen(page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) {
  const legH = 20 * echelle, legW = 6 * echelle, topW = 44 * echelle, topH = 8 * echelle;
  chemin(page, `M${cx - topW / 2 + 4 * echelle},${cy - legH} H${cx - topW / 2 + 4 * echelle + legW} V${cy} H${cx - topW / 2 + 4 * echelle} Z`, ax, ay, s, fill);
  chemin(page, `M${cx + topW / 2 - 4 * echelle - legW},${cy - legH} H${cx + topW / 2 - 4 * echelle} V${cy} H${cx + topW / 2 - 4 * echelle - legW} Z`, ax, ay, s, fill);
  chemin(page, `M${cx - topW / 2},${cy - legH - topH} H${cx + topW / 2} V${cy - legH} H${cx - topW / 2} Z`, ax, ay, s, fill);
}

/** Motif dédié du 12 août -- croissant seul, voir illustrations.js. */
export function eclipse(page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) {
  const R = 15 * echelle, dy = 8 * echelle, cyDisque = cy - R - 4 * echelle;
  const xi = Math.sqrt(R * R - (dy / 2) * (dy / 2));
  const p1x = cx - xi, p1y = cyDisque - dy / 2, p2x = cx + xi, p2y = cyDisque - dy / 2;
  const d = `M${p1x},${p1y} A${R},${R} 0 1,1 ${p2x},${p2y} A${R},${R} 0 0,0 ${p1x},${p1y} Z`;
  chemin(page, d, ax, ay, s, fill);
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx},${cy} A${rx},${ry} 0 1,0 ${cx + rx},${cy} A${rx},${ry} 0 1,0 ${cx - rx},${cy} Z`;
}

// --- registre ---------------------------------------------------------------

const TEINTE_PAR_CATEGORIE: Record<string, string> = {
  route: "pietra", ville: "lago", nature: "oliva", lac: "lagoMid", evenement: "sole",
};

type NomBande = "collines" | "lac" | "vagues" | "route" | "vigne";
type NomObjet = "chateau" | "clocher" | "cypres" | "pin" | "olivier" | "platane" | "pont" | "rocher" | "aiguilles" | "dolmen";
const BANDES: NomBande[] = ["collines", "lac", "vagues", "route", "vigne"];
const OBJETS: Record<NomObjet, (page: PDFPage, ax: number, ay: number, s: number, cx: number, cy: number, echelle: number, fill: RGB) => void> = {
  chateau, clocher, cypres, pin, olivier, platane, pont, rocher, aiguilles, dolmen,
};
const ECHELLE_OBJET: Record<NomObjet, number> = {
  pont: 1.7, chateau: 2.6, clocher: 4.1, cypres: 3.7, pin: 2.7, olivier: 5.0,
  rocher: 2.4, aiguilles: 2.2, dolmen: 3.0, platane: 1.9,
};

export interface PaletteBandeau {
  paperDeep: RGB;
  pietra: RGB; lago: RGB; oliva: RGB; lagoMid: RGB; sole: RGB;
  papier: RGB;
}

/**
 * Compose un bandeau paysage dans le rectangle [ax,ay,largeurPage,hauteurPage]
 * de la page (ax,ay = coin haut-gauche en coordonnées PDF), à partir des noms
 * de illustration[] d'une journée -- même répartition 3 plans que
 * composerBandeau() côté app (voir illustrations.js), simplifiée : pas de
 * ciel ici sauf "eclipse", traité à part par l'appelant sur le 12 août.
 */
export function dessinerBandeau(
  page: PDFPage,
  noms: string[],
  categorie: string,
  ax: number,
  ay: number,
  largeurPage: number,
  hauteurPage: number,
  palette: PaletteBandeau,
) {
  // Hauteur locale fixe (260, comme composerBandeau côté app) : les tailles
  // d'objets (registre ECHELLE_OBJET) sont calibrées en pixels absolus pour
  // ce repère précis -- les faire varier avec hauteurPage désaligne le
  // rapport taille d'objet / hauteur de plan et fait déborder les objets du
  // plan proche en haut de bande (constaté en test visuel). L'appelant doit
  // donc choisir hauteurPage proche de 260*largeurPage/1000 pour un rendu
  // sans marge ; un hauteurPage plus grand laisse un fond papier visible
  // au-dessus de la composition plutôt que de la déformer.
  const LARGEUR_VB = 1000, HAUTEUR_VB = 260;
  const s = largeurPage / LARGEUR_VB;
  const variableCouleur = (palette as any)[TEINTE_PAR_CATEGORIE[categorie] || "pietra"] as RGB;
  const plans = [{ base: 130, amplitude: 34 }, { base: 190, amplitude: 40 }, { base: 260, amplitude: 54 }];
  const dosage = [45, 72, 100];
  const dephasage = [0.18, 0.58, 0.34];
  const X_MIN = 0.15, X_MAX = 0.85;

  const terrestres = (noms || []).filter((n) => BANDES.includes(n as NomBande) || (n in OBJETS));
  if (!terrestres.length) return;

  const N = plans.length;
  const seaux: string[][] = [[], [], []];
  terrestres.forEach((nom, i) => {
    const p = Math.min(Math.floor((i * N) / terrestres.length), N - 1);
    seaux[p].push(nom);
  });

  seaux.forEach((nomsDuPlan, p) => {
    const plan = plans[p];
    const teinte = nuance(variableCouleur, palette.paperDeep, dosage[p]);
    let yBande = plan.base;
    const objets: string[] = [];

    nomsDuPlan.forEach((nom) => {
      if (BANDES.includes(nom as NomBande)) {
        const fn = { collines, lac, vagues, vigne }[nom as "collines" | "lac" | "vagues" | "vigne"];
        if (fn) fn(page, ax, ay, s, LARGEUR_VB, plan.amplitude, yBande, teinte);
        else if (nom === "route") route(page, ax, ay, s, LARGEUR_VB, plan.amplitude, yBande, teinte, palette.papier);
        yBande -= plan.amplitude * 0.35;
      } else {
        objets.push(nom);
      }
    });

    if (objets.length) {
      const echelleGlobale = 0.75 + (N > 1 ? p / (N - 1) : 0) * 0.64;
      objets.forEach((nom, k) => {
        const frac = X_MIN + (((k + 1) / (objets.length + 1) + dephasage[p]) % 1) * (X_MAX - X_MIN);
        const dessin = OBJETS[nom as NomObjet];
        if (!dessin) return;
        dessin(page, ax, ay, s, LARGEUR_VB * frac, plan.base, echelleGlobale * (ECHELLE_OBJET[nom as NomObjet] || 1), teinte);
      });
    }
  });
}
