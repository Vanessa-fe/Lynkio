-- Réglages de la recherche (décision du 11/11/2026) :
-- - aucun secteur ignoré par défaut : les comptes qui avaient encore la sélection automatique
--   (finance, immobilier, administration, ménages, organisations extraterritoriales) n'en ont plus ;
-- - plus d'option « agences d'intérim » : leurs offres restent écartées.
ALTER TABLE prospection_settings ALTER COLUMN excluded_naf_sections SET DEFAULT '{}';

UPDATE prospection_settings
   SET excluded_naf_sections = '{}'
 WHERE excluded_naf_sections @> '{K,L,O,T,U}' AND excluded_naf_sections <@ '{K,L,O,T,U}';

UPDATE prospection_settings
   SET accepted_intermediaries = array_remove(accepted_intermediaries, 'staffing')
 WHERE 'staffing' = ANY (accepted_intermediaries);
