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
   « Thème visuel »).
6. Je récupère le JSON final et je le publie moi-même côté technique —
   tu n'as pas besoin d'accéder à une base de données ou à un dépôt Git.

## Format attendu

Un objet à trois clés : `voyage`, `journees` (tableau), `badges`
(tableau, facultatif si le voyage n'a pas de quiz/badges).

Un modèle commenté et copiable est disponible dans `voyages/_modele.md`
si tu y as accès ; sinon, le schéma complet suit.

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
| `plan_b` | texte | le repli, un seul paragraphe |
| `notes` | tableau | `[{"ton":"alerte"|"soleil", "titre":"...", "texte":"..."}]` |
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

## Thème visuel (facultatif)

Si tu veux proposer une identité visuelle pour ce voyage (sinon on garde
le thème par défaut du moteur) :

```json
{
  "polices_google": ["Playfair+Display:wght@600;700"],
  "css": ":root{--rosso:#7A2E2E;--font-display:'Playfair Display',Georgia,serif;}"
}
```

- `polices_google` : identifiants Google Fonts (`Famille:wght@poids`),
  sans domaine.
- `css` : un bloc `:root{...}` qui ne surcharge que les variables
  voulues, parmi : `--paper` (fond), `--ink` (texte), `--rosso` (accent
  principal), `--sole` (accent rare), `--oliva`, `--lago`, `--lago-mid`
  (couleurs de catégories), `--font-display` (titres), `--font-body`
  (corps de texte), `--font-mono` (données/heures). Propose 2-3 options
  avec une justification courte (ce qu'elles évoquent du lieu), je
  choisirai.

## Comment me rendre le résultat

Un seul bloc de code JSON, valide, complet. Si le voyage est long,
on peut construire par morceaux (d'abord `voyage`, puis les journées une
à une ou par petits groupes), mais le livrable final doit être un JSON
unique assemblé, prêt à copier dans un fichier.
