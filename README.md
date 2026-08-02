# CarnetVoyage

Version générique du carnet de route développé pour [Italie2026](../Italie2026) :
même moteur de rendu (HTML/CSS/JS vanilla, offline-first), mais contenu
piloté par une base Supabase au lieu d'un fichier `donnees.js` statique —
pour pouvoir lancer un nouveau voyage sans toucher au code.

## Architecture

```
app/        → le moteur de rendu (gabarit, styles, filtres, frise, chasse
              au trésor, quiz), porté depuis index.html d'Italie2026.
              Charge son contenu via l'API Supabase au lieu d'un objet
              JOURS/BADGES en dur, avec un service worker qui met en cache
              la réponse + les assets pour l'usage hors-connexion.
admin/      → interface CRUD pour créer/éditer un voyage : journées, fil
              horodaté, observations, quiz, badges. Authentifiée (Supabase
              Auth), pas d'accès public.
supabase/
  migrations/ → schéma SQL (voyages, journees, observations, quiz_questions,
                badges, badge_conditions, progression).
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

Chaque ligne de `voyages` a un `slug` (ex. `salo2026`). L'app publique se
charge avec ce slug dans l'URL et récupère tout son contenu (journées,
observations, quiz, badges) filtré par `voyage_id`. Créer un nouveau voyage
= créer une ligne + son contenu via l'admin, sans déploiement de code.

## État actuel

Scaffold initial : schéma Supabase posé, structure de dossiers en place.
Reste à faire (voir suite de la conversation / tâches de suivi) :

1. Créer le projet Supabase et appliquer `supabase/migrations/0001_init.sql`
2. Porter le moteur de rendu d'`index.html` (Italie2026) vers `app/`, en
   remplaçant la lecture de `JOURS`/`BADGES` par des appels à l'API Supabase
3. Écrire le service worker (cache-first sur le contenu du voyage actif)
4. Construire l'admin (auth + formulaires CRUD)
5. Script de migration : convertir `donnees.js` (Italie2026) en insertions
   SQL, pour vérifier le modèle sur des données réelles
