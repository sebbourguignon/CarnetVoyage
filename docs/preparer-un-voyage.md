# Préparer un voyage pour CarnetVoyage — brief autonome

Colle ce document en entier au début d'une conversation avec n'importe
quel assistant (Claude, ChatGPT, Mistral, Gemini...) pour préparer le
contenu d'un nouveau voyage. Il ne suppose aucun accès au dépôt de code :
tout ce qu'il faut savoir est inclus ci-dessous.

## Contexte

CarnetVoyage est un carnet de voyage numérique, familial, consulté sur
téléphone — souvent en voiture, souvent sans réseau. Le lecteur connaît
déjà le voyage : il ne cherche pas à être convaincu, il cherche à
retrouver vite une heure de départ, une option de repli, un point de
vigilance. Le contenu que tu vas m'aider à produire suit ce même esprit.

Le résultat attendu de cette conversation est **un unique objet JSON**,
au format exact décrit plus bas, que je publierai ensuite moi-même dans
la base de données du projet.

## Règles non négociables

1. **Ne jamais inventer une donnée** — horaire, tarif, jour de fermeture,
   durée de trajet, prix, numéro de téléphone. Si tu ne sais pas ou si tu
   n'es pas sûr, écris `à vérifier` (ou laisse la note correspondante
   dans `voyage.a_verifier`) plutôt que de proposer une valeur plausible.
   Une erreur ici coûte une vraie journée de vacances.
2. **Tout le texte est en français.**
3. **Contraintes familiales toujours respectées** : si je t'ai dit qu'on
   voyage avec un chien, une poussette, des personnes à mobilité réduite,
   etc., chaque journée proposée doit rester compatible — pas d'excursion
   qui suppose implicitement de laisser quelqu'un ou quelque chose de côté.
4. **Rythme voulu** : en général on préfère plus d'options que de temps
   disponible, avec un plan B systématique par journée. Le but n'est pas
   de tout faire, c'est de ne jamais être coincé. (Je préciserai si ce
   voyage veut un rythme différent — plus lent, plus local.)
5. HTML simple autorisé dans les champs texte : `<b>`, `<i>`, `<sup>`.
   Le jeton `{{chien}}` est remplacé automatiquement par une pastille
   « Chien ok » — à utiliser si le voyage inclut un animal.

## Déroulé de la conversation

1. Je te décris le voyage : dates, lieu(x), contraintes familiales,
   rythme voulu, ce qu'on a déjà envie de faire ou qu'on avait évoqué.
2. Tu poses les questions nécessaires pour combler les trous plutôt que
   de deviner (jours de fermeture, horaires de marée/éclipse/événement,
   affluence saisonnière...).
3. Tu me proposes une structure de journées (dates, chapitres, temps
   forts) avant de rédiger le détail, pour qu'on valide l'ossature.
4. Tu rédiges le JSON complet au format ci-dessous, un morceau à la fois
   si le voyage est long (une journée = un objet dans `journees`).
5. En option, tu proposes une palette de couleurs et deux ou trois
   polices Google Fonts qui évoquent le lieu du voyage (voir section
   « Système de design »).
6. Je récupère le JSON final et je le publie moi-même côté technique —
   tu n'as pas besoin d'accéder à une base de données ou à un dépôt Git.

## Format attendu

