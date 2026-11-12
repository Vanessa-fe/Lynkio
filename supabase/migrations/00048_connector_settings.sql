-- Interrupteur global par source de données (phase 0 de l'évolution de Sophie, 13/11/2026).
-- Une source coupée ici n'est plus interrogée par aucun passage de Sophie, pour aucun compte, sans
-- déploiement : utile si un fournisseur (France Travail…) demande l'arrêt ou tombe en panne.
--   Couper :    UPDATE connector_settings SET enabled = false, disabled_reason = '…' WHERE key = 'job_postings';
--   Rallumer :  UPDATE connector_settings SET enabled = true, disabled_reason = NULL WHERE key = 'job_postings';

CREATE TABLE connector_settings (
  -- Même clé que les sources de prospection_settings.sources (SourceKey dans prospection-run)
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  label TEXT NOT NULL,
  provider TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Montré tel quel dans l'historique des recherches quand la source est coupée
  disabled_reason TEXT CHECK (disabled_reason IS NULL OR length(disabled_reason) <= 300),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE connector_settings IS 'Interrupteur global de chaque source de Sophie (modifiable par migration ou service_role seulement)';

INSERT INTO connector_settings (key, label, provider) VALUES
  ('job_postings', 'Offres d''emploi', 'France Travail'),
  ('recent_creations', 'Sociétés tout juste créées', 'BODACC'),
  ('tech_users', 'Recherche par technologie', 'IA de l''utilisateur');

ALTER TABLE connector_settings ENABLE ROW LEVEL SECURITY;

-- Lecture pour les comptes connectés (l'écran pourra dire qu'une source est coupée) ; écriture : service_role
CREATE POLICY "Authenticated users can read connector settings"
  ON connector_settings FOR SELECT TO authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON connector_settings FROM anon, authenticated;

CREATE FUNCTION public.touch_connector_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER connector_settings_touch
  BEFORE UPDATE ON connector_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_connector_settings();
