/* ==========================================================================
   ILLUSTRATIONS — bibliothèque de silhouettes SVG et composeur de bandeaux.

   Ce fichier ne connaît rien du carnet : il expose une quinzaine de
   primitives nommées (ILLUSTRATIONS) et une fonction composerBandeau()
   qui les assemble en paysage. carnet.html appelle composerBandeau()
   avec le champ `illustration` et la catégorie (`cat`) de chaque journée.

   Le dessin de l'éclipse du 12 août n'utilise rien de ce fichier : il
   reste sur mesure, câblé à part dans carnet.html (svgDisqueEclipse).

   ---------------------------------------------------------------------------
   STYLE
   ---------------------------------------------------------------------------
   Silhouettes plates (fill) ou traits (stroke) — jamais les deux mélangés
   dans un dégradé, jamais d'ombre portée. Une seule couleur par silhouette,
   fournie par l'appelant. Les couleurs viennent uniquement des variables
   CSS déjà définies dans carnet.html (palette Officina Bodoniana) : ce
   fichier ne définit aucune couleur en dur.

   ---------------------------------------------------------------------------
   TROIS NUANCES, UNE SEULE VARIABLE
   ---------------------------------------------------------------------------
   nuance() mélange une variable CSS avec un fond via color-mix() : pas de
   nouveau jeton de couleur, juste des dosages du même jeton.

   composerBandeau(noms, categorie, profond) : le troisième argument,
   facultatif, bascule vers le mode du bandeau de tête plein (fond sombre,
   --cat-*-deep en CSS). Les deux modes vont dans des directions opposées,
   parce que la profondeur doit toujours se lire en s'éloignant du fond :
   - mode clair (fond --paper-deep, clair) : les silhouettes s'assombrissent
     vers la couleur pure de la catégorie à mesure qu'on se rapproche
     (45 % / 72 % / 100 %) — le plan proche est le plus sombre, le plus
     contrasté sur le papier clair.
   - mode profond (fond --cat-*-deep, sombre) : les silhouettes s'éclaircissent
     vers --paper à mesure qu'on se rapproche (78 % / 52 % / 22 % de couleur
     pure, donc de moins en moins pure) — le plan proche est le plus clair,
     le plus contrasté sur le fond sombre. Mélanger vers le fond sombre lui
     même (comme le mode clair mélange vers son fond clair) noierait les
     plans lointains dans la couleur de fond : sur un fond sombre, il faut
     éclaircir, pas assombrir.

   ---------------------------------------------------------------------------
   RÉPARTITION SUR LES TROIS PLANS
   ---------------------------------------------------------------------------
   composerBandeau(noms, categorie) découpe le tableau `noms` en 3 tiers
   dans l'ORDRE D'ÉCRITURE : le premier tiers va au plan lointain, le
   dernier au plan proche. Convention pour qui écrit un `illustration` :
   lister les motifs de l'arrière-plan vers le premier plan.

   Chaque primitive est soit une "bande" (silhouette étirée sur toute la
   largeur : relief, eau, route, vigne), soit un "objet" (élément posé à
   une position : arbre, bâtiment, bateau...), soit un "ciel" (astre :
   soleil, éclipse). Dans un même plan, les bandes sont peintes d'abord
   (le sol), puis les objets par-dessus, répartis à intervalles réguliers
   sur la largeur. Les objets portent chacun un facteur `echelle` propre
   (voir le registre ILLUSTRATIONS) : leurs dimensions sont des constantes
   en pixels héritées du canevas de test (240 de large), sans rapport avec
   la largeur réelle du bandeau (1000) — `echelle` corrige ce décalage
   motif par motif pour viser 10 à 18 % de la largeur du bandeau.

   Les "ciel" ne suivent aucune de ces règles : ni bande, ni objet, ils
   ne participent pas à la répartition en trois plans (aucun objet placé
   « au sol » n'est un astre) et occupent une position verticale fixe
   dans le tiers haut du viewBox, à une échelle qui leur est propre —
   voir CIEL_Y et CIEL_ECHELLE dans composerBandeau().

   ---------------------------------------------------------------------------
   LES TRENTE-SEPT PRIMITIVES
   ---------------------------------------------------------------------------
   Bandes (8) : montagnes, collines, lac, vagues, vigne, route,
                terrasses, tourbiere

   Objets (29), par famille :
   - relief et eau : rocher, cascade, aiguilles, gorge, dolmen
   - végétal : cypres, pin, olivier, bambou, citronnier, platane
   - bâti courant : pont, chateau, clocher
   - bâti et monuments : arcades, coupole, creneaux, tour-penchee,
     aqueduc, viaduc, remparts
   - eau et navigation : voile, phare-eau
   - signes : soleil, capot, eclipse, labyrinthe, volcan, pierre-levee
   ========================================================================== */

/* --- couleur : catégorie de journée → variable CSS existante ------------ */
var TEINTE_PAR_CATEGORIE = {
  route: "--pietra",
  ville: "--lago",
  nature: "--oliva",
  lac: "--lago-mid",
  evenement: "--sole"
};

function nuance(variable, pourcentage, fond){
  /* par défaut, mélangée contre --paper-deep : c'est le fond réel du
     bandeau clair (voir .bandeau-illu-wrap). Le bandeau de tête plein
     (mode "profond") passe --paper à la place — voir composerBandeau(). */
  return "color-mix(in srgb, var(" + variable + ") " + pourcentage + "%, var(" + (fond || "--paper-deep") + ") " + (100 - pourcentage) + "%)";
}