Un objet à trois clés : `voyage`, `journees` (tableau), `badges`
(tableau, facultatif si le voyage n'a pas de quiz/badges). Squelette à
copier comme point de départ (les commentaires `//` ne sont pas du JSON
valide, à retirer dans le livrable final) :

```jsonc
{
  "voyage": {
    "slug": "reims2026",                    // court, sans espace ni accent
    "titre": "Une semaine",
    "titre_suite": "en <em>Champagne</em>",  // HTML simple autorisé
    "sous_titre": "26 OCTOBRE → 1er NOVEMBRE 2026 · REIMS",
    "date_debut": "2026-10-26",
    "date_fin": "2026-11-01",
    "frise_legende": "Le rythme de la semaine — hauteur = intensité de la journée",
    "a_verifier": "À vérifier avant départ : jour de fermeture de X · réservation de Y",
    "urgences": {
      "memo": ["Conseil pratique local, ex. numéro d'urgence, coutume administrative."],
      "numeros": [{ "tel": "112", "label": "Urgences — tous pays d'Europe" }]
    },
    "theme": {                               // facultatif, retirer si pas de thème dédié — voir plus bas
      "polices_google": ["Playfair+Display:wght@600;700"],
      "css": ":root{--rosso:#7A2E2E;--font-display:'Playfair Display',Georgia,serif;}"
    }
  },

  "journees": [
    {
      "ancre": "d-1026",                     // d-MMJJ
      "date": "2026-10-26",
      "rail1": "≈ 3 h 00",                   // ou distance, ou "Sur place"
      "rail2": "Route",
      "categorie": "route",                  // route | ville | nature | lac | evenement
      "badge": "Route",
      "intensite": 2,                        // 1 à 4
      "star": false,
      "eclipse": false,
      "anniversaire": false,
      "titre": "Titre de la journée",
      "accroche": "Une phrase d'intention.",
      "fil": [
        { "h": "9 h 00", "texte": "Départ." },
        { "h": "12 h 00", "texte": "Arrivée, installation." }
      ],
      "options_titre": "Si vous avez plus de temps",
      "options": ["<b>Une alternative</b> — pourquoi elle vaut le détour"],
      "notes": [
        { "ton": "alerte", "titre": "À anticiper", "texte": "Ce qu'il faut réserver ou prévoir." },
        { "ton": "alerte", "titre": "Si ça tourne mal", "texte": "Le repli si la journée dérape (météo, fermeture, imprévu) — une note comme une autre, pas un champ séparé." }
      ],
      "chapitre": null,                      // texte, ou null/absent si pas de rupture de chapitre ici
      "ordre": 0,
      "pratique": {
        "parking": "où se garer",
        "reserver": "ce qui doit être réservé à l'avance",
        "chien": "facile | à vérifier | interdit"
      },
      "carte": [{ "label": "Nom du point", "requete": "texte de recherche Google Maps" }],
      "illustration": ["motif-fond", "motif-milieu", "motif-premier-plan"],
      "manger": {
        "midi": { "ou": "adresse ou secteur", "nom": "nom du lieu", "note": "détail pratique" },
        "plat": "spécialité locale à goûter",
        "soir": { "ou": "adresse", "nom": "nom du lieu", "note": "détail pratique" }
      },
      "visibilite": "amis",                  // amis | famille
      "observations": [
        { "ou": "Nom du point d'observation", "niveau": 1, "quoi": "ce qu'on y voit ou apprend" }
      ],
      "lieux": [
        { "nom": "Nom du lieu", "quoi": "description", "pratique": "horaires/tarif si connus, sinon 'à vérifier'", "requete": "texte Google Maps" }
      ],
      "quiz_questions": [
        { "question": "Une question sur la journée ?", "choix": ["Réponse A", "Réponse B", "Réponse C"], "reponse_correcte": 0, "ordre": 0 }
      ]
    }
  ],

  "badges": [
    {
      "nom": "Nom du badge",
      "resume": "Ce qu'il récompense.",
      "icone": "mot-clé-icone",
      "seuil_niveau3": null,
      "seuil_total": null,
      "seuil_journees_corrigees": null,
      "seuil_points_quiz": null,
      "ordre": 0,
      "conditions_brutes": [{ "jour": "d-1026", "ou": "Nom du point d'observation" }]
    }
  ]
}
```

Détail champ par champ ci-dessous.

### `voyage` (objet)

| Champ | Type | Rôle |
|---|---|---|
| `slug` | texte | identifiant d'URL, court, sans espace ni accent — ex. `reims2026` |
| `titre` | texte | titre principal affiché |
| `titre_suite` | texte, facultatif | fin du titre, HTML simple autorisé — ex. `week-end en <em>Champagne</em>` |
| `sous_titre` | texte | ligne de dates/étapes sous le titre |
| `date_debut` / `date_fin` | date `AAAA-MM-JJ` | bornes du voyage |
| `frise_legende` | texte | légende sous la frise d'intensité des journées |
| `a_verifier` | texte | résumé des points encore incertains avant le départ — jamais vide s'il y a une inconnue |
| `urgences` | objet, facultatif | `{ "memo": ["conseil...", ...], "numeros": [{"tel":"...", "label":"...", "note":"..."(facultatif)}] }` |
| `theme` | objet, facultatif | voir section « Thème visuel » |

### `journees` (tableau, un objet par jour)

| Champ | Type | Rôle |
|---|---|---|
| `ancre` | texte | identifiant unique, format `d-MMJJ` — ex. `d-1030` pour le 30 octobre |
| `date` | date `AAAA-MM-JJ` | |
| `rail1` / `rail2` | texte | distance et durée du trajet, ou `"Sur place"` |
| `categorie` | texte | une valeur parmi : `route`, `ville`, `nature`, `lac`, `evenement` |
| `badge` | texte | libellé court affiché en pastille |
| `intensite` | entier 1 à 4 | pilote la hauteur du trait dans la frise |
| `star` | booléen | `true` pour un temps fort du voyage |
| `eclipse` | booléen | `true` uniquement si un événement astronomique cadre cette journée (sinon `false`) |
| `anniversaire` | booléen | `true` si la journée marque un anniversaire ou une date spéciale familiale |
| `titre` | texte | titre de la journée |
| `accroche` | texte | une phrase d'intention |
| `fil` | tableau | `[{"h":"9 h 00", "texte":"..."}]` — déroulé horodaté |
| `options_titre` | texte, facultatif | ex. `"Si vous avez plus de temps"` |
| `options` | tableau de texte | alternatives, HTML simple autorisé |
| `notes` | tableau | `[{"ton":"alerte"|"soleil", "titre":"...", "texte":"..."}]` — le repli en cas d'imprévu (météo, fermeture) est une note `alerte` comme une autre, pas un champ séparé |
| `chapitre` | texte, facultatif | insère un séparateur de chapitre avant cette journée |
| `ordre` | entier | position dans le voyage (0, 1, 2...) |
| `pratique` | objet, facultatif | `{"parking":"...", "ztl":"...", "reserver":"...", "emporter":"...", "chien":"..."}` — chaque clé facultative |
| `carte` | tableau, facultatif | `[{"label":"...", "requete":"texte de recherche Google Maps"}]` |
| `illustration` | tableau de texte, facultatif | mots-clés de motifs visuels, du fond vers le premier plan — ex. `["montagnes","clocher"]`. Utilise des mots-clés génériques (montagne, colline, clocher, vigne, bateau, arbre...) ; je vérifierai s'ils existent déjà dans la bibliothèque, sinon je les ferai ajouter |
| `manger` | objet, facultatif | `{"midi":{"ou":"...", "nom":"...", "note":"...", "tel":"..."(facultatif)}, "plat":"spécialité locale", "soir":{...}}` |
| `visibilite` | texte, facultatif | `"amis"` (public, par défaut) ou `"famille"` (réservé aux comptes invités) |
| `observations` | tableau, facultatif | `[{"ou":"nom du point d'observation", "niveau":1-3, "quoi":"description"}]` — sert de base aux badges |
| `lieux` | tableau, facultatif | `[{"nom":"...", "quoi":"...", "pratique":"...", "requete":"texte Google Maps"}]` — fiches lieu détaillées |
| `quiz_questions` | tableau, facultatif | `[{"question":"...", "choix":["a","b","c"], "reponse_correcte":0, "ordre":0}]` — `reponse_correcte` est l'index (0-based) de la bonne réponse dans `choix` |

### `badges` (tableau, facultatif)

| Champ | Type | Rôle |
|---|---|---|
| `nom` / `resume` / `icone` | texte | affichage du badge (`icone` = mot-clé libre, à faire correspondre à une icône existante) |
| `seuil_niveau3` / `seuil_total` / `seuil_journees_corrigees` / `seuil_points_quiz` | entier, facultatifs | condition de déblocage — en général une seule renseignée, les autres `null` |
| `ordre` | entier | position d'affichage |
| `conditions_brutes` | tableau, facultatif | `[{"jour":"<ancre de la journée>", "ou":"<texte identique à observations[].ou>"}]` |

## Système de design (facultatif)

Si tu veux proposer une identité visuelle pour ce voyage (sinon on garde
le thème par défaut du moteur, palette Officina Bodoniana). C'est un
vrai exercice de design, pas juste choisir des couleurs — mêmes
contraintes que le thème par défaut :

**Important — penser le système comme un tout, pas comme une palette
qu'on change.** L'identité actuelle (Officina Bodoniana : polices,
couleurs, ET motifs d'illustration) a été conçue spécifiquement pour
l'Italie — les silhouettes existantes (cyprès, olivier, campanile,
capot de voiture pour Motor Valley, labyrinthe pour le Labirinto della
Masone...) sont des références italiennes précises, pas un vocabulaire
neutre. Pour un voyage ailleurs, les trois dimensions (polices,
couleurs, motifs) doivent être repensées ensemble, ancrées sur ce lieu
précis — pas juste changer `--rosso` en gardant des cyprès toscans dans
les bandeaux d'un voyage en Champagne. Le meilleur point de départ,
souvent, est une seule référence culturelle forte du lieu (comme Bodoni
pour l'Italie, choisi parce que le Museo Bodoniano et le Labirinto sont
deux étapes réelles du voyage) plutôt qu'un choix de couleurs abstrait.

### Contrainte d'usage, non négociable

L'écran est un téléphone, souvent au soleil, souvent en extérieur.
Conséquences directes :
- **Contraste fort obligatoire** entre le texte et le fond — viser au
  moins le ratio WCAG AA (4.5:1 pour le texte courant, 3:1 pour les
  gros titres). Pas de gris clair sur fond clair, pas de pari sur un
  bel écran calibré : on ne l'aura pas.
- **Une police à empattements marqués (display) réservée aux gros
  corps** (titres, numéros de jour — au-dessus de 28px environ) :
  les pleins et déliés d'une police élégante se brouillent en petite
  taille en plein soleil. Jamais cette police dans le corps de texte,
  une liste ou un badge.
- **Une police sans-serif pour le corps de texte**, lisible en petit.
- **Une police mono pour les données** (heures, distances, badges) —
  aligne les chiffres, signale visuellement « c'est une donnée, pas
  de la prose ».
- **Un seul accent de couleur dominant** (titres de rubrique, alertes),
  un second accent plus rare. Pas une palette arc-en-ciel : le carnet
  doit rester lisible d'un coup d'œil, pas décoratif.

### Jetons de couleur — lesquels toucher

Il y a deux familles de jetons. **Ne surcharger que les jetons de
base** ci-dessous : les variantes dérivées (`-light`, `-deep`,
`-synth`) se recalculent automatiquement à partir d'eux (mélange CSS
`color-mix`), inutile et risqué de les redéfinir une par une.

