-- journees.chapitre etait en texte simple depuis 0001_init.sql, avec un
-- commentaire notant deja l'ecart : Italie2026 stocke {numero, titre}
-- (ex. {numero: "Chapitre I", titre: "La descente"}), le numero etant
-- affiche en tres grand corps Bodoni (voir .chapter p, direction
-- artistique Officina Bodoniana). En texte simple, le numero etait
-- perdu et remplace par une chaine vide cote client (app/index.html) -
-- le bloc "numero" geant restait toujours vide a l'ecran. Passe en
-- jsonb pour porter les deux champs comme Italie2026, sans plus
-- approximer.

alter table journees alter column chapitre type jsonb using
  case when chapitre is not null then jsonb_build_object('titre', chapitre) else null end;
