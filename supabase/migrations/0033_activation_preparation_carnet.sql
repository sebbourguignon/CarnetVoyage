-- Bascule explicite, journée par journée, entre la compatibilité historique
-- du PDF validé et la nouvelle préparation du carnet.
alter table carnet_journees
  add column preparation_active boolean not null default false;

comment on column carnet_journees.preparation_active is
  'Vrai après un enregistrement explicite dans l écran de préparation; le PDF utilise alors uniquement cette préparation.';
