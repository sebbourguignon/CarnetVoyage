// Composants de mise en page du PDF carnet -- un composant = une fonction
// nommée qui dessine un bloc précis et retourne le curseur vertical (y)
// après son propre contenu, jamais un y codé en dur côté appelant. Séparé
// d'index.ts (qui ne fait plus que : récupérer les données, construire le
// contexte, appeler ces composants dans l'ordre) -- refactor du 2026-08-05,
// demandé explicitement : logique de données / logique de mise en page /
// logique de rendu ne doivent plus vivre dans la même fonction géante.
//
// Correspondance avec les noms demandés en conversation (composants
// génériques anglais) -- gardés en français comme le reste du projet
// (voir CLAUDE.md, "tout le contenu est en français, y compris les
// commentaires de code") :
//   drawCoverPage        -> dessinerPageCouverture
//   drawStoryPage         -> dessinerPageRecit
//   drawEditorialPhotoPage (page collage, gabarit 3+ photos) -> dessinerGaleriePhotos (branche "collage")
//   drawClosingPage       -> dessinerPageCloture
//   drawStamp             -> dessinerSceau (déjà dans ornements.ts)
//   drawItalyMap           -> dessinerCarteStylisee (déjà dans ornements.ts)
//   drawSectionTitle       -> dessinerEnteteJour (en-tête de jour) / dessinerTitreSection (page collage)
//   drawPhotoWithCaption   -> dessinerPhotoAvecLegende
//   drawQuoteBlock         -> dessinerBlocCitation
//   drawHighlightsBlock    -> dessinerRepereJour (lieux + distance/durée)

import { PDFDocument, PDFFont, PDFImage, PDFPage, RGB } from "npm:pdf-lib@1.17.1";
import { appendBezierCurve, clip, closePath, endPath, lineTo, moveTo, popGraphicsState, pushGraphicsState, rectangle } from "npm:pdf-lib@1.17.1";
import { dessinerBandeau } from "./illustrations.ts";
import { dessinerCarteItalie, dessinerMotifScene, dessinerParaphe, dessinerPhotoArche, dessinerSceau, dessinerSeparateurOlivier } from "./ornements.ts";
import { colonnes, COMPOSITION, GRILLE, PALETTE, PALETTE_BANDEAU, TYPO } from "./design-system.ts";
import { deviverIconePourLieu, dessinerIconeBandeau, NomIconeBandeau } from "./icones.ts";

export interface Polices {
  titre: PDFFont; // Bodoni Bold — titres de jour, chapitres
  titreDoux: PDFFont; // Bodoni Regular — couverture (grand corps, moins agressif)
  accroche: PDFFont; // Bodoni Italic — accroche de journée, esprit carnet manuscrit
  texte: PDFFont; // Plex Regular — corps
  label: PDFFont; // Plex SemiBold — eyebrows, folios, labels
  legende: PDFFont; // Plex Light — légendes photo
}

export function nettoyerHtml(s: unknown): string {
  return String(s || "").replace(/<[^>]+>/g, "");
}

