(function(global){
  "use strict";

  function el(tag, cls, texte){
    var node=document.createElement(tag);
    if(cls) node.className=cls;
    if(texte != null) node.textContent=texte;
    return node;
  }
  function nettoyer(value){ return String(value == null ? "" : value).replace(/\s+/g," ").trim(); }

  function creer(options){
    var modele=global.CarnetPreparationModele;
    var preparations={};
    var modeRevue=false;
    var jourOuvert=null;

    (options.preparations || []).forEach(function(ligne){ preparations[ligne.journee_id]=ligne; });

    function legacyPour(jour){ return (options.textesLegacy || []).find(function(t){ return t.journee_id===jour.uuid; }) || null; }
    function etatPour(jour){
      if(jour._preparationCarnet) return jour._preparationCarnet;
      var ligne=preparations[jour.uuid] || null;
      jour._preparationCarnet={
        preparation:modele.normaliserPreparation(ligne,legacyPour(jour)),
        faits:modele.normaliserFaits(ligne && ligne.carnet_faits_confirmes),
        photos:modele.normaliserPhotos(ligne && ligne.carnet_photos_selectionnees),
        modifie:false,
        sauvegarde:false
      };
      return jour._preparationCarnet;
    }
    function photosDisponibles(jour){
      return (options.photosParJournee[jour.uuid] || []).filter(function(p){ return p.membre_id===options.utilisateurId; });
    }
    function faitCle(f){ return f.sourceType+":"+(f.sourceId || f.libelle.toLowerCase()); }
    function suggestions(jour){
      var liste=[];
      (jour.regarder || []).forEach(function(o,index){
        liste.push({sourceType:"observation",sourceId:o.id,libelle:nettoyer(o.ou || o.quoi),repere:options.observationReperee(jour,index)});
      });
      (jour.lieux || []).forEach(function(l){
        liste.push({sourceType:"lieu",sourceId:l.id,libelle:nettoyer(l.nom),repere:false});
      });
      var vues={};
      return liste.filter(function(f){ var cle=faitCle(f); if(!f.libelle || vues[cle]) return false; vues[cle]=true; return true; });
    }
    function marquer(etat){ etat.modifie=true; etat.sauvegarde=false; }
    function analyser(etat){ return modele.analyserJournee(etat.preparation,etat.faits,etat.photos); }
    function libelleSource(source){ return {empty:"Aucun récit",legacy:"Ancien texte à relire",manual:"Récit manuel",ai:"Brouillon IA"}[source] || source; }

    function rendreResume(panel){
      var totalPhotos=0, pretes=0, brouillons=0, compactes=0;
      options.jours.forEach(function(j){
        var etat=etatPour(j), analyse=analyser(etat);
        totalPhotos+=etat.photos.length;
        if(analyse.compacte) compactes++;
        else if(etat.preparation.carnetStoryValidated) pretes++;
        else brouillons++;
      });
      var intro=el("section","carnet-preparation-intro");
      intro.appendChild(el("p","eyebrow","Carnet souvenir"));
      intro.appendChild(el("h2",null,"Préparer le carnet"));
      intro.appendChild(el("p","carnet-preparation-explication","Confirmez les souvenirs réellement vécus, choisissez les photos et relisez les récits avant l’export."));
      var stats=el("div","carnet-preparation-stats");
      [[pretes,"journées prêtes"],[brouillons,"à relire"],[compactes,"étapes compactes"],[totalPhotos,"photos sélectionnées"]].forEach(function(s){
        var item=el("div","carnet-preparation-stat"); item.appendChild(el("strong",null,String(s[0]))); item.appendChild(el("span",null,s[1])); stats.appendChild(item);
      });
      intro.appendChild(stats);
      var bouton=el("button","carnet-bouton-generer","Préparer le carnet"); bouton.type="button";
      bouton.addEventListener("click",function(){ modeRevue=true; jourOuvert=jourOuvert || options.jours[0] && options.jours[0].uuid; rendre(panel); });
      intro.appendChild(bouton);
      panel.appendChild(intro);
    }

    function rendreRecit(jour,etat){
      var bloc=el("section","carnet-preparation-bloc");
      bloc.appendChild(el("h4",null,"Récit de la journée"));
      var meta=el("div","carnet-recit-meta");
      var source=el("span","carnet-source carnet-source-"+etat.preparation.carnetStorySource,libelleSource(etat.preparation.carnetStorySource));
      var validation=el("span",etat.preparation.carnetStoryValidated?"carnet-valide":"carnet-brouillon",etat.preparation.carnetStoryValidated?"Validé":"Brouillon");
      meta.appendChild(source); meta.appendChild(validation); bloc.appendChild(meta);
      var champ=document.createElement("textarea"); champ.className="carnet-preparation-recit"; champ.rows=7;
      champ.placeholder="Racontez ici les souvenirs réellement vécus pendant cette journée…";
      champ.value=etat.preparation.carnetStory;
      champ.addEventListener("input",function(){
        etat.preparation.carnetStory=champ.value.trim();
        etat.preparation.carnetStorySource=etat.preparation.carnetStory?"manual":"empty";
        etat.preparation.carnetStoryValidated=false; marquer(etat);
        source.textContent=libelleSource(etat.preparation.carnetStorySource); source.className="carnet-source carnet-source-"+etat.preparation.carnetStorySource;
        validation.textContent="Brouillon"; validation.className="carnet-brouillon";
      });
      bloc.appendChild(champ);
      var actions=el("div","carnet-preparation-actions");
      var valider=el("button","carnet-action-primaire",etat.preparation.carnetStoryValidated?"Récit validé ✓":"Valider le récit"); valider.type="button";
      valider.addEventListener("click",function(){
        if(!champ.value.trim()){ window.alert("Le récit est vide."); return; }
        etat.preparation.carnetStory=champ.value.trim();
        if(etat.preparation.carnetStorySource==="empty") etat.preparation.carnetStorySource="manual";
        etat.preparation.carnetStoryValidated=true; marquer(etat); rendre(options.panel);
      });
      var ia=el("button","carnet-action-secondaire","Composer le récit avec l’IA — bientôt"); ia.type="button"; ia.disabled=true;
      actions.appendChild(valider); actions.appendChild(ia); bloc.appendChild(actions);
      var notes=el("label","carnet-preparation-label","Notes pour préparer le récit");
      var notesChamp=document.createElement("textarea"); notesChamp.rows=3; notesChamp.placeholder="Anecdotes, impressions ou détails à conserver…"; notesChamp.value=etat.preparation.notesManuelles;
      notesChamp.addEventListener("input",function(){ etat.preparation.notesManuelles=notesChamp.value.trim(); marquer(etat); });
      notes.appendChild(notesChamp); bloc.appendChild(notes);
      return bloc;
    }

    function rendreFaits(jour,etat){
      var bloc=el("section","carnet-preparation-bloc");
      bloc.appendChild(el("h4",null,"Ce qui a réellement été fait"));
      bloc.appendChild(el("p","carnet-preparation-aide","Les éléments repérés dans « À regarder » sont proposés, jamais confirmés automatiquement."));
      var liste=el("div","carnet-faits-liste");
      function ligneFait(fait, suggestion){
        var cle=faitCle(fait);
        var confirme=etat.faits.find(function(f){ return faitCle(f)===cle; });
        var ligne=el("div","carnet-fait"+(confirme?" confirme":""));
        var label=el("label","carnet-fait-confirmation");
        var check=document.createElement("input"); check.type="checkbox"; check.checked=!!confirme;
        label.appendChild(check); label.appendChild(el("span",null,fait.libelle));
        if(suggestion && suggestion.repere) label.appendChild(el("small",null,"Repéré dans À regarder"));
        ligne.appendChild(label);
        var moment=el("label","carnet-fait-moment"); var etoile=document.createElement("input"); etoile.type="checkbox"; etoile.checked=!!(confirme && confirme.momentFort); etoile.disabled=!confirme;
        moment.appendChild(etoile); moment.appendChild(el("span",null,"Moment fort")); ligne.appendChild(moment);
        if(confirme){
          var commandes=el("div","carnet-fait-ordre");
          [["↑","Monter",-1],["↓","Descendre",1]].forEach(function(action){
            var b=el("button",null,action[0]); b.type="button"; b.title=action[1];
            var position=etat.faits.indexOf(confirme); b.disabled=position+action[2]<0 || position+action[2]>=etat.faits.length;
            b.addEventListener("click",function(){
              var i=etat.faits.indexOf(confirme), cible=i+action[2], autre=etat.faits[cible];
              etat.faits[cible]=confirme; etat.faits[i]=autre; etat.faits.forEach(function(f,k){f.ordre=k;});
              marquer(etat); rendre(options.panel);
            });
            commandes.appendChild(b);
          });
          ligne.appendChild(commandes);
        }
        check.addEventListener("change",function(){
          if(check.checked && !confirme){ confirme={sourceType:fait.sourceType,sourceId:fait.sourceId||null,libelle:fait.libelle,momentFort:false,ordre:etat.faits.length}; etat.faits.push(confirme); }
          if(!check.checked && confirme){ etat.faits.splice(etat.faits.indexOf(confirme),1); }
          marquer(etat); rendre(options.panel);
        });
        etoile.addEventListener("change",function(){
          if(!confirme) return;
          if(etoile.checked && etat.faits.filter(function(f){return f.momentFort;}).length>=modele.MOMENTS_FORTS_MAX){ window.alert("Choisissez au maximum 5 moments forts."); etoile.checked=false; return; }
          confirme.momentFort=etoile.checked; marquer(etat);
        });
        return ligne;
      }
      suggestions(jour).forEach(function(s){ liste.appendChild(ligneFait(s,s)); });
      etat.faits.filter(function(f){return f.sourceType==="manual";}).forEach(function(f){
        var ligne=ligneFait(f,null); var supprimer=el("button","carnet-fait-supprimer","Supprimer"); supprimer.type="button";
        supprimer.addEventListener("click",function(){ etat.faits.splice(etat.faits.indexOf(f),1); marquer(etat); rendre(options.panel); }); ligne.appendChild(supprimer); liste.appendChild(ligne);
      });
      bloc.appendChild(liste);
      var ajout=el("div","carnet-fait-ajout"); var champ=document.createElement("input"); champ.type="text"; champ.placeholder="Ajouter un lieu ou une expérience vécue";
      var bouton=el("button","carnet-action-secondaire","Ajouter"); bouton.type="button";
      bouton.addEventListener("click",function(){ var valeur=champ.value.trim(); if(!valeur)return; etat.faits.push({sourceType:"manual",sourceId:null,libelle:valeur,momentFort:false,ordre:etat.faits.length}); marquer(etat); rendre(options.panel); });
      ajout.appendChild(champ); ajout.appendChild(bouton); bloc.appendChild(ajout);
      return bloc;
    }

    function rendrePhotos(jour,etat){
      var bloc=el("section","carnet-preparation-bloc");
      bloc.appendChild(el("h4",null,"Photos du carnet"));
      var compteur=el("p","carnet-photos-compteur",etat.photos.length+" sélectionnée"+(etat.photos.length>1?"s":"")+" · 12 conseillées, 20 maximum pour cette journée");
      if(etat.photos.length>12) compteur.classList.add("avertissement"); bloc.appendChild(compteur);
      var grille=el("div","carnet-selection-photos");
      photosDisponibles(jour).forEach(function(photo){
        var selection=etat.photos.find(function(s){return s.photoId===photo.id;});
        var carte=el("article","carnet-selection-photo"+(selection?" selectionnee":""));
        var img=document.createElement("img"); img.alt=photo.legende||""; img.loading="lazy"; options.urlPhoto(photo.storage_path).then(function(url){if(url)img.src=url;}); carte.appendChild(img);
        var choisir=el("label","carnet-photo-choisir"); var check=document.createElement("input"); check.type="checkbox"; check.checked=!!selection; choisir.appendChild(check); choisir.appendChild(el("span",null,"Dans le carnet")); carte.appendChild(choisir);
        check.addEventListener("change",function(){
          if(check.checked && !selection){
            if(etat.photos.length>=modele.PHOTOS_MAX_PAR_JOUR){ window.alert("Maximum de 20 photos sélectionnées pour cette journée."); check.checked=false; return; }
            selection={photoId:photo.id,ordre:etat.photos.length,principale:etat.photos.length===0,focalX:0.5,focalY:0.5,legendeCarnet:nettoyer(photo.legende)}; etat.photos.push(selection);
          } else if(!check.checked && selection){
            var etaitPrincipale=selection.principale; etat.photos.splice(etat.photos.indexOf(selection),1); if(etaitPrincipale && etat.photos[0]) etat.photos[0].principale=true;
          }
          etat.photos.forEach(function(p,i){p.ordre=i;}); marquer(etat); rendre(options.panel);
        });
        if(selection){
          var principale=el("label","carnet-photo-principale"); var radio=document.createElement("input"); radio.type="radio"; radio.name="principale-"+jour.uuid; radio.checked=selection.principale;
          principale.appendChild(radio); principale.appendChild(el("span",null,"Photo principale")); carte.appendChild(principale);
          radio.addEventListener("change",function(){etat.photos.forEach(function(p){p.principale=p===selection;});marquer(etat);});
          var legende=el("label","carnet-photo-legende","Légende"); var champ=document.createElement("input"); champ.type="text"; champ.value=selection.legendeCarnet; champ.addEventListener("input",function(){selection.legendeCarnet=champ.value.trim();marquer(etat);}); legende.appendChild(champ); carte.appendChild(legende);
          var ordre=el("div","carnet-photo-ordre");
          [["←","Monter",-1],["→","Descendre",1]].forEach(function(action){var b=el("button",null,action[0]);b.type="button";b.title=action[1];b.disabled=etat.photos.indexOf(selection)+(action[2])<0||etat.photos.indexOf(selection)+(action[2])>=etat.photos.length;b.addEventListener("click",function(){var i=etat.photos.indexOf(selection),j=i+action[2],autre=etat.photos[j];etat.photos[j]=selection;etat.photos[i]=autre;etat.photos.forEach(function(p,k){p.ordre=k;});marquer(etat);rendre(options.panel);});ordre.appendChild(b);});
          carte.appendChild(ordre);
          var focal=el("details","carnet-photo-focale"); focal.appendChild(el("summary",null,"Position du recadrage"));
          [["Horizontal", "focalX"],["Vertical", "focalY"]].forEach(function(info){var l=el("label",null,info[0]);var range=document.createElement("input");range.type="range";range.min="0";range.max="1";range.step="0.05";range.value=selection[info[1]];range.addEventListener("input",function(){selection[info[1]]=Number(range.value);img.style.objectPosition=(selection.focalX*100)+"% "+(selection.focalY*100)+"%";marquer(etat);});l.appendChild(range);focal.appendChild(l);}); carte.appendChild(focal);
        }
        grille.appendChild(carte);
      });
      if(!photosDisponibles(jour).length) grille.appendChild(el("p","carnet-preparation-aide","Aucune photo téléversée pour cette journée."));
      bloc.appendChild(grille); return bloc;
    }

    async function sauvegarder(jour,etat,statut,bouton){
      var analyse=analyser(etat);
      if(analyse.erreurs.length){ window.alert(analyse.erreurs.join("\n")); return; }
      bouton.disabled=true; statut.textContent="Enregistrement…"; statut.className="carnet-sauvegarde-statut";
      try{
        var p=etat.preparation;
        var ligne={voyage_id:options.voyageId,journee_id:jour.uuid,membre_id:options.utilisateurId,carnet_story:p.carnetStory||null,carnet_story_source:p.carnetStory? p.carnetStorySource:"empty",carnet_story_validated:!!p.carnetStoryValidated,notes_manuelles:p.notesManuelles||null,temperature_reelle:p.temperatureReelle,temperature_relevee_le:p.temperatureReleveeLe,afficher_programme_prevu:!!p.afficherProgrammePrevu,maj_le:new Date().toISOString()};
        var upsert=await options.supabase.from("carnet_journees").upsert(ligne,{onConflict:"journee_id,membre_id"}).select("id").single(); if(upsert.error) throw upsert.error;
        p.id=upsert.data.id;
        var suppressionFaits=await options.supabase.from("carnet_faits_confirmes").delete().eq("carnet_journee_id",p.id); if(suppressionFaits.error) throw suppressionFaits.error;
        if(etat.faits.length){var insertionFaits=await options.supabase.from("carnet_faits_confirmes").insert(etat.faits.map(function(f,i){return {carnet_journee_id:p.id,source_type:f.sourceType,source_id:f.sourceId,libelle:f.libelle,moment_fort:!!f.momentFort,ordre:i};}));if(insertionFaits.error)throw insertionFaits.error;}
        var suppressionPhotos=await options.supabase.from("carnet_photos_selectionnees").delete().eq("carnet_journee_id",p.id); if(suppressionPhotos.error) throw suppressionPhotos.error;
        if(etat.photos.length){var insertionPhotos=await options.supabase.from("carnet_photos_selectionnees").insert(etat.photos.map(function(s,i){return {carnet_journee_id:p.id,photo_id:s.photoId,ordre:i,principale:!!s.principale,focal_x:s.focalX,focal_y:s.focalY,legende_carnet:s.legendeCarnet||null};}));if(insertionPhotos.error)throw insertionPhotos.error;}
        // Compatibilité descendante : seul un récit explicitement validé
        // alimente l’ancien modèle, qui reste disponible pour retour arrière.
        if(p.carnetStoryValidated && p.carnetStory){
          var legacy=await options.supabase.from("carnet_textes").upsert({voyage_id:options.voyageId,journee_id:jour.uuid,membre_id:options.utilisateurId,texte:p.carnetStory,maj_le:new Date().toISOString()},{onConflict:"journee_id,membre_id"}); if(legacy.error) throw legacy.error;
        }
        etat.modifie=false; etat.sauvegarde=true; statut.textContent="Préparation enregistrée ✓"; statut.className="carnet-sauvegarde-statut succes";
      }catch(erreur){console.error("Échec de sauvegarde de la préparation :",erreur);statut.textContent="Échec de l’enregistrement";statut.className="carnet-sauvegarde-statut erreur";}
      bouton.disabled=false;
    }

    function rendreJour(jour){
      var etat=etatPour(jour), analyse=analyser(etat), ouvert=jourOuvert===jour.uuid;
      var item=el("article","carnet-preparation-jour"+(ouvert?" ouvert":""));
      var head=el("button","carnet-preparation-jour-head"); head.type="button"; head.setAttribute("aria-expanded",ouvert?"true":"false");
      var titre=el("span",null,(jour.dow?jour.dow+" ":"")+(jour.num?jour.num+" ":"")+(jour.mois||"")+" — "+nettoyer(jour.titre));
      var statut=el("span",analyse.compacte?"compacte":etat.preparation.carnetStoryValidated?"prete":"brouillon",analyse.compacte?"Étape compacte":etat.preparation.carnetStoryValidated?"Prête":"À relire");
      head.appendChild(titre); head.appendChild(statut); head.addEventListener("click",function(){jourOuvert=ouvert?null:jour.uuid;rendre(options.panel);}); item.appendChild(head);
      if(!ouvert) return item;
      var corps=el("div","carnet-preparation-jour-corps");
      var details=el("div","carnet-preparation-details"); [jour.rail1,jour.rail2].filter(Boolean).forEach(function(v){details.appendChild(el("span",null,nettoyer(v)));}); corps.appendChild(details);
      corps.appendChild(rendreRecit(jour,etat)); corps.appendChild(rendreFaits(jour,etat)); corps.appendChild(rendrePhotos(jour,etat));
      var programme=el("label","carnet-programme-option");var programmeCheck=document.createElement("input");programmeCheck.type="checkbox";programmeCheck.checked=etat.preparation.afficherProgrammePrevu;programmeCheck.addEventListener("change",function(){etat.preparation.afficherProgrammePrevu=programmeCheck.checked;marquer(etat);});programme.appendChild(programmeCheck);programme.appendChild(el("span",null,"Afficher une rubrique « Programme prévu » pour cette étape non enrichie"));corps.appendChild(programme);
      var barre=el("div","carnet-sauvegarde");var bouton=el("button","carnet-action-primaire","Enregistrer cette journée");bouton.type="button";var message=el("span","carnet-sauvegarde-statut",etat.sauvegarde?"Préparation enregistrée ✓":etat.modifie?"Modifications non enregistrées":"");bouton.addEventListener("click",function(){sauvegarder(jour,etat,message,bouton);});barre.appendChild(bouton);barre.appendChild(message);corps.appendChild(barre);
      item.appendChild(corps); return item;
    }

    function rendreRevue(panel){
      var nav=el("div","carnet-preparation-nav"); var retour=el("button","carnet-action-secondaire","← Revenir au résumé");retour.type="button";retour.addEventListener("click",function(){modeRevue=false;rendre(panel);});nav.appendChild(retour);nav.appendChild(el("p",null,"Les changements sont enregistrés journée par journée."));panel.appendChild(nav);
      var liste=el("div","carnet-preparation-jours"); options.jours.forEach(function(j){liste.appendChild(rendreJour(j));});panel.appendChild(liste);
      var exportInfo=el("section","carnet-export-verrouille");exportInfo.appendChild(el("h3",null,"Export PDF"));exportInfo.appendChild(el("p",null,"La préparation est testable dès maintenant. Le nouvel export utilisant exclusivement ces contenus sera activé avec les gabarits du lot 4."));var b=el("button","carnet-bouton-generer","Générer le carnet — bientôt");b.disabled=true;exportInfo.appendChild(b);panel.appendChild(exportInfo);
    }

    function rendre(panel){ options.panel=panel; panel.innerHTML=""; if(modeRevue) rendreRevue(panel); else rendreResume(panel); }
    return {rendre:rendre,ouvrir:function(panel){modeRevue=true;rendre(panel);}};
  }

  global.CarnetPreparationEcran={creer:creer};
})(window);
