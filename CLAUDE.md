# CarnetVoyage

Moteur générique de carnet de voyage — dérivé d'[Italie2026](../Italie2026),
mêmes principes (terrain avant tout, jamais de donnée inventée), mais le
contenu vit en base Supabase au lieu d'un fichier `donnees.js` statique.
Un seul moteur de rendu (`app/`) sert n'importe quel voyage via `?voyage=<slug>`.

**Ce fichier sert de brief pour préparer un nouveau voyage en conversation.**
Il documente le format exact attendu, pour qu'une session Claude qui n'a
jamais vu ce projet sache quoi produire sans redécouvrir le schéma à tâtons.

Si la préparation du contenu se fait ailleurs que dans Claude Code (chat
web, autre assistant), utiliser plutôt `docs/preparer-un-voyage.md` — un
brief autonome, sans dépendance au dépôt, à coller tel quel. Ce
`CLAUDE.md` reste la référence quand on travaille directement dans le
dépôt.

## Principes hérités (non négociables)

- **Ne jamais inventer une donnée** — horaire, tarif, jour de fermeture,
  durée de trajet, prix. Écrire `à vérifier` plutôt que de combler un
  champ. Si une donnée vient d'une source, le dire en conversation.
- **Terrain avant tout** — consultation mobile, souvent sans réseau. Le
  service worker (`app/sw.js`) est déjà en place ; rien dans le contenu
  ne doit supposer une connexion permanente.
- **Tout le contenu est en français**, y compris les commentaires de code.
- **Pas de framework front, pas de dépendance ajoutée** — HTML/CSS/JS
  natifs côté `app/`. Les seuls scripts Node sont dans `outils/`, sans
  dépendance npm (module `https` natif, voir `outils/publier-voyage.js`).

## Environnements (prod / dev)

Deux projets Supabase distincts, jamais un seul partagé entre
développement et production :

| | Prod | Dev |
|---|---|---|
| Projet Supabase | `CarnetVoyage` (`cgxnrgkalhfyfkpesshq`) | `CarnetVoyage Dev` (`ozjbkpgoatagqyrlxdry`) |
| Déclenché par | domaine `salo2026.netlify.app` uniquement | tout le reste (localhost, previews, autre domaine) — défaut de sécurité |
| Fichier de clés (scripts `outils/`) | `.env` | `.env.dev` |
| Migrations appliquées par CI sur | branche `main` | toute autre branche |

Le choix d'environnement côté `app/index.html` se fait au runtime par
nom d'hôte (`ENVIRONNEMENTS`/`HOTE_PRODUCTION`, dans `chargerEtDemarrer`)
puisque le projet n'a pas de build — impossible d'utiliser une variable
d'environnement classique. **Tester en local ou sur une preview touche
donc automatiquement le projet dev, jamais les données famille.**

Pour un script `outils/` en ligne de commande, préciser l'environnement
visé explicitement plutôt que de se fier à un fichier `.env` déjà
chargé dans le shell :
```bash
set -a && source .env.dev && set +a   # ou .env pour la prod, en conscience
node outils/mettre-a-jour-voyage.js voyages/salo2026.json
```

**CI/CD** (`.github/workflows/supabase-migrations.yml`) : à chaque push
qui touche `supabase/migrations/`, les migrations non encore jouées sont
poussées automatiquement — vers dev sur toute branche, vers prod
uniquement depuis `main`. Le contenu (`voyages/<slug>.json`) n'est *pas*
poussé par la CI : publier/mettre à jour le contenu reste une action
volontaire (`outils/publier-voyage.js` ou `mettre-a-jour-voyage.js`),
avec le bon fichier de clés en tête.

