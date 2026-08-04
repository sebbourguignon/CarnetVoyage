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
// pdf-lib (npm, via specifier Deno natif) : seule dependance de ce
// fichier, pas de bundler -- Deno resout et met en cache le paquet lui-meme.
// Le reste du projet (app/, outils/) reste sans dependance, voir CLAUDE.md ;
// cette regle vise le code servi au navigateur, pas les Edge Functions,
// ou assembler un PDF a la main serait deraisonnable.

import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

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

Deno.serve(async (requete) => {
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
      .from("voyages").select("titre, titre_suite").eq("id", voyage_id).maybeSingle();
    if (erreurVoyage || !voyage) return jsonResponse({ error: "voyage introuvable ou acces refuse" }, 404);

    const { data: journees, error: erreurJournees } = await supabaseUtilisateur
      .from("journees").select("id, date, titre, accroche").eq("voyage_id", voyage_id).order("ordre", { ascending: true });
    if (erreurJournees) return jsonResponse({ error: erreurJournees.message }, 500);

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

    const pdf = await PDFDocument.create();
    const policeTitre = await pdf.embedFont(StandardFonts.HelveticaBold);
    const policeTexte = await pdf.embedFont(StandardFonts.Helvetica);
    const LARGEUR = 595.28, HAUTEUR = 841.89; // A4 portrait, points

    // --- page de couverture -------------------------------------------
    const couverture = pdf.addPage([LARGEUR, HAUTEUR]);
    const titreCarnet = [voyage.titre, voyage.titre_suite].filter(Boolean).join(" ").replace(/<[^>]+>/g, "");
    couverture.drawText(titreCarnet, {
      x: 50, y: HAUTEUR - 160, size: 26, font: policeTitre, color: rgb(0.11, 0.11, 0.09), maxWidth: LARGEUR - 100,
    });
    couverture.drawText(mode === "perso" ? "Carnet personnel" : "Carnet de famille", {
      x: 50, y: HAUTEUR - 200, size: 14, font: policeTexte, color: rgb(0.7, 0.23, 0.18),
    });

    // --- une page par journee ayant au moins une photo ------------------
    for (const j of journees || []) {
      const photosDuJour = photosParJournee.get(j.id);
      if (!photosDuJour || !photosDuJour.length) continue;

      let page = pdf.addPage([LARGEUR, HAUTEUR]);
      let y = HAUTEUR - 60;

      const dateAffichee = j.date ? new Date(j.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "";
      page.drawText(dateAffichee, { x: 50, y, size: 11, font: policeTexte, color: rgb(0.43, 0.42, 0.38) });
      y -= 22;
      const titreJour = String(j.titre || "").replace(/<[^>]+>/g, "");
      page.drawText(titreJour, { x: 50, y, size: 18, font: policeTitre, color: rgb(0.11, 0.11, 0.09), maxWidth: LARGEUR - 100 });
      y -= 34;

      // grille simple 2 colonnes, images carrees recadrees par le fit
      // proportionnel de pdf-lib (drawImage avec width/height fixes) --
      // suffisant pour un carnet a emporter, pas un book d'edition.
      const colonnes = 2;
      const marge = 50;
      const espace = 12;
      const tailleCase = (LARGEUR - marge * 2 - espace * (colonnes - 1)) / colonnes;

      let colonne = 0;
      for (const photo of photosDuJour) {
        try {
          const { data: fichier, error: erreurTelechargement } = await supabaseUtilisateur
            .storage.from("photos").download(photo.storage_path);
          if (erreurTelechargement || !fichier) continue;
          const octets = new Uint8Array(await fichier.arrayBuffer());
          const image = await pdf.embedJpg(octets).catch(() => pdf.embedPng(octets));

          if (y - tailleCase < 40) {
            page = pdf.addPage([LARGEUR, HAUTEUR]);
            y = HAUTEUR - 60;
            colonne = 0;
          }
          const x = marge + colonne * (tailleCase + espace);
          page.drawImage(image, { x, y: y - tailleCase, width: tailleCase, height: tailleCase });

          colonne = (colonne + 1) % colonnes;
          if (colonne === 0) y -= tailleCase + espace;
        } catch (_e) {
          continue; // une photo illisible ne doit pas casser tout le carnet
        }
      }
    }

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
