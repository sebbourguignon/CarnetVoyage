-- Nouveau type de seuil de badge : nombre de photos personnelles
-- deposees dans l'application (voir 0018_photos.sql), pour le badge
-- "Le Photographe" demande par les enfants -- seuil sur MES photos
-- uploadees, pas sur le total famille (RLS de la table photos ne
-- laisse voir a chaque membre que ses propres photos + celles marquees
-- "partagee" par les autres, donc un total famille exact demanderait
-- une fonction dediee ; un seuil individuel reste dans le meme modele
-- que les seuils existants, tous evalues sur l'etat de l'appareil
-- courant -- voir badgeObtenu dans app/index.html).
alter table badges add column seuil_photos integer;
