-- Corrige une récursion infinie introduite dans 0003 : la policy de lecture
-- de membres_famille s'interrogeait elle-même (select ... from
-- membres_famille à l'intérieur de sa propre policy select), ce que
-- Postgres ne peut pas résoudre et rejette avec "infinite recursion
-- detected in policy for relation membres_famille". Détecté lors du test
-- du flux de connexion famille : même le chargement anonyme échouait, car
-- la policy sur journees référence aussi membres_famille.
--
-- Solution standard Supabase : une fonction security definer, qui lit
-- membres_famille en contournant le RLS (donc sans redéclencher la policy),
-- utilisée à la place des sous-requêtes inline dans toutes les policies qui
-- avaient besoin de vérifier l'appartenance à la famille d'un voyage.

create function est_membre_famille(cible_voyage_id uuid) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from membres_famille
    where voyage_id = cible_voyage_id
      and utilisateur_id = auth.uid()
  );
$$;

drop policy "lecture par membre" on membres_famille;
create policy "lecture par membre" on membres_famille for select using (
  est_membre_famille(voyage_id)
);

drop policy "lecture journees" on journees;
create policy "lecture journees" on journees for select using (
  visibilite = 'amis' or est_membre_famille(voyage_id)
);

drop policy "lecture observations" on observations;
create policy "lecture observations" on observations for select using (
  visibilite = 'amis'
  or exists (
    select 1 from journees j
    where j.id = observations.journee_id
      and est_membre_famille(j.voyage_id)
  )
);

drop policy "lecture quiz par famille" on quiz_questions;
create policy "lecture quiz par famille" on quiz_questions for select using (
  exists (
    select 1 from journees j
    where j.id = quiz_questions.journee_id
      and est_membre_famille(j.voyage_id)
  )
);

drop policy "lecture progression par la famille du voyage" on progression;
create policy "lecture progression par la famille du voyage" on progression for select using (
  est_membre_famille(voyage_id)
);
