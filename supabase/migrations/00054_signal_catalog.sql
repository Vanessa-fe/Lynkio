-- Catalogue de signaux normalisé (carte Trello « Créer un catalogue de signaux de prospection normalisé »,
-- 12/11/2026). Rien n'est supprimé ni renommé : on décrit mieux ce qui existe.
--
-- Pour chaque TYPE de signal (signal_types) :
--   category       famille : creation, hiring, partnership, tender, website, news, request
--   nature         observed (fait constaté dans une source), hypothesis (déduit, à vérifier),
--                  explicit_need (besoin exprimé par l'entreprise elle-même : demande, appel d'offres)
--   reliability    high (source officielle), medium (source publique non officielle), low (déduit, IA)
--   retention_days durée de conservation de la donnée ; purge automatique ensuite (≠ default_ttl_days,
--                  qui dit combien de temps le signal compte dans le score)
--
-- Pour chaque SIGNAL (company_signals) :
--   source    d'où il vient (bodacc, site, registry, france_travail, linkedin, ai_research, manual, unknown)
--   event_at  date de l'événement lui-même (parution, publication), quand la source la donne ;
--             detected_at reste la date de collecte
-- Les deux sont remplis par la base à l'insertion, depuis evidence (aucune fonction à redéployer).
-- Type, entreprise, URL, données minimales (evidence) et doublons (dedupe_key unique) existaient déjà.

-- ---------------------------------------------------------------------
-- 1. Types de signaux
-- ---------------------------------------------------------------------
ALTER TABLE signal_types
  ADD COLUMN category TEXT NOT NULL DEFAULT 'news'
    CHECK (category IN ('creation', 'hiring', 'partnership', 'tender', 'website', 'news', 'request')),
  ADD COLUMN nature TEXT NOT NULL DEFAULT 'observed'
    CHECK (nature IN ('observed', 'hypothesis', 'explicit_need')),
  ADD COLUMN reliability TEXT NOT NULL DEFAULT 'medium'
    CHECK (reliability IN ('high', 'medium', 'low')),
  ADD COLUMN retention_days INTEGER NOT NULL DEFAULT 365 CHECK (retention_days BETWEEN 30 AND 1095);

COMMENT ON COLUMN signal_types.category IS 'Famille : creation, hiring, partnership, tender, website, news, request';
COMMENT ON COLUMN signal_types.nature IS 'observed = fait constaté ; hypothesis = déduit, à vérifier ; explicit_need = besoin exprimé par l''entreprise';
COMMENT ON COLUMN signal_types.reliability IS 'high = source officielle ; medium = source publique ; low = déduit ou IA';
COMMENT ON COLUMN signal_types.retention_days IS 'Conservation de la donnée, puis purge (cron signals-retention)';

UPDATE signal_types SET category = v.category, nature = v.nature, reliability = v.reliability
  FROM (VALUES
    ('recently_created',         'creation',    'observed',      'high'),
    ('job_posting_dev',          'hiring',      'observed',      'high'),
    ('job_posting_design',       'hiring',      'observed',      'high'),
    ('job_posting_digital',      'hiring',      'observed',      'high'),
    ('job_posting_marketing',    'hiring',      'observed',      'high'),
    ('job_posting_keyword',      'hiring',      'observed',      'high'),
    ('consulting_hiring',        'partnership', 'observed',      'high'),
    ('dev_hiring_reinforcement', 'partnership', 'observed',      'high'),
    ('freelance_mission',        'request',     'explicit_need', 'medium'),
    ('linkedin_post_request',    'request',     'explicit_need', 'medium'),
    ('tech_stack_match',         'website',     'observed',      'medium'),
    ('no_website',               'website',     'observed',      'medium'),
    ('outdated_website',         'website',     'hypothesis',    'low'),
    ('slow_website',             'website',     'observed',      'medium'),
    ('inactive_blog',            'website',     'observed',      'medium'),
    ('funding_round',            'news',        'observed',      'medium'),
    ('headcount_growth',         'news',        'observed',      'high')
  ) AS v(key, category, nature, reliability)
 WHERE signal_types.key = v.key;

-- ---------------------------------------------------------------------
-- 2. Signaux : source et date de l'événement
-- ---------------------------------------------------------------------
ALTER TABLE company_signals
  ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (source IN ('bodacc', 'site', 'registry', 'france_travail', 'linkedin', 'ai_research', 'manual', 'unknown')),
  ADD COLUMN event_at TIMESTAMPTZ;

COMMENT ON COLUMN company_signals.source IS 'Origine du signal ; unknown si la source n''est pas connue (affiché comme tel)';
COMMENT ON COLUMN company_signals.event_at IS 'Date de l''événement (parution, publication) ; detected_at = date de collecte';

-- Source et date lues dans evidence (même règle pour l'insertion et pour le rattrapage)
CREATE OR REPLACE FUNCTION public.signal_source_from_evidence(p_evidence JSONB, p_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_evidence->>'source' IN ('bodacc', 'site', 'registry', 'france_travail', 'linkedin', 'ai_research', 'manual')
      THEN p_evidence->>'source'
    WHEN p_evidence->>'source' IN ('recherche-entreprises', 'recherche_entreprises') THEN 'registry'
    WHEN p_type = 'linkedin_post_request' THEN 'linkedin'
    WHEN p_type = 'tech_stack_match' THEN 'site'
    ELSE 'unknown'
  END;
$$;

CREATE OR REPLACE FUNCTION public.signal_event_from_evidence(p_evidence JSONB)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  raw TEXT := coalesce(p_evidence->>'date_publication', p_evidence->>'date_parution', p_evidence->>'date_debut_activite');
BEGIN
  IF raw IS NULL OR raw !~ '^\d{4}-\d{2}-\d{2}' THEN
    RETURN NULL;
  END IF;
  RETURN left(raw, 10)::date::timestamptz;
EXCEPTION WHEN others THEN
  -- Date invalide dans la source : on n'en invente pas
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_company_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.source IS NULL OR NEW.source = 'unknown' THEN
    NEW.source := public.signal_source_from_evidence(NEW.evidence, NEW.signal_type);
  END IF;
  IF NEW.event_at IS NULL THEN
    NEW.event_at := public.signal_event_from_evidence(NEW.evidence);
  END IF;
  -- Un événement ne peut pas être postérieur à sa collecte
  IF NEW.event_at IS NOT NULL AND NEW.event_at > NEW.detected_at THEN
    NEW.event_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_company_signal_trigger
  BEFORE INSERT ON company_signals
  FOR EACH ROW EXECUTE FUNCTION public.normalize_company_signal();

-- Rattrapage des signaux existants
UPDATE company_signals
   SET source = public.signal_source_from_evidence(evidence, signal_type),
       event_at = CASE
         WHEN public.signal_event_from_evidence(evidence) <= detected_at THEN public.signal_event_from_evidence(evidence)
       END;

-- ---------------------------------------------------------------------
-- 3. Conservation : purge des signaux plus vieux que la durée de leur type
--    (bien après leur expiration dans le score : default_ttl_days ≤ 180 jours)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_old_company_signals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  removed INTEGER;
BEGIN
  DELETE FROM public.company_signals s
   USING public.signal_types t
   WHERE t.key = s.signal_type
     AND s.detected_at < now() - make_interval(days => t.retention_days);
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_company_signals() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('signals-retention', '45 3 * * *', $$ SELECT public.purge_old_company_signals(); $$);
