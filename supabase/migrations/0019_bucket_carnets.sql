-- Bucket prive pour les carnets PDF generes par l'Edge Function
-- "generer-carnet" (voir supabase/functions/generer-carnet). Ecriture
-- reservee au role service (l'Edge Function tourne avec la cle service,
-- qui contourne le RLS) -- aucune policy insert/update cote client,
-- volontairement : un PDF genere n'est jamais modifie, seulement recree.
--
-- Convention de chemin, comme pour le bucket "photos" (migration 0018) :
--   <voyage_id>/<membre_id>/<mode>-<timestamp>.pdf
-- Chaque membre ne peut lire que ses propres fichiers -- meme un carnet
-- "famille" est propre a qui l'a genere (il aggrege les photos partagees
-- des autres, mais le PDF resultant reste prive a son auteur).

insert into storage.buckets (id, name, public)
values ('carnets', 'carnets', false)
on conflict (id) do nothing;

create policy "lecture de ses propres carnets" on storage.objects for select
  using (
    bucket_id = 'carnets'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
