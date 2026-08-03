# Modèle de `voyages/<slug>.json`

Squelette annoté à copier-coller comme point de départ. Les commentaires
`//` ne sont pas du JSON valide : à retirer avant d'enregistrer le
fichier final (ou demander à l'assistant de les retirer en livrant le
JSON strict). Voir `docs/preparer-un-voyage.md` pour le schéma complet
commenté champ par champ.

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
      "memo": [
        "Conseil pratique local, ex. numéro d'urgence, coutume administrative."
      ],
      "numeros": [
        { "tel": "112", "label": "Urgences — tous pays d'Europe" }
      ]
    },
    "theme": {                               // facultatif, retirer si pas de thème dédié
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
      "options": [
        "<b>Une alternative</b> — pourquoi elle vaut le détour"
      ],
      "plan_b": "Le repli si la journée dérape, en un paragraphe.",
      "notes": [
        { "ton": "alerte", "titre": "À anticiper", "texte": "Ce qu'il faut réserver ou prévoir." }
      ],
      "chapitre": null,                      // texte, ou null/absent si pas de rupture de chapitre ici
      "ordre": 0,
      "pratique": {
        "parking": "où se garer",
        "reserver": "ce qui doit être réservé à l'avance",
        "chien": "facile | à vérifier | interdit"
      },
      "carte": [
        { "label": "Nom du point", "requete": "texte de recherche Google Maps" }
      ],
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
      "conditions_brutes": [
        { "jour": "d-1026", "ou": "Nom du point d'observation" }
      ]
    }
  ]
}
```
