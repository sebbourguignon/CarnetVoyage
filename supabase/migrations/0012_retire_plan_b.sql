-- Retire la fonctionnalite Plan B, alignee sur son retrait dans Italie2026
-- (commit f43b53d : suppression du champ, du mode d'affichage bascule et
-- de son indexation dans la recherche). Les infos de repli utiles avaient
-- deja ete reinjectees en `notes` avant le retrait, cote Italie2026 comme
-- cote CarnetVoyage (voyages/salo2026.json).

alter table journees drop column plan_b;
