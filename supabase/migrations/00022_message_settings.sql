-- =====================================================================
-- MESSAGES DE SOPHIE
-- Ce que Sophie doit savoir de l'utilisateur pour rédiger un premier
-- message : une courte présentation (qui il est, ce qu'il apporte) et la
-- signature ajoutée telle quelle à la fin des e-mails. Les messages
-- préparés sont enregistrés comme brouillons dans company_interactions
-- (status = 'draft'), qui le prévoyait déjà.
-- =====================================================================

ALTER TABLE user_profiles
  ADD COLUMN message_pitch TEXT CHECK (length(message_pitch) <= 1500),
  ADD COLUMN message_signature TEXT CHECK (length(message_signature) <= 500);

COMMENT ON COLUMN user_profiles.message_pitch IS 'Présentation de l''utilisateur, donnée à l''IA pour rédiger les messages de prospection';
COMMENT ON COLUMN user_profiles.message_signature IS 'Signature ajoutée par le code (pas par l''IA) à la fin des e-mails préparés';
