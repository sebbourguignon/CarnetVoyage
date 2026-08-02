-- URGENCES (numéros, vétérinaires, assurance auto, consulaire, documents,
-- mémo) est une donnée par voyage dans donnees.js (Italie2026), oubliée
-- comme illustration/manger/quoi avant elle : détectée en testant le rendu
-- réel, où l'onglet Urgences provoquait un ReferenceError (variable globale
-- absente, faute de colonne pour la porter).

alter table voyages add column urgences jsonb;
