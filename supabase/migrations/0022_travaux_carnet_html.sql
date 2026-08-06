-- Travaux asynchrones du générateur HTML/Paged.js. Le modèle est construit
-- dans l'application depuis les données déjà filtrées par RLS. La fonction
-- Netlify travaille avec le JWT du membre, jamais avec une clé service.
create table carnet_travaux (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references voyages(id) on delete cascade,
  membre_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'en_cours', 'termine', 'erreur')),
  modele jsonb not null,
  chemin_pdf text,
  erreur text,
  diagnostic jsonb,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

alter table carnet_travaux enable row level security;
create policy "gestion de ses travaux de carnet" on carnet_travaux for all
  using (auth.uid() = membre_id)
  with check (auth.uid() = membre_id);

-- Le PDF reste privé et rangé sous <voyage>/<membre>/<travail>.pdf.
create policy "depot de ses propres carnets" on storage.objects for insert
  with check (
    bucket_id = 'carnets'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy "mise a jour de ses propres carnets" on storage.objects for update
  using (
    bucket_id = 'carnets'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy "suppression de ses propres carnets" on storage.objects for delete
  using (
    bucket_id = 'carnets'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create index carnet_travaux_membre_date on carnet_travaux (membre_id, cree_le desc);
