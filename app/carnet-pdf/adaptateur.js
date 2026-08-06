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
      focalX:Number(!selection || selection.focal_x == null ? .5 : selection.focal_x),
      focalY:Number(!selection || selection.focal_y == null ? .5 : selection.focal_y)};
  }

  function adapter(options){
    var preparations={};
    (options.preparations || []).forEach(function(p){preparations[p.journee_id]=p;});
    var photosSources=[];
    var journees=(options.jours || []).map(function(jour){
      var preparation=preparations[jour.uuid];
      var activer=!!(preparation && preparation.preparation_active);
      var disponibles=(options.photosParJournee[jour.uuid] || []).filter(function(p){return p.membre_id===options.utilisateurId;});
      var photos;
      if(activer){
        var parId={};disponibles.forEach(function(p){parId[p.id]=p;});
        var deja={};
        photos=(preparation.carnet_photos_selectionnees || []).slice().sort(function(a,b){
          if(!!a.principale!==!!b.principale)return a.principale?-1:1;
          return (a.ordre||0)-(b.ordre||0);
        }).filter(function(s){if(!parId[s.photo_id]||deja[s.photo_id])return false;deja[s.photo_id]=true;return true;})
          .slice(0,20).map(function(s){return photoModele(parId[s.photo_id],s);});
      }else photos=disponibles.map(function(p){return photoModele(p,null);});
      photos.forEach(function(p){photosSources.push(p);});

      var recit=activer ? (preparation.carnet_story_validated ? texte(preparation.carnet_story) : "") : texte(options.texteJournee(jour));
      var moments=activer ? (preparation.carnet_faits_confirmes || []).filter(function(f){return f.moment_fort;})
        .sort(function(a,b){return (a.ordre||0)-(b.ordre||0);}).slice(0,5).map(function(f){return texte(f.libelle);}).filter(Boolean)
        : (jour.lieux || []).map(function(l){return texte(l.nom);}).filter(Boolean).slice(0,5);
      var introduction=activer ? "" : texte(jour.accroche);
      if(!activer && !recit && !introduction && !photos.length)return null;
      return {id:jour.uuid,date:jour.date || "",lieu:texte(jour.titre),titre:texte(jour.titre),introduction:introduction,
        recit:recit,tempsForts:moments,distance:texte(jour.rail1),duree:texte(jour.rail2),photos:photos,preparationActive:activer};
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