/* --- bandes : silhouettes étirées sur une largeur donnée ----------------- */

function dessinerMontagnes(largeur, hauteur, base, fill){
  var pas = 90, d = "M0," + base, x = 0, i = 0;
  while(x < largeur){
    var h = hauteur * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.9)));
    d += " L" + (x + pas / 2) + "," + (base - h);
    x += pas; i++;
    d += " L" + Math.min(x, largeur) + "," + base;
  }
  d += " Z";
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

function dessinerCollines(largeur, hauteur, base, fill){
  var pas = 130, d = "M0," + base, x = 0, i = 0;
  while(x < largeur){
    var h = hauteur * (0.5 + 0.5 * Math.abs(Math.cos(i * 1.3)));
    var xf = Math.min(x + pas, largeur);
    d += " Q" + (x + pas / 2) + "," + (base - h) + " " + xf + "," + base;
    x = xf; i++;
  }
  d += " Z";
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

function dessinerLac(largeur, hauteur, base, fill){
  var pas = 70, d = "M0," + base, x = 0, i = 0;
  while(x <= largeur){
    var h = hauteur * 0.14 * Math.sin(i * 1.1);
    d += " L" + x + "," + (base + h);
    x += pas; i++;
  }
  d += " L" + largeur + "," + (base + hauteur) + " L0," + (base + hauteur) + " Z";
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

function dessinerVagues(largeur, hauteur, base, fill){
  var pas = 40, d = "M0," + base, x = 0, i = 0;
  while(x < largeur){
    var h = hauteur * 0.45 * (i % 2 === 0 ? 1 : 0.2);
    var xf = Math.min(x + pas, largeur);
    d += " Q" + (x + pas / 2) + "," + (base - h) + " " + xf + "," + base;
    x = xf; i++;
  }
  d += " L" + largeur + "," + (base + hauteur * 0.5) + " L0," + (base + hauteur * 0.5) + " Z";
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

function dessinerVigne(largeur, hauteur, base, fill){
  var out = "", pas = 26, x = 6;
  while(x < largeur){
    out += '<line x1="' + x + '" y1="' + base + '" x2="' + (x + 9) + '" y2="' + (base - hauteur) +
           '" stroke="' + fill + '" stroke-width="3" stroke-linecap="round"/>';
    x += pas;
  }
  return "<g>" + out + "</g>";
}

function dessinerRoute(largeur, hauteur, base, fill){
  var w0 = hauteur * 0.9, w1 = largeur * 0.1, cx = largeur / 2;
  var d = "M" + (cx - w0 / 2) + "," + base + " L" + (cx - w1 / 2) + "," + (base - hauteur) +
          " L" + (cx + w1 / 2) + "," + (base - hauteur) + " L" + (cx + w0 / 2) + "," + base + " Z";
  var tirets = "", n = 5, i;
  for(i = 1; i < n; i++){
    var t = i / n, yy = base - t * hauteur;
    tirets += '<line x1="' + (cx - 1.5) + '" y1="' + yy + '" x2="' + (cx + 1.5) + '" y2="' + (yy - hauteur / n * 0.5) +
              '" stroke="var(--paper)" stroke-width="2.4"/>';
  }
  return '<path d="' + d + '" fill="' + fill + '"/>' + tirets;
}

/* --- objets : éléments posés à une position (cx, cy = point de sol) ----- */

function dessinerPont(cx, cy, s, fill){
  var w = 76 * s, x0 = cx - w / 2, yPont = cy - 46 * s, sw = 3 * s, out = "", i;
  out += '<line x1="' + x0 + '" y1="' + yPont + '" x2="' + (x0 + w) + '" y2="' + yPont +
         '" stroke="' + fill + '" stroke-width="' + sw + '" stroke-linecap="round"/>';
  for(i = 0; i < 5; i++){
    var px = x0 + w * (i + 0.5) / 5;
    out += '<line x1="' + px + '" y1="' + yPont + '" x2="' + px + '" y2="' + cy +
           '" stroke="' + fill + '" stroke-width="' + (sw * 0.7) + '" stroke-linecap="round"/>';
  }
  return "<g>" + out + "</g>";
}

function dessinerChateau(cx, cy, s, fill){
  var w = 46 * s, h = 40 * s, x0 = cx - w / 2, y0 = cy - h;
  var out = '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" fill="' + fill + '"/>';
  var nc = 4, i;
  for(i = 0; i < nc; i++){
    if(i % 2 === 0) continue;
    out += '<rect x="' + (x0 + w * i / nc) + '" y="' + (y0 - 8 * s) + '" width="' + (w / nc) + '" height="' + (8 * s) + '" fill="' + fill + '"/>';
  }
  var tw = 14 * s;
  out += '<rect x="' + (x0 - tw * 0.3) + '" y="' + (y0 - 16 * s) + '" width="' + tw + '" height="' + (h + 16 * s) + '" fill="' + fill + '"/>';
  return "<g>" + out + "</g>";
}

function dessinerClocher(cx, cy, s, fill){
  /* toit de la même largeur que le corps, jamais plus large : au-delà,
     la silhouette se lit comme une flèche plutôt qu'une tour. */
  var w = 22 * s, h = 42 * s, x0 = cx - w / 2, y0 = cy - h;
  var corps = '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" fill="' + fill + '"/>';
  var toit = '<path d="M' + x0 + "," + y0 + " L" + cx + "," + (y0 - 11 * s) + " L" + (x0 + w) + "," + y0 +
             ' Z" fill="' + fill + '"/>';
  return "<g>" + corps + toit + "</g>";
}

function dessinerCypres(cx, cy, s, fill){
  var w = 13 * s, h = 58 * s;
  var d = "M" + cx + "," + (cy - h) +
          " C" + (cx + w) + "," + (cy - h * 0.6) + " " + (cx + w * 0.6) + "," + (cy - h * 0.15) + " " + (cx + w * 0.75) + "," + cy +
          " L" + (cx - w * 0.75) + "," + cy +
          " C" + (cx - w * 0.6) + "," + (cy - h * 0.15) + " " + (cx - w) + "," + (cy - h * 0.6) + " " + cx + "," + (cy - h) + " Z";
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

function dessinerPin(cx, cy, s, fill){
  var trH = 30 * s, trW = 4 * s;
  var tronc = '<rect x="' + (cx - trW / 2) + '" y="' + (cy - trH) + '" width="' + trW + '" height="' + trH + '" fill="' + fill + '"/>';
  var rx = 24 * s, ry = 13 * s, cyEllipse = cy - trH - ry * 0.5;
  var chapeau = '<ellipse cx="' + cx + '" cy="' + cyEllipse + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"/>';
  return "<g>" + tronc + chapeau + "</g>";
}

function dessinerOlivier(cx, cy, s, fill){
  var trH = 16 * s;
  var tronc = '<path d="M' + cx + "," + cy + " q" + (3 * s) + ",-" + (trH * 0.5) + " 0,-" + trH +
              '" stroke="' + fill + '" stroke-width="' + (3 * s) + '" fill="none" stroke-linecap="round"/>';
  var boule = '<circle cx="' + cx + '" cy="' + (cy - trH - 10 * s) + '" r="' + (13 * s) + '" fill="' + fill + '"/>';
  return "<g>" + tronc + boule + "</g>";
}

function dessinerVoile(cx, cy, s, fill){
  var hullW = 30 * s;
  var coque = '<path d="M' + (cx - hullW / 2) + "," + cy + " L" + (cx + hullW / 2) + "," + cy +
              " L" + (cx + hullW * 0.28) + "," + (cy + 11 * s) + " L" + (cx - hullW * 0.28) + "," + (cy + 11 * s) +
              ' Z" fill="' + fill + '"/>';
  var matH = 40 * s;
  var mat = '<line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - matH) + '" stroke="' + fill + '" stroke-width="' + (1.6 * s) + '"/>';
  var voile = '<path d="M' + cx + "," + (cy - matH) + " L" + cx + "," + cy + " L" + (cx - 20 * s) + "," + cy +
              ' Z" fill="' + fill + '"/>';
  return "<g>" + coque + mat + voile + "</g>";
}

function dessinerRocher(cx, cy, s, fill){
  var d = "M" + (cx - 24 * s) + "," + cy +
          " Q" + (cx - 26 * s) + "," + (cy - 22 * s) + " " + (cx - 6 * s) + "," + (cy - 26 * s) +
          " Q" + (cx + 16 * s) + "," + (cy - 30 * s) + " " + (cx + 24 * s) + "," + (cy - 10 * s) +
          " Q" + (cx + 28 * s) + "," + cy + " " + (cx + 24 * s) + "," + cy + " Z";
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

function dessinerSoleil(cx, cy, s, fill){
  var r = 16 * s, cyc = cy - r - 4 * s;
  var disque = '<circle cx="' + cx + '" cy="' + cyc + '" r="' + r + '" fill="' + fill + '"/>';
  var rayons = "", n = 8, i;
  for(i = 0; i < n; i++){
    var a = i / n * Math.PI * 2, r1 = r * 1.3, r2 = r * 1.65;
    rayons += '<line x1="' + (cx + Math.cos(a) * r1) + '" y1="' + (cyc + Math.sin(a) * r1) +
              '" x2="' + (cx + Math.cos(a) * r2) + '" y2="' + (cyc + Math.sin(a) * r2) +
              '" stroke="' + fill + '" stroke-width="' + (2 * s) + '" stroke-linecap="round"/>';
  }
  return "<g>" + disque + rayons + "</g>";
}

/* --- bâti et monuments : objets ------------------------------------------ */

function dessinerArcades(cx, cy, s, fill){
  var w = 60 * s, h = 34 * s, n = 4, archW = w / n, x0 = cx - w / 2, sw = 3 * s;
  var out = "", i;
  for(i = 0; i < n; i++){
    var xL = x0 + i * archW, xR = xL + archW, r = archW / 2, yTop = cy - h;
    out += '<path d="M' + xL + "," + cy + " L" + xL + "," + (yTop + r) +
           " A" + r + "," + r + " 0 0 1 " + xR + "," + (yTop + r) + " L" + xR + "," + cy +
           '" fill="none" stroke="' + fill + '" stroke-width="' + sw + '" stroke-linecap="round"/>';
  }
  return "<g>" + out + "</g>";
}

function dessinerCoupole(cx, cy, s, fill){
  var w = 30 * s, hDrum = 14 * s, x0 = cx - w / 2, yDrum = cy - hDrum, r = w / 2, yDome = yDrum - r;
  var drum = '<rect x="' + x0 + '" y="' + yDrum + '" width="' + w + '" height="' + hDrum + '" fill="' + fill + '"/>';
  var dome = '<path d="M' + x0 + "," + yDrum + " A" + r + "," + r + " 0 0 1 " + (x0 + w) + "," + yDrum + ' Z" fill="' + fill + '"/>';
  var lanterne = '<rect x="' + (cx - 2 * s) + '" y="' + (yDome - 8 * s) + '" width="' + (4 * s) + '" height="' + (8 * s) + '" fill="' + fill + '"/>' +
                 '<circle cx="' + cx + '" cy="' + (yDome - 10 * s) + '" r="' + (2.5 * s) + '" fill="' + fill + '"/>';
  return "<g>" + drum + dome + lanterne + "</g>";
}

function dessinerCreneaux(cx, cy, s, fill){
  var w = 70 * s, wallH = 16 * s, toothH = 12 * s, n = 5, toothW = w / n, x0 = cx - w / 2, yWall = cy - wallH;
  var mur = '<rect x="' + x0 + '" y="' + yWall + '" width="' + w + '" height="' + wallH + '" fill="' + fill + '"/>';
  var merlons = "", i;
  for(i = 0; i < n; i++){
    var xl = x0 + i * toothW, xr = xl + toothW, xm = (xl + xr) / 2, flare = toothW * 0.18;
    merlons += '<path d="M' + xl + "," + yWall + " L" + (xl - flare) + "," + (yWall - toothH) +
               " L" + xm + "," + (yWall - toothH * 0.55) + " L" + (xr + flare) + "," + (yWall - toothH) +
               " L" + xr + "," + yWall + ' Z" fill="' + fill + '"/>';
  }
  return "<g>" + mur + merlons + "</g>";
}

function dessinerTourPenchee(cx, cy, s, fill){
  var w = 16 * s, h = 60 * s, lean = 8 * s, x0 = cx - w / 2, y0 = cy - h;
  var corps = '<path d="M' + x0 + "," + cy + " L" + (x0 + lean) + "," + y0 +
              " L" + (x0 + lean + w) + "," + y0 + " L" + (x0 + w) + "," + cy + ' Z" fill="' + fill + '"/>';
  var toit = '<path d="M' + (x0 + lean) + "," + y0 + " L" + (x0 + lean + w / 2) + "," + (y0 - 10 * s) +
             " L" + (x0 + lean + w) + "," + y0 + ' Z" fill="' + fill + '"/>';
  return "<g>" + corps + toit + "</g>";
}

function dessinerAqueduc(cx, cy, s, fill){
  var w = 80 * s, hTot = 44 * s, n = 4, archW = w / n, x0 = cx - w / 2, sw = 3 * s;
  var out = "", tier, i;
  for(tier = 0; tier < 2; tier++){
    var yBase = cy - tier * (hTot * 0.5), yTop = yBase - hTot * 0.5;
    for(i = 0; i < n; i++){
      var xL = x0 + i * archW + archW * 0.08, xR = xL + archW * 0.84, r = (xR - xL) / 2;
      out += '<path d="M' + xL + "," + yBase + " L" + xL + "," + (yTop + r) +
             " A" + r + "," + r + " 0 0 1 " + xR + "," + (yTop + r) + " L" + xR + "," + yBase +
             '" fill="none" stroke="' + fill + '" stroke-width="' + sw + '" stroke-linecap="round"/>';
    }
  }
  return "<g>" + out + "</g>";
}

function dessinerViaduc(cx, cy, s, fill){
  var w = 90 * s, deckY = cy - 30 * s, pylonH = 46 * s, sw = 2.4 * s, x0 = cx - w / 2, x1 = cx + w / 2;
  var out = '<line x1="' + x0 + '" y1="' + deckY + '" x2="' + x1 + '" y2="' + deckY +
             '" stroke="' + fill + '" stroke-width="' + (sw * 1.3) + '" stroke-linecap="round"/>';
  [cx - w * 0.25, cx + w * 0.25].forEach(function(px){
    var top = deckY - pylonH, i;
    out += '<line x1="' + px + '" y1="' + deckY + '" x2="' + px + '" y2="' + top +
           '" stroke="' + fill + '" stroke-width="' + sw + '" stroke-linecap="round"/>';
    for(i = -2; i <= 2; i++){
      if(i === 0) continue;
      var xEnd = px + i * (w * 0.11);
      out += '<line x1="' + px + '" y1="' + top + '" x2="' + xEnd + '" y2="' + deckY +
             '" stroke="' + fill + '" stroke-width="' + (sw * 0.5) + '"/>';
    }
  });
  return "<g>" + out + "</g>";
}

function dessinerRemparts(cx, cy, s, fill){
  var w = 100 * s, h = 20 * s, x0 = cx - w / 2;
  var d = "M" + x0 + "," + cy + " L" + x0 + "," + (cy - h * 0.6) + " L" + (x0 + w * 0.3) + "," + (cy - h) +
          " L" + (x0 + w * 0.5) + "," + (cy - h * 0.7) + " L" + (x0 + w * 0.7) + "," + (cy - h) +
          " L" + (x0 + w) + "," + (cy - h * 0.6) + " L" + (x0 + w) + "," + cy + " Z";
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

/* --- nature et relief ---------------------------------------------------- */

function dessinerCascade(cx, cy, s, fill){
  var h = 50 * s, wallW = 16 * s, gap = 10 * s;
  var d = "M" + (cx - gap / 2 - wallW) + "," + cy + " L" + (cx - gap / 2 - wallW) + "," + (cy - h) +
          " L" + (cx - gap / 2) + "," + (cy - h * 0.8) + " L" + (cx - gap / 2) + "," + cy + " Z" +
          " M" + (cx + gap / 2) + "," + cy + " L" + (cx + gap / 2) + "," + (cy - h * 0.8) +
          " L" + (cx + gap / 2 + wallW) + "," + (cy - h) + " L" + (cx + gap / 2 + wallW) + "," + cy + " Z";
  var parois = '<path d="' + d + '" fill="' + fill + '"/>';
  var eau = "", n = 4, i;
  for(i = 0; i < n; i++){
    var xx = cx - gap / 2 + gap * (i + 0.5) / n;
    eau += '<line x1="' + xx + '" y1="' + (cy - h * 0.75) + '" x2="' + xx + '" y2="' + cy +
           '" stroke="' + fill + '" stroke-width="' + (1.4 * s) + '" stroke-linecap="round"/>';
  }
  return "<g>" + parois + eau + "</g>";
}

function dessinerAiguilles(cx, cy, s, fill){
  var n = 6, w = 60 * s, x0 = cx - w / 2, i, out = "";
  for(i = 0; i < n; i++){
    var xx = x0 + w * (i + 0.5) / n, h = (18 + (i % 3) * 10) * s, bw = 5 * s;
    out += '<path d="M' + (xx - bw) + "," + cy + " L" + xx + "," + (cy - h) + " L" + (xx + bw) + "," + cy + ' Z" fill="' + fill + '"/>';
  }
  return "<g>" + out + "</g>";
}

function dessinerGorge(cx, cy, s, fill){
  var h = 56 * s, wallW = 20 * s, gap = 8 * s;
  var d = "M" + (cx - gap / 2 - wallW) + "," + cy + " L" + (cx - gap / 2) + "," + cy +
          " L" + (cx - gap / 2) + "," + (cy - h) + " L" + (cx - gap / 2 - wallW) + "," + (cy - h * 0.85) + " Z" +
          " M" + (cx + gap / 2) + "," + cy + " L" + (cx + gap / 2 + wallW) + "," + cy +
          " L" + (cx + gap / 2 + wallW) + "," + (cy - h * 0.85) + " L" + (cx + gap / 2) + "," + (cy - h) + " Z";
  var parois = '<path d="' + d + '" fill="' + fill + '"/>';
  var filet = '<line x1="' + cx + '" y1="' + (cy - 2 * s) + '" x2="' + cx + '" y2="' + cy + '" stroke="' + fill + '" stroke-width="' + (1.2 * s) + '"/>';
  return "<g>" + parois + filet + "</g>";
}

function dessinerTerrasses(largeur, hauteur, base, fill){
  var marches = 5, pas = largeur / marches, x = 0, d = "M0," + base, i;
  for(i = 0; i < marches; i++){
    var yNext = base - hauteur * (i + 1) / marches;
    d += " L" + x + "," + yNext + " L" + (x + pas) + "," + yNext;
    x += pas;
  }
  d += " L" + largeur + "," + base + " Z";
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

function dessinerTourbiere(largeur, hauteur, base, fill){
  var out = dessinerLac(largeur, hauteur * 0.6, base, fill), n = Math.floor(largeur / 90), i;
  for(i = 0; i < n; i++){
    out += '<circle cx="' + (45 + i * 90) + '" cy="' + (base + hauteur * 0.15) + '" r="5" fill="' + fill + '"/>';
  }
  return "<g>" + out + "</g>";
}

function dessinerDolmen(cx, cy, s, fill){
  var legH = 20 * s, legW = 6 * s, topW = 44 * s, topH = 8 * s;
  var jambes = '<rect x="' + (cx - topW / 2 + 4 * s) + '" y="' + (cy - legH) + '" width="' + legW + '" height="' + legH + '" fill="' + fill + '"/>' +
               '<rect x="' + (cx + topW / 2 - 4 * s - legW) + '" y="' + (cy - legH) + '" width="' + legW + '" height="' + legH + '" fill="' + fill + '"/>';
  var table = '<rect x="' + (cx - topW / 2) + '" y="' + (cy - legH - topH) + '" width="' + topW + '" height="' + topH + '" fill="' + fill + '"/>';
  return "<g>" + jambes + table + "</g>";
}

/* --- végétal --------------------------------------------------------------- */

function dessinerBambou(cx, cy, s, fill){
  var n = 4, h = 46 * s, out = "", i, j;
  for(i = 0; i < n; i++){
    var x = cx - 14 * s + i * (9 * s), hh = h * (0.75 + 0.25 * (i % 2)), ns = 4;
    out += '<line x1="' + x + '" y1="' + cy + '" x2="' + x + '" y2="' + (cy - hh) + '" stroke="' + fill + '" stroke-width="' + (2.4 * s) + '" stroke-linecap="round"/>';
    for(j = 1; j < ns; j++){
      var yy = cy - hh * j / ns;
      out += '<line x1="' + (x - 2.5 * s) + '" y1="' + yy + '" x2="' + (x + 2.5 * s) + '" y2="' + yy + '" stroke="' + fill + '" stroke-width="' + (1.4 * s) + '"/>';
    }
  }
  return "<g>" + out + "</g>";
}

function dessinerCitronnier(cx, cy, s, fill){
  var potH = 10 * s, potW = 20 * s, trH = 8 * s;
  var pot = '<path d="M' + (cx - potW / 2) + "," + cy + " L" + (cx - potW * 0.4) + "," + (cy - potH) +
            " L" + (cx + potW * 0.4) + "," + (cy - potH) + " L" + (cx + potW / 2) + "," + cy + ' Z" fill="' + fill + '"/>';
  var tronc = '<rect x="' + (cx - 2 * s) + '" y="' + (cy - potH - trH) + '" width="' + (4 * s) + '" height="' + trH + '" fill="' + fill + '"/>';
  var boule = '<circle cx="' + cx + '" cy="' + (cy - potH - trH - 12 * s) + '" r="' + (13 * s) + '" fill="' + fill + '"/>';
  return "<g>" + pot + tronc + boule + "</g>";
}

function dessinerPlatane(cx, cy, s, fill){
  var trH = 22 * s, trW = 5 * s, rx = 34 * s, ry = 18 * s;
  var tronc = '<rect x="' + (cx - trW / 2) + '" y="' + (cy - trH) + '" width="' + trW + '" height="' + trH + '" fill="' + fill + '"/>';
  var houppier = '<ellipse cx="' + cx + '" cy="' + (cy - trH - ry * 0.6) + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"/>';
  return "<g>" + tronc + houppier + "</g>";
}

/* --- objets et signes ------------------------------------------------------ */

function dessinerCapot(cx, cy, s, fill){
  var w = 60 * s, h = 14 * s;
  var d = "M" + (cx - w / 2) + "," + cy + " L" + (cx - w / 2) + "," + (cy - h * 0.4) +
          " L" + (cx - w * 0.2) + "," + (cy - h) + " L" + (cx + w * 0.15) + "," + (cy - h) +
          " L" + (cx + w * 0.35) + "," + (cy - h * 0.5) + " L" + (cx + w / 2) + "," + (cy - h * 0.3) +
          " L" + (cx + w / 2) + "," + cy + " Z";
  var roues = '<circle cx="' + (cx - w * 0.28) + '" cy="' + cy + '" r="' + (6 * s) + '" fill="' + fill + '"/>' +
              '<circle cx="' + (cx + w * 0.28) + '" cy="' + cy + '" r="' + (6 * s) + '" fill="' + fill + '"/>';
  return '<path d="' + d + '" fill="' + fill + '"/>' + roues;
}

function dessinerEclipse(cx, cy, s, fill){
  /* un croissant unique, dessiné directement comme silhouette (deux arcs
     de même rayon, centres décalés) — pas deux disques superposés : le
     fichier ne connaît qu'une couleur, donc l'occultation doit être une
     forme, pas une soustraction de couleur. dy contrôle l'épaisseur du
     croissant ; choisi large pour rester lisible à 60 px, pas pour
     représenter le taux d'obscuration réel. Motif de la journée du 12
     août, à soigner particulièrement. */
  var R = 15 * s, dy = 8 * s, cyDisque = cy - R - 4 * s;
  var xi = Math.sqrt(R * R - (dy / 2) * (dy / 2));
  var p1x = cx - xi, p1y = cyDisque - dy / 2, p2x = cx + xi, p2y = cyDisque - dy / 2;
  var croissant = '<path d="M' + p1x + "," + p1y + " A" + R + "," + R + " 0 1,1 " + p2x + "," + p2y +
                   " A" + R + "," + R + " 0 0,0 " + p1x + "," + p1y + ' Z" fill="' + fill + '"/>';
  return "<g>" + croissant + "</g>";
}

function dessinerLabyrinthe(cx, cy, s, fill){
  var pas = 6 * s, n = 6, x = cx, y = cy, d = "M" + x + "," + y;
  var dirs = [[1, 0], [0, -1], [-1, 0], [0, 1]], len = pas, i;
  for(i = 0; i < n; i++){
    var dir = dirs[i % 4];
    x += dir[0] * len; y += dir[1] * len;
    d += " L" + x + "," + y;
    if(i % 2 === 1) len += pas;
  }
  return '<path d="' + d + '" fill="none" stroke="' + fill + '" stroke-width="' + (2.2 * s) + '" stroke-linecap="square"/>';
}

function dessinerPhareEau(cx, cy, s, fill){
  var moleLen = 40 * s, moleH = 3 * s, baliseW = 6 * s, baliseH = 20 * s, bx = cx - 4 * s;
  var mole = '<rect x="' + (cx - moleLen) + '" y="' + (cy - moleH) + '" width="' + moleLen + '" height="' + moleH + '" fill="' + fill + '"/>';
  var balise = '<rect x="' + (bx - baliseW / 2) + '" y="' + (cy - baliseH) + '" width="' + baliseW + '" height="' + baliseH + '" fill="' + fill + '"/>';
  var sommet = '<circle cx="' + bx + '" cy="' + (cy - baliseH - 4 * s) + '" r="' + (4 * s) + '" fill="' + fill + '"/>';
  return "<g>" + mole + balise + sommet + "</g>";
}

function dessinerVolcan(cx, cy, s, fill){
  var w = 50 * s, h = 34 * s, topW = 10 * s;
  var d = "M" + (cx - w / 2) + "," + cy + " L" + (cx - topW / 2) + "," + (cy - h) +
          " L" + (cx + topW / 2) + "," + (cy - h) + " L" + (cx + w / 2) + "," + cy + " Z";
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

function dessinerPierreLevee(cx, cy, s, fill){
  var w = 12 * s, h = 34 * s;
  var d = "M" + (cx - w / 2) + "," + cy + " L" + (cx - w * 0.35) + "," + (cy - h) +
          " L" + (cx + w * 0.2) + "," + (cy - h * 0.95) + " L" + (cx + w / 2) + "," + cy + " Z";
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

/* --- registre --------------------------------------------------------- */
/* echelle (objets uniquement) : facteur qui recalibre chaque silhouette,
   dessinée en pixels absolus pour un canevas de 240 de large, vers le
   bandeau réel de 1000. Valeur par défaut visée : ~14 % de la largeur du
   bandeau au plan médian. Quatre motifs hauts et étroits (clocher,
   cypres, tour-penchee, pierre-levee) reçoivent un facteur plus mesuré :
   un calibrage sur la seule largeur les ferait dépasser la hauteur du
   viewBox au plan le plus proche. */
var ILLUSTRATIONS = {
  montagnes: { type: "bande", dessin: dessinerMontagnes },
  collines:  { type: "bande", dessin: dessinerCollines },
  lac:       { type: "bande", dessin: dessinerLac },
  vagues:    { type: "bande", dessin: dessinerVagues },
  vigne:     { type: "bande", dessin: dessinerVigne },
  route:     { type: "bande", dessin: dessinerRoute },
  pont:      { type: "objet", dessin: dessinerPont, echelle: 1.7 },
  chateau:   { type: "objet", dessin: dessinerChateau, echelle: 2.6 },
  clocher:   { type: "objet", dessin: dessinerClocher, echelle: 4.1 },
  cypres:    { type: "objet", dessin: dessinerCypres, echelle: 3.7 },
  pin:       { type: "objet", dessin: dessinerPin, echelle: 2.7 },
  olivier:   { type: "objet", dessin: dessinerOlivier, echelle: 5.0 },
  voile:     { type: "objet", dessin: dessinerVoile, echelle: 3.7 },
  rocher:    { type: "objet", dessin: dessinerRocher, echelle: 2.4 },
  soleil:    { type: "ciel", dessin: dessinerSoleil },

  arcades:        { type: "objet", dessin: dessinerArcades, echelle: 2.2 },
  coupole:        { type: "objet", dessin: dessinerCoupole, echelle: 4.4 },
  creneaux:       { type: "objet", dessin: dessinerCreneaux, echelle: 1.9 },
  "tour-penchee": { type: "objet", dessin: dessinerTourPenchee, echelle: 3.1 },
  aqueduc:        { type: "objet", dessin: dessinerAqueduc, echelle: 1.6 },
  viaduc:         { type: "objet", dessin: dessinerViaduc, echelle: 1.5 },
  remparts:       { type: "objet", dessin: dessinerRemparts, echelle: 1.3 },

  cascade:    { type: "objet", dessin: dessinerCascade, echelle: 3.1 },
  aiguilles:  { type: "objet", dessin: dessinerAiguilles, echelle: 2.2 },
  gorge:      { type: "objet", dessin: dessinerGorge, echelle: 2.7 },
  terrasses:  { type: "bande", dessin: dessinerTerrasses },
  tourbiere:  { type: "bande", dessin: dessinerTourbiere },
  dolmen:     { type: "objet", dessin: dessinerDolmen, echelle: 3.0 },

  bambou:     { type: "objet", dessin: dessinerBambou, echelle: 4.8 },
  citronnier: { type: "objet", dessin: dessinerCitronnier, echelle: 5.0 },
  platane:    { type: "objet", dessin: dessinerPlatane, echelle: 1.9 },

  capot:          { type: "objet", dessin: dessinerCapot, echelle: 2.2 },
  eclipse:        { type: "ciel", dessin: dessinerEclipse },
  labyrinthe:     { type: "objet", dessin: dessinerLabyrinthe, echelle: 7.3 },
  "phare-eau":    { type: "objet", dessin: dessinerPhareEau, echelle: 3.1 },
  volcan:         { type: "objet", dessin: dessinerVolcan, echelle: 2.6 },
  "pierre-levee": { type: "objet", dessin: dessinerPierreLevee, echelle: 6.4 }
};

/* --- composeur -----------------------------------------------------------
   profond (facultatif) : mode bandeau de tête plein (chantier 2), fond
   sombre --cat-*-deep en CSS. Direction de mélange inversée par rapport
   au mode clair — voir le bloc "TROIS NUANCES" en tête de fichier.

   opts (facultatif) : mode "héros" (page d'accueil). Sans lui, la fonction
   se comporte exactement comme avant — mêmes 22 bandeaux de journée, au
   pixel près — puisque chaque valeur ci-dessous retombe sur son défaut
   littéral (les trois plans, les dosages et le déphasage d'origine) dès
   que le champ correspondant n'est pas fourni :
     hauteur    HAUTEUR du viewBox (défaut 360)
     plans      tableau {base, amplitude}, un par plan de profondeur —
                sa longueur pilote tout : nombre de plans, répartition
                en seaux, dosage et déphasage par défaut (défaut : les
                trois plans historiques)
     dosage     % de couleur pure par plan, un par entrée de `plans`
                (défaut : les trois dosages historiques)
     dephasage  décalage en x par plan, un par entrée de `plans`
                (défaut : les trois déphasages historiques)
     xMin/xMax  bande sûre en x (défaut 0.15/0.85 ; resserrée à
                0.25/0.75 pour l'accueil — sur mobile, le viewBox 1000×560
                est nettement plus rogné sur les côtés que les bandeaux
                de journée en 1000×360)
     cielY/cielEchelle  position et échelle du ciel (défaut : CIEL_Y/
                CIEL_ECHELLE, pensés pour HAUTEUR=360 — l'accueil, plus
                haut, fournit les siens)
   Un plans/dosage/dephasage de longueur différente de 3 doit être fourni
   en entier par l'appelant : il n'existe pas de génération automatique
   au-delà de trois plans, pour ne pas faire courir de risque à défaut
   historique. */
/* position et échelle des "ciel" (soleil, éclipse) par défaut : fixes,
   indépendantes des plans de profondeur — un astre n'est pas posé sur un
   plan. CIEL_Y est le repère passé aux fonctions de dessin (elles placent
   le disque au-dessus de ce point) ; choisi avec CIEL_ECHELLE pour que le
   disque et ses rayons/pointes tiennent dans le tiers haut du viewBox
   (0 à HAUTEUR/3) avec de la marge des deux côtés. */
var CIEL_Y = 95, CIEL_ECHELLE = 1.3;

function composerBandeau(noms, categorie, profond, opts){
  opts = opts || {};
  var LARGEUR = 1000, HAUTEUR = opts.hauteur || 360;
  var variable = TEINTE_PAR_CATEGORIE[categorie] || "--pietra";
  var plans = opts.plans || [
    { base: 175, amplitude: 46 },
    { base: 255, amplitude: 52 },
    { base: 360, amplitude: 70 }
  ];
  var cielY = opts.cielY != null ? opts.cielY : CIEL_Y;
  var cielEchelle = opts.cielEchelle != null ? opts.cielEchelle : CIEL_ECHELLE;
  /* fond de mélange et dosages [lointain, ..., proche], en % de la
     couleur pure de catégorie (voir nuance()) — sens opposé selon le
     mode, pour que la profondeur s'éloigne toujours du fond réel :
     en clair on assombrit vers la couleur pure (ascendant), en profond
     on éclaircit vers --paper (descendant, donc de moins en moins pur). */
  var fond = profond ? "--paper" : "--paper-deep";
  var dosage = opts.dosage || (profond ? [78, 52, 22] : [45, 72, 100]);
  /* déphasage par plan : évite qu'un objet seul dans chaque plan retombe
     systématiquement au centre (x identique d'un plan à l'autre). */
  var dephasage = opts.dephasage || [0.18, 0.58, 0.34];
  /* bande sûre en x : toute composition de 4 primitives se répartit en
     seaux [2,1,1], donc un plan à un seul objet est fréquent — sans
     cette bande, le déphasage peut renvoyer un x proche de 0 ou 1 et
     le slice du viewBox rogne l'objet sur les bords en mobile. */
  var X_MIN = opts.xMin != null ? opts.xMin : 0.15;
  var X_MAX = opts.xMax != null ? opts.xMax : 0.85;

  var valides = (noms || []).filter(function(n){ return !!ILLUSTRATIONS[n]; });
  if(!valides.length) return "";

  var celestes = valides.filter(function(n){ return ILLUSTRATIONS[n].type === "ciel"; });
  var terrestres = valides.filter(function(n){ return ILLUSTRATIONS[n].type !== "ciel"; });

  var corps = "";
  var dosageProche = dosage[dosage.length - 1];

  /* le ciel se peint en premier (les silhouettes des plans peuvent
     légitimement passer devant), mais reçoit le dosage du plan le plus
     proche : c'est l'élément signature du bandeau — l'éclipse du 12 août
     doit être la forme la plus lisible, pas la plus lointaine. */
  celestes.forEach(function(nom, k){
    var frac = X_MIN + (((k + 1) / (celestes.length + 1)) % 1) * (X_MAX - X_MIN);
    var teinte = nuance(variable, dosageProche, fond);
    corps += ILLUSTRATIONS[nom].dessin(LARGEUR * frac, cielY, cielEchelle, teinte);
  });

  if(terrestres.length){
    var N = plans.length;
    var seaux = [];
    for(var s = 0; s < N; s++) seaux.push([]);
    terrestres.forEach(function(nom, i){
      var p = Math.floor(i * N / terrestres.length);
      seaux[Math.min(p, N - 1)].push(nom);
    });

    seaux.forEach(function(nomsDuPlan, p){
      var plan = plans[p], teinte = nuance(variable, dosage[p], fond);
      var yBande = plan.base, objets = [];

      nomsDuPlan.forEach(function(nom){
        var def = ILLUSTRATIONS[nom];
        if(def.type === "bande"){
          corps += def.dessin(LARGEUR, plan.amplitude, yBande, teinte);
          yBande -= plan.amplitude * 0.35;
        } else {
          objets.push(nom);
        }
      });

      if(objets.length){
        /* échelle 0.75 (lointain) → 1.39 (proche), toujours sur cette
           même plage quel que soit le nombre de plans : p/(N-1) plutôt
           que p brut, sans quoi un 4e ou 5e plan pousserait les objets
           du premier plan (déjà calibrés à s~5-7 pour certains, voir le
           registre ILLUSTRATIONS) bien au-delà de leur taille prévue.
           Pour N=3, p/(N-1) vaut 0, 0.5, 1 : mêmes 0.75/1.07/1.39 qu'avant. */
        var echelle = 0.75 + (N > 1 ? p / (N - 1) : 0) * 0.64;
        objets.forEach(function(nom, k){
          var frac = X_MIN + (((k + 1) / (objets.length + 1) + dephasage[p]) % 1) * (X_MAX - X_MIN);
          var def = ILLUSTRATIONS[nom];
          corps += def.dessin(LARGEUR * frac, plan.base, echelle * (def.echelle || 1), teinte);
        });
      }
    });
  }

  return '<svg class="bandeau-illu" viewBox="0 0 ' + LARGEUR + " " + HAUTEUR +
         '" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' + corps + "</svg>";
}
