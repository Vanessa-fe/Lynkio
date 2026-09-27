-- =====================================================================
-- MISSIONS FREELANCE ET OFFRES ANONYMES
-- - Une offre ouverte aux indépendants (contrat freelance, plateforme de
--   mise en relation) est ce que la freelance cherche en priorité : elle
--   devient un signal à part, mieux pondéré qu'une offre d'emploi.
-- - Une offre sans nom d'entreprise n'est plus perdue : elle est gardée, avec
--   son lien, pour que l'utilisatrice retrouve qui l'a publiée et la rattache.
-- =====================================================================

INSERT INTO signal_types (key, label, description, default_ttl_days) VALUES
  ('freelance_mission', 'Mission freelance', 'Offre ouverte aux indépendants : contrat freelance ou plateforme de mise en relation', 30)
ON CONFLICT (key) DO NOTHING;

INSERT INTO profession_signals (profession_key, signal_type, default_weight) VALUES
  ('web_developer', 'freelance_mission', 40)
ON CONFLICT (profession_key, signal_type) DO NOTHING;

CREATE TABLE unidentified_job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'france_travail' CHECK (source IN ('france_travail')),
  external_id TEXT NOT NULL,
  signal_type TEXT NOT NULL REFERENCES signal_types(key) ON UPDATE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  contract_type TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'dismissed', 'linked')),
  company_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source, external_id),
  FOREIGN KEY (company_id, user_id) REFERENCES companies(id, user_id) ON DELETE SET NULL (company_id)
);

COMMENT ON TABLE unidentified_job_offers IS 'Offres sans nom d''entreprise, à rattacher à la main à une entreprise (ou à ignorer)';

CREATE INDEX idx_unidentified_job_offers_new ON unidentified_job_offers(user_id, published_at DESC) WHERE status = 'new';
CREATE INDEX idx_unidentified_job_offers_company ON unidentified_job_offers(company_id) WHERE company_id IS NOT NULL;

CREATE TRIGGER update_unidentified_job_offers_updated_at
  BEFORE UPDATE ON unidentified_job_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Écrites par Sophie (clé de service) ; l'utilisatrice les lit, les ignore ou les rattache
ALTER TABLE unidentified_job_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rows"
  ON unidentified_job_offers FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own rows"
  ON unidentified_job_offers FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
