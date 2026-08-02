-- Accès famille par compte (Supabase Auth) et quiz synchronisé multi-appareils.
-- Remplace l'idée initiale de mot de passe partagé famille/amis : le contenu
-- "amis" reste public, le contenu "famille" n'est visible qu'aux comptes
-- email invités par l'organisateur du voyage (toi). Le quiz est réservé aux
-- comptes famille, corrigé à distance depuis n'importe quel appareil connecté.

-- Qui fait partie de la famille pour un voyage donné. Une ligne = un compte
-- Supabase Auth (créé par invitation, jamais d'inscription libre) rattaché
-- à un voyage.
create table membres_famille (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references voyages(id) on delete cascade,
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  ajoute_le timestamptz not null default now(),
  unique (voyage_id, utilisateur_id)
);

alter table membres_famille enable row level security;

-- Un membre peut voir la liste des autres membres de ses propres voyages
-- (utile pour l'écran de correction : savoir qui a le droit de répondre).
create policy "lecture par membre" on membres_famille for select using (
  exists (
    select 1 from membres_famille mf
    where mf.voyage_id = membres_famille.voyage_id
      and mf.utilisateur_id = auth.uid()
  )
);
create policy "ecriture admin" on membres_famille for all using (auth.role() = 'service_role');

-- Niveau de visibilité du contenu : "amis" (public) ou "famille" (réservé).
alter table journees add column visibilite text not null default 'amis'
  check (visibilite in ('amis', 'famille'));
alter table observations add column visibilite text not null default 'amis'
  check (visibilite in ('amis', 'famille'));

-- Les policies de lecture publique posées dans 0001 étaient inconditionnelles ;
-- on les remplace par des versions qui respectent le niveau et l'appartenance
-- à la famille du voyage.
drop policy "lecture publique" on journees;
create policy "lecture journees" on journees for select using (
  visibilite = 'amis'
  or exists (
    select 1 from membres_famille mf
    where mf.voyage_id = journees.voyage_id
      and mf.utilisateur_id = auth.uid()
  )
);

drop policy "lecture publique" on observations;
create policy "lecture observations" on observations for select using (
  visibilite = 'amis'
  or exists (
    select 1 from journees j
    join membres_famille mf on mf.voyage_id = j.voyage_id
    where j.id = observations.journee_id
      and mf.utilisateur_id = auth.uid()
  )
);

-- Le quiz est entièrement réservé à la famille connectée, quel que soit le
-- niveau de la journée à laquelle il appartient.
drop policy "lecture publique" on quiz_questions;
create policy "lecture quiz par famille" on quiz_questions for select using (
  exists (
    select 1 from journees j
    join membres_famille mf on mf.voyage_id = j.voyage_id
    where j.id = quiz_questions.journee_id
      and mf.utilisateur_id = auth.uid()
  )
);

-- Progression : remplace l'appareil anonyme par le compte connecté, pour
-- pouvoir centraliser les réponses de quiz et les corriger à distance.
alter table progression drop constraint progression_voyage_id_appareil_id_key;
alter table progression drop column appareil_id;
alter table progression add column utilisateur_id uuid not null references auth.users(id) on delete cascade;
alter table progression add column quiz_corrige boolean not null default false;
alter table progression add column quiz_score integer;
alter table progression add column quiz_corrige_le timestamptz;
alter table progression add unique (voyage_id, utilisateur_id);

drop policy "progression par appareil" on progression;
create policy "lecture et ecriture de sa propre progression" on progression for all using (
  utilisateur_id = auth.uid()
);
-- Un membre famille peut lire (pour corriger) la progression de quiz des
-- autres membres du même voyage, mais ne peut écrire que la sienne (géré
-- par la policy ci-dessus + celle-ci qui n'ajoute qu'un droit de lecture).
create policy "lecture progression par la famille du voyage" on progression for select using (
  exists (
    select 1 from membres_famille mf
    where mf.voyage_id = progression.voyage_id
      and mf.utilisateur_id = auth.uid()
  )
);

-- Correction du quiz : un membre famille peut marquer corrigé/score sur la
-- progression d'un autre membre du même voyage, mais jamais modifier ses
-- réponses brutes (quiz_etat, observations_cochees). Passer par une fonction
-- security definer plutôt qu'une policy UPDATE large évite d'ouvrir l'écriture
-- de tous les champs de la ligne à n'importe quel membre de la famille.
create function corriger_quiz(
  cible_utilisateur_id uuid,
  cible_voyage_id uuid,
  nouveau_score integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from membres_famille mf
    where mf.voyage_id = cible_voyage_id
      and mf.utilisateur_id = auth.uid()
  ) then
    raise exception 'pas membre de la famille de ce voyage';
  end if;

  update progression
  set quiz_corrige = true,
      quiz_score = nouveau_score,
      quiz_corrige_le = now()
  where voyage_id = cible_voyage_id
    and utilisateur_id = cible_utilisateur_id;
end;
$$;
