-- Fin des offres d'emploi France Travail (13/11/2026 : réutilisation commerciale non permise).
-- Les recherches par profil (prospect_strategies) passent à chaque prospection : la liste des
-- sources en plus peut donc être vide, et l'est par défaut. Les données issues de France Travail
-- (entreprises trouvées par elle, signaux, offres à identifier, historique) ont été effacées le
-- 13/11/2026 à la demande de Vanessa.

ALTER TABLE prospection_settings DROP CONSTRAINT prospection_settings_sources_check;
ALTER TABLE prospection_settings ADD CONSTRAINT prospection_settings_sources_check
  CHECK (sources <@ '{job_postings,recent_creations}'::text[]);
ALTER TABLE prospection_settings ALTER COLUMN sources SET DEFAULT '{}';

UPDATE prospection_settings
   SET sources = array_remove(sources, 'job_postings'),
       job_postings_cursor = NULL;

COMMENT ON COLUMN prospection_settings.sources IS 'Sources en plus des recherches par profil : recent_creations (créations BODACC). job_postings (France Travail) n''est plus utilisée depuis le 13/11/2026';
