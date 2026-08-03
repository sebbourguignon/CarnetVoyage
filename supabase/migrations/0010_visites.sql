-- Statistiques de fréquentation famille : une ligne "visite" par
-- chargement de page, pour les membres famille connectés uniquement.
-- Jamais pour les visiteurs publics du contenu "amis", qui n'ont pas de
-- compte et restent anonymes par design.

create table visites (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references voyages(id) on delete cascade,
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  debutee_le timestamptz not null default now(),
  derniere_activite_le timestamptz not null default now(),
  duree_secondes integer not null default 0,
  onglets_vus jsonb not null default '[]'   -- [{onglet, le}], un par changement d'onglet
);

alter table visites enable row level security;

create policy "ecriture propre visite" on visites for all
  using (utilisateur_id = auth.uid()) with check (utilisateur_id = auth.uid());

-- Lecture réservée aux comptes admin du voyage concerné (voir 0008 pour
-- le rôle), même pattern que la lecture progression par la famille
-- (0003) mais restreinte au rôle admin puisque c'est une donnée
-- d'usage, pas de correction partagée.
create policy "lecture admin visites" on visites for select using (
  exists (
    select 1 from membres_famille mf
    where mf.voyage_id = visites.voyage_id
      and mf.utilisateur_id = auth.uid()
      and mf.role = 'admin'
  )
);
