-- Retire la mention de dégustation (Chiaretto/Lugana) des options
-- ("Si vous avez plus de temps") de la journée du 7 août 2026 (voyage
-- salo2026) : famille sans alcool, décision déjà appliquée à
-- l'observation "Le Chiaretto" (remplacée par "Le clocher de
-- Polpenazze") et à manger.plat (omis). Reste de la liste des options
-- inchangé -- pas de refonte demandée.
--
-- Idempotente : cible la journée par (voyage.slug = 'salo2026' and
-- date = '2026-08-07'), jamais par id codé en dur. Ne touche aucune
-- autre journée.
--
-- Réversible : l'ancienne valeur de "options" est documentée dans le
-- message de la conversation qui a produit cette migration.

do $$
declare
  v_journee_id uuid;
begin
  select j.id into v_journee_id
  from journees j
  join voyages v on v.id = j.voyage_id
  where v.slug = 'salo2026' and j.date = '2026-08-07';

  if v_journee_id is null then
    raise exception 'journee du 2026-08-07 introuvable pour salo2026 -- migration annulee';
  end if;

  update journees set
    options = '[
      "<b>Rocca di Lonato</b> — deuxième candidat pour l''éclipse : plus haut, forteresse dominant directement la plaine du Pô, horizon ouest le plus dégagé du secteur. <b>À tester ce soir aussi</b>, et vérifier l''accès en soirée",
      "<b>Castello di Padenghe</b> — enceinte médiévale habitée, gratuite"
    ]'::jsonb
  where id = v_journee_id;
end $$;
