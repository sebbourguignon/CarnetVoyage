-- Restaure la reecriture de la journee du vendredi 7 aout 2026 (voyage
-- salo2026), perdue par ecrasement accidentel : une resynchronisation
-- via outils/mettre-a-jour-voyage.js depuis un JSON local non
-- reactualise a remplace la migration 0022 (planning matin/Lonato) par
-- l'ancien contenu (baignade + reperage du soir).
--
-- Reprend integralement 0022, avec deux differences :
--   - l'observation "Le Chiaretto" n'est pas reintroduite : la famille
--     ne consomme pas d'alcool, deja tranche separement (observation
--     remplacee par "Le clocher de Polpenazze", deja en base et non
--     touchee ici) ;
--   - manger.plat ne mentionne plus d'accord vin -- champ facultatif,
--     omis plutot qu'invente.
--
-- Idempotente : chaque bloc cible la journee par
-- (voyage.slug = 'salo2026' and date = '2026-08-07'), jamais par id
-- code en dur, donc rejouable sans effet de bord. Ne touche aucune
-- autre journee -- toutes les clauses where sont bornees par
-- journee_id/question_id issus de cette meme journee.
--
-- Reversible : les anciennes valeurs (fil, notes, pratique, manger,
-- carte, lieux, observations, quiz) sont documentees dans le message
-- de la conversation qui a produit cette migration ; un rollback
-- consiste a reappliquer ces anciennes valeurs de la meme facon.

do $$
declare
  v_journee_id uuid;
  v_obs_coucher_id uuid;
  v_q_lugana_id uuid;
  v_q_lugana_ordre integer;