Jetons de base à choisir :

| Jeton | Rôle |
|---|---|
| `--paper` | fond principal (papier) |
| `--paper-deep` | fond légèrement plus soutenu (cartes, creux) |
| `--card` | fond de carte |
| `--ink` | texte principal |
| `--ink-soft` | texte secondaire |
| `--rosso` | accent principal — titres de rubrique, alertes |
| `--sole` | accent rare |
| `--blu` | second accent, réservé à un usage exceptionnel (ex. un événement particulier du voyage) |
| `--pietra` | couleur de la catégorie `route` |
| `--lago` | couleur de la catégorie `ville` |
| `--oliva` | couleur de la catégorie `nature` |
| `--lago-mid` | couleur de la catégorie `lac` |
| (`--sole` sert aussi de couleur à la catégorie `evenement`) | |

Les noms `--pietra`/`--lago`/`--oliva` viennent du thème par défaut
(pierre, lac, olivier) : ne pas se sentir obligé de leur trouver un
équivalent thématique dans le nouveau lieu, ce sont juste des noms de
variable — seule la valeur hexadécimale compte pour le nouveau thème.

### Illustrations — mécanique technique et vocabulaire à réinventer

Les bandeaux de journée sont composés par un moteur générique : chaque
silhouette est un dessin plat (une seule couleur, celle de la catégorie
de la journée), rangée en trois plans (fond/milieu/premier plan),
référencée par mot-clé dans `journees[].illustration` — ex.
`["collines", "vigne", "clocher"]`, du plan lointain vers le premier
plan. **Ce mécanisme est neutre et réutilisable pour n'importe quel
lieu.** Ce qui ne l'est pas, ce sont les silhouettes elles-mêmes :

