(function(global){
  "use strict";
  var generationEnCours = false;
  var VERSION_CLIENT = "carnet-client-v4";

  function attendre(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }

  function messageErreur(erreur){
    var code = erreur && erreur.code;
    if(code === "AUCUN_CONTENU") return "Terminez au moins une journée avant de générer le carnet.";
    if(code === "IMAGE_ILLISIBLE") return "Une photographie ne peut pas être lue. Vérifiez-la puis réessayez.";
    if(code === "MEMOIRE_INSUFFISANTE") return "Le carnet est trop volumineux pour être généré en une fois.";
    if(code === "NAVIGATEUR_INCOMPATIBLE") return "Ce navigateur ne permet pas de télécharger le carnet.";
    return "La génération du carnet a échoué. Vous pouvez réessayer dans quelques instants.";
  }

  function verifierNavigateur(){
    if(!global.fetch || !global.Blob || !global.URL || !global.URL.createObjectURL){
      throw { code: "NAVIGATEUR_INCOMPATIBLE" };
    }
  }

  async function generer(options){
    if(generationEnCours) return null;
    generationEnCours = true;
    var travail = null;
    try {
      verifierNavigateur();
      var debut=options.t0Utilisateur||Date.now(),profilClient={t0_clic_ms:debut};
      if(options.onProgress)options.onProgress("Chargement des données…",0);
      var debutModele=Date.now();
      var verificationVersion=fetch("/.netlify/functions/carnet-version",{cache:"no-store"}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
      var modele = await options.construireModele(),versionDistante=await verificationVersion;
      modele.clientBuild=VERSION_CLIENT;
      profilClient.build_verifie=versionDistante;
      profilClient.chargement_donnees_ms=Date.now()-debutModele;
      var insertion = await options.supabase.from("carnet_travaux").insert({
        voyage_id: options.voyageId, modele: modele
      }).select("id").single();
      if(insertion.error) throw insertion.error;
      travail = insertion.data;

      var session = await options.supabase.auth.getSession();
      var jeton = session.data && session.data.session && session.data.session.access_token;
      if(!jeton) throw { code: "SESSION_EXPIREE" };
      var t1=Date.now();profilClient.t1_envoi_ms=t1;profilClient.preparation_client_ms=t1-debut;
      var reponse = await fetch("/.netlify/functions/generer-carnet", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + jeton },
        body: JSON.stringify({
          travail_id: travail.id,
          supabase_url: options.supabaseUrl
        })
      });
      var t2=Date.now();profilClient.t2_reponse_http_ms=t2;profilClient.reseau_aller_ms=t2-t1;
      if(!reponse.ok && reponse.status !== 202) throw new Error("démarrage refusé (" + reponse.status + ")");

      var resultat;
      for(var tentative = 0; tentative < 450; tentative++){
        await attendre(750);
        var lecture = await options.supabase.from("carnet_travaux")
          .select("statut, chemin_pdf, erreur, diagnostic, maj_le").eq("id", travail.id).single();
        if(lecture.error) throw lecture.error;
        resultat = lecture.data;
        if(options.onProgress){var etape=resultat.diagnostic&&resultat.diagnostic.etape||"préparation",m=etape.match(/variante_persistante:(\d+)\/(\d+)/);options.onProgress(m?"Préparation des "+(Number(m[2])-Number(m[1])+1)+" dernières photos…":/variantes_pretes|demarrage_chromium|rendu_html/.test(etape)?"Mise en page du carnet…":"Génération du carnet…",Math.round((Date.now()-debut)/1000));}
        if(resultat.statut === "termine" || resultat.statut === "erreur") break;
        if(resultat.statut === "en_cours" && resultat.maj_le && Date.now() - new Date(resultat.maj_le).getTime() > 180000){
          var interruption = new Error("la fonction de génération s’est interrompue");
          interruption.code = "ECHEC_GENERATION";
          throw interruption;
        }
      }
      if(!resultat || resultat.statut !== "termine"){
        var erreur = new Error(resultat && resultat.erreur || "délai de génération dépassé");
        erreur.code = resultat && resultat.diagnostic && resultat.diagnostic.code;
        throw erreur;
      }

      var signature = await options.supabase.storage.from("carnets").createSignedUrl(resultat.chemin_pdf, 300);
      if(signature.error || !signature.data) throw signature.error || new Error("URL PDF absente");
      var debutTransfert=Date.now(),pdf = await fetch(signature.data.signedUrl);
      if(!pdf.ok) throw new Error("téléchargement PDF impossible");
      var blob = await pdf.blob();
      profilClient.transfert_pdf_ms=Date.now()-debutTransfert;
      var url = URL.createObjectURL(blob);
      var lien = document.createElement("a");
      lien.href = url;
      lien.download = modele.nomFichier;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      profilClient.t3_fichier_disponible_ms=Date.now();profilClient.traitement_client_ms=profilClient.t3_fichier_disponible_ms-(debutTransfert+profilClient.transfert_pdf_ms);profilClient.temps_total_utilisateur_ms=profilClient.t3_fichier_disponible_ms-debut;
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      resultat.diagnostic=resultat.diagnostic||{};resultat.diagnostic.profil_client=profilClient;resultat.diagnostic.clientBundleVersion=VERSION_CLIENT;global.__dernierProfilCarnet=resultat.diagnostic;if(global.console&&console.table)console.table({version:{client:VERSION_CLIENT,fonction:resultat.diagnostic.functionVersion,sha:resultat.diagnostic.buildSha},filtrage:{includedDayIds:resultat.diagnostic.includedDayIds,excludedDayIds:resultat.diagnostic.excludedDayIds},client:profilClient,serveur:resultat.diagnostic.profil||{},fonction:resultat.diagnostic.profil_fonction||{},variantes:resultat.diagnostic.profil_variantes||{}});return resultat.diagnostic;
    } catch(erreur){
      if(!erreur.code && /memory|heap|allocation|mémoire/i.test(String(erreur && erreur.message || erreur))) erreur.code="MEMOIRE_INSUFFISANTE";
      console.error("Échec de génération du carnet :", erreur);
      throw { original: erreur, messageUtilisateur: messageErreur(erreur), code: erreur && erreur.code };
    } finally {
      generationEnCours = false;
      if(travail) options.supabase.from("carnet_travaux").delete().eq("id", travail.id).then(function(){});
    }
  }

  global.CarnetPDFClient = { generer: generer, estEnCours: function(){ return generationEnCours; } };
})(window);
