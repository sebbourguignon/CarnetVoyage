// Edge Function "generer-carnet" — assemble le PDF a emporter a partir des
// photos deposees par les membres famille (voir app/index.html,
// construireBlocPhotos / rendrePanelCarnet, et supabase/migrations/0018).
//
// Deux modes (voir conception, conversation du 2026-08-04) :
//   - "perso"   : uniquement les photos du membre appelant, quelle que
//                 soit leur visibilite.
//   - "famille" : les photos que n'importe quel membre a explicitement
//                 marquees "partagee" -- jamais par defaut.
// Generation disponible a tout moment, meme partielle : pas de notion de
// voyage "termine".
//
// Body attendu : { voyage_id: uuid, mode: "perso" | "famille" }
// Reponse : { url: string } -- URL signee (1 h) vers le PDF dans le
// bucket prive "carnets" (migration 0019).
//
// pdf-lib + @pdf-lib/fontkit (npm, via specifier Deno natif) : seule
// dependance de ce fichier, pas de bundler -- Deno resout et met en cache
// les paquets lui-meme. Le reste du projet (app/, outils/) reste sans
// dependance, voir CLAUDE.md ; cette regle vise le code servi au
// navigateur, pas les Edge Functions, ou assembler un PDF a la main
// serait deraisonnable.
//
// Architecture (refactor du 2026-08-05, demande explicite : separer
// donnees / mise en page / rendu plutot qu'une seule fonction geante) :
//   - design-system.ts : palette, grille, echelle typographique
//   - illustrations.ts : bibliotheque de silhouettes (port pdf-lib de
//     app/illustrations.js)
//   - ornements.ts      : sceau, carte stylisee, icones, decoupe en arche
//   - composants.ts     : un composant nomme par bloc de mise en page
//     (dessinerPageCouverture, dessinerPageCloture, dessinerEnteteJour,
//     dessinerRepereJour, dessinerGaleriePhotos, dessinerBlocCitation...)
//   - index.ts (ce fichier) : recupere les donnees Supabase, construit le
//     contexte (polices, images), appelle les composants dans l'ordre.
//     Ne contient plus de logique de dessin bas niveau.
//
// Direction visuelle (couverture/pages en photo + sceau + carte stylisee,
// 2026-08-05) : esprit magazine de voyage haut de gamme, voir DESIGN.md
// et l'historique de conversation pour le detail des arbitrages.

