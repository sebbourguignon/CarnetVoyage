(function(global){
  "use strict";
  var generationEnCours = false;

  function attendre(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }

  function messageErreur(erreur){
    var code = erreur && erreur.code;
    if(code === "AUCUN_CONTENU") return "Ajoutez du contenu au carnet avant de le générer.";
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
      var modele = await options.construireModele();
      var insertion = await options.supabase.from("carnet_travaux").insert({
        voyage_id: options.voyageId, modele: modele
      }).select("id").single();
      if(insertion.error) throw insertion.error;
      travail = insertion.data;

      var session = await options.supabase.auth.getSession();
      var jeton = session.data && session.data.session && session.data.session.access_token;
      if(!jeton) throw { code: "SESSION_EXPIREE" };
      var reponse = await fetch("/.netlify/functions/generer-carnet", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + jeton },
        body: JSON.stringify({
          travail_id: travail.id,
          supabase_url: options.supabaseUrl
        })
      });
      if(!reponse.ok && reponse.status !== 202) throw new Error("démarrage refusé (" + reponse.status + ")");

      var resultat;
      for(var tentative = 0; tentative < 450; tentative++){
        await attendre(2000);
        var lecture = await options.supabase.from("carnet_travaux")
          .select("statut, chemin_pdf, erreur, diagnostic").eq("id", travail.id).single();
        if(lecture.error) throw lecture.error;
        resultat = lecture.data;
        if(resultat.statut === "termine" || resultat.statut === "erreur") break;
      }
      if(!resultat || resultat.statut !== "termine"){
        var erreur = new Error(resultat && resultat.erreur || "délai de génération dépassé");
        erreur.code = resultat && resultat.diagnostic && resultat.diagnostic.code;
        throw erreur;
      }

      var signature = await options.supabase.storage.from("carnets").createSignedUrl(resultat.chemin_pdf, 300);
      if(signature.error || !signature.data) throw signature.error || new Error("URL PDF absente");
      var pdf = await fetch(signature.data.signedUrl);
      if(!pdf.ok) throw new Error("téléchargement PDF impossible");
      var blob = await pdf.blob();
      var url = URL.createObjectURL(blob);
      var lien = document.createElement("a");
      lien.href = url;
      lien.download = modele.nomFichier;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      return resultat.diagnostic || null;
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
