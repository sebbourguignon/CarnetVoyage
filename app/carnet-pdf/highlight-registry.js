(function(global){
  "use strict";

  var CATEGORIES=["heritage","museum","architecture","automotive","gastronomy","tasting","nature","mountain","water","panorama","activity","family","other"];
  var ICONES={
    heritage:'<path d="M4 20V9h16v11M7 9V5h10v4M8 13h2m4 0h2m-8 4h2m4 0h2"/>',
    museum:'<path d="M3.5 9 12 4l8.5 5M5 10h14M6.5 10v8m3-8v8m5-8v8m3-8v8M4 20h16"/>',
    architecture:'<path d="M5 20V9l7-5 7 5v11h-5v-6h-4v6M8 10h2m4 0h2"/>',
    automotive:'<path d="M4 14l2-5h12l2 5v4h-2v2h-3v-2H9v2H6v-2H4Zm3-3h10l-1-3H8Z"/>',
    gastronomy:'<path d="M6 3v8m-2-8v6a2 2 0 0 0 4 0V3m0 8v10m8-18v18m0-18c4 4 4 8 0 10"/>',
    tasting:'<path d="M9 3h6v3l2 3v11H7V9l2-3Zm0 7h6m-6 5h6"/>',
    nature:'<path d="M5 19C6 9 12 4 20 4c0 8-5 14-15 15Zm2-2 8-8"/>',
    mountain:'<path d="m3 19 6.5-11 3 5 2.5-4 6 10Zm4.5-4h10"/>',
    water:'<path d="M3 10c2.2 0 2.2-2 4.5-2s2.2 2 4.5 2 2.2-2 4.5-2 2.2 2 4.5 2M3 15c2.2 0 2.2-2 4.5-2s2.2 2 4.5 2 2.2-2 4.5-2 2.2 2 4.5 2"/>',
    panorama:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.6"/>',
    activity:'<path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18"/>',
    family:'<circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M3.5 20c.5-4.5 2.5-6.5 5.5-6.5s5 2 5.5 6.5m-1.5-5c3.8-.7 6 1 6.8 5"/>',
    other:'<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>'
  };
  var REGLES=[
    ["automotive",/\b(auto(?:mobile)?|voiture|moto|motor|ferrari|transport)\b/],
    ["museum",/\b(musee|museum|galerie d art|exposition|pinacotheque)\b/],
    ["tasting",/\b(degustation|cave|vignoble|vin|oenolog|acetaia|balsami|brasserie)\b/],
    ["gastronomy",/\b(restaurant|repas|cuisine|gastronomie|gastronomique|trattoria|osteria|marche alimentaire)\b/],
    ["water",/\b(plage|baignade|bateau|barque|lac|mer|riviere|cascade|nautique)\b/],
    ["mountain",/\b(montagne|sommet|randonnee|trek|sentier|alpage|col)\b/],
    ["panorama",/\b(panorama|point de vue|belvedere|vue|mirador)\b/],
    ["nature",/\b(nature|parc naturel|jardin|foret|reserve|faune|flore)\b/],
    ["family",/\b(famille|familial|familiale|anniversaire|souvenir)\b/],
    ["heritage",/\b(chateau|cathedrale|eglise|basilique|duomo|abbaye|monument|patrimoine|arena|arenes|arche|arco|arc)\b/],
    ["architecture",/\b(architecture|palais|tour|torre|place|piazza|maison|casa|quartier historique|porte|porta)\b/],
    ["activity",/\b(activite|atelier|experience|visite guidee|spectacle|jeu|aventure)\b/]
  ];
  function normaliser(value){return String(value==null?"":value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
  function categorieValide(value){var c=normaliser(value).replace(/ /g,"_");return CATEGORIES.indexOf(c)>=0?c:"";}
  function categoriser(donnee){
    donnee=donnee||{};
    var explicite=categorieValide(donnee.highlightCategory||donnee.highlight_category||donnee.category||donnee.categorie);
    if(explicite)return explicite;
    var structure=normaliser([donnee.type,donnee.tags,donnee.sourceType,donnee.source_type,donnee.dayCategory,donnee.day_category].filter(Boolean).join(" "));
    var identite=normaliser([donnee.name,donnee.nom,donnee.label,donnee.libelle,donnee.ou,donnee.parentLabel].filter(Boolean).join(" "));
    var description=normaliser([donnee.description,donnee.quoi].filter(Boolean).join(" "));
    for(var i=0;i<REGLES.length;i++)if(REGLES[i][1].test(structure))return REGLES[i][0];
    for(var j=0;j<REGLES.length;j++)if(REGLES[j][1].test(identite))return REGLES[j][0];
    for(var k=0;k<REGLES.length;k++)if(REGLES[k][1].test(description))return REGLES[k][0];
    return "other";
  }
  function icone(category){var c=categorieValide(category)||"other";return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONES[c]+"</svg>";}
  global.CarnetHighlightRegistry={CATEGORIES:CATEGORIES,ICONES:ICONES,categoriser:categoriser,icone:icone};
})(typeof window!=="undefined"?window:globalThis);
