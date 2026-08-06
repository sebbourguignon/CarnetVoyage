(function(global){
  "use strict";

  function texte(value){
    var div = document.createElement("div");
    div.innerHTML = String(value == null ? "" : value);
    return (div.textContent || "").replace(/\s+/g, " ").trim();
  }

  function titreFichier(value){
    return texte(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "carnet-voyage";
  }

  function adapter(options){
    var photosSources = [];
    var journees = (options.jours || []).map(function(jour){
      var photos = (options.photosParJournee[jour.uuid] || [])
        .filter(function(photo){ return photo.membre_id === options.utilisateurId; });
      var recit = texte(options.texteJournee(jour));
      var introduction = texte(jour.accroche);
      if(!recit && !introduction && !photos.length) return null;

      var photosModele = photos.map(function(photo){
        var entree = {
          id: photo.id,
          legende: texte(photo.legende),
          storagePath: photo.storage_path,
          url: null
        };
        photosSources.push(entree);
        return entree;
      });
      return {
        id: jour.uuid,
        date: jour.date || "",
        lieu: texte(jour.titre),
        titre: texte(jour.titre),
        introduction: introduction,
        recit: recit,
        tempsForts: (jour.lieux || []).map(function(lieu){ return texte(lieu.nom); }).filter(Boolean).slice(0, 5),
        distance: texte(jour.rail1),
        duree: texte(jour.rail2),
        photos: photosModele
      };
    }).filter(Boolean);

    if(!journees.length) return Promise.reject({ code: "AUCUN_CONTENU", message: "Aucun contenu exploitable pour générer le carnet." });

    return Promise.all(photosSources.map(function(photo){
      return options.urlPhoto(photo.storagePath).then(function(url){
        if(!url) throw { code: "IMAGE_ILLISIBLE", message: "Une photographie n’est pas accessible." };
        photo.url = url;
      });
    })).then(function(){
      var photos = photosSources.length;
      var illustrees = journees.filter(function(j){ return j.photos.length; }).length;
      return {
        version: 1,
        voyage: {
          id: options.voyageId,
          slug: options.slug,
          titre: texte(options.carnet.titre + " " + (options.carnet.titreSuite || "")),
          destination: texte(options.carnet.destination),
          sousTitre: texte(options.carnet.sousTitre),
          dateDebut: options.carnet.dateDebut || "",
          dateFin: options.carnet.dateFin || ""
        },
        journees: journees,
        statistiques: { journeesIllustrees: illustrees, photos: photos },
        nomFichier: titreFichier(options.carnet.titre + " " + (options.carnet.titreSuite || "")) + ".pdf"
      };
    });
  }

  global.CarnetPDFAdaptateur = { adapter: adapter, titreFichier: titreFichier };
})(window);
