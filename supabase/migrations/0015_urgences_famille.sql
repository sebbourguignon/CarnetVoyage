-- L'assurance auto (numero client, numero de contrat) vivait dans
-- voyages.urgences, une colonne en lecture publique sans restriction
-- (policy "lecture publique" ... using (true), 0001) : n'importe qui
-- connaissant l'URL du carnet pouvait recuperer ces identifiants via
-- l'API REST, sans meme etre connecte. Trouve en verifiant avant de
-- rendre le depot GitHub public (donnee independante de GitHub, deja
-- exposee par l'API).
--
-- Table a part, RLS reservee aux membres famille (meme fonction
-- est_membre_famille que le reste du schema, 0005) - memes principes
-- que quiz_reponses (0008) pour la bonne reponse du quiz : la donnee
-- sensible vit hors de la ligne publique, jamais dans un champ mele au
-- contenu public.

create table urgences_famille (
  voyage_id uuid primary key references voyages(id) on delete cascade,
  assurance_auto jsonb
);

alter table urgences_famille enable row level security;

create policy "lecture famille" on urgences_famille for select using (
  est_membre_famille(voyage_id)
);
