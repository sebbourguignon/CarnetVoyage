-- Rôle admin/membre, et bonnes réponses du quiz stockées en clair.
--
-- Le chiffrement XOR+mot de passe (reponse_chiffree) datait du mode
-- "fichier HTML autonome sans compte" d'Italie2026 : la seule protection
-- possible était un secret partagé, redemandé à chaque correction. Ici,
-- les comptes famille sont de vrais comptes Supabase Auth — la bonne
-- protection est un contrôle d'accès en base (RLS), pas un secret que
-- l'admin doit retaper à chaque fois.
--
-- reponse_correcte ne vit pas dans quiz_questions (lisible par toute la
-- famille, y compris les enfants, pour afficher les questions) mais dans
-- une table à part, quiz_reponses, dont la lecture est réservée aux
-- membres au rôle 'admin' du voyage concerné.

alter table membres_famille add column role text not null default 'membre'
  check (role in ('admin', 'membre'));

create table quiz_reponses (
  question_id uuid primary key references quiz_questions(id) on delete cascade,
  reponse_correcte smallint not null
);

alter table quiz_reponses enable row level security;

create policy "lecture par admin du voyage" on quiz_reponses for select using (
  exists (
    select 1 from quiz_questions q
    join journees j on j.id = q.journee_id
    join membres_famille mf on mf.voyage_id = j.voyage_id
    where q.id = quiz_reponses.question_id
      and mf.utilisateur_id = auth.uid()
      and mf.role = 'admin'
  )
);
create policy "ecriture service" on quiz_reponses for all using (auth.role() = 'service_role');

-- corriger_quiz était ouvert à tout membre famille ; la correction devient
-- une action réservée aux admins, cohérent avec l'accès à quiz_reponses.
drop function corriger_quiz(uuid, uuid, integer, jsonb);

create function corriger_quiz(
  cible_utilisateur_id uuid,
  cible_voyage_id uuid,
  nouveau_score integer,
  nouveaux_resultats jsonb
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
      and mf.role = 'admin'
  ) then
    raise exception 'reserve aux comptes admin de ce voyage';
  end if;

  update progression
  set quiz_corrige = true,
      quiz_score = nouveau_score,
      quiz_resultats = quiz_resultats || nouveaux_resultats,
      quiz_corrige_le = now()
  where voyage_id = cible_voyage_id
    and utilisateur_id = cible_utilisateur_id;
end;
$$;

-- reponse_chiffree n'est PAS supprimée ici : elle sert encore de source
-- pour peupler quiz_reponses (déchiffrement ponctuel, voir conversation).
-- Suppression dans la migration suivante (0009), une fois la copie vérifiée.
