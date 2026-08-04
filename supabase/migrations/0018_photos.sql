-- Photos ajoutees par les membres famille, rattachees a une journee.
-- Deux usages en aval (voir conversation de conception) : chaque membre
-- genere son propre carnet PDF a partir de ses photos (visibilite quelconque),
-- et un carnet familial optionnel agrege les photos que leurs auteurs ont
-- explicitement marquees "partagee" -- opt-in, jamais automatique.
--
-- Stockage binaire dans Supabase Storage (bucket "photos", cree separement
-- via le dashboard/CLI -- une migration SQL ne peut pas creer de bucket),
-- cette table ne porte que le chemin et les metadonnees.

create table photos (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references voyages(id) on delete cascade,
  journee_id uuid not null references journees(id) on delete cascade,
  membre_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  legende text,
  prise_le timestamptz,
  visibilite text not null default 'perso' check (visibilite in ('perso', 'partagee')),
  cree_le timestamptz not null default now()
);

create index photos_voyage_journee on photos (voyage_id, journee_id);
create index photos_membre on photos (membre_id);

alter table photos enable row level security;

-- Un membre gere entierement ses propres photos (creer, voir, modifier la
-- legende/visibilite, supprimer), quel que soit le voyage -- la verification
-- d'appartenance au voyage se fait a l'ecriture cote appli (journee_id doit
-- appartenir a un voyage dont il est membre), pas via une policy dediee,
-- puisque auth.uid() = membre_id suffit a circonscrire l'acces a ses propres
-- lignes.
create policy "gestion de ses propres photos" on photos for all using (
  auth.uid() = membre_id
) with check (
  auth.uid() = membre_id
);

-- Les autres membres famille du meme voyage voient les photos marquees
-- partagee -- necessaire pour le carnet familial agrege et pour l'affichage
-- du pool de photos dans le bloc "Photos" d'une journee.
create policy "lecture des photos partagees par la famille" on photos for select using (
  visibilite = 'partagee' and est_membre_famille(voyage_id)
);

-- Bucket prive : les fichiers ne sont jamais servis en URL publique directe,
-- toujours via une URL signee generee cote appli apres verification RLS.
-- Convention de chemin imposee par la policy ci-dessous :
--   <voyage_id>/<membre_id>/<uuid-fichier>.jpg
-- (le membre_id dans le chemin permet de restreindre l'ecriture sans avoir
-- a interroger la table photos depuis la policy storage, qui ne connait que
-- le chemin -- la ligne correspondante dans photos est creee dans le meme
-- appel applicatif que l'upload).
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "depot de ses propres photos" on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "suppression de ses propres photos" on storage.objects for delete
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Lecture : son propre dossier, ou celui de n'importe quel membre du meme
-- voyage (le filtrage "partagee vs perso" reste applique par l'appli via
-- la table photos avant de demander l'URL signee -- storage.objects ne
-- connait pas la colonne visibilite).
create policy "lecture des photos de son voyage" on storage.objects for select
  using (
    bucket_id = 'photos'
    and est_membre_famille((storage.foldername(name))[1]::uuid)
  );
