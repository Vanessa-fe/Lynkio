-- =====================================================================
-- LANCEMENT SUR UN SEUL MÉTIER
-- On valide le produit avec les développeur·ses web avant d'ouvrir les
-- autres métiers. Les métiers restent en base (avec leurs signaux et
-- leurs critères d'ICP) : pour en rouvrir un, il suffit de repasser
-- is_active à TRUE, sans déploiement.
-- =====================================================================

UPDATE professions
   SET is_active = FALSE
 WHERE key <> 'web_developer';