```
montagnes, collines, lac, vagues, vigne, route, pont, chateau, clocher,
cypres, pin, olivier, voile, rocher, soleil, arcades, coupole, creneaux,
aqueduc, viaduc, remparts, cascade, aiguilles, gorge, terrasses,
tourbiere, dolmen, bambou, citronnier, platane, capot, labyrinthe, volcan
```

— ce sont des motifs italiens (cyprès, olivier, campanile, capot de
Ferrari...), choisis pour le voyage 2026. Pour un voyage ailleurs,
**propose un nouveau jeu de motifs propres au lieu** (pour la
Champagne, par exemple : coteaux de vignes en terrasses, une flèche de
cathédrale gothique plutôt qu'un campanile italien, des fûts/pupitres
de vinification, des champs de craie...) plutôt que de piocher dans la
liste ci-dessus par facilité. Une poignée de motifs génériques
(montagnes, collines, lac, vagues, route, pont, rocher, soleil) peuvent
rester pertinents tels quels si le paysage s'y prête réellement — à
juger au cas par cas, pas par défaut.

Pour chaque motif proposé (qu'il soit nouveau ou réutilisé), une
description en une phrase suffit (ex. « une flèche de cathédrale
gothique élancée, à trois niveaux ») — je le ferai ajouter à la
bibliothèque technique, en silhouette plate à une couleur cohérente
avec le reste du système.

### Format attendu

```json
{
  "polices_google": ["Playfair+Display:wght@600;700"],
  "css": ":root{--rosso:#7A2E2E;--font-display:'Playfair Display',Georgia,serif;}"
}
```

- `polices_google` : identifiants Google Fonts (`Famille:wght@poids`),
  sans domaine.
- `css` : un bloc `:root{...}` qui ne surcharge que les jetons choisis
  ci-dessus, plus `--font-display` / `--font-body` / `--font-mono` si
  tu changes les polices.

Propose 2-3 directions de palette avec une justification courte (ce
qu'elles évoquent du lieu, pourquoi le contraste tient), je choisirai.
Comme pour le contenu : **je ne peux valider le rendu réel qu'en le
testant moi-même dans l'application** — ce document ne permet pas de
voir le résultat en direct, seulement de proposer les valeurs.

## Comment me rendre le résultat

Un seul bloc de code JSON, valide, complet. Si le voyage est long,
on peut construire par morceaux (d'abord `voyage`, puis les journées une
à une ou par petits groupes), mais le livrable final doit être un JSON
unique assemblé, prêt à copier dans un fichier.
