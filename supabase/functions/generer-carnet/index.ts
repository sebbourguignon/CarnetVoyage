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
// Palette et polices : reprises telles quelles de la direction
// Officina Bodoniana d'app/index.html (variables --paper/--ink/--rosso,
// --font-display/--font-body) pour que le carnet imprime ressemble a
// l'appli plutot qu'a un PDF generique. Les deux fichiers de police sont
// les variable fonts Google Fonts telles quelles (aucune instance
// statique n'existe pour Bodoni Moda/IBM Plex Sans dans le depot
// google/fonts) : pdf-lib les embarque via leur instance par defaut
// (poids Regular) -- pas de gras disponible, compense par la taille
// plutot que par le poids pour les titres.
//
// Encodees en base64 dans des modules .ts (BodoniModa_Variable.ts,
// IBMPlexSans_Variable.ts) plutot que lues depuis un fichier .ttf a
// l'execution : `supabase functions deploy` ne televerse que les
// fichiers presents dans le graphe de modules import/export, jamais un
// asset statique lu via Deno.readFile -- verifie en test (erreur
// "path not found" une fois deploye).

import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import { donneesBase64 as bodoniModaBase64 } from "./BodoniModa_Variable.ts";
import { donneesBase64 as ibmPlexSansBase64 } from "./IBMPlexSans_Variable.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- palette Officina Bodoniana (voir app/index.html, :root) ------------
const CARTA = rgb(0xF3 / 255, 0xF1 / 255, 0xEA / 255);
const INCHIOSTRO = rgb(0x1A / 255, 0x1A / 255, 0x18 / 255);
const GRIGIO = rgb(0x59 / 255, 0x56 / 255, 0x50 / 255);
const ROSSO = rgb(0xB2 / 255, 0x3A / 255, 0x2E / 255);

const LARGEUR = 595.28, HAUTEUR = 841.89; // A4 portrait, points
const MARGE = 56;

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

/* dimensions d'une image mises a l'echelle "contain" dans une case
   carree (jamais de recadrage ni de deformation, contrairement a la
   premiere version qui forcait width=height=tailleCase) : le plus grand
   cote de l'image occupe tailleCase, l'autre est mis a l'echelle dans
   les memes proportions, puis l'image est centree dans la case. */
function dimensionsContenues(largeurImg: number, hauteurImg: number, tailleCase: number) {
  const echelle = Math.min(tailleCase / largeurImg, tailleCase / hauteurImg);
  const largeur = largeurImg * echelle;
  const hauteur = hauteurImg * echelle;
  return { largeur, hauteur, decalageX: (tailleCase - largeur) / 2, decalageY: (tailleCase - hauteur) / 2 };
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
    pdf.registerFontkit(fontkit);
    const policeTitre = await pdf.embedFont(decoderBase64(bodoniModaBase64));
    const policeTexte = await pdf.embedFont(decoderBase64(ibmPlexSansBase64));

    function nouvellePage() {
      const page = pdf.addPage([LARGEUR, HAUTEUR]);
      page.drawRectangle({ x: 0, y: 0, width: LARGEUR, height: HAUTEUR, color: CARTA });
      return page;
    }

    // --- page de couverture -------------------------------------------
    const couverture = nouvellePage();
    couverture.drawRectangle({ x: MARGE, y: HAUTEUR - 220, width: 34, height: 3, color: ROSSO });
    couverture.drawText(mode === "perso" ? "CARNET PERSONNEL" : "CARNET DE FAMILLE", {
      x: MARGE, y: HAUTEUR - 200, size: 10.5, font: policeTexte, color: ROSSO,
    });
    const titreCarnet = [voyage.titre, voyage.titre_suite].filter(Boolean).join(" ").replace(/<[^>]+>/g, "");
    couverture.drawText(titreCarnet, {
      x: MARGE, y: HAUTEUR - 260, size: 34, font: policeTitre, color: INCHIOSTRO, maxWidth: LARGEUR - MARGE * 2,
    });

    // --- une page par journee ayant au moins une photo ------------------
    for (const j of journees || []) {
      const photosDuJour = photosParJournee.get(j.id);
      if (!photosDuJour || !photosDuJour.length) continue;

      let page = nouvellePage();
      let y = HAUTEUR - 70;

      const dateAffichee = j.date
        ? new Date(j.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
        : "";
      page.drawText(dateAffichee.toUpperCase(), { x: MARGE, y, size: 9.5, font: policeTexte, color: GRIGIO });
      y -= 26;
      const titreJour = String(j.titre || "").replace(/<[^>]+>/g, "");
      page.drawText(titreJour, { x: MARGE, y, size: 22, font: policeTitre, color: INCHIOSTRO, maxWidth: LARGEUR - MARGE * 2 });
      y -= 16;
      page.drawRectangle({ x: MARGE, y, width: 28, height: 2, color: ROSSO });
      y -= 30;

      // grille 2 colonnes, chaque photo mise a l'echelle "contain" et
      // centree dans sa case (jamais de deformation, voir dimensionsContenues).
      const colonnes = 2;
      const espace = 14;
      const tailleCase = (LARGEUR - MARGE * 2 - espace * (colonnes - 1)) / colonnes;

      let colonne = 0;
      for (const photo of photosDuJour) {
        try {
          const { data: fichier, error: erreurTelechargement } = await supabaseUtilisateur
            .storage.from("photos").download(photo.storage_path);
          if (erreurTelechargement || !fichier) continue;
          const octets = new Uint8Array(await fichier.arrayBuffer());
          const image = await pdf.embedJpg(octets).catch(() => pdf.embedPng(octets));

          if (y - tailleCase < 50) {
            page = nouvellePage();
            y = HAUTEUR - 70;
            colonne = 0;
          }
          const caseX = MARGE + colonne * (tailleCase + espace);
          const caseYBas = y - tailleCase;
          const dims = dimensionsContenues(image.width, image.height, tailleCase);
          page.drawImage(image, {
            x: caseX + dims.decalageX,
            y: caseYBas + dims.decalageY,
            width: dims.largeur,
            height: dims.hauteur,
          });

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
