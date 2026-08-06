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
  function programmePrevu(jour){
    var elements=[];
    if(jour.fil) elements.push(texte(jour.fil));
    (jour.lieux || []).forEach(function(lieu){ if(lieu && lieu.nom) elements.push(texte(lieu.nom)); });
    return elements.filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; });
  }

  function adapter(options){
    var preparations={};
    (options.preparations || []).forEach(function(p){ preparations[p.journee_id]=p; });
    var photosSources=[];
    var journees=(options.jours || []).map(function(jour){
      var preparation=preparations[jour.uuid] || {};
      var disponibles={};
      (options.photosParJournee[jour.uuid] || []).filter(function(p){ return p.membre_id===options.utilisateurId; })
        .forEach(function(p){ disponibles[p.id]=p; });
      var ids={};
      var selections=(preparation.carnet_photos_selectionnees || []).slice().sort(function(a,b){
        if(!!a.principale!==!!b.principale) return a.principale ? -1 : 1;
        return (a.ordre || 0)-(b.ordre || 0);
      }).filter(function(s){
        if(!disponibles[s.photo_id] || ids[s.photo_id]) return false;
        ids[s.photo_id]=true; return true;
      }).slice(0,20);
      var photos=selections.map(function(selection){
        var source=disponibles[selection.photo_id];
        var entree={id:source.id,legende:texte(selection.legende_carnet || source.legende),storagePath:source.storage_path,url:null,
          principale:!!selection.principale,focalX:Number(selection.focal_x == null ? .5 : selection.focal_x),focalY:Number(selection.focal_y == null ? .5 : selection.focal_y)};
        photosSources.push(entree); return entree;
      });
      var faits=(preparation.carnet_faits_confirmes || []).slice().sort(function(a,b){ return (a.ordre || 0)-(b.ordre || 0); });
      var recit=preparation.carnet_story_validated ? texte(preparation.carnet_story) : "";
      var moments=faits.filter(function(f){ return f.moment_fort; }).slice(0,5).map(function(f){ return texte(f.libelle); }).filter(Boolean);
      var confirme=faits.map(function(f){ return texte(f.libelle); }).filter(Boolean);
      var compacte=!recit && !photos.length && !confirme.length;
      return {id:jour.uuid,date:jour.date || "",lieu:texte(jour.titre),titre:texte(jour.titre),recit:recit,
        faitsConfirmes:confirme,tempsForts:moments,distance:texte(jour.rail1),duree:texte(jour.rail2),
        temperature:preparation.temperature_reelle == null ? "" : texte(preparation.temperature_reelle)+" °C",
        photos:photos,compacte:compacte,programmePrevu:compacte && preparation.afficher_programme_prevu ? programmePrevu(jour) : []};
    });
    return Promise.all(photosSources.map(function(photo){
      return options.urlPhoto(photo.storagePath).then(function(url){
        if(!url) throw {code:"IMAGE_ILLISIBLE",message:"Une photographie sélectionnée n’est pas accessible."};
        photo.url=url;
      });
    })).then(function(){
      return {version:2,voyage:{id:options.voyageId,slug:options.slug,
        titre:texte(options.carnet.titre+" "+(options.carnet.titreSuite || "")),destination:texte(options.carnet.destination),
        sousTitre:texte(options.carnet.sousTitre),dateDebut:options.carnet.dateDebut || "",dateFin:options.carnet.dateFin || ""},
        journees:journees,statistiques:{journeesIllustrees:journees.filter(function(j){return j.photos.length;}).length,photos:photosSources.length},
        nomFichier:titreFichier(options.carnet.titre+" "+(options.carnet.titreSuite || ""))+".pdf"};
    });
  }

  global.CarnetPDFAdaptateur={adapter:adapter,titreFichier:titreFichier};
})(window);
