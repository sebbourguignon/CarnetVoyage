# CarnetVoyage

Version générique du carnet de route développé pour [Italie2026](../Italie2026) :
même moteur de rendu (HTML/CSS/JS vanilla, offline-first), mais contenu
piloté par une base Supabase au lieu d'un fichier `donnees.js` statique —
pour pouvoir lancer un nouveau voyage sans toucher au code.

Différence de fond avec Italie2026 : il n'y a pas d'interface de saisie.
Le contenu de chaque voyage (journées, quiz, badges, direction visuelle) est
rédigé par Claude en conversation avec l'organisateur, puis publié en base
par un script. Voir « Créer un nouveau voyage » ci-dessous.

## Architecture

```
app/        → le moteur de rendu (gabarit, styles, filtres, frise, chasse
              au trésor, quiz), porté depuis index.html d'Italie2026.
              Charge son contenu via l'API Supabase au lieu d'un objet
              JOURS/BADGES en dur, avec un service worker qui met en cache
              la réponse + les assets pour l'usage hors-connexion (à écrire).
              Un thème CSS + un fichier d'illustrations par voyage sont
              chargés dynamiquement selon le slug (à écrire).
voyages/    → un fichier JSON par voyage (ex. salo2026.json), sauvegarde
              lisible du contenu publié en base. Resynchronisé après
              chaque édition ciblée pour ne jamais devenir périmé.
outils/
  publier-voyage.js   → lit voyages/<slug>.json, crée toutes les lignes
                        en base (voyage, journées, observations, quiz,
                        badges) dans le bon ordre de dépendances.
  exporter-voyage.js  → relit un voyage depuis la base et réécrit son
                        JSON, pour resynchroniser après une édition ciblée.
supabase/
  migrations/ → schéma SQL : voyages, journees, observations,
                quiz_questions, badges, badge_conditions, membres_famille,
                progression.
```

## Principes hérités d'Italie2026

- **Terrain avant tout** : consultation mobile, souvent sans réseau. Le
  service worker et le cache local ne sont pas une option, ils sont la
  priorité n°1 de ce projet.
- **Ne jamais inventer une donnée** (horaire, tarif, jour de fermeture) —
  champ vide ou "à vérifier" plutôt qu'une valeur plausible.
- Pas de framework front lourd : HTML/CSS/JS natifs, pour rester léger et
  rapide à charger.

## Multi-voyage

Chaque ligne de `voyages` a un `slug` (ex. `salo2026`), utilisé dans l'URL
publique (`?voyage=salo2026`). `app/` reste un seul et même fichier pour
tous les voyages : il charge le contenu, le thème et les illustrations du
voyage demandé au moment du chargement, rien n'est codé en dur par voyage
dans le moteur de rendu.

## Créer un nouveau voyage

1. **Conversation** : l'organisateur décrit le voyage (dates, destinations,
   contraintes familiales, rythme voulu) à Claude, qui rédige le contenu
   (journées, fil horodaté, observations, quiz, badges) en respectant les
   mêmes règles qu'Italie2026 — jamais de donnée inventée.