import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import { donneesBase64 as bodoniRegularBase64 } from "./BodoniModa_Variable.ts";
import { donneesBase64 as bodoniBoldBase64 } from "./BodoniModa_Bold.ts";
import { donneesBase64 as plexRegularBase64 } from "./IBMPlexSans_Variable.ts";
import { donneesBase64 as plexSemiBoldBase64 } from "./IBMPlexSans_SemiBold.ts";
import { donneesBase64 as plexLightBase64 } from "./IBMPlexSans_Light.ts";
import { donneesBase64 as bodoniItalicBase64 } from "./BodoniModa_Italic.ts";
import { GRILLE } from "./design-system.ts";
import {
  dessinerBandeauTempsForts,
  dessinerEnteteJour,
  dessinerFiletMarge,
  dessinerGaleriePhotos,
  dessinerPageCloture,
  dessinerPageCouverture,
  dessinerPageGalerieTrois,
  dessinerPiedDePage,
  dessinerRecitColonnes,
  dessinerRepereCarte,
  dessinerSceauCarnet,
  dessinerSeparateurChapitre,
  formatDateLongue,
  nettoyerHtml,
  nouvellePage,
  PhotoValide,
  Polices,
} from "./composants.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function decoderBase64(base64: string): Uint8Array {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { voyage_id, mode } = await requete.json();
    if (!voyage_id || (mode !== "perso" && mode !== "famille")) {
      return jsonResponse({ error: "voyage_id et mode ('perso'|'famille') requis" }, 400);
    }

    const authHeader = requete.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "authentification requise" }, 401);

    // Client scope a l'utilisateur appelant : le RLS des migrations 0005/0018
    // fait tout le travail de restriction (membre du voyage, photos visibles),
    // pas la peine de le reimplementer ici.
    const supabaseUtilisateur = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: erreurUser } = await supabaseUtilisateur.auth.getUser();
    if (erreurUser || !userData?.user) return jsonResponse({ error: "session invalide" }, 401);
    const utilisateurId = userData.user.id;

    const { data: voyage, error: erreurVoyage } = await supabaseUtilisateur
      .from("voyages").select("titre, titre_suite, date_debut, date_fin").eq("id", voyage_id).maybeSingle();
    if (erreurVoyage || !voyage) return jsonResponse({ error: "voyage introuvable ou acces refuse" }, 404);

    const { data: journees, error: erreurJournees } = await supabaseUtilisateur
      .from("journees")
      .select("id, date, titre, accroche, rail1, rail2, fil, categorie, illustration, eclipse, chapitre, lieux(nom, ordre)")
      .eq("voyage_id", voyage_id).order("ordre", { ascending: true });
    if (erreurJournees) return jsonResponse({ error: erreurJournees.message }, 500);

    // Surcharges de texte de carnet (migration 0020) : uniquement en mode
    // perso, propres a l'appelant -- le carnet familial n'a pas de
    // proprietaire par journee, il reste toujours sur le texte automatique.
    const textesParJournee = new Map<string, string>();
    if (mode === "perso") {
      const { data: textesCarnet, error: erreurTextes } = await supabaseUtilisateur
        .from("carnet_textes").select("journee_id, texte")
        .eq("voyage_id", voyage_id).eq("membre_id", utilisateurId);
      if (erreurTextes) return jsonResponse({ error: erreurTextes.message }, 500);
      for (const t of textesCarnet || []) textesParJournee.set(t.journee_id, t.texte);
    }

    // Meme gabarit que texteAutoJournee (app/index.html) : assemblage de
    // champs deja verifies (titre, accroche, rail1, lieux/fil), jamais de
    // donnee inventee.
    function texteAutoJournee(j: { titre: string; accroche: string | null; rail1: string | null; fil: { texte: string }[] | null; lieux: { nom: string; ordre: number }[] | null }): string {
      const titre = nettoyerHtml(j.titre);
      let debut = titre + (j.rail1 ? ` — ${j.rail1}` : "");
      const suite: string[] = [];
      if (j.accroche) suite.push(nettoyerHtml(j.accroche));
      const lieuxNoms = (j.lieux || []).slice().sort((a, b) => a.ordre - b.ordre).map((l) => l.nom).filter(Boolean);
      if (lieuxNoms.length) {
        suite.push(`Au programme : ${lieuxNoms.join(", ")}.`);
      } else if (j.fil && j.fil.length) {
        suite.push(`Au programme : ${j.fil.map((f) => nettoyerHtml(f.texte)).join(" ")}`);
      }
      return debut + (suite.length ? `. ${suite.join(" ")}` : ".");
    }

    let requetePhotos = supabaseUtilisateur.from("photos").select("*").eq("voyage_id", voyage_id);
    requetePhotos = mode === "perso"
      ? requetePhotos.eq("membre_id", utilisateurId)
      : requetePhotos.eq("visibilite", "partagee");
    const { data: photos, error: erreurPhotos } = await requetePhotos.order("cree_le", { ascending: true });
    if (erreurPhotos) return jsonResponse({ error: erreurPhotos.message }, 500);
    if (!photos || !photos.length) {
      return jsonResponse({ error: "aucune photo pour ce mode — rien à générer" }, 422);
    }

    const photosParJournee = new Map<string, typeof photos>();
    for (const p of photos) {
      const liste = photosParJournee.get(p.journee_id) || [];
      liste.push(p);
      photosParJournee.set(p.journee_id, liste);
    }
    const journeesIllustrees = (journees || []).filter((j) => photosParJournee.get(j.id)?.length);

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const polices: Polices = {
      titre: await pdf.embedFont(decoderBase64(bodoniBoldBase64)),
      titreDoux: await pdf.embedFont(decoderBase64(bodoniRegularBase64)),
      accroche: await pdf.embedFont(decoderBase64(bodoniItalicBase64)),
      texte: await pdf.embedFont(decoderBase64(plexRegularBase64)),
      label: await pdf.embedFont(decoderBase64(plexSemiBoldBase64)),
      legende: await pdf.embedFont(decoderBase64(plexLightBase64)),
    };

    // cache par id de photo : la photo de couverture est choisie parmi les
    // photos du premier jour illustré (voir plus bas), puis ce même jour
    // est redessiné dans la boucle principale -- sans cache, chaque photo
    // du premier jour serait téléchargée et embarquée deux fois.
    const cacheImages = new Map<string, Awaited<ReturnType<typeof pdf.embedJpg>> | null>();
    async function telechargerImage(photo: NonNullable<typeof photos>[number]) {
      if (cacheImages.has(photo.id)) return cacheImages.get(photo.id)!;
      const { data: fichier, error } = await supabaseUtilisateur.storage.from("photos").download(photo.storage_path);
      if (error || !fichier) {
        cacheImages.set(photo.id, null);
        return null;
      }
      const octets = new Uint8Array(await fichier.arrayBuffer());
      let image;
      try {
        image = await pdf.embedJpg(octets);
      } catch {
        try {
          image = await pdf.embedPng(octets);
        } catch {
          image = null;
        }
      }
      cacheImages.set(photo.id, image);
      return image;
    }

    let folio = 0;

    // --- page 1 : couverture ------------------------------------------
    // photo héros choisie parmi les photos du premier jour illustré, pas
    // juste la première venue : on préfère le ratio le plus proche du
    // cadre en arche de la couverture (largeur/hauteur ≈ 1.15), et à
    // ratio égal la définition la plus haute -- seul critère de "qualité"
    // mesurable sans inventer une note esthétique.
    const RATIO_ARCHE_COUVERTURE = (GRILLE.largeur - GRILLE.marge * 2) / 420;
    const photosPremierJour = journeesIllustrees.length ? photosParJournee.get(journeesIllustrees[0].id) || [] : [];
    const candidatesCouverture = (await Promise.all(
      photosPremierJour.map(async (p) => ({ p, img: await telechargerImage(p).catch(() => null) })),
    )).filter((c): c is { p: NonNullable<typeof photos>[number]; img: NonNullable<Awaited<ReturnType<typeof telechargerImage>>> } => !!c.img);
    const imgCouverture = candidatesCouverture.length
      ? candidatesCouverture.reduce((meilleur, c) => {
        const ecart = (img: typeof c.img) => Math.abs(img.width / img.height - RATIO_ARCHE_COUVERTURE);
        if (ecart(c.img) < ecart(meilleur.img)) return c;
        if (ecart(c.img) === ecart(meilleur.img) && c.img.width * c.img.height > meilleur.img.width * meilleur.img.height) return c;
        return meilleur;
      }).img
      : null;
    const titreCarnet = [voyage.titre, voyage.titre_suite].filter(Boolean).join(" ").replace(/<[^>]+>/g, "");
    dessinerPageCouverture(pdf, polices, {
      titre: titreCarnet,
      mode,
      dateDebut: formatDateLongue(voyage.date_debut) || null,
      dateFin: formatDateLongue(voyage.date_fin) || null,
      nbJours: journeesIllustrees.length,
      nbPhotos: photos.length,
      motifsRepli: ["collines", "clocher", "cypres"],
      imgHero: imgCouverture,
    });
    folio++;

    // --- une page par journee ayant au moins une photo ------------------
    for (const j of journeesIllustrees) {
      const photosDuJour = photosParJournee.get(j.id)!;

      const chapitre = j.chapitre as { numero?: string; titre?: string } | null;
      if (chapitre?.numero) {
        dessinerSeparateurChapitre(pdf, polices, chapitre);
        folio++;
      }

      let page = nouvellePage(pdf);
      folio++;
      const estEclipse = !!j.eclipse;
      dessinerFiletMarge(page);
      dessinerSceauCarnet(page, polices, GRILLE.largeur - GRILLE.marge - 34, GRILLE.hauteur - 66, 30);
      dessinerRepereCarte(page, GRILLE.largeur - GRILLE.marge - 56, GRILLE.hauteur - 118, 56, 130);

      const largeurDisponible = GRILLE.largeur - GRILLE.marge - 130;
      const titreJour = nettoyerHtml(j.titre);
      let y = dessinerEnteteJour(page, polices, {
        date: j.date ? formatDateLongue(j.date) : "",
        titre: titreJour,
        accroche: j.accroche ? nettoyerHtml(j.accroche as string) : null,
        estEclipse,
        largeurDisponible,
      }, GRILLE.hauteur - 62);

      // paragraphe de contexte : surcharge de l'utilisateur (mode perso)
      // ou gabarit automatique -- jamais vide, voir texteAutoJournee.
      const texteJour = textesParJournee.get(j.id) || texteAutoJournee(j as Parameters<typeof texteAutoJournee>[0]);

      const images = await Promise.all(photosDuJour.map((p) => telechargerImage(p).catch(() => null)));
      const valides: PhotoValide[] = photosDuJour
        .map((p, i) => ({ img: images[i], legende: p.legende ? String(p.legende) : null }))
        .filter((e): e is PhotoValide => !!e.img);

      // récit à double lecture (brief : "récit écrit / récit
      // photographique") : la première photo accompagne le texte en
      // colonne. Elle seule vit sur la page récit -- toute photo
      // supplémentaire va sur une page galerie dédiée, TOUJOURS une page
      // neuve (règle explicite du 2026-08-05 : "aucune photographie de
      // galerie ne doit être placée sur la page récit", et jamais de
      // titre de galerie orphelin en bas de la page récit).
      // photo secondaire de la page récit (petite, cadre arche, colonne de
      // gauche) : la 2e photo réellement disponible du jour, quand elle
      // existe -- prélevée AVANT le reste, qui part sur la page galerie
      // (elle n'est donc jamais montrée deux fois). S'il n'y a qu'une seule
      // photo pour la journée, aucune photo secondaire (comportement de
      // repli, jamais de case vide).
      const [photoPrincipale, photoSecondaireRecit, ...photosRestantes] = valides;
      dessinerRecitColonnes(page, polices, texteJour, photoPrincipale ?? null, y, 158, photoSecondaireRecit ?? null);

      // bandeau "temps forts / détails du jour" : position FIXE en bas de
      // page récit (esprit maquette de référence -- un vrai bandeau de bas
      // de page, pas un bloc qui suit la fin, variable, du texte), jamais
      // superposé au pied de page (folio) grâce à sa hauteur réservée fixe.
      const largeurContenuBandeau = GRILLE.largeur - GRILLE.marge * 2;
      dessinerBandeauTempsForts(page, polices, {
        lieux: (j.lieux as { nom: string; ordre: number }[] | null) || [],
        rail1: j.rail1 ? String(j.rail1) : null,
        rail2: j.rail2 ? String(j.rail2) : null,
        largeurDisponible: largeurContenuBandeau,
      }, 158);

      dessinerPiedDePage(page, polices, titreJour, folio);

      if (photosRestantes.length) {
        page = nouvellePage(pdf);
        folio++;
        dessinerFiletMarge(page);
        dessinerSceauCarnet(page, polices, GRILLE.largeur - GRILLE.marge - 34, GRILLE.hauteur - 66, 30);
        dessinerRepereCarte(page, GRILLE.largeur - GRILLE.marge - 56, GRILLE.hauteur - 118, 56, 130);
        let yGalerie = GRILLE.hauteur - 62;

        if (photosRestantes.length === 3) {
          // composition dédiée imposée (section 5 du brief) : photo large
          // à gauche, photo + citation en haut à droite, panoramique en bas.
          const intro = j.accroche
            ? nettoyerHtml(j.accroche as string)
            : `Un aperçu en images de la journée à ${titreJour}.`; // formule neutre dérivée du seul nom de lieu, jamais d'événement inventé
          yGalerie = dessinerPageGalerieTrois(page, polices, {
            surtitre: "Galerie du jour",
            titre: `Les plus beaux instants de ${titreJour}`,
            intro,
            photos: [photosRestantes[0], photosRestantes[1], photosRestantes[2]],
          }, yGalerie);
        } else if (photosRestantes.length <= 6) {
          // 4-6 photos : une seule page, composition asymétrique (hero +
          // vignettes de tailles variées) déjà non uniforme -- voir
          // dessinerGaleriePhotos, branche >=3.
          const etatPage = { page, folio };
          dessinerGaleriePhotos(etatPage, pdf, polices, titreJour, photosRestantes, yGalerie);
          page = etatPage.page;
          folio = etatPage.folio;
        } else {
          // 7 photos et plus : plusieurs pages galerie, chacune avec sa
          // propre composition complète (titre + hero + vignettes) --
          // jamais une dernière page avec seulement une ou deux petites
          // images en haut (règle explicite du brief).
          const paquets: PhotoValide[][] = [];
          for (let i = 0; i < photosRestantes.length; i += 5) paquets.push(photosRestantes.slice(i, i + 5));
          paquets.forEach((paquet, i) => {
            if (i > 0) {
              page = nouvellePage(pdf);
              folio++;
              dessinerFiletMarge(page);
              dessinerSceauCarnet(page, polices, GRILLE.largeur - GRILLE.marge - 34, GRILLE.hauteur - 66, 30);
              dessinerRepereCarte(page, GRILLE.largeur - GRILLE.marge - 56, GRILLE.hauteur - 118, 56, 130);
              yGalerie = GRILLE.hauteur - 62;
            }
            const etatPage = { page, folio };
            dessinerGaleriePhotos(etatPage, pdf, polices, `${titreJour} (${i + 1}/${paquets.length})`, paquet, yGalerie);
            page = etatPage.page;
            folio = etatPage.folio;
          });
        }
        dessinerPiedDePage(page, polices, titreJour, folio);
      }
    }

    // --- page de clôture -------------------------------------------------
    folio++;
    dessinerPageCloture(pdf, polices, {
      titreCarnet,
      dateDebut: formatDateLongue(voyage.date_debut) || null,
      dateFin: formatDateLongue(voyage.date_fin) || null,
      nbJours: journeesIllustrees.length,
      nbPhotos: photos.length,
      mode,
      folio,
    });

    const octetsPdf = await pdf.save();

    const chemin = `${voyage_id}/${utilisateurId}/${mode}-${Date.now()}.pdf`;
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: erreurUpload } = await supabaseService.storage
      .from("carnets").upload(chemin, octetsPdf, { contentType: "application/pdf" });
    if (erreurUpload) return jsonResponse({ error: erreurUpload.message }, 500);

    const { data: urlSignee, error: erreurSignature } = await supabaseService.storage
      .from("carnets").createSignedUrl(chemin, 3600);
    if (erreurSignature || !urlSignee) return jsonResponse({ error: "échec de génération du lien" }, 500);

    return jsonResponse({ url: urlSignee.signedUrl });
  } catch (e) {
    console.error("generer-carnet:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "erreur inattendue" }, 500);
  }
});