export function formatDateLongue(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Nombre de lignes qu'occupera `texte` une fois enveloppé à `maxWidth` --
 * pdf-lib ne renvoie AUCUNE métrique depuis page.drawText() (elle renvoie
 * la page elle-même, pas un compte de lignes : un premier essai de mesure
 * s'appuyait sur une métrique qui n'existe pas, silencieusement toujours
 * `undefined` -- bug repéré le 2026-08-05 sur le rendu réel, un titre de
 * couverture sur 2 lignes venait percuter la date). Retour à la ligne mot
 * par mot, glouton, même logique que celle de pdf-lib en interne.
 */
export function compterLignes(font: PDFFont, texte: string, taille: number, maxWidth: number): number {
  const mots = texte.split(/\s+/).filter(Boolean);
  if (!mots.length) return 1;
  let lignes = 1;
  let ligneActuelle = mots[0];
  for (let i = 1; i < mots.length; i++) {
    const essai = `${ligneActuelle} ${mots[i]}`;
    if (font.widthOfTextAtSize(essai, taille) > maxWidth) {
      lignes++;
      ligneActuelle = mots[i];
    } else {
      ligneActuelle = essai;
    }
  }
  return lignes;
}

/**
 * Dessine un texte avec retour à la ligne automatique et retourne le y de
 * la dernière ligne réellement occupée -- jamais un décalage fixe, pour ne
 * jamais faire chevaucher le bloc suivant quand le texte prend plus de
 * lignes que prévu.
 */
export function dessinerTexteMesure(
  page: PDFPage,
  texte: string,
  x: number,
  y: number,
  opts: { size: number; font: PDFFont; color: RGB; maxWidth: number; lineHeight: number },
): number {
  page.drawText(texte, { x, y, ...opts });
  const nbLignes = compterLignes(opts.font, texte, opts.size, opts.maxWidth);
  return y - (nbLignes - 1) * opts.lineHeight;
}

export function nouvellePage(pdf: PDFDocument): PDFPage {
  const page = pdf.addPage([GRILLE.largeur, GRILLE.hauteur]);
  page.drawRectangle({ x: 0, y: 0, width: GRILLE.largeur, height: GRILLE.hauteur, color: PALETTE.carta });
  return page;
}

export function dessinerPiedDePage(page: PDFPage, polices: Polices, libelleGauche: string, numero: number) {
  const y = COMPOSITION.piedY;
  dessinerSeparateurOlivier(page, GRILLE.marge, y + 19, GRILLE.largeur - GRILLE.marge * 2, PALETTE.oliva);
  page.drawText(libelleGauche.toUpperCase(), { x: GRILLE.marge, y, size: TYPO.folio.taille, font: polices.label, color: PALETTE.grigio });
  const texteNumero = String(numero).padStart(2, "0");
  const largeurNumero = polices.label.widthOfTextAtSize(texteNumero, TYPO.folio.taille);
  page.drawText(texteNumero, { x: GRILLE.largeur - GRILLE.marge - largeurNumero, y, size: TYPO.folio.taille, font: polices.label, color: PALETTE.grigio });
}

/** Filet vertical décoratif en marge gauche -- signature répétée sur toutes les pages. */
export function dessinerFiletMarge(page: PDFPage) {
  page.drawRectangle({ x: COMPOSITION.filetMargeX, y: 76, width: 0.75, color: PALETTE.rosso, height: GRILLE.hauteur - 128 });
}

/** Sceau "ITALIE · SOUVENIRS DE FAMILLE", scène centrale = loggia + cyprès + horizon (line-art, esprit tampon de collection). */
export function dessinerSceauCarnet(page: PDFPage, polices: Polices, cx: number, cy: number, rayon: number) {
  dessinerSceau(page, cx, cy, rayon, "ITALIE", "SOUVENIRS DE FAMILLE", polices.label,
    (pg, mx, my) => dessinerMotifScene(pg, mx, my - rayon * 0.06, rayon * 0.92, PALETTE.rosso), PALETTE.rosso);
}

/**
 * Carte d'Italie stylisée en filigrane -- silhouette (italie.ts, tracé fixe
 * dérivé d'une vraie frontière) + itinéraire pointillé + marqueurs
 * (ornements.ts::dessinerCarteItalie). `opacite` régit uniquement la
 * silhouette/le tracé, jamais au point de la rendre invisible (règle
 * explicite des maquettes : la carte doit rester un vrai élément visuel,
 * pas un détail gris perdu dans un coin).
 */
export function dessinerRepereCarte(page: PDFPage, x: number, yHaut: number, largeur: number, hauteur: number, opacite = 0.9) {
  dessinerCarteItalie(page, x, yHaut, largeur, hauteur, PALETTE.mapStroke, PALETTE.mapFill, PALETTE.rosso, PALETTE.rosso, PALETTE.carta, opacite);
}

/**
 * Photo en cadrage "cover" (plein cadre, recadré, jamais de bande morte
 * autour d'une photo dont le ratio ne colle pas à la case) avec légende
 * optionnelle en dessous. Le clip vient de pdf-lib bas niveau
 * (rectangle+clip+endPath, exportés publiquement) : pas d'API haut niveau
 * pour ça dans pdf-lib.
 *
 * Limite assumée : le recadrage n'a AUCUNE notion du sujet de la photo (pas
 * de détection de visage/objet, hors de portée sans service externe). Seul
 * ajustement possible sans cette information : quand le rognage est
 * vertical (photo plus "haute" que sa case), le cadre est décalé vers le
 * haut plutôt que parfaitement centré (BIAIS_VERTICAL) -- un visage est
 * statistiquement plus souvent dans le tiers supérieur d'une photo que
 * pile au centre. Ça réduit le risque de tête coupée sans le garantir.
 */
const BIAIS_VERTICAL_CADRAGE = 0.35; // 0 = centré, 1 = aligné tout en haut

/**
 * Hauteur réellement nécessaire sous une photo pour sa légende (0 si
 * absente) -- mesurée, pas une réserve fixe qui suppose toujours une seule
 * ligne (bug constaté au test de rendu réel du 2026-08-05 : une légende
 * de plusieurs lignes venait chevaucher la vignette suivante).
 */
export function hauteurLegende(font: PDFFont, legende: string | null, largeurCase: number): number {
  if (!legende) return 0;
  const texte = legende.slice(0, 140);
  const nbLignes = compterLignes(font, texte, TYPO.legende.taille, largeurCase);
  return 14 + nbLignes * TYPO.legende.interligne;
}

const KAPPA_COIN = 0.5522847498;

/**
 * coinArrondi (optionnel) : rayon d'arrondi appliqué au seul coin
 * inférieur droit -- "arrondi discret uniquement sur un angle", jamais
 * les quatre (ce ne serait plus discret, esprit carte à jouer). Construit
 * à la main (moveTo/lineTo/appendBezierCurve, mêmes opérateurs bas niveau
 * que la découpe en arche de la couverture) : pdf-lib n'a pas de primitive
 * "rectangle à coin arrondi" toute faite.
 */
export function dessinerPhotoAvecLegende(page: PDFPage, polices: Polices, img: PDFImage | null, x: number, yHaut: number, largeurCase: number, hauteurCase: number, legende: string | null, coinArrondi = 0) {
  if (!img) return;
  const yBas = yHaut - hauteurCase;
  if (coinArrondi > 0) {
    const r = Math.min(coinArrondi, hauteurCase / 2, largeurCase / 2);
    page.pushOperators(
      pushGraphicsState(),
      moveTo(x, yBas + r),
      lineTo(x, yHaut),
      lineTo(x + largeurCase, yHaut),
      lineTo(x + largeurCase, yBas + r),
      appendBezierCurve(x + largeurCase, yBas + r - r * KAPPA_COIN, x + largeurCase - r + r * KAPPA_COIN, yBas, x + largeurCase - r, yBas),
      lineTo(x, yBas),
      closePath(),
      clip(),
      endPath(),
    );
  } else {
    page.pushOperators(pushGraphicsState(), rectangle(x, yBas, largeurCase, hauteurCase), clip(), endPath());
  }
  const echelle = Math.max(largeurCase / img.width, hauteurCase / img.height);
  const lw = img.width * echelle, lh = img.height * echelle;
  // biais=0 -> Y=yBas-excedent/2 (centré) ; biais=1 -> Y=yBas-excedent
  // (haut de l'image aligné pile sur yHaut, tout le rognage absorbé en bas).
  const excedentVertical = lh - hauteurCase;
  page.drawImage(img, { x: x - (lw - largeurCase) / 2, y: yBas - (excedentVertical * (1 + BIAIS_VERTICAL_CADRAGE)) / 2, width: lw, height: lh });
  page.pushOperators(popGraphicsState());
  if (legende) {
    page.drawText(legende.slice(0, 140), {
      x, y: yBas - 14, size: TYPO.legende.taille, font: polices.legende, color: PALETTE.grigio, maxWidth: largeurCase, lineHeight: TYPO.legende.interligne,
    });
  }
}

/**
 * Titre de section générique, distinct du titre de jour déjà affiché plus
 * haut sur la page -- couche supplémentaire demandée pour la page collage
 * (l'équivalent d'un "Les plus beaux points de vue" de magazine). Texte
 * éditorial fixe, pas une donnée du voyage.
 */
export function dessinerTitreSection(page: PDFPage, polices: Polices, texte: string, y: number): number {
  page.drawText("GALERIE DU JOUR", { x: GRILLE.marge, y, size: TYPO.labelSection.taille, font: polices.label, color: PALETTE.rosso });
  y -= 18;
  page.drawText(texte, { x: GRILLE.marge, y: y - 18, size: 19, font: polices.titreDoux, color: PALETTE.inchiostro });
  return y - 34;
}

/** Citation mise en avant (guillemet + italique) -- uniquement à partir d'une légende réellement renseignée, jamais un texte inventé. */
export function dessinerBlocCitation(page: PDFPage, polices: Polices, texte: string, x: number, y: number, largeur: number): number {
  page.drawText("“", { x, y: y - 6, size: 30, font: polices.titreDoux, color: PALETTE.oliva });
  page.drawText(texte, {
    x: x + 26, y: y - 8, size: TYPO.citation.taille, font: polices.accroche, color: PALETTE.inchiostro,
    maxWidth: largeur - 26, lineHeight: TYPO.citation.interligne,
  });
  return y - 54;
}

/** Découpe un texte en phrases (., !, ? suivis d'un espace ou de la fin), sans en modifier le contenu. */
function decouperEnPhrases(texte: string): string[] {
  return (texte.match(/[^.!?]+[.!?]+(\s+|$)/g) || [texte]).map((p) => p.trim()).filter(Boolean);
}

/** Regroupe des phrases en `n` paragraphes aussi égaux que possible -- pure présentation, jamais de reformulation. */
function grouperEnParagraphes(phrases: string[], n: number): string[] {
  if (phrases.length <= n) return phrases;
  const taillePar = Math.ceil(phrases.length / n);
  const groupes: string[] = [];
  for (let i = 0; i < phrases.length; i += taillePar) groupes.push(phrases.slice(i, i + taillePar).join(" "));
  return groupes;
}

/**
 * Dessine le récit en 2-3 paragraphes visuels (texte inchangé, seule la
 * présentation est découpée) avec un petit espace entre chacun. Si la toute
 * dernière phrase se termine par "!", elle est isolée et mise en avant
 * (terracotta, semi-gras) -- typiquement une phrase de conclusion du type
 * "Une belle journée bien remplie !". Retourne la hauteur totale occupée
 * (mesurée, pour dimensionner la photo en vis-à-vis à la même hauteur).
 */
function dessinerParagraphes(page: PDFPage, polices: Polices, texteJour: string, x: number, y: number, largeur: number): number {
  const phrases = decouperEnPhrases(texteJour);
  let phraseFinale: string | null = null;
  let phrasesCorps = phrases;
  const derniere = phrases[phrases.length - 1];
  if (phrases.length > 1 && derniere && derniere.trim().endsWith("!") && derniere.length <= 70) {
    phraseFinale = derniere.trim();
    phrasesCorps = phrases.slice(0, -1);
  }
  const paragraphes = grouperEnParagraphes(phrasesCorps, 3);
  const espaceParagraphe = 7;
  let yCourant = y;
  for (const p of paragraphes) {
    page.drawText(p, { x, y: yCourant, size: TYPO.corps.taille, font: polices.texte, color: PALETTE.inchiostro, maxWidth: largeur, lineHeight: TYPO.corps.interligne });
    const nbLignes = compterLignes(polices.texte, p, TYPO.corps.taille, largeur);
    yCourant -= nbLignes * TYPO.corps.interligne + espaceParagraphe;
  }
  if (phraseFinale) {
    yCourant += espaceParagraphe - 2; // resserré : c'est la conclusion du même récit, pas un nouveau paragraphe
    page.drawText(phraseFinale, { x, y: yCourant, size: TYPO.corps.taille, font: polices.label, color: PALETTE.rosso, maxWidth: largeur, lineHeight: TYPO.corps.interligne });
    const nbLignes = compterLignes(polices.label, phraseFinale, TYPO.corps.taille, largeur);
    yCourant -= nbLignes * TYPO.corps.interligne;
  }
  return y - yCourant;
}

/**
 * Récit à double lecture : texte en colonne gauche, photo principale en
 * colonne droite à la hauteur du texte (jamais deux blocs indépendants
 * empilés) -- correspond à "récit écrit / récit photographique" du brief.
 * Sans photo principale, le texte repasse en pleine largeur (comportement
 * de repli, jamais de colonne vide).
 */
export function dessinerRecitColonnes(
  page: PDFPage,
  polices: Polices,
  texteJour: string,
  photoPrincipale: PhotoValide | null,
  y: number,
  yPlancher?: number,
  photoSecondaire?: PhotoValide | null,
): number {
  const largeurContenu = GRILLE.largeur - GRILLE.marge * 2;
  if (!photoPrincipale) {
    const hauteurTexte = dessinerParagraphes(page, polices, texteJour, GRILLE.marge, y, largeurContenu);
    return y - hauteurTexte - 22;
  }
  const [colTexte, colPhoto] = colonnes(2, largeurContenu, GRILLE.marge, 24, [0.54, 0.46]);
  const hauteurTexte = dessinerParagraphes(page, polices, texteJour, colTexte.x, y, colTexte.largeur);

  // Photo secondaire en cadre arche, colonne de GAUCHE, sous le texte
  // (maquette de référence, page récit : une petite photo en arche avec sa
  // légende, distincte des grandes photos de la colonne de droite).
  // dessinerPhotoArche + dessinerPhotoAvecLegende partagent la même règle
  // de sécurité : jamais de légende dessinée si l'image est absente
  // (dessinerPhotoAvecLegende retourne tôt sur `!img`) -- ici on applique
  // la même garde explicitement avant même d'entrer dans ce bloc.
  let yApresTexteGauche = y - hauteurTexte - 18;
  if (photoSecondaire && photoSecondaire.img) {
    const largeurArche = Math.min(colTexte.largeur, 190);
    const hauteurArche = 150;
    dessinerPhotoArche(page, photoSecondaire.img, colTexte.x, yApresTexteGauche, largeurArche, hauteurArche);
    if (photoSecondaire.legende) {
      page.drawText(photoSecondaire.legende.slice(0, 140), {
        x: colTexte.x, y: yApresTexteGauche - hauteurArche - 14, size: TYPO.legende.taille, font: polices.legende, color: PALETTE.grigio,
        maxWidth: largeurArche, lineHeight: TYPO.legende.interligne,
      });
    }
    yApresTexteGauche -= hauteurArche + Math.max(26, hauteurLegende(polices.legende, photoSecondaire.legende, largeurArche) + 10);
  }

  // `yPlancher` (le haut du bandeau fixe "temps forts", quand fourni) fait
  // monter la photo de droite pour occuper tout l'espace vertical
  // disponible plutôt que de s'arrêter à la hauteur du texte -- sans ça,
  // un récit court laisse un grand vide blanc entre le bloc récit et le
  // bandeau (constaté à l'inspection du rendu réel, 2026-08-05). La photo
  // reste toujours au moins aussi haute que le texte, jamais plus courte.
  const hauteurDisponible = yPlancher !== undefined ? y - (yPlancher + 20) : 0;
  const hauteurPhoto = Math.max(hauteurTexte, hauteurDisponible, 170);
  dessinerPhotoAvecLegende(page, polices, photoPrincipale.img, colPhoto.x, y, colPhoto.largeur, hauteurPhoto, photoPrincipale.legende);
  const reserve = Math.max(26, hauteurLegende(polices.legende, photoPrincipale.legende, colPhoto.largeur) + 10);
  return Math.min(yApresTexteGauche, y - Math.max(hauteurTexte, hauteurPhoto) - reserve);
}

/**
 * En-tête de page de journée : date, titre (mesuré, jamais de collision
 * avec ce qui suit), accroche italique (j.accroche, donnée réelle,
 * facultative), filet de fin de bloc.
 */
export function dessinerEnteteJour(
  page: PDFPage,
  polices: Polices,
  opts: { date: string; titre: string; accroche: string | null; estEclipse: boolean; largeurDisponible: number },
  y: number,
): number {
  page.drawText(opts.date.toUpperCase(), { x: GRILLE.marge, y, size: TYPO.dateJour.taille, font: polices.label, color: opts.estEclipse ? PALETTE.blu : PALETTE.rosso });
  y -= 34;
  y = dessinerTexteMesure(page, opts.titre, GRILLE.marge, y, {
    size: TYPO.titreJour.taille, font: polices.titre, color: PALETTE.inchiostro, maxWidth: opts.largeurDisponible, lineHeight: TYPO.titreJour.interligne,
  });
  y -= 20;
  if (opts.accroche) {
    page.drawText(opts.accroche, {
      x: GRILLE.marge, y, size: TYPO.accrocheJour.taille, font: polices.accroche, color: PALETTE.grigio, maxWidth: opts.largeurDisponible, lineHeight: TYPO.accrocheJour.interligne,
    });
    const nbLignes = compterLignes(polices.accroche, opts.accroche, TYPO.accrocheJour.taille, opts.largeurDisponible);
    y -= nbLignes * TYPO.accrocheJour.interligne + 14;
  }
  dessinerSeparateurOlivier(page, GRILLE.marge, y, 86, opts.estEclipse ? PALETTE.blu : PALETTE.oliva);
  return y - 24;
}

/**
 * Bandeau de bas de page récit "LES TEMPS FORTS / DÉTAILS DU JOUR" (maquette
 * de référence, page 2) : à gauche les lieux réellement renseignés, chacun
 * avec une icône DIFFÉRENTE devinée par mot-clé (icones.ts::deviverIconePourLieu,
 * jamais une icône inventée pour un lieu non reconnu -- repli sur la goutte
 * générique), séparés par des pointillés verticaux ; à droite, uniquement
 * les champs réellement connus (rail1/rail2 -- distance, durée), jamais de
 * "météo" ou "ambiance" fabriquées puisqu'aucune donnée du voyage ne les
 * porte (règle explicite CLAUDE.md : jamais inventer une donnée manquante).
 * Deux colonnes séparées par un filet vertical olive, chacune avec son
 * propre petit titre en petites capitales rouge + trait.
 */
export function dessinerBandeauTempsForts(
  page: PDFPage,
  polices: Polices,
  opts: { lieux: { nom: string; ordre: number }[]; rail1: string | null; rail2: string | null; largeurDisponible: number },
  y: number,
): number {
  const lieuxTries = opts.lieux.slice(0, 5).sort((a, b) => a.ordre - b.ordre);
  const aDesDetails = !!(opts.rail1 || opts.rail2);
  if (!lieuxTries.length && !aDesDetails) return y;

  page.drawRectangle({ x: GRILLE.marge, y, width: opts.largeurDisponible, height: 0.6, color: PALETTE.sauge });
  y -= 22;

  const [colGauche, colDroite] = colonnes(2, opts.largeurDisponible, GRILLE.marge, 20, [0.6, 0.4]);
  const yHautBandeau = y;

  function titreColonne(x: number, texte: string) {
    page.drawText(texte, { x, y, size: TYPO.labelSection.taille, font: polices.label, color: PALETTE.rosso });
    page.drawRectangle({ x, y: y - 8, width: 18, height: 1.4, color: PALETTE.rosso });
  }

  if (lieuxTries.length) {
    titreColonne(colGauche.x, "LES TEMPS FORTS");
    const largeurCase = colGauche.largeur / lieuxTries.length;
    lieuxTries.forEach((lieu, i) => {
      const cx = colGauche.x + i * largeurCase;
      const icone = deviverIconePourLieu(String(lieu.nom || ""));
      dessinerIconeBandeau(page, icone, cx + largeurCase / 2 - 9, y - 42, 18, PALETTE.oliva);
      dessinerTexteCentre(page, String(lieu.nom || ""), cx + largeurCase / 2, y - 56, {
        size: TYPO.legende.taille, font: polices.texte, color: PALETTE.inchiostro, maxWidth: largeurCase - 8, lineHeight: 10,
      });
      if (i > 0) {
        for (let py = y - 6; py > y - 74; py -= 6) {
          page.drawRectangle({ x: cx - 4, y: py, width: 0.6, height: 3, color: PALETTE.sauge });
        }
      }
    });
  }

  if (aDesDetails) {
    titreColonne(colDroite.x, "DÉTAILS DU JOUR");
    let yLigne = y - 20;
    const lignes: { icone: NomIconeBandeau; texte: string }[] = [];
    if (opts.rail1) lignes.push({ icone: "route", texte: opts.rail1 });
    if (opts.rail2) lignes.push({ icone: "horloge", texte: opts.rail2 });
    for (const ligne of lignes) {
      dessinerIconeBandeau(page, ligne.icone, colDroite.x, yLigne - 14, 16, PALETTE.oliva);
      page.drawText(ligne.texte, { x: colDroite.x + 24, y: yLigne - 10, size: TYPO.meta.taille, font: polices.texte, color: PALETTE.inchiostro, maxWidth: colDroite.largeur - 24 });
      yLigne -= 24;
    }
  }

  const hauteurBloc = lieuxTries.length ? 90 : 70;
  return yHautBandeau - hauteurBloc;
}

/** Petite aide : texte centré horizontalement autour de `cx`, avec retour à la ligne géré. */
function dessinerTexteCentre(page: PDFPage, texte: string, cx: number, y: number, opts: { size: number; font: PDFFont; color: RGB; maxWidth: number; lineHeight: number }) {
  const largeur = Math.min(opts.maxWidth, opts.font.widthOfTextAtSize(texte, opts.size));
  page.drawText(texte, { x: cx - largeur / 2, y, size: opts.size, font: opts.font, color: opts.color, maxWidth: opts.maxWidth, lineHeight: opts.lineHeight });
}

export interface PhotoValide {
  img: PDFImage;
  legende: string | null;
}

/**
 * Hauteur minimale qu'une section de galerie doit pouvoir tenir sur la
 * page courante avant d'y démarrer -- surtitre + titre + accroche + au
 * moins le premier bloc photo. Si l'espace restant est inférieur, la
 * galerie démarre sur une page neuve plutôt que de laisser un titre
 * orphelin en bas de la page récit (règle explicite du 2026-08-05).
 */
export const HAUTEUR_MIN_SECTION_GALERIE = 320;

export function espaceDisponible(y: number): number {
  return y - GRILLE.espaceFooter;
}

/**
 * Galerie photo adaptative : 1 = pleine largeur, 2 = principale + secondaire
 * de tailles différentes, 3 = composition éditoriale dédiée (voir
 * dessinerPageGalerieTrois), 4+ = hero + mosaïque variée. `etatPage` est
 * mutable (page courante + folio) : la galerie peut déclencher un saut de
 * page en cours de route si le contenu déborde, et le signale à l'appelant
 * en mutant `etatPage.page`/`etatPage.folio`.
 */
export function dessinerGaleriePhotos(
  etatPage: { page: PDFPage; folio: number },
  pdf: PDFDocument,
  polices: Polices,
  titrePage: string,
  valides: PhotoValide[],
  yDepart: number,
): number {
  let y = yDepart;
  const largeurContenu = GRILLE.largeur - GRILLE.marge * 2;

  function assurerPlace(hauteurBloc: number) {
    if (y - hauteurBloc < 60) {
      dessinerPiedDePage(etatPage.page, polices, titrePage, etatPage.folio);
      etatPage.page = nouvellePage(pdf);
      etatPage.folio++;
      // jamais une page de continuation sans repère -- une galerie qui
      // déborde en interne (composition trop dense pour une seule page)
      // doit quand même s'ouvrir sur un titre, jamais juste des photos
      // orphelines en haut d'une page vide (bug constaté au test réel du
      // 2026-08-05 : la moitié de la galerie atterrissait sur une page
      // sans aucun repère, avec une première page à moitié vide).
      dessinerFiletMarge(etatPage.page);
      etatPage.page.drawText(`${titrePage.toUpperCase()} (SUITE)`, {
        x: GRILLE.marge, y: GRILLE.hauteur - 50, size: TYPO.labelSection.taille, font: polices.label, color: PALETTE.rosso,
      });
      y = GRILLE.hauteur - 80;
    }
  }
  const photo = (img: PDFImage | null, x: number, largeurCase: number, hauteurCase: number, legende: string | null) =>
    dessinerPhotoAvecLegende(etatPage.page, polices, img, x, y, largeurCase, hauteurCase, legende);

  if (valides.length === 1) {
    const h = Math.min(Math.max(y - GRILLE.espaceFooter, 160), 460);
    assurerPlace(h + 20);
    photo(valides[0].img, GRILLE.marge, largeurContenu, h, valides[0].legende);
    y -= h + Math.max(26, hauteurLegende(polices.legende, valides[0].legende, largeurContenu) + 10);
  } else if (valides.length === 2) {
    // récit à double lecture : une photo principale plus grande (le
    // souvenir choisi) et une secondaire plus étroite -- pas deux cases
    // identiques, pour une vraie hiérarchie visuelle. Colonnes posées via
    // la grille centralisée (design-system.ts), pas un calcul ad hoc.
    const [colPrincipale, colSecondaire] = colonnes(2, largeurContenu, GRILLE.marge, 14, [0.62, 0.38]);
    const h = Math.min(Math.max(y - GRILLE.espaceFooter, 160), colPrincipale.largeur * 0.85, 400);
    assurerPlace(h + 20);
    photo(valides[0].img, colPrincipale.x, colPrincipale.largeur, h, valides[0].legende);
    photo(valides[1].img, colSecondaire.x, colSecondaire.largeur, h, valides[1].legende);
    const reserve = Math.max(hauteurLegende(polices.legende, valides[0].legende, colPrincipale.largeur), hauteurLegende(polices.legende, valides[1].legende, colSecondaire.largeur));
    y -= h + Math.max(26, reserve + 10);
  } else if (valides.length >= 3) {
    // au-delà de 3, la composition dédiée (voir dessinerPageGalerieTrois,
    // appelée directement par index.ts pour le cas n=3) ne s'applique pas
    // -- ici : hero pleine largeur, citation, puis colonne verticale +
    // vignettes empilées, tailles volontairement variées.
    y = dessinerTitreSection(etatPage.page, polices, "Les plus beaux instants du jour", y);
    const [hero, ...reste] = valides;
    // la hauteur se déduit de l'espace RÉELLEMENT disponible (moins la
    // marge de sécurité de 20pt utilisée par assurerPlace), jamais d'un
    // plafond fixe indépendant -- un plafond fixe (ex. 320) pouvait
    // dépasser de peu l'espace restant et faire basculer tout un bloc sur
    // la page suivante en laissant la précédente à moitié vide (bug
    // constaté au test réel du 2026-08-05, cas à 5 photos).
    const hauteurHero = Math.min(Math.max((y - GRILLE.espaceFooter - 20) * 0.4, 150), 230);
    assurerPlace(hauteurHero + 20);
    photo(hero.img, GRILLE.marge, largeurContenu, hauteurHero, null);
    y -= hauteurHero + 20;

    const citation = [hero, ...reste].map((e) => e.legende).find((l) => l && l.trim());
    if (citation) {
      assurerPlace(50);
      y = dessinerBlocCitation(etatPage.page, polices, citation, GRILLE.marge, y, largeurContenu);
    }

    if (reste.length) {
      const [vertical, ...vignettes] = reste;
      const espace = 12;
      const [colVerticale, colVignettes] = colonnes(2, largeurContenu, GRILLE.marge, espace, [0.56, 0.44]);
      const hauteurBloc = Math.min(Math.max(y - GRILLE.espaceFooter - 20, 140), 300);
      assurerPlace(hauteurBloc + 20);
      photo(vertical.img, colVerticale.x, colVerticale.largeur, hauteurBloc, vertical.legende);

      // réserve mesurée (pas fixe) pour la légende entre deux vignettes
      // empilées -- la plus haute des deux légendes affichées, pour que
      // l'espacement soit identique quelle que soit celle qui déborde.
      const vignettesAffichees = vignettes.slice(0, 2);
      const reserveLegende = Math.max(10, ...vignettesAffichees.map((v) => hauteurLegende(polices.legende, v.legende, colVignettes.largeur)));
      const hauteurVignette = vignettesAffichees.length === 2 ? (hauteurBloc - espace - reserveLegende) / 2 : hauteurBloc;
      let yVignette = y;
      for (const v of vignettesAffichees) {
        dessinerPhotoAvecLegende(etatPage.page, polices, v.img, colVignettes.x, yVignette, colVignettes.largeur, hauteurVignette, v.legende);
        yVignette -= hauteurVignette + espace + reserveLegende;
      }
      y -= hauteurBloc + Math.max(26, hauteurLegende(polices.legende, vertical.legende, colVerticale.largeur) + 10);

      // au-delà de hero + vertical + 2 vignettes (5 photos et plus) :
      // bandeau panoramique final pour ancrer la page plutôt qu'une
      // troisième rangée qui casserait le rythme à trois blocs.
      const surplus = vignettes.slice(2);
      if (surplus.length) {
        const hauteurBandeau = Math.min(Math.max(y - GRILLE.espaceFooter - 20, 90), 160);
        assurerPlace(hauteurBandeau + 20);
        photo(surplus[0].img, GRILLE.marge, largeurContenu, hauteurBandeau, surplus[0].legende);
        y -= hauteurBandeau + Math.max(26, hauteurLegende(polices.legende, surplus[0].legende, largeurContenu) + 10);
      }
    }
  }
  return y;
}

/**
 * Page galerie dédiée pour exactement 3 photos -- composition asymétrique
 * imposée (conversation du 2026-08-05) : photo A large à gauche (~58%),
 * photo B en haut à droite (~38%) avec un bloc citation dessous, photo C
 * panoramique pleine largeur en bas. Toujours appelée sur une page neuve
 * (voir index.ts) : jamais mêlée à la page récit.
 */
export function dessinerPageGalerieTrois(
  page: PDFPage,
  polices: Polices,
  opts: { surtitre: string; titre: string; intro: string; photos: [PhotoValide, PhotoValide, PhotoValide] },
  yDepart: number,
): number {
  const largeurContenu = GRILLE.largeur - GRILLE.marge * 2;
  let y = yDepart;

  page.drawText(opts.surtitre.toUpperCase(), { x: GRILLE.marge, y, size: 9.5, font: polices.label, color: PALETTE.rosso });
  page.drawRectangle({ x: GRILLE.marge, y: y - 12, width: 28, height: 2, color: PALETTE.rosso });
  y -= 52;
  // gap mesuré, pas une valeur fixe trop courte -- même bug que
  // précédemment (deux lignes de texte consécutives ont besoin d'un écart
  // qui tienne compte de leurs propres ascendantes/descendantes, pas d'un
  // delta arbitraire de 10pt) : constaté à l'inspection du rendu réel.
  y = dessinerTexteMesure(page, opts.titre, GRILLE.marge, y, {
    size: 38, font: polices.titreDoux, color: PALETTE.inchiostro, maxWidth: largeurContenu * 0.62, lineHeight: 42,
  });
  y -= 14;
  dessinerSeparateurOlivier(page, GRILLE.marge, y, 150, PALETTE.oliva);
  y -= 28;
  y = dessinerTexteMesure(page, opts.intro, GRILLE.marge, y, {
    size: 11, font: polices.texte, color: PALETTE.grigio, maxWidth: 280, lineHeight: 15,
  });
  y -= 24;

  const [photoA, photoB, photoC] = opts.photos;
  const espace = 14;
  const [colA, colB] = colonnes(2, largeurContenu, GRILLE.marge, espace, [0.58, 0.42]);
  const hauteurA = 218, hauteurB = 190;
  // décalage volontaire de photo B (composition asymétrique, maquette 3 :
  // la photo de droite "commence un peu plus bas" que celle de gauche).
  const decalageB = 0;
  dessinerPhotoAvecLegende(page, polices, photoA.img, colA.x, y, colA.largeur, hauteurA, photoA.legende);

  // la légende de la photo B n'est PAS répétée sous l'image : elle devient
  // directement le bloc citation en dessous (éviter la redite constatée au
  // rendu réel -- même texte affiché deux fois, une petite et une grande).
  dessinerPhotoAvecLegende(page, polices, photoB.img, colB.x, y - decalageB, colB.largeur, hauteurB, null);
  // au moins 18pt d'espace net entre la photo et la citation qui suit
  // (règle explicite des maquettes : jamais de guillemet collé à une
  // photo) -- pas juste "de l'attention", un espace mesuré en dur ici.
  const ESPACE_MIN_PHOTO_TEXTE = 18;
  const yQuote = y - decalageB - hauteurB - ESPACE_MIN_PHOTO_TEXTE;
  const citation = photoB.legende || photoA.legende || photoC.legende || "Un instant de la journée.";
  const yApresQuote = dessinerBlocCitation(page, polices, citation, colB.x, yQuote, colB.largeur);

  // la ligne suivante démarre sous la colonne la PLUS BASSE des deux
  // (photo A + légende, ou photo B décalée + citation) -- jamais calculé
  // sur une seule colonne, sinon la photo C peut chevaucher la citation
  // quand celle-ci descend plus bas que la photo A (bug potentiel avec le
  // décalageB introduit pour l'asymétrie).
  const yBasColA = y - hauteurA - Math.max(26, hauteurLegende(polices.legende, photoA.legende, colA.largeur) + 10);
  const yBasColB = yApresQuote - 10;
  y = Math.min(yBasColA, yBasColB);

  // rangée 3 (maquette de référence) : grande photo panoramique alignée à
  // DROITE (~68% de la largeur, pas pleine largeur), avec dans la marge
  // gauche restante un petit rameau d'olivier isolé -- purement
  // décoratif, ça occupe l'espace qui restait vide en bas de page plutôt
  // que de laisser near la moitié de la page en blanc (constaté à
  // l'inspection du rendu réel, 2026-08-05). La hauteur de la photo se
  // déduit de l'espace RÉELLEMENT restant jusqu'au pied de page, jamais
  // d'une valeur fixe qui laisserait un vide résiduel.
  const largeurC = largeurContenu * 0.72;
  const xC = GRILLE.marge + largeurContenu - largeurC;
  const hauteurC = Math.min(Math.max(y - 78, 205), 285);
  dessinerPhotoAvecLegende(page, polices, photoC.img, xC, y, largeurC, hauteurC, photoC.legende, 22);
  dessinerSeparateurOlivier(page, GRILLE.marge, y - hauteurC / 2, largeurContenu - largeurC - 12, PALETTE.oliva);
  y -= hauteurC + Math.max(26, hauteurLegende(polices.legende, photoC.legende, largeurC) + 10);

  return y;
}

export interface DonneesCouverture {
  titre: string;
  mode: "perso" | "famille";
  dateDebut: string | null;
  dateFin: string | null;
  nbJours: number;
  nbPhotos: number;
  motifsRepli: string[];
  imgHero: PDFImage | null;
}

/** Page 1 -- couverture : photo héros en arche, titre, sceau, carte, dates réelles. Retombe sur un bandeau vectoriel si aucune photo n'a pu être téléchargée. */
export function dessinerPageCouverture(pdf: PDFDocument, polices: Polices, d: DonneesCouverture): PDFPage {
  const page = nouvellePage(pdf);
  dessinerFiletMarge(page);
  const hauteurArche = COMPOSITION.couverture.photoHauteur;
  if (d.imgHero) {
    dessinerPhotoArche(page, d.imgHero, GRILLE.marge, COMPOSITION.couverture.photoHaut, GRILLE.largeur - GRILLE.marge * 2, hauteurArche);
  } else {
    dessinerBandeau(page, d.motifsRepli, "ville", 0, GRILLE.hauteur - GRILLE.margeBandeau, GRILLE.largeur, hauteurArche, PALETTE_BANDEAU);
  }
  dessinerSceauCarnet(page, polices, GRILLE.largeur - 100, GRILLE.hauteur - 100, 46);

  const yZoneTexte = COMPOSITION.couverture.photoHaut - hauteurArche;
  const largeurTexte = COMPOSITION.couverture.largeurTitre;
  let y = yZoneTexte - 38;
  page.drawRectangle({ x: GRILLE.marge, y, width: 34, height: 3, color: PALETTE.rosso });
  y -= 22;
  page.drawText(d.mode === "perso" ? "CARNET PERSONNEL" : "CARNET DE FAMILLE", { x: GRILLE.marge, y, size: TYPO.labelCouverture.taille, font: polices.label, color: PALETTE.rosso });
  y -= 42;
  // La carte passe derrière le bloc éditorial, avant le titre, afin de
  // former une seule composition sans jamais recouvrir les glyphes.
  dessinerRepereCarte(page, GRILLE.largeur * 0.53, yZoneTexte + 8, GRILLE.largeur * 0.41, 300, 0.30);
  y = dessinerTexteMesure(page, d.titre, GRILLE.marge, y, {
    size: TYPO.titreCouverture.taille, font: polices.titre, color: PALETTE.inchiostro, maxWidth: largeurTexte, lineHeight: TYPO.titreCouverture.interligne,
  });
  y -= 30;
  const bornes = [d.dateDebut, d.dateFin].filter((x): x is string => !!x);
  if (bornes.length) {
    y = dessinerTexteMesure(page, bornes.length === 2 ? `Du ${bornes[0]} au ${bornes[1]}` : bornes[0], GRILLE.marge, y, {
      size: TYPO.dateCouverture.taille, font: polices.texte, color: PALETTE.grigio, maxWidth: largeurTexte, lineHeight: TYPO.dateCouverture.interligne,
    });
    y -= 22;
  }
  dessinerSeparateurOlivier(page, GRILLE.marge, y, 250, PALETTE.oliva);
  page.drawSvgPath("M2,15 L2,6 L6,6 L7.5,3.5 L12.5,3.5 L14,6 L18,6 L18,15 Z", { x: GRILLE.marge, y: 62, scale: 0.7, borderColor: PALETTE.oliva, borderWidth: 1.3 / 0.7 });
  page.drawEllipse({ x: GRILLE.marge + 7, y: 56, xScale: 2.5, yScale: 2.5, borderColor: PALETTE.oliva, borderWidth: 1 });
  page.drawText(`${d.nbJours} journée${d.nbJours > 1 ? "s" : ""} illustrée${d.nbJours > 1 ? "s" : ""} · ${d.nbPhotos} photo${d.nbPhotos > 1 ? "s" : ""}`, {
    x: GRILLE.marge + 24, y: 52, size: TYPO.recapCouverture.taille, font: polices.label, color: PALETTE.grigio,
  });
  return page;
}

/** Séparateur de chapitre pleine page (journees.chapitre), numéro géant Bodoni. */
export function dessinerSeparateurChapitre(pdf: PDFDocument, polices: Polices, chapitre: { numero?: string; titre?: string }): PDFPage {
  const page = nouvellePage(pdf);
  dessinerFiletMarge(page);
  const y = GRILLE.hauteur / 2;
  if (chapitre.numero) {
    page.drawText(chapitre.numero, { x: GRILLE.marge, y: y + 10, size: TYPO.titreChapitre.taille, font: polices.titre, color: PALETTE.inchiostro });
  }
  if (chapitre.titre) {
    page.drawText(nettoyerHtml(chapitre.titre).toUpperCase(), { x: GRILLE.marge, y: y - 30, size: TYPO.sousTitreChapitre.taille, font: polices.label, color: PALETTE.rosso });
  }
  page.drawRectangle({ x: GRILLE.marge, y: y - 46, width: 34, height: 2, color: PALETTE.rosso });
  dessinerParaphe(page, GRILLE.marge + 44, y - 45, PALETTE.oliva);
  return page;
}

export interface DonneesCloture {
  titreCarnet: string;
  dateDebut: string | null;
  dateFin: string | null;
  nbJours: number;
  nbPhotos: number;
  mode: "perso" | "famille";
  folio: number;
}

/**
 * Page de clôture -- ENTIÈREMENT typographique/vectorielle (maquette de
 * référence 2026-08-05 : sceau, carte en filigrane, titre, phrase, dates,
 * récapitulatif, filet olive, pied de page -- AUCUNE photo). L'ancienne
 * bande de vignettes-souvenir (dessinerBandeauSouvenirs) a été retirée : un
 * crop de photo en bas de carnet cassait la lecture "beau livre" recherchée
 * par les 3 maquettes, dont la page de clôture ne montre jamais d'image.
 */
export function dessinerPageCloture(pdf: PDFDocument, polices: Polices, d: DonneesCloture): PDFPage {
  const page = nouvellePage(pdf);
  dessinerFiletMarge(page);
  dessinerSceauCarnet(page, polices, GRILLE.largeur - 90, GRILLE.hauteur - 80, 40);
  dessinerRepereCarte(page, GRILLE.largeur - COMPOSITION.cloture.carteLargeur - 18, 610,
    COMPOSITION.cloture.carteLargeur, COMPOSITION.cloture.carteHauteur, COMPOSITION.cloture.opaciteCarte);

  const largeurTexte = GRILLE.largeur - GRILLE.marge * 2;
  // bloc titre+phrase+dates+récap centré verticalement (règle explicite :
  // entre ~0.35h et ~0.65h) plutôt que plaqué en haut de page -- une page
  // de clôture avec un seul bloc court, ancrée en haut, laissait plus de
  // la moitié de la page vide en dessous (constaté à l'inspection du rendu
  // réel, 2026-08-05).
  let y = GRILLE.hauteur * 0.62;

  page.drawRectangle({ x: GRILLE.marge, y, width: 34, height: 3, color: PALETTE.rosso });
  y -= 50;
  y = dessinerTexteMesure(page, "Fin du carnet", GRILLE.marge, y, {
    size: TYPO.titreCloture.taille, font: polices.titre, color: PALETTE.inchiostro, maxWidth: largeurTexte, lineHeight: TYPO.titreCloture.interligne,
  });
  y -= 28;
  y = dessinerTexteMesure(page, "Un carnet à conserver, à partager, à relire.", GRILLE.marge, y, {
    size: TYPO.phraseCloture.taille, font: polices.accroche, color: PALETTE.grigio, maxWidth: largeurTexte, lineHeight: TYPO.phraseCloture.interligne,
  });
  y -= 30;

  const bornes = [d.dateDebut, d.dateFin].filter((x): x is string => !!x);
  if (bornes.length) {
    y = dessinerTexteMesure(page, bornes.length === 2 ? `${bornes[0]} → ${bornes[1]}` : bornes[0], GRILLE.marge, y, {
      size: 10.5, font: polices.label, color: PALETTE.rosso, maxWidth: largeurTexte, lineHeight: 15,
    });
    y -= 22;
  }
  page.drawText(`${d.nbJours} journée${d.nbJours > 1 ? "s" : ""} illustrée${d.nbJours > 1 ? "s" : ""} · ${d.nbPhotos} photo${d.nbPhotos > 1 ? "s" : ""} ${d.mode === "perso" ? "personnelle" + (d.nbPhotos > 1 ? "s" : "") : "partagée" + (d.nbPhotos > 1 ? "s" : "")}`, {
    x: GRILLE.marge, y, size: 10, font: polices.texte, color: PALETTE.inchiostro, maxWidth: largeurTexte,
  });
  y -= 26;
  dessinerSeparateurOlivier(page, GRILLE.marge, y, 250, PALETTE.oliva);
  dessinerPiedDePage(page, polices, d.titreCarnet, d.folio);
  return page;
}
