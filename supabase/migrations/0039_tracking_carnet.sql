-- Étend le journal de fréquentation existant avec les événements métier.
-- Aucune nouvelle table analytics : les événements restent rattachés à la
-- même session `visites` et héritent de ses policies RLS.
alter table visites
  add column if not exists evenements jsonb not null default '[]'::jsonb;

