(function(global){
  "use strict";

  function texte(value){
    var div=document.createElement("div");
    div.innerHTML=String(value == null ? "" : value);
    return (div.textContent || "").replace(/\s+/g," ").trim();
  }
  function titreFichier(value){
    return texte(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "carnet-voyage";
  }
  function photoModele(source,selection){
    return {id:source.id,legende:texte(selection && selection.legende_carnet || source.legende),storagePath:source.storage_path,url:null,
      version:source.maj_le || source.cree_le || source.storage_path,
      focalX:Number(!selection || selection.focal_x == null ? .5 : selection.focal_x),
      focalY:Number(!selection || selection.focal_y == null ? .5 : selection.focal_y)};
  }
  function distanceValide(value){
    var v=texte(value);
    return /\b\d+(?:[.,]\d+)?\s*(?:km|m)\b/i.test(v)||/\b(?:sur place|à pied|a pied)\b/i.test(v)?v:"";
  }
  function dureeValide(value){
    var v=texte(value);
    return /\b\d+(?:[.,]\d+)?\s*(?:h(?:eures?)?|min(?:utes?)?)\b/i.test(v)?v:"";
  }

  function adapter(options){
    var preparations={};
    (options.preparations || []).forEach(function(p){preparations[p.journee_id]=p;});
    var photosSources=[];
    // Le statut éditorial est l'unique critère d'inclusion. Ce filtre est
    // volontairement placé avant toute recherche/signature de photographie.
    var journees=(options.jours || []).filter(function(jour){
      var preparation=preparations[jour.uuid];
      return !!(preparation&&preparation.carnet_terminee===true);
    }).map(function(jour){
      var preparation=preparations[jour.uuid];
      var disponibles=(options.photosParJournee[jour.uuid] || []).filter(function(p){return p.membre_id===options.utilisateurId;});
      var parId={};disponibles.forEach(function(p){parId[p.id]=p;});
      var deja={};
      var photos=(preparation.carnet_photos_selectionnees || []).slice().sort(function(a,b){
        if(!!a.principale!==!!b.principale)return a.principale?-1:1;
        return (a.ordre||0)-(b.ordre||0);
      }).filter(function(s){if(!parId[s.photo_id]||deja[s.photo_id])return false;deja[s.photo_id]=true;return true;})
        .slice(0,10).map(function(s){return photoModele(parId[s.photo_id],s);});
      photos.forEach(function(p){photosSources.push(p);});

      var recit=texte(preparation.carnet_story);
      var moments=(preparation.carnet_faits_confirmes || []).filter(function(f){return f.moment_fort;})
        .sort(function(a,b){return (a.ordre||0)-(b.ordre||0);}).slice(0,5).map(function(f){return texte(f.libelle);}).filter(Boolean)
        ;
      return {id:jour.uuid,date:jour.date || "",lieu:texte(jour.titre),titre:texte(jour.titre),introduction:"",
        recit:recit,tempsForts:moments,distance:distanceValide(jour.rail1),duree:dureeValide(jour.rail2),temperature:preparation.temperature_reelle!=null?texte(preparation.temperature_reelle)+" °C":"",photos:photos,preparationActive:true,carnetTerminee:true};
    }).filter(Boolean);
    if(!journees.length)return Promise.reject({code:"AUCUN_CONTENU",message:"Aucun contenu exploitable pour générer le carnet."});
    return Promise.all(photosSources.map(function(photo){return options.urlPhoto(photo.storagePath).then(function(url){
      if(!url)throw {code:"IMAGE_ILLISIBLE",message:"Une photographie n’est pas accessible."};photo.url=url;
    });})).then(function(){
      return {version:2,voyage:{id:options.voyageId,slug:options.slug,titre:texte(options.carnet.titre+" "+(options.carnet.titreSuite||"")),
        destination:texte(options.carnet.destination),sousTitre:texte(options.carnet.sousTitre),dateDebut:options.carnet.dateDebut||"",dateFin:options.carnet.dateFin||""},
        journees:journees,statistiques:{journeesIllustrees:journees.filter(function(j){return j.photos.length;}).length,photos:photosSources.length},
        nomFichier:titreFichier(options.carnet.titre+" "+(options.carnet.titreSuite||""))+".pdf"};
    });
  }
  global.CarnetPDFAdaptateur={adapter:adapter,titreFichier:titreFichier};
})(window);
