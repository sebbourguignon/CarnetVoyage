-- Préparation explicite du carnet souvenir, additive et réversible.
-- `carnet_textes` reste en place pendant toute la période de validation.

create table carnet_journees (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references voyages(id) on delete cascade,
  journee_id uuid not null references journees(id) on delete cascade,
  membre_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  carnet_story text,
  carnet_story_source text not null default 'empty'
    check (carnet_story_source in ('manual', 'ai', 'empty', 'legacy')),
  carnet_story_validated boolean not null default false,
  notes_manuelles text,
  temperature_reelle smallint,
  temperature_relevee_le timestamptz,
  afficher_programme_prevu boolean not null default false,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  unique (journee_id, membre_id),
  check (carnet_story_source <> 'empty' or carnet_story is null or btrim(carnet_story) = ''),
  check (not carnet_story_validated or (carnet_story is not null and btrim(carnet_story) <> ''))
);

create table carnet_faits_confirmes (
  id uuid primary key default gen_random_uuid(),
  carnet_journee_id uuid not null references carnet_journees(id) on delete cascade,
  source_type text not null check (source_type in ('observation', 'lieu', 'manual')),
  source_id uuid,
  libelle text not null check (btrim(libelle) <> ''),
  moment_fort boolean not null default false,
  ordre integer not null default 0 check (ordre >= 0),
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  check ((source_type = 'manual' and source_id is null) or (source_type <> 'manual' and source_id is not null))
);

create unique index carnet_faits_source_unique
  on carnet_faits_confirmes (carnet_journee_id, source_type, source_id)
  where source_id is not null;

create table carnet_photos_selectionnees (
  id uuid primary key default gen_random_uuid(),
  carnet_journee_id uuid not null references carnet_journees(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  ordre integer not null default 0 check (ordre >= 0),
  principale boolean not null default false,
  focal_x numeric(5,4) not null default 0.5 check (focal_x between 0 and 1),
  focal_y numeric(5,4) not null default 0.5 check (focal_y between 0 and 1),
  legende_carnet text,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  unique (carnet_journee_id, photo_id)
);

create unique index carnet_photo_principale_unique
  on carnet_photos_selectionnees (carnet_journee_id)
  where principale;

create index carnet_journees_membre_voyage
  on carnet_journees (membre_id, voyage_id);
create index carnet_faits_journee_ordre
  on carnet_faits_confirmes (carnet_journee_id, ordre);
create index carnet_photos_journee_ordre
  on carnet_photos_selectionnees (carnet_journee_id, ordre);

alter table carnet_journees enable row level security;
alter table carnet_faits_confirmes enable row level security;
alter table carnet_photos_selectionnees enable row level security;

create policy "gestion de sa préparation de journée" on carnet_journees for all
  using (auth.uid() = membre_id)
  with check (auth.uid() = membre_id);

create policy "gestion de ses faits confirmés" on carnet_faits_confirmes for all
  using (exists (
    select 1 from carnet_journees cj
    where cj.id = carnet_faits_confirmes.carnet_journee_id and cj.membre_id = auth.uid()
  ))
  with check (exists (
    select 1 from carnet_journees cj
    where cj.id = carnet_faits_confirmes.carnet_journee_id and cj.membre_id = auth.uid()
  ));

create policy "gestion de ses photos sélectionnées" on carnet_photos_selectionnees for all
  using (exists (
    select 1 from carnet_journees cj
    where cj.id = carnet_photos_selectionnees.carnet_journee_id and cj.membre_id = auth.uid()
  ))
  with check (exists (
    select 1 from carnet_journees cj
    where cj.id = carnet_photos_selectionnees.carnet_journee_id and cj.membre_id = auth.uid()
  ));

-- Garanties métier qui ne doivent pas dépendre du navigateur.
create function verifier_photo_carnet() returns trigger
language plpgsql
set search_path = public
as $$
declare
  preparation carnet_journees%rowtype;
  photo photos%rowtype;
  nombre integer;
begin
  select * into preparation from carnet_journees where id = new.carnet_journee_id;
  select * into photo from photos where id = new.photo_id;
  if preparation.id is null or photo.id is null
    or photo.journee_id <> preparation.journee_id
    or photo.membre_id <> preparation.membre_id then
    raise exception 'photo étrangère à la préparation du carnet';
  end if;

  select count(*) into nombre from carnet_photos_selectionnees
  where carnet_journee_id = new.carnet_journee_id and id <> new.id;
  if nombre >= 20 then raise exception 'maximum de 20 photos par journée'; end if;
  return new;
end;
$$;

create trigger carnet_photo_verification
  before insert or update on carnet_photos_selectionnees
  for each row execute function verifier_photo_carnet();

create function verifier_fait_carnet() returns trigger
language plpgsql
set search_path = public
as $$
declare
  journee uuid;
  nombre integer;
begin
  select journee_id into journee from carnet_journees where id = new.carnet_journee_id;
  if new.source_type = 'observation' and not exists (
    select 1 from observations where id = new.source_id and journee_id = journee
  ) then raise exception 'observation étrangère à la journée'; end if;
  if new.source_type = 'lieu' and not exists (
    select 1 from lieux where id = new.source_id and journee_id = journee
  ) then raise exception 'lieu étranger à la journée'; end if;

  if new.moment_fort then
    select count(*) into nombre from carnet_faits_confirmes
    where carnet_journee_id = new.carnet_journee_id and moment_fort and id <> new.id;
    if nombre >= 5 then raise exception 'maximum de 5 moments forts par journée'; end if;
  end if;
  return new;
end;
$$;

create trigger carnet_fait_verification
  before insert or update on carnet_faits_confirmes
  for each row execute function verifier_fait_carnet();

-- Copie initiale prudente : origine inconnue, donc brouillon legacy à relire.
insert into carnet_journees (
  voyage_id, journee_id, membre_id, carnet_story,
  carnet_story_source, carnet_story_validated, maj_le
)
select voyage_id, journee_id, membre_id, texte, 'legacy', false, maj_le
from carnet_textes
on conflict (journee_id, membre_id) do nothing;

