-- =====================================================================
-- SIGNAL « STACK TECHNIQUE COMPATIBLE »
-- L'ICP précise les technologies qui intéressent l'utilisatrice
-- (criteria.tech_stack). Dès que la stack détectée d'une entreprise change,
-- la base crée, met à jour ou retire le signal tech_stack_match : peu importe
-- qui a lancé l'analyse (fiche, formulaire, Sophie).
-- =====================================================================

-- 0. Correctif du score (00016) : dans une même transaction, NOW() renvoie la
--    même heure pour tous les calculs ; le « dernier calcul » trié par date
--    pouvait alors être le mauvais, et un changement de score était ignoré.
--    On n'ignore désormais un calcul que si le score affiché sur l'entreprise
--    est lui aussi déjà le bon.
CREATE OR REPLACE FUNCTION score_company(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result RECORD;
  company_user UUID;
  company_score SMALLINT;
  current_version INTEGER;
  last company_qualifications%ROWTYPE;
BEGIN
  SELECT * INTO result FROM compute_company_score(p_company_id);
  -- Entreprise supprimée, ou utilisateur sans ICP : rien à noter
  IF NOT FOUND OR result.icp_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT user_id, score INTO company_user, company_score FROM companies WHERE id = p_company_id;
  SELECT version INTO current_version FROM icp_profiles WHERE id = result.icp_profile_id;

  SELECT * INTO last
    FROM company_qualifications
   WHERE company_id = p_company_id AND model = 'rules-v1'
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND
     AND last.icp_profile_id = result.icp_profile_id
     AND last.icp_version = current_version
     AND last.score = result.score
     AND last.is_eliminated = result.is_eliminated
     AND last.reasons = result.reasons
     AND company_score IS NOT DISTINCT FROM (CASE WHEN result.is_eliminated THEN 0 ELSE result.score END) THEN
    RETURN;
  END IF;

  INSERT INTO company_qualifications
    (user_id, company_id, icp_profile_id, score, is_eliminated, elimination_reason, reasons, model)
  VALUES
    (company_user, p_company_id, result.icp_profile_id, result.score, result.is_eliminated,
     result.elimination_reason, result.reasons, 'rules-v1');
END;
$$;

-- 1. Technologies par défaut pour les développeur·ses web
UPDATE professions
   SET default_icp = default_icp || '{"tech_stack": ["nextjs", "react"]}'::jsonb
 WHERE key = 'web_developer'
   AND NOT (default_icp ? 'tech_stack');

UPDATE icp_profiles
   SET criteria = criteria || '{"tech_stack": ["nextjs", "react"]}'::jsonb
 WHERE profession_key = 'web_developer'
   AND NOT (criteria ? 'tech_stack');

-- 2. Synchronisation du signal pour une entreprise
CREATE OR REPLACE FUNCTION sync_tech_stack_signal(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c companies%ROWTYPE;
  wanted TEXT[];
  matched TEXT[];
  ttl INTEGER;
  detected TIMESTAMPTZ;
BEGIN
  SELECT * INTO c FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Même ICP que pour le score : celui de l'entreprise, sinon le premier actif
  SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(i.criteria->'tech_stack', '[]'::jsonb)))
    INTO wanted
    FROM icp_profiles i
   WHERE i.user_id = c.user_id
     AND (i.id = c.icp_profile_id OR (c.icp_profile_id IS NULL AND i.is_active))
   ORDER BY (i.id = c.icp_profile_id) DESC NULLS LAST, i.created_at
   LIMIT 1;

  matched := ARRAY(
    SELECT unnest(c.detected_stack)
    INTERSECT
    SELECT unnest(COALESCE(wanted, '{}'::text[]))
  );

  IF cardinality(matched) = 0 THEN
    DELETE FROM company_signals WHERE company_id = c.id AND signal_type = 'tech_stack_match';
    RETURN;
  END IF;

  SELECT default_ttl_days INTO ttl FROM signal_types WHERE key = 'tech_stack_match';
  detected := COALESCE(c.stack_detected_at, NOW());

  INSERT INTO company_signals (user_id, company_id, signal_type, dedupe_key, evidence, detected_at, expires_at)
  VALUES (
    c.user_id,
    c.id,
    'tech_stack_match',
    'site',
    jsonb_build_object('source', 'site', 'technologies', to_jsonb(matched), 'stack_detectee', to_jsonb(c.detected_stack)),
    detected,
    CASE WHEN ttl IS NOT NULL THEN detected + make_interval(days => ttl) END
  )
  ON CONFLICT (company_id, signal_type, dedupe_key) DO UPDATE
    SET evidence = EXCLUDED.evidence,
        detected_at = EXCLUDED.detected_at,
        expires_at = EXCLUDED.expires_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_tech_stack_signal(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sync_tech_stack_signal(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION sync_tech_stack_signal IS 'Crée, met à jour ou retire le signal tech_stack_match selon la stack détectée et l''ICP';

-- 3. Déclenchement : stack détectée modifiée
CREATE OR REPLACE FUNCTION sync_tech_stack_signal_on_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM sync_tech_stack_signal(NEW.id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_tech_stack_on_company_change
  AFTER INSERT OR UPDATE OF detected_stack ON companies
  FOR EACH ROW EXECUTE FUNCTION sync_tech_stack_signal_on_company();

-- 4. Déclenchement : technologies de l'ICP modifiées
CREATE OR REPLACE FUNCTION sync_tech_stack_signals_on_icp_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF NEW.criteria->'tech_stack' IS DISTINCT FROM OLD.criteria->'tech_stack'
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    FOR v_company_id IN
      SELECT c.id FROM companies c WHERE c.user_id = NEW.user_id AND cardinality(c.detected_stack) > 0
    LOOP
      PERFORM sync_tech_stack_signal(v_company_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_tech_stack_on_icp_change
  AFTER UPDATE ON icp_profiles
  FOR EACH ROW EXECUTE FUNCTION sync_tech_stack_signals_on_icp_change();

-- 5. Entreprises déjà analysées
SELECT sync_tech_stack_signal(id) FROM companies WHERE cardinality(detected_stack) > 0;
