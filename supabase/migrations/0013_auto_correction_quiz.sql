-- Auto-correction du quiz : chaque membre famille se corrige lui-même en
-- répondant, au lieu qu'un adulte prenne le téléphone de chacun pour
-- valider après coup (ancien onglet Admin, hérité du mode "fichier HTML
-- autonome sans compte" d'Italie2026 — n'a plus de raison d'être
-- maintenant que chacun a un vrai compte, voir CLAUDE.md).
--
-- repondre_quiz() reste la SEULE porte d'entrée pour écrire
-- quiz_resultats/quiz_score/quiz_corrige : elle lit la bonne réponse dans
-- quiz_reponses (RLS réservée aux admins, jamais exposée au client) en
-- security definer, calcule le score, et renvoie l'index correct pour un
-- affichage immédiat côté appelant.
--
-- Les colonnes de correction sont retirées des privilèges UPDATE
-- généraux du rôle authenticated : la policy RLS existante ("lecture et
-- ecriture de sa propre progression", 0003) est au niveau ligne, pas
-- colonne — sans ce retrait, n'importe quel compte pourrait forger sa
-- propre update REST directe et écrire un score arbitraire. quiz_etat
-- (réponse brute) n'a lui-même plus d'écrivain direct côté client depuis
-- ce commit (repondre_quiz l'écrit en même temps que la correction) ;
-- seul observations_cochees reste écrit directement par son propriétaire
-- (chasse au trésor, aucune correction à préserver).

revoke update (quiz_resultats, quiz_score, quiz_corrige, quiz_corrige_le) on progression from authenticated;

create function repondre_quiz(
  cible_question_id uuid,
  cible_reponse smallint
) returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voyage_id uuid;
  v_correcte smallint;
  v_etat jsonb;
  v_resultats jsonb;
  -- doit rester synchronisé avec POINTS_PAR_BONNE_REPONSE_QUIZ, côté
  -- app/index.html.
  v_points_par_bonne_reponse constant integer := 3;
  v_score integer;
begin
  select j.voyage_id into v_voyage_id
  from quiz_questions q
  join journees j on j.id = q.journee_id
  where q.id = cible_question_id;

  if v_voyage_id is null then
    raise exception 'question introuvable';
  end if;

  if not exists (
    select 1 from membres_famille mf
    where mf.voyage_id = v_voyage_id and mf.utilisateur_id = auth.uid()
  ) then
    raise exception 'pas membre de la famille de ce voyage';
  end if;

  select reponse_correcte into v_correcte
  from quiz_reponses where question_id = cible_question_id;

  insert into progression (voyage_id, utilisateur_id, quiz_etat, quiz_resultats, quiz_score, quiz_corrige, maj_le)
  values (v_voyage_id, auth.uid(), '{}'::jsonb, '{}'::jsonb, 0, false, now())
  on conflict (voyage_id, utilisateur_id) do nothing;

  select quiz_etat, quiz_resultats into v_etat, v_resultats
  from progression
  where voyage_id = v_voyage_id and utilisateur_id = auth.uid()
  for update;

  v_etat := coalesce(v_etat, '{}'::jsonb)
    || jsonb_build_object(cible_question_id::text, jsonb_build_object('reponse', cible_reponse));
  v_resultats := coalesce(v_resultats, '{}'::jsonb)
    || jsonb_build_object(cible_question_id::text, to_jsonb(v_correcte));

  select coalesce(sum(v_points_par_bonne_reponse), 0) into v_score
  from jsonb_each(v_resultats) as r(qid, correct_idx)
  where (v_etat -> r.qid ->> 'reponse') is not null
    and (v_etat -> r.qid ->> 'reponse')::int = (r.correct_idx #>> '{}')::int;

  update progression
  set quiz_etat = v_etat,
      quiz_resultats = v_resultats,
      quiz_score = v_score,
      quiz_corrige = true,
      quiz_corrige_le = now(),
      maj_le = now()
  where voyage_id = v_voyage_id and utilisateur_id = auth.uid();

  return v_correcte;
end;
$$;

-- corriger_quiz (0003/0007/0008) n'a plus d'appelant : la correction par
-- un admin n'existe plus côté app/index.html.
drop function corriger_quiz(uuid, uuid, integer, jsonb);
