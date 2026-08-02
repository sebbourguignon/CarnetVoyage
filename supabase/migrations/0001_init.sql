-- Schéma initial CarnetVoyage — un voyage = un projet, contenu dérivé
-- de la structure JOURS/BADGES du prototype Italie2026 (voir
-- ~/Downloads/Italie2026/donnees.js et CLAUDE.md pour le modèle d'origine).

create table voyages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,              -- ex. "salo2026", utilisé dans l'URL publique
  titre text not null,
  titre_suite text,                       -- ex. "tour d'<em>Italie</em>"
  sous_titre text,
  date_debut date not null,
  date_fin date not null,
  frise_legende text,
  a_verifier text,
  cree_le timestamptz not null default now()
);

create table journees (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references voyages(id) on delete cascade,
  ancre text not null,                    -- ancien "id" texte, ex. "d-0806"
  date date not null,
  rail1 text,
  rail2 text,
  categorie text not null,                -- "route" | "ville" | "nature" | "lac" | "evenement"
  badge text,
  intensite smallint check (intensite between 1 and 4),
  star boolean not null default false,
  eclipse boolean not null default false,
  titre text not null,
  accroche text,
  fil jsonb not null default '[]',        -- [{h, texte}]
  options_titre text,
  options jsonb not null default '[]',    -- [{...}]
  plan_b text,
  notes jsonb not null default '[]',      -- [{ton, titre, texte}]
  chapitre text,
  ordre integer not null,
  unique (voyage_id, ancre)
);

create table observations (
  id uuid primary key default gen_random_uuid(),
  journee_id uuid not null references journees(id) on delete cascade,
  ou text not null,
  niveau smallint not null default 1 check (niveau between 1 and 3),
  ordre integer not null
);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  journee_id uuid not null references journees(id) on delete cascade,
  question text not null,
  choix jsonb not null,                   -- [texte, texte, ...]
  reponse_chiffree text not null,         -- XOR + base64url, voir outils/chiffrer-quiz.js
  ordre integer not null
);

create table badges (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references voyages(id) on delete cascade,
  nom text not null,
  resume text not null,
  icone text not null,
  seuil_niveau3 integer,
  seuil_total integer,
  seuil_journees_corrigees integer,
  seuil_points_quiz integer,
  ordre integer not null
);

create table badge_conditions (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references badges(id) on delete cascade,
  observation_id uuid not null references observations(id) on delete cascade
);

-- Progression : lue/écrite par le device du voyageur, jamais par l'admin.
-- Remplace le localStorage actuel si on veut synchroniser entre appareils ;
-- sinon cette table reste optionnelle et le front peut continuer en local-only.
create table progression (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references voyages(id) on delete cascade,
  appareil_id text not null,              -- identifiant anonyme généré côté client
  observations_cochees jsonb not null default '{}',
  quiz_etat jsonb not null default '{}',
  maj_le timestamptz not null default now(),
  unique (voyage_id, appareil_id)
);

-- RLS : contenu public en lecture pour tout le monde (l'app voyageur n'a pas
-- de compte), écriture réservée aux comptes admin authentifiés.
alter table voyages enable row level security;
alter table journees enable row level security;
alter table observations enable row level security;
alter table quiz_questions enable row level security;
alter table badges enable row level security;
alter table badge_conditions enable row level security;
alter table progression enable row level security;

create policy "lecture publique" on voyages for select using (true);
create policy "lecture publique" on journees for select using (true);
create policy "lecture publique" on observations for select using (true);
create policy "lecture publique" on quiz_questions for select using (true);
create policy "lecture publique" on badges for select using (true);
create policy "lecture publique" on badge_conditions for select using (true);

create policy "ecriture admin" on voyages for all using (auth.role() = 'authenticated');
create policy "ecriture admin" on journees for all using (auth.role() = 'authenticated');
create policy "ecriture admin" on observations for all using (auth.role() = 'authenticated');
create policy "ecriture admin" on quiz_questions for all using (auth.role() = 'authenticated');
create policy "ecriture admin" on badges for all using (auth.role() = 'authenticated');
create policy "ecriture admin" on badge_conditions for all using (auth.role() = 'authenticated');

create policy "progression par appareil" on progression for all using (true) with check (true);
