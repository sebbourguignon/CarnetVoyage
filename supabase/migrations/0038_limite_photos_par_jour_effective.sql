-- Réapplique la protection d’upload après l’alignement de l’historique DEV.
-- Idempotent : ne modifie aucune donnée existante.
create or replace function verifier_limite_photos_journee() returns trigger
language plpgsql
set search_path = public
as $$
declare
  nombre integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.journee_id::text, 0));
  select count(*) into nombre from photos where journee_id = new.journee_id;
  if nombre >= 30 then
    raise exception 'maximum de 30 photos par journée';
  end if;
  return new;
end;
$$;

drop trigger if exists photos_limite_journee on photos;
create trigger photos_limite_journee
  before insert on photos
  for each row execute function verifier_limite_photos_journee();
