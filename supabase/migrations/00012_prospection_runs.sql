-- =====================================================================
-- PROSPECTION AUTOMATIQUE (« Sophie ») : réglages et journal des passages
-- Additif : aucune table existante n'est modifiée.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Prochain passage d'un planning
-- ---------------------------------------------------------------------
-- Premier créneau strictement après p_after parmi les jours cochés
-- (ISO : 1 = lundi … 7 = dimanche), à l'heure p_hour dans le fuseau p_tz.
-- Le calcul se fait dans le fuseau de l'utilisateur : « 9 h » reste 9 h
-- après le passage à l'heure d'été.
CREATE OR REPLACE FUNCTION compute_next_prospection_run(
  p_days SMALLINT[],
  p_hour SMALLINT,
  p_tz TEXT,
  p_after TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  local_day DATE := (p_after AT TIME ZONE p_tz)::date;
  candidate TIMESTAMPTZ;
BEGIN
  IF p_days IS NULL OR cardinality(p_days) = 0 THEN
    RETURN NULL;
  END IF;

  FOR i IN 0..7 LOOP
    candidate := ((local_day + i) + make_time(p_hour, 0, 0)) AT TIME ZONE p_tz;
    IF extract(isodow FROM local_day + i)::smallint = ANY (p_days) AND candidate > p_after THEN
      RETURN candidate;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. Réglages de prospection (une ligne par utilisateur)
-- ---------------------------------------------------------------------
CREATE TABLE prospection_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Planning
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  days_of_week SMALLINT[] NOT NULL DEFAULT '{1,4}'
    CHECK (days_of_week <@ '{1,2,3,4,5,6,7}'::smallint[]),
  run_hour SMALLINT NOT NULL DEFAULT 9 CHECK (run_hour BETWEEN 0 AND 23),
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris' CHECK (timezone ~ '^[A-Za-z_]+/[A-Za-z_]+$'),

  -- Critères de recherche
  departments TEXT[] NOT NULL DEFAULT '{}'
    CHECK (
      cardinality(departments) <= 20
      AND array_to_string(departments, ',') ~ '^(((0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6]),)*(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6]))?$'
    ),
  -- Sections de la nomenclature NAF à ignorer. Par défaut : finance et
  -- holdings (K), immobilier et SCI (L), administration (O), ménages (T),
  -- organismes extraterritoriaux (U) : rarement des clients pour un freelance.
  excluded_naf_sections TEXT[] NOT NULL DEFAULT '{K,L,O,T,U}'
    CHECK (excluded_naf_sections <@ '{A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U}'::text[]),
  max_companies_per_run SMALLINT NOT NULL DEFAULT 20 CHECK (max_companies_per_run BETWEEN 1 AND 100),

  -- Gérés par Sophie (non modifiables par l'utilisateur, voir le trigger)
  next_run_at TIMESTAMPTZ,
  bodacc_cursor DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE prospection_settings IS 'Planning et critères de la prospection automatique, un jeu par utilisateur';
COMMENT ON COLUMN prospection_settings.days_of_week IS 'Jours de passage, ISO : 1 = lundi … 7 = dimanche';
COMMENT ON COLUMN prospection_settings.bodacc_cursor IS 'Date de parution BODACC jusqu''à laquelle les créations ont été examinées';

CREATE INDEX idx_prospection_settings_due ON prospection_settings(next_run_at) WHERE is_active;

-- next_run_at est toujours recalculé par la base à partir du planning ;
-- next_run_at et bodacc_cursor ne peuvent pas être modifiés par l'utilisateur
-- (seul le service de prospection, sans auth.uid(), y a accès).
CREATE OR REPLACE FUNCTION prospection_settings_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.bodacc_cursor := NULL;
    ELSE
      NEW.bodacc_cursor := OLD.bodacc_cursor;
      NEW.next_run_at := OLD.next_run_at;
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.days_of_week IS DISTINCT FROM OLD.days_of_week
     OR NEW.run_hour IS DISTINCT FROM OLD.run_hour
     OR NEW.timezone IS DISTINCT FROM OLD.timezone THEN
    NEW.next_run_at := CASE
      WHEN NEW.is_active THEN compute_next_prospection_run(NEW.days_of_week, NEW.run_hour, NEW.timezone, NOW())
    END;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER prospection_settings_before_write_trigger
  BEFORE INSERT OR UPDATE ON prospection_settings
  FOR EACH ROW EXECUTE FUNCTION prospection_settings_before_write();

ALTER TABLE prospection_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own prospection settings"
  ON prospection_settings FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own prospection settings"
  ON prospection_settings FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own prospection settings"
  ON prospection_settings FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 3. Journal des passages
-- ---------------------------------------------------------------------
-- Écrit uniquement par le service de prospection (Edge Function, clé de
-- service) : l'utilisateur ne peut que lire ses passages, pas les falsifier.
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('manual', 'schedule')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  companies_seen INTEGER NOT NULL DEFAULT 0 CHECK (companies_seen >= 0),
  companies_created INTEGER NOT NULL DEFAULT 0 CHECK (companies_created >= 0),
  companies_skipped INTEGER NOT NULL DEFAULT 0 CHECK (companies_skipped >= 0),
  error TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  CHECK ((status = 'running') = (finished_at IS NULL)),
  CHECK (status <> 'failed' OR error IS NOT NULL)
);

COMMENT ON TABLE pipeline_runs IS 'Journal des passages de la prospection automatique';
COMMENT ON COLUMN pipeline_runs.companies_skipped IS 'Entreprises écartées : déjà connues, secteur exclu, non diffusibles…';

CREATE INDEX idx_pipeline_runs_user ON pipeline_runs(user_id, started_at DESC);
-- Un seul passage à la fois par utilisateur, garanti par la base
CREATE UNIQUE INDEX uq_pipeline_runs_one_running ON pipeline_runs(user_id) WHERE status = 'running';

ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pipeline runs"
  ON pipeline_runs FOR SELECT
  USING ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 4. Réservation des passages arrivés à échéance
-- ---------------------------------------------------------------------
-- Avance next_run_at et renvoie les utilisateurs à traiter, en une seule
-- requête : deux appels simultanés ne peuvent pas réserver le même passage.
CREATE OR REPLACE FUNCTION claim_due_prospection_runs(p_limit INTEGER DEFAULT 20)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE prospection_settings s
     SET next_run_at = compute_next_prospection_run(s.days_of_week, s.run_hour, s.timezone, NOW())
   WHERE s.user_id IN (
           SELECT user_id
             FROM prospection_settings
            WHERE is_active AND next_run_at <= NOW()
            ORDER BY next_run_at
            LIMIT p_limit
              FOR UPDATE SKIP LOCKED
         )
  RETURNING s.user_id;
$$;

REVOKE EXECUTE ON FUNCTION claim_due_prospection_runs(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_due_prospection_runs(INTEGER) TO service_role;

COMMENT ON FUNCTION claim_due_prospection_runs IS 'Réserve les passages planifiés arrivés à échéance (service de prospection uniquement)';
