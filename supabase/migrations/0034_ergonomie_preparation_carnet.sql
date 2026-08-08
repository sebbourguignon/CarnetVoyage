-- Une seule validation éditoriale et une limite photo cohérente avec l’écran.
alter table carnet_journees
  add column carnet_terminee boolean not null default false,
  add column recit_source_hash text;

comment on column carnet_journees.carnet_terminee is
  'Seule validation éditoriale explicite : vrai après Terminer la journée.';
comment on column carnet_journees.recit_source_hash is
  'Empreinte des faits, photos légendées et notes utilisés par la dernière génération IA.';

create or replace function verifier_photo_carnet() returns trigger
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
  if nombre >= 10 then raise exception 'maximum de 10 photos par journée'; end if;
  return new;
end;
$$;