2. **Direction visuelle** : Claude propose une palette, des polices et des
   illustrations ancrées sur le pays/la culture du voyage (comme la
   direction Officina Bodoniana pour l'Italie), à valider en conversation.
3. **Sauvegarde** : le contenu est écrit dans `voyages/<slug>.json`,
   versionné avec le reste du repo.
4. **Publication** : `outils/publier-voyage.js` pousse ce JSON en base.
5. **Édition ultérieure** : les changements ponctuels ("l'horaire du 6 août
   passe à 15h") se font directement en base, puis
   `outils/exporter-voyage.js` resynchronise le JSON pour qu'il reste le
   miroir exact du contenu publié.

## Accès et authentification

- **Contenu public** (`visibilite = 'amis'`, valeur par défaut) : visible
  par tout le monde sans connexion, comme un site classique.
- **Contenu famille** (`visibilite = 'famille'`) : réservé aux comptes
  email invités par l'organisateur (table `membres_famille`), via Supabase
  Auth (mot de passe ou bouton Google). Personne ne peut créer de compte
  de son propre chef — seul l'organisateur invite.
- La distinction est appliquée par les policies RLS en base (pas seulement
  cachée à l'écran), puisque de vrais comptes existent pour la famille.

## Quiz et correction à distance

Le quiz est réservé aux comptes famille connectés (pas de mode invité par
prénom). Chaque réponse est envoyée à la table `progression`, liée au
compte de son auteur. Le mécanisme de chiffrement de la bonne réponse
(`reponse_chiffree`, XOR + mot de passe, jamais stocké) est repris tel quel
d'Italie2026 — il sert à empêcher un enfant de lire la réponse dans le
code, pas à sécuriser la transmission.

Un membre famille au rôle `admin` (table `membres_famille`) voit apparaître
un onglet Admin dans la barre du bas de `app/` : il y retrouve la liste des
journées, les réponses de chaque membre lues via `quiz_reponses` (RLS
réservée aux admins), puis valide par personne — ce qui appelle la fonction
SQL `corriger_quiz(...)` qui écrit le résultat dans `progression` (et
seulement le résultat — jamais les réponses brutes des autres, par
construction de la fonction). Chaque appareil voit sa correction dès son
prochain chargement.

## Photos famille et carnet PDF à emporter

Migrations 0018-0020. Chaque membre famille peut déposer des photos par
journée depuis `app/` (`construireBlocPhotos`, compression côté client),
les marquer `visibilite: perso` (par défaut) ou `partagee`, et ajouter une
légende. Il peut aussi surcharger le texte automatique d'une journée pour
*son propre* carnet (`carnet_textes`, une ligne par membre × journée) —
le carnet familial, lui, n'a pas de propriétaire par journée et reste
toujours sur le texte automatique.

La génération du PDF est une Edge Function Supabase,
`supabase/functions/generer-carnet/` (Deno + pdf-lib, pas Node) :

```
index.ts          → orchestration : lit voyage/journées/photos depuis
                     Supabase (RLS fait le tri perso/famille), assemble
                     le contexte (polices embarquées, images
                     téléchargées), appelle les composants dans l'ordre,
                     upload le PDF dans le bucket privé "carnets" et
                     renvoie une URL signée (1h).
design-system.ts  → palette, grille de page (A4 portrait), échelle
                     typographique — toute valeur de style partagée par
                     plusieurs composants vit ici.
ornements.ts      → sceau (deux anneaux + texte courbe + scène italienne
                     en line-art), carte d'Italie stylisée (silhouette +
                     itinéraire pointillé + marqueurs), réutilisés en
                     grand (couverture/clôture) et en filigrane (page
                     récit).
icones.ts         → bibliothèque de pictogrammes line-art (amphithéâtre,
                     cœur, tour, arche, château, route, horloge, météo,
                     appareil photo), mappés par mot-clé sur le nom du
                     lieu — jamais un pictogramme générique répété.
illustrations.ts / italie.ts → silhouettes de fond (port pdf-lib de
                     app/illustrations.js) et tracé fixe de la botte
                     italienne (jamais dérivé de vraies coordonnées de
                     voyage).
composants.ts     → un composant nommé par bloc de mise en page
                     (dessinerPageCouverture, dessinerEnteteJour,
                     dessinerRecitColonnes, dessinerBandeauTempsForts,
                     dessinerPageGalerieTrois, dessinerPageCloture...).
```

Direction visuelle : esprit carnet/beau livre de voyage (palette carta/
inchiostro/terracotta/oliva, Bodoni Moda + IBM Plex, voir le détail des
couleurs et de la mise en page dans `CLAUDE.md` → « Générateur de PDF »).
Trois maquettes de référence (couverture, page récit, page galerie) font
foi pour toute nouvelle itération visuelle — reproduire leur composition
exacte, pas s'en inspirer librement.

Deux modes de génération, choisis à l'appel (`voyage_id`, `mode`) :
`perso` (uniquement les photos du membre appelant) ou `famille`
(uniquement les photos explicitement partagées par n'importe quel
membre). Disponible à tout moment, y compris en cours de voyage — pas de
notion de voyage « terminé ».

## État actuel

Schéma Supabase posé et appliqué (`0001_init.sql` à `0020_carnet_textes.sql`).
Moteur de rendu porté vers `app/` avec fetch Supabase (`demarrerCarnet`).
Le voyage salo2026 est publié et sert de validation sur données réelles.

Fait : `outils/publier-voyage.js`, `outils/exporter-voyage.js`,
authentification famille, onglet Admin (correction du quiz +
fréquentation), service worker (cache-first shell, network-first
données Supabase), photos famille + génération de carnet PDF (perso et
famille).

Reste à faire :

1. Thème (palette, polices) et illustrations chargés dynamiquement par
   slug — aujourd'hui la palette Officina Bodoniana et les polices
   Google Fonts sont en dur dans `app/index.html`, ce qui empêche un
   deuxième voyage de porter sa propre identité visuelle sans toucher
   au moteur
2. Générateur PDF : valider le rendu sur de vraies photos (jusqu'ici
   testé uniquement avec des aplats de couleur en local, voir
   `CLAUDE.md` → « Générateur de PDF » pour l'état exact et les points
   restants) et réduire l'espace vide en bas des pages galerie/clôture
