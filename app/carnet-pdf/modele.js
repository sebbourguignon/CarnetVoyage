(function(global){
  "use strict";

  var SOURCES_RECIT = ["manual", "ai", "empty", "legacy"];
  var PHOTOS_CONSEILLEES_PAR_JOUR = 10;
  var PHOTOS_MAX_PAR_JOUR = 10;
  var MOMENTS_FORTS_MAX = 5;

  function texte(value){ return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function nombre(value, repli){ var n = Number(value); return Number.isFinite(n) ? n : repli; }

  function normaliserPreparation(ligne, texteLegacy){
    var source = ligne && SOURCES_RECIT.indexOf(ligne.carnet_story_source) !== -1
      ? ligne.carnet_story_source : null;
    var recit = texte(ligne && ligne.carnet_story);
    if(!source && texteLegacy){ source = "legacy"; recit = texte(texteLegacy.texte); }
    return {
      id: ligne && ligne.id || null,
      carnetStory: recit,
      carnetStorySource: source || "empty",
      carnetStoryValidated: !!(ligne && ligne.carnet_story_validated && recit),
      notesManuelles: texte(ligne && ligne.notes_manuelles),
      temperatureReelle: ligne && ligne.temperature_reelle != null ? nombre(ligne.temperature_reelle, null) : null,
      temperatureReleveeLe: ligne && ligne.temperature_relevee_le || null,
      afficherProgrammePrevu: !!(ligne && ligne.afficher_programme_prevu),
      carnetTerminee: !!(ligne && ligne.carnet_terminee),
      recitSourceHash: ligne && ligne.recit_source_hash || null
    };
  }

  function normaliserFaits(faits){
    return (faits || []).map(function(fait, index){
      return {
        id: fait.id || null,
        sourceType: fait.source_type || fait.sourceType || "manual",
        sourceId: fait.source_id || fait.sourceId || null,
        libelle: texte(fait.libelle),
        momentFort: !!(fait.moment_fort != null ? fait.moment_fort : fait.momentFort),
        ordre: nombre(fait.ordre, index)
      };
    }).filter(function(fait){ return !!fait.libelle; }).sort(function(a,b){ return a.ordre-b.ordre; });
  }

  function normaliserPhotos(selections){
    return (selections || []).map(function(selection, index){
      return {
        id: selection.id || null,
        photoId: selection.photo_id || selection.photoId,
        ordre: nombre(selection.ordre, index),
        principale: !!selection.principale,
        focalX: nombre(selection.focal_x != null ? selection.focal_x : selection.focalX, 0.5),
        focalY: nombre(selection.focal_y != null ? selection.focal_y : selection.focalY, 0.5),
        legendeCarnet: texte(selection.legende_carnet != null ? selection.legende_carnet : selection.legendeCarnet)
      };
    }).filter(function(selection){ return !!selection.photoId; }).sort(function(a,b){ return a.ordre-b.ordre; }).slice(0, PHOTOS_MAX_PAR_JOUR);
  }

  function analyserJournee(preparation, faits, photos){
    var erreurs = [], avertissements = [];
    var moments = (faits || []).filter(function(f){ return f.momentFort; });
    var principales = (photos || []).filter(function(p){ return p.principale; });
    if((photos || []).length > PHOTOS_MAX_PAR_JOUR) erreurs.push("Maximum de 10 photos sélectionnées par journée.");
    if(principales.length > 1) erreurs.push("Une seule photo principale est autorisée par journée.");
    if(moments.length > MOMENTS_FORTS_MAX) erreurs.push("Maximum de 5 moments forts par journée.");
    return {
      erreurs: erreurs,
      avertissements: avertissements,
      enrichie: !!(preparation.carnetStory || (faits || []).length || (photos || []).length),
      compacte: !(preparation.carnetStory || (faits || []).length || (photos || []).length)
    };
  }

  global.CarnetPreparationModele = {
    SOURCES_RECIT: SOURCES_RECIT,
    PHOTOS_CONSEILLEES_PAR_JOUR: PHOTOS_CONSEILLEES_PAR_JOUR,
    PHOTOS_MAX_PAR_JOUR: PHOTOS_MAX_PAR_JOUR,
    MOMENTS_FORTS_MAX: MOMENTS_FORTS_MAX,
    normaliserPreparation: normaliserPreparation,
    normaliserFaits: normaliserFaits,
    normaliserPhotos: normaliserPhotos,
    analyserJournee: analyserJournee
  };
})(typeof window !== "undefined" ? window : globalThis);
