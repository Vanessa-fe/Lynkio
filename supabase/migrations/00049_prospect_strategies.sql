-- Stratégies de recherche (phase 1 de l'évolution de Sophie, 13/11/2026).
-- Le client idéal (icp_profiles) dit « qui est mon client » ; une stratégie dit « comment je le
-- trouve ». Premières approches : par profil d'entreprise (secteur, taille, zone) et partenaires
-- (agences ou cabinets qui sous-traitent), toutes deux sur le registre officiel des entreprises
-- (API Recherche d'entreprises, gratuite, sans clé, sans IA).

CREATE TABLE prospect_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  approach TEXT NOT NULL CHECK (approach IN ('profile', 'partner')),
  -- { "naf_codes": ["73.11Z"], "sector_groups": ["communication"], "departments": ["69"], "sizes": ["tpe", "pme"] }
  filters JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters) = 'object'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Où Sophie en est dans les résultats (page suivante) : on ne revoit pas les mêmes entreprises
  cursor JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(cursor) = 'object'),
  -- Incrémentée à chaque changement de filtres (le curseur repart alors de zéro)
  version INTEGER NOT NULL DEFAULT 1,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

COMMENT ON TABLE prospect_strategies IS 'Recherches enregistrées de chaque utilisateur (approche + filtres versionnés)';

CREATE INDEX idx_prospect_strategies_user ON prospect_strategies(user_id) WHERE is_active;
CREATE UNIQUE INDEX uq_prospect_strategies_name ON prospect_strategies(user_id, lower(trim(name)));

ALTER TABLE prospect_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own strategies"
  ON prospect_strategies FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert their own strategies"
  ON prospect_strategies FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update their own strategies"
  ON prospect_strategies FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete their own strategies"
  ON prospect_strategies FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Filtres modifiés : nouvelle version, et le curseur repart du début (autres résultats)
CREATE FUNCTION public.bump_strategy_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.filters IS DISTINCT FROM OLD.filters OR NEW.approach IS DISTINCT FROM OLD.approach THEN
    NEW.version := OLD.version + 1;
    NEW.cursor := '{}'::jsonb;
  ELSE
    NEW.version := OLD.version;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prospect_strategies_bump_version
  BEFORE UPDATE ON prospect_strategies
  FOR EACH ROW EXECUTE FUNCTION public.bump_strategy_version();

-- 20 recherches au plus par compte (garde-fou ; les offres pourront fixer moins)
CREATE FUNCTION public.limit_prospect_strategies()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.prospect_strategies WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION 'Vous avez déjà 20 recherches enregistrées' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prospect_strategies_limit
  BEFORE INSERT ON prospect_strategies
  FOR EACH ROW EXECUTE FUNCTION public.limit_prospect_strategies();

-- ---------------------------------------------------------------------
-- La recherche qui a trouvé chaque fiche (la première), pour « Pourquoi cette entreprise »
-- et, plus tard, les résultats par stratégie. Une recherche supprimée laisse la fiche.
-- ---------------------------------------------------------------------
ALTER TABLE companies ADD COLUMN strategy_id UUID;
ALTER TABLE companies ADD CONSTRAINT companies_strategy_id_user_id_fkey
  FOREIGN KEY (strategy_id, user_id) REFERENCES prospect_strategies(id, user_id) ON DELETE SET NULL (strategy_id);
CREATE INDEX idx_companies_strategy ON companies(strategy_id) WHERE strategy_id IS NOT NULL;

COMMENT ON COLUMN companies.strategy_id IS 'Recherche enregistrée qui a trouvé la fiche (null : autre origine)';

-- Nouvelle source dans l'interrupteur global
INSERT INTO connector_settings (key, label, provider) VALUES
  ('profile_search', 'Recherche par profil d''entreprise', 'API Recherche d''entreprises');
