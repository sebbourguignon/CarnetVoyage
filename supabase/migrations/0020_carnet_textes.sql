-- Texte de narration par journee pour le carnet PDF (voir conception,
-- conversation du 2026-08-04) : chaque membre peut remplacer le
-- paragraphe assemble automatiquement (titre + accroche + lieux, voir
-- texteAutoJournee dans app/index.html) par son propre texte pour SON
-- carnet perso. Une ligne = une surcharge ; son absence signifie
-- "utiliser le texte automatique", jamais une valeur vide stockee en
-- base -- coherent avec le principe general "jamais de donnee inventee"
-- (le texte auto est assemble depuis des champs deja verifies, pas
-- devine).
--
-- Personnel a chaque membre, pas partage : le carnet familial (mode
-- "famille" de generer-carnet) n'a pas de proprietaire unique par
-- journee, il utilise toujours le texte automatique.

create table carnet_textes (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references voyages(id) on delete cascade,
  journee_id uuid not null references journees(id) on delete cascade,
  membre_id uuid not null references auth.users(id) on delete cascade,
  texte text not null,
  maj_le timestamptz not null default now(),
  unique (journee_id, membre_id)
);

alter table carnet_textes enable row level security;

create policy "gestion de son propre texte de carnet" on carnet_textes for all using (
  auth.uid() = membre_id
) with check (
  auth.uid() = membre_id
);
