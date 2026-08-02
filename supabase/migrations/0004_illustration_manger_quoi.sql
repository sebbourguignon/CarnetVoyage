-- Trois champs de donnees.js (Italie2026) oubliés dans 0001/0002, détectés
-- lors de la première publication réelle du voyage salo2026 : le script de
-- migration les avait signalés comme non mappés plutôt que de les perdre
-- silencieusement.

alter table journees add column illustration jsonb;  -- ex. ["montagnes", "clocher"], mots-clés pour le bandeau
alter table journees add column manger jsonb;         -- {midi: {nom, ou, note}, soir: {...}}, facultatif

alter table observations add column quoi text;        -- description de l'observation, distincte de `ou`
