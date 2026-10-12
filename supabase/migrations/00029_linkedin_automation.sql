-- =====================================================================
-- ENVOI LINKEDIN AUTOMATIQUE (extension Chrome)
-- L'extension envoie les invitations, repère les invitations acceptées et
-- envoie le premier message, à rythme humain et dans les plafonds. Les
-- relances restent en un clic tant que les réponses ne sont pas détectées.
-- - linkedin_automation : l'interrupteur, la pause (et pourquoi), et ce que
--   l'extension a fait en dernier, pour que Filonea l'affiche.
-- - linkedin_sequences : de quoi travailler sans tout relire sur LinkedIn.
-- =====================================================================

CREATE TABLE linkedin_automation (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- Pause posée par l'extension (LinkedIn a changé, demande une vérification, limite atteinte…)
  paused_reason TEXT CHECK (paused_reason IS NULL OR length(paused_reason) <= 300),
  paused_at TIMESTAMPTZ,
  -- Reprise automatique après une limite de LinkedIn (sinon : reprise à la main)
  paused_until TIMESTAMPTZ,
  -- Dernière fois que l'extension est passée (Chrome ouvert), et dernière action envoyée
  last_seen_at TIMESTAMPTZ,
  last_action_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE linkedin_automation IS 'Envoi LinkedIn automatique par l''extension : activé ou non, pause éventuelle, dernière activité';

CREATE TRIGGER update_linkedin_automation_updated_at
  BEFORE UPDATE ON linkedin_automation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE linkedin_automation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rows" ON linkedin_automation
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert their own rows" ON linkedin_automation
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own rows" ON linkedin_automation
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE linkedin_sequences
  -- Identifiant LinkedIn de la personne (urn:li:fsd_profile:…), retenu après la première lecture du profil
  ADD COLUMN profile_urn TEXT CHECK (profile_urn IS NULL OR profile_urn ~ '^urn:li:fsd_profile:[A-Za-z0-9_-]+$'),
  -- Dernière vérification de l'invitation (acceptée ou non)
  ADD COLUMN last_checked_at TIMESTAMPTZ,
  -- Ce qui a empêché l'extension d'avancer pour cette personne : elle passe alors en un clic
  ADD COLUMN automation_error TEXT CHECK (automation_error IS NULL OR length(automation_error) <= 300),
  ADD COLUMN automation_error_at TIMESTAMPTZ;
