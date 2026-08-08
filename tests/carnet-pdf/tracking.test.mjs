import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("le tracking Carnet réutilise visites et son journal d’événements", async () => {
  const migration = await readFile(new URL("../../supabase/migrations/0030_tracking_carnet.sql", import.meta.url), "utf8");
  const index = await readFile(new URL("../../app/index.html", import.meta.url), "utf8");
  assert.match(migration, /alter table visites/i);
  assert.match(migration, /evenements jsonb/i);
  assert.match(index, /carnet_dashboard/);
  assert.match(index, /carnet_day_detail/);
  assert.match(index, /carnet_photo_selector/);
  assert.match(index, /carnet_generate_success/);
  assert.match(index, /carnet_generate_error/);
  assert.match(index, /select\("utilisateur_id, debutee_le, duree_secondes, onglets_vus, evenements"\)/);
});