Garder les deux projets en phase pour le **schéma** (une migration
écrite = à jouer des deux côtés, la CI s'en charge) ; le **contenu**,
lui, peut légitimement diverger (dev sert à casser des choses sans
craindre pour les vraies données du voyage).

## Préparer un nouveau voyage — déroulé en conversation

1. **Contenu** — tu décris le voyage (dates, destinations, contraintes
   familiales — le chien, le rythme voulu). Je rédige le JSON complet
   (voir schéma ci-dessous) dans `voyages/<slug>.json`, en respectant le
   principe « jamais de donnée inventée » : tout ce que je ne sais pas
   vérifier devient `à vérifier` dans `voyage.a_verifier`, pas un champ
   comblé au hasard.
2. **Thème visuel** — je propose une palette et des polices (Google Fonts)
   ancrées sur le lieu/la culture du voyage, sous la forme exacte attendue
   par `voyages.theme` (voir plus bas). Toujours à valider en conversation
   avant publication — jamais imposé.
3. **Illustrations** — si le voyage a besoin d'un motif absent de
   `app/illustrations.js` (ex. une cathédrale, des vignes de Champagne),
   je l'ajoute à la bibliothèque partagée plutôt que de créer un fichier
   par voyage — elle est déjà paramétrée par couleur CSS, pas par thème.
4. **Publication** — une fois `voyages/<slug>.json` validé :
   ```bash
   set -a && source .env.dev && set +a   # tester en dev d'abord — toujours
   node outils/publier-voyage.js voyages/<slug>.json
   ```
   Les clés viennent de `.env` (prod) ou `.env.dev` (non versionnés, voir
   « Environnements » ci-dessus) — tester en dev avant de rejouer contre
   `.env` en conscience. Le script s'arrête net à la première erreur —
   pas de rattrapage silencieux, l'état partiel en base est signalé.
5. **Édition ultérieure** — un changement ponctuel se fait directement en
   base (SQL ou conversation), puis :
   ```bash
   node outils/exporter-voyage.js <slug>
   ```
   pour que le JSON reste le miroir exact du contenu publié.
6. **Comptes famille** (si le voyage a du contenu réservé) —
   `outils/inviter-membre.js` crée les comptes email invités. Voir
   « Accès et authentification » dans le README pour le modèle
   `amis`/`famille`.

## Format de `voyages/<slug>.json`

Un objet à trois clés : `voyage`, `journees` (tableau), `badges` (tableau).
Le mapping exact vers les tables Supabase est dans
`supabase/migrations/0001_init.sql` à `0014_chapitre_jsonb.sql` — la liste
ci-dessous en est le résumé côté rédaction.

### `voyage` (objet)

| Champ | Rôle |
|---|---|
| `slug` | identifiant d'URL, ex. `reims2026` — court, sans espace |
| `titre` / `titre_suite` | titre affiché ; `titre_suite` peut contenir du HTML simple (`<em>`) |
| `sous_titre` | ligne de dates/étapes sous le titre |
| `date_debut` / `date_fin` | `YYYY-MM-DD` |
| `frise_legende` | légende sous la frise d'intensité |
| `a_verifier` | résumé des points ouverts avant départ — jamais vide s'il y a une incertitude |
| `urgences` | objet `{memo: [texte...], numeros: [{tel, label, note?}...], documents, consulaire, veterinaires}` — jamais de donnée personnelle identifiante ici, en lecture publique sans restriction |
| `theme` | optionnel, voir section dédiée ci-dessous |

**Assurance auto (numéro client, numéro de contrat)** : n'existe **pas**
dans `voyages/<slug>.json` — le dépôt Git est public, ce fichier ne doit
jamais porter d'identifiant personnel. Cette donnée vit uniquement dans
`urgences_famille` (table à part, RLS réservée aux comptes famille,
migration 0015), éditée directement en base ou en conversation, jamais
via le pipeline `outils/`.

### `journees` (tableau, un objet par jour)

Repris quasi à l'identique du format `JOURS` d'Italie2026 (voir son
`CLAUDE.md`), avec quelques champs Supabase en plus.

| Champ | Rôle |
|---|---|
| `ancre` | ancre unique, format `d-MMJJ` |
| `date` | `YYYY-MM-DD` — remplace `dow`/`num`/`mois` d'Italie2026, recalculés côté moteur |
| `rail1` / `rail2` | distance et durée, ou `Sur place` |
| `categorie` | `route` · `ville` · `nature` · `lac` · `evenement` |
| `badge` | libellé de la pastille |
| `intensite` | 1 à 4 |
| `star` | `true` pour les temps forts |
| `eclipse` / `anniversaire` | booléens, événements spéciaux du jour |
| `titre` / `accroche` | titre de journée et intention |
| `fil` | `[{h, texte}]` — déroulé horodaté |
| `options_titre` / `options` | alternatives |
| `notes` | `[{ton, titre, texte}]`, `ton` = `alerte` ou `soleil` |
| `chapitre` | facultatif, `{numero, titre}` — ex. `{"numero":"Chapitre I","titre":"La descente"}` ; `numero` s'affiche en très grand corps Bodoni, `titre` en dessous |
| `ordre` | position dans le voyage (entier, définit le tri) |
| `pratique` | `{parking, ztl, reserver, emporter, chien}`, chaque clé facultative |
| `carte` | `[{label, requete}]` — `requete` = texte de recherche Google Maps |
| `lat` / `lon` | position (nombres décimaux) du lieu principal de la journée — sert à la météo (voir section dédiée) ; absent = pas de pastille météo pour ce jour, rien d'autre n'en dépend |
| `illustration` | `["mot-clé", ...]` — motifs disponibles dans `app/illustrations.js`, du fond vers le premier plan |
| `manger` | `{midi: {ou, nom, note, tel?}, plat, soir: {...}}`, tout facultatif |
| `visibilite` | `amis` (public, par défaut) ou `famille` (réservé) |
| `observations` | `[{ou, niveau, quoi}]` — `niveau` 1 à 3, sert aux badges |
| `lieux` | `[{nom, quoi, pratique, requete, ordre}]` — fiches lieu |
| `quiz_questions` | `[{question, choix: [texte...], reponse_correcte, ordre}]` — `reponse_correcte` = index dans `choix`, jamais republié dans le JSON exporté (il vit dans `quiz_reponses`, réservé aux admins) |

Dans les champs texte, HTML simple autorisé : `<b>`, `<i>`, `<sup>`. Le
jeton `{{chien}}` est remplacé par la pastille « Chien ok ».

### `badges` (tableau)

| Champ | Rôle |
|---|---|
| `nom` / `resume` / `icone` | affichage du badge |
| `seuil_niveau3` / `seuil_total` / `seuil_journees_corrigees` / `seuil_points_quiz` | conditions de déblocage, une seule renseignée en général |
| `ordre` | position d'affichage |
| `conditions_brutes` | `[{jour: <ancre>, ou: <texte identique à observations[].ou>}]` — résolu vers `badge_conditions` à la publication |

## Météo (`journees[].lat`/`lon`, optionnel)

Ajouté en 0017. Chaque journée peut porter la position (latitude,
longitude en degrés décimaux) de son lieu principal — pas forcément la
base du voyage : un jour d'excursion prend la position de la
destination du jour, pas celle de l'hébergement. `app/index.html`
(fonction `chargerJoursMeteo`) interroge Open-Meteo (API gratuite, sans
clé) et affiche, dans le bandeau de tête de la vue détail :
- le relevé réel pour un jour déjà passé,
- les conditions actuelles pour aujourd'hui,
- la prévision pour un jour à venir.

**Un seul lieu par jour, mais partagé entre jours qui s'y trouvent
ensemble** : un seul appel réseau couvre tout le voyage pour une
position donnée (Open-Meteo renvoie jusqu'à 92 jours passés + 16 jours
à venir en une requête), donc plusieurs journées à la même base
(ex. six jours à Salò) doivent réutiliser exactement les mêmes
`lat`/`lon` plutôt que des coordonnées légèrement différentes — sinon
autant d'appels réseau que de variantes.

En préparant un voyage, propose une position (ville/lieu-dit) par
journée, dérivée du lieu réellement visité ce jour-là — jamais une
position par défaut appliquée à tout le séjour. Coordonnées au niveau
ville suffisent, inutile de viser l'adresse exacte : la météo ne varie
pas à cette échelle.

## Thème par voyage (`voyage.theme`, optionnel)

Ajouté en 0011 pour qu'un deuxième voyage porte sa propre identité sans
toucher au moteur. Absent (`null`) → palette et polices par défaut
(Officina Bodoniana, salo2026) inchangées.

```json
{
  "polices_google": ["Playfair+Display:wght@600;700"],
  "css": ":root{--rosso:#7A2E2E;--font-display:'Playfair Display',Georgia,serif;}"
}
```

- `polices_google` : un identifiant par famille, format Google Fonts API
  (`Famille:wght@poids`), sans le domaine — chargé via `<link>` injecté au
  démarrage, mis en cache par le service worker comme les polices actuelles.
- `css` : un bloc `:root{...}` qui surcharge tout ou partie des variables
  définies dans `app/index.html` (`--paper`, `--ink`, `--rosso`, `--sole`,
  `--oliva`, `--lago`, `--font-display`, `--font-body`, `--font-mono`,
  etc.) — inutile de tout redéfinir, seules les variables citées changent.
- Toujours proposer palette + polices en conversation avant de les écrire
  dans le JSON, comme pour le contenu : c'est un choix éditorial, pas une
  valeur par défaut à deviner.

## Ce qui n'est PAS à documenter ici

Architecture technique détaillée, RLS, fonctions SQL : voir les migrations
dans `supabase/migrations/` (chacune commentée avec le pourquoi) et le
README (« Architecture », « Accès et authentification », « Quiz et
correction à distance »). Ce fichier reste focalisé sur *préparer du
contenu de voyage*, pas sur l'infrastructure.
