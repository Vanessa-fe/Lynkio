-- Intermédiaires acceptés dans les offres d'emploi, au choix de chaque utilisateur
-- (décision du 11/11/2026 : les ESN ne sont plus écartées d'office).
--   consulting : ESN et sociétés de conseil (placement chez leurs clients, régie)
--   recruiters : cabinets de recrutement qui ne nomment pas leur client (offres à identifier)
--   platforms  : plateformes de missions freelance (Malt, Free-Work, Collective…)
--   staffing   : agences et missions d'intérim
ALTER TABLE prospection_settings
  ADD COLUMN accepted_intermediaries TEXT[] NOT NULL DEFAULT '{consulting,recruiters,platforms}'
  CONSTRAINT prospection_settings_accepted_intermediaries_check
    CHECK (accepted_intermediaries <@ ARRAY['consulting', 'recruiters', 'platforms', 'staffing']);

COMMENT ON COLUMN prospection_settings.accepted_intermediaries IS 'Intermédiaires gardés dans les offres d''emploi : consulting, recruiters, platforms, staffing';

INSERT INTO signal_types (key, label, description, default_ttl_days) VALUES
  ('consulting_hiring', 'ESN qui recrute', 'Société de services ou de conseil qui recrute pour placer des profils chez ses clients : une mission en régie est possible', 45)
ON CONFLICT (key) DO NOTHING;

INSERT INTO profession_signals (profession_key, signal_type, default_weight)
SELECT key, 'consulting_hiring', CASE WHEN key = 'web_developer' THEN 25 ELSE 20 END
  FROM professions
ON CONFLICT (profession_key, signal_type) DO NOTHING;
