-- Identité visuelle par voyage : palette et polices, surchargeables sans
-- toucher au moteur de rendu (voir appliquerTheme() dans app/index.html).
-- Colonne nullable : un voyage sans thème garde le rendu par défaut
-- (palette Officina Bodoniana déclarée dans le :root de app/index.html).
--
-- Forme attendue :
-- {
--   "polices_google": ["Playfair+Display:wght@600;700"],
--   "css": ":root{--rosso:#7A2E2E;--font-display:'Playfair Display',Georgia,serif;}"
-- }

alter table voyages add column theme jsonb;