begin
  select j.id into v_journee_id
  from journees j
  join voyages v on v.id = j.voyage_id
  where v.slug = 'salo2026' and j.date = '2026-08-07';

  if v_journee_id is null then
    raise exception 'journee du 2026-08-07 introuvable pour salo2026 -- migration annulee';
  end if;

  -- 1. Métadonnées, fil, pratique, notes, carte, manger ----------------
  update journees set
    rail1 = '65 km',
    rail2 = '≈ 1 h 35',
    titre = 'Valtenesi et Lonato — repérage de l''éclipse le matin',
    accroche = 'La Rocca le matin — c''est là qu''on choisit le spot de l''éclipse. Puis les collines, et Lonato l''après-midi.',
    fil = '[
      {"h": "9 h 00", "texte": "Départ de Salò. Vingt minutes jusqu''à Manerba del Garda."},
      {"h": "9 h 30", "texte": "<b>Museo Civico Archeologico della Valtenesi</b>, au pied de la Rocca. Petit, et il donne le sens de ce qu''on va voir en haut : quatre mille ans d''occupation du même rocher."},
      {"h": "10 h 15", "texte": "<b>Montée à la Rocca di Manerba.</b> Vingt à trente minutes par un sentier pierreux et sans ombre."},
      {"h": "10 h 45", "texte": "<b>Repérage du spot d''éclipse.</b> Mercredi, le maximum est à 20 h 20 avec le Soleil à 4-6° au-dessus de l''horizon OUEST. Tourner le dos au lac et vérifier : une crête ou une ligne d''arbres suffirait à tout masquer. Repérer aussi où se garer et par où monter en fin de journée."},
      {"h": "11 h 45", "texte": "<b>Boucle en Valtenesi</b> par les petites routes : Moniga del Garda, puis Padenghe (Rocca et port, arrêt court), Soiano del Lago et Polpenazze del Garda. Une vingtaine de kilomètres, cinq à dix minutes entre chaque village."},
      {"h": "13 h 15", "texte": "<b>Déjeuner à Polpenazze.</b>"},
      {"h": "14 h 45", "texte": "Route vers <b>Lonato del Garda</b>, 12 km."},
      {"h": "15 h 15", "texte": "<b>Rocca di Lonato</b> — l''une des plus vastes forteresses de Lombardie — et la <b>Casa del Podestà</b>, avec sa bibliothèque de 50 000 volumes léguée à la nation."},
      {"h": "17 h 30", "texte": "Retour vers Salò, 20 km. <b>Dîner à l''appartement.</b>"}
    ]'::jsonb,
    pratique = jsonb_build_object(
      'parking', pratique->>'parking',
      'reserver', 'Rien d''obligatoire. Réserver si vous visez l''Antica Trattoria Miravalle : le service s''arrête à 13 h 30.',
      'emporter', 'Eau et chapeaux — la montée à la Rocca est exposée et sans ombre. Chaussures fermées pour le sentier.',
      'chien', 'à gérer'
    ),
    notes = '[
      {"ton": "soleil", "titre": "Le repérage, c''est ce matin", "texte": "C''est la seule chose vraiment importante de la journée. Mercredi soir, il sera trop tard pour découvrir qu''une colline bouche l''ouest. Photographier l''horizon depuis le sommet pour pouvoir comparer avec Lonato l''après-midi."},
      {"ton": "alerte", "titre": "Journée chargée", "texte": "Quatre villages et Lonato dans l''après-midi, c''est dense. Padenghe est un arrêt court — la Rocca et le port, une demi-heure. Si le retard s''accumule, Soiano est celui qu''on saute."},
      {"ton": "alerte", "titre": "Réglisse", "texte": "La Rocca de Manerba est une réserve naturelle : chien en laisse admis, mais le sentier est pierreux et brûlant en milieu de journée. À Lonato, l''enceinte de la forteresse est en plein air ; la Casa del Podestà se visite avec un guide et ne l''admettra probablement pas — appeler le +39 030 913 0060 pour confirmer."}
    ]'::jsonb,
    carte = '[
      {"label": "Rocca di Manerba", "requete": "Rocca di Manerba del Garda parco"},
      {"label": "Moniga", "requete": "Moniga del Garda centro storico"},
      {"label": "Padenghe", "requete": "Rocca di Padenghe sul Garda"},
      {"label": "Polpenazze", "requete": "Polpenazze del Garda centro"},
      {"label": "Osteria del Borgo", "requete": "Osteria del Borgo Polpenazze del Garda"},
      {"label": "Rocca di Lonato", "requete": "Rocca di Lonato del Garda"}
    ]'::jsonb,
    -- manger.plat omis : pas d'accord vin (famille sans alcool), et
    -- aucune alternative verifiee a proposer -- l'absence vaut mieux
    -- qu'une donnee inventee.
    manger = jsonb_build_object(
      'midi', jsonb_build_object(
        'ou', 'Via Giuseppe Zanardelli 10, Polpenazze del Garda',
        'nom', 'Osteria del Borgo',
        'tel', '+393332083064',
        'note', '4,6/5, cuisine familiale sans chichi, terrasse sous un arbre, prix très bas. Service jusqu''à 14 h. Plus soigné, à 300 m : Antica Trattoria Miravalle, +390365679078, 4,7/5 sur 1 005 avis avec vue sur le lac — mais service arrêté à 13 h 30 et réservation nécessaire.'
      ),
      'soir', jsonb_build_object(
        'ou', 'Salò',
        'nom', 'À l''appartement',
        'note', 'Rien de prévu au restaurant.'
      )
    )
  where id = v_journee_id;

  -- options_titre, options, star/intensite/categorie/badge/eclipse,
  -- illustration, lat/lon, visibilite, chapitre, ancre, ordre, date :
  -- non mentionnés par la demande de restauration, laissés tels quels
  -- (le champ "options" existant mentionne encore une dégustation --
  -- signalé en fin de migration, pas corrigé ici, hors périmètre exact
  -- de la demande).

  -- 2. Lieux -------------------------------------------------------------
  delete from lieux
  where journee_id = v_journee_id
    and nom in ('Punta Belvedere et Isola San Biagio', 'San Felice del Benaco');

  insert into lieux (journee_id, nom, quoi, pratique, requete, ordre)
  select * from (values
    (v_journee_id, 'Moniga del Garda',
     'Un village fortifié du X siècle, bâti contre les incursions hongroises : l''enceinte abritait les maisons des villageois, pas un seigneur. C''est ici qu''est né le Chiaretto en 1896, quand Pompeo Molmenti a appliqué au raisin local une méthode de vinification apprise à Bordeaux.',
     'Accès libre au bourg. Se garer en contrebas.',
     'Moniga del Garda centro storico', 6),
    (v_journee_id, 'Rocca di Padenghe',
     'Une forteresse-refuge du X siècle, bâtie elle aussi contre les incursions hongroises. Sa particularité : l''enceinte abritait de petites maisons où les villageois se réfugiaient avec leurs réserves — c''est un village fortifié, pas un château seigneurial. Plusieurs sont encore habitées aujourd''hui.',
     'Accès libre en permanence. Se garer en contrebas, montée de dix minutes. Vue dégagée sur le bas lac.',
     'Rocca di Padenghe sul Garda', 7),
    (v_journee_id, 'Polpenazze del Garda',
     'Village perché avec une terrasse devant l''église qui domine toute la vallée. En contrebas, le site du Lucone : un village sur pilotis de l''âge du bronze, fouillé depuis les années 1960.',
     'Accès libre. Parking sur la place basse.',
     'Polpenazze del Garda centro', 8),
    (v_journee_id, 'Rocca di Lonato',
     'L''une des plus vastes forteresses de Lombardie, sur une colline qui domine la plaine au sud du lac. Son horizon ouest est entièrement dégagé, sans relief pour masquer le soleil couchant : c''est le second candidat pour l''éclipse de mercredi, à comparer avec Manerba.',
     'Via Rocca, Lonato del Garda. Ouvert tous les jours 10 h - 12 h 30 et 14 h - 18 h. Payant.',
     'Rocca di Lonato del Garda', 9),
    (v_journee_id, 'Casa del Podestà — Fondation Ugo Da Como',
     'La demeure d''un sénateur et bibliophile, laissée exactement en l''état à sa mort en 1941 et léguée à la nation. Sa bibliothèque compte 50 000 volumes, dont des incunables. On la visite avec un guide, et c''est ce qui en fait tout l''intérêt : rien n''y est reconstitué.',
     'Via Rocca 2, Lonato del Garda. Tél. +39 030 913 0060. Tous les jours 10 h - 12 h 30 et 14 h - 18 h. Visite guidée.',
     'Fondazione Ugo Da Como Lonato del Garda', 10)
  ) as nouveaux(journee_id, nom, quoi, pratique, requete, ordre)
  where not exists (
    select 1 from lieux l where l.journee_id = v_journee_id and l.nom = nouveaux.nom
  );

  -- 3. Observations (chasse au trésor) ------------------------------------
  -- "Le Chiaretto" n'est pas restauré : déjà remplacé par "Le clocher de
  -- Polpenazze" (niveau 1) dans une modification distincte, non touchée
  -- ici. Seul "Le coucher de soleil, ce soir" (obsolète : le repérage
  -- passe au matin) est remplacé.
  select id into v_obs_coucher_id
  from observations
  where journee_id = v_journee_id and ou = 'Le coucher de soleil, ce soir';

  if v_obs_coucher_id is not null then
    -- aucune condition de badge ne référence cette observation (vérifié
    -- sur la base réelle avant migration) -- suppression directe.
    delete from observations where id = v_obs_coucher_id;
  end if;

  insert into observations (journee_id, ou, niveau, ordre, visibilite, quoi)
  select v_journee_id, 'L''horizon ouest, depuis Lonato', 1, 3, 'amis',
    'Depuis le haut de la Rocca, tournez le dos au lac : la plaine s''étend sans le moindre relief jusqu''à l''horizon. Comparez avec ce que vous avez vu ce matin à Manerba — c''est exactement ce qui décidera d''où vous regarderez l''éclipse mercredi.'
  where not exists (
    select 1 from observations where journee_id = v_journee_id and ou = 'L''horizon ouest, depuis Lonato'
  );

  -- 4. Quiz ---------------------------------------------------------------
  select id, ordre into v_q_lugana_id, v_q_lugana_ordre
  from quiz_questions
  where journee_id = v_journee_id
    and question = 'Le Lugana, blanc du sud du lac, est produit à partir de quel cépage ?';

  if v_q_lugana_id is not null then
    delete from quiz_reponses where question_id = v_q_lugana_id;
    delete from quiz_questions where id = v_q_lugana_id;
  end if;

  if not exists (
    select 1 from quiz_questions
    where journee_id = v_journee_id
      and question = 'Quel cépage rouge ne pousse pratiquement qu''en Valtenesi ?'
  ) then
    insert into quiz_questions (journee_id, question, choix, ordre)
    values (
      v_journee_id,
      'Quel cépage rouge ne pousse pratiquement qu''en Valtenesi ?',
      '["Le groppello", "Le nebbiolo", "La barbera"]'::jsonb,
      coalesce(v_q_lugana_ordre, 1)
    );
  end if;

  insert into quiz_reponses (question_id, reponse_correcte)
  select q.id, 0
  from quiz_questions q
  where q.journee_id = v_journee_id
    and q.question = 'Quel cépage rouge ne pousse pratiquement qu''en Valtenesi ?'
  on conflict (question_id) do update set reponse_correcte = excluded.reponse_correcte;
end $$;

