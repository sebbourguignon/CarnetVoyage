-- Détail par question de la correction du quiz, pour que chaque membre
-- famille retrouve le ✓/✗ par question (pas seulement un score agrégé)
-- une fois corrigé à distance depuis admin/ — voir README « Quiz et
-- correction à distance » et app/index.html (fusionnerProgressionQuiz).

alter table progression add column quiz_resultats jsonb not null default '{}';
-- { [quiz_question_id]: indexCorrect } — indexCorrect est l'index du bon
-- choix dans quiz_questions.choix, déchiffré côté client par admin/ à
-- partir de reponse_chiffree. Jamais les réponses des autres membres,
-- seulement ce résultat-là (comme quiz_score déjà).

-- Prénom affiché dans l'écran de correction (admin/) : sans lui, un membre
-- famille qui corrige n'a que des utilisateur_id (uuid) pour distinguer qui
-- a répondu quoi — l'API cliente n'a pas accès à auth.users (email). Facultatif,
-- renseigné par outils/inviter-membre.js au moment de l'invitation.
alter table membres_famille add column prenom text;

drop function corriger_quiz(uuid, uuid, integer);

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
  ) then
    raise exception 'pas membre de la famille de ce voyage';
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
