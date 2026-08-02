-- Complète le schéma initial avec les champs de JOURS non couverts par
-- 0001_init.sql, découverts en préparant la migration des données réelles
-- d'Italie2026 (voir ~/Downloads/Italie2026/donnees.js, commentaire d'en-tête).

alter table journees
  add column anniversaire boolean not null default false,
  add column pratique jsonb,              -- {parking, ztl, reserver, emporter, chien}
  add column carte jsonb,                 -- [{label, requete}]
  add column quiz_controle text;          -- somme de contrôle par journée, produite par
                                           -- outils/chiffrer-quiz.js ; permet d'afficher
                                           -- « mot de passe incorrect » plutôt que de
                                           -- déchiffrer n'importe quoi

create table lieux (
  id uuid primary key default gen_random_uuid(),
  journee_id uuid not null references journees(id) on delete cascade,
  nom text not null,
  quoi text,
  pratique text,
  requete text,                           -- texte de recherche Google Maps, par nom
  ordre integer not null
);

alter table lieux enable row level security;
create policy "lecture publique" on lieux for select using (true);
create policy "ecriture admin" on lieux for all using (auth.role() = 'authenticated');
