-- Position (lat/lon) du lieu principal de chaque journee, pour la
-- meteo (voir app/index.html, chargerJoursMeteo) : Open-Meteo n'a besoin
-- que d'une position et d'une date, aucune cle ni compte. Nullable :
-- une journee sans position affiche simplement pas de pastille meteo,
-- comme les autres champs facultatifs du carnet.

alter table journees add column lat double precision;
alter table journees add column lon double precision;
