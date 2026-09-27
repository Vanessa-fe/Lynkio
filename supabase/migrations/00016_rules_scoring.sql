-- =====================================================================
-- SCORING PAR RÈGLES (« rules-v1 »)
-- Le score d'une entreprise (0 à 100) est calculé par la base à partir de
-- l'ICP de l'utilisateur et des poids de signaux de son métier. Il est
-- recalculé automatiquement dès qu'un signal, un contact ou la fiche change,
-- quelle que soit l'origine (application, Sophie, import).
-- Chaque calcul qui change le résultat est gardé dans company_qualifications
-- avec ses raisons ; le trigger existant recopie le score sur l'entreprise.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Calcul (lecture seule)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_company_score(p_company_id UUID)
RETURNS TABLE (
  icp_profile_id UUID,
  score SMALLINT,
  is_eliminated BOOLEAN,
  elimination_reason TEXT,
  reasons JSONB
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  c companies%ROWTYPE;
  icp icp_profiles%ROWTYPE;
  profession TEXT;
  total INTEGER := 0;
  items JSONB := '[]'::jsonb;
  sig RECORD;
  points INTEGER;
  newest TIMESTAMPTZ;
  keyword TEXT;
  haystack TEXT;
  size_label TEXT;
BEGIN
  SELECT * INTO c FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- ICP de l'entreprise, sinon le premier ICP actif de l'utilisateur
  SELECT * INTO icp
    FROM icp_profiles i
   WHERE i.user_id = c.user_id
     AND (i.id = c.icp_profile_id OR (c.icp_profile_id IS NULL AND i.is_active))
   ORDER BY (i.id = c.icp_profile_id) DESC NULLS LAST, i.created_at
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  profession := COALESCE(icp.profession_key, (SELECT up.profession_key FROM user_profiles up WHERE up.id = c.user_id));

  -- Critères éliminatoires ------------------------------------------------
  IF jsonb_typeof(icp.criteria->'countries') = 'array'
     AND jsonb_array_length(icp.criteria->'countries') > 0
     AND NOT (icp.criteria->'countries' ? c.country) THEN
    RETURN QUERY SELECT icp.id, 0::smallint, TRUE, format('Pays hors cible (%s)', c.country),
      jsonb_build_array(jsonb_build_object('code', 'eliminated:country', 'label', format('Pays hors cible (%s)', c.country), 'points', 0));
    RETURN;
  END IF;

  haystack := lower(concat_ws(' ', c.name, c.sector, c.notes));
  FOR keyword IN
    SELECT lower(trim(value)) FROM jsonb_array_elements_text(COALESCE(icp.criteria->'exclude_keywords', '[]'::jsonb))
  LOOP
    IF keyword <> '' AND position(keyword IN haystack) > 0 THEN
      RETURN QUERY SELECT icp.id, 0::smallint, TRUE, format('Mot-clé exclu : %s', keyword),
        jsonb_build_array(jsonb_build_object('code', 'eliminated:keyword', 'label', format('Mot-clé exclu : %s', keyword), 'points', 0));
      RETURN;
    END IF;
  END LOOP;

  -- Signaux d'achat encore valides ----------------------------------------
  -- Poids : surcharge de l'ICP, sinon poids par défaut du métier.
  -- Plusieurs signaux du même type : +5 par signal supplémentaire, au plus +10.
  FOR sig IN
    SELECT s.signal_type,
           st.label,
           count(*) AS n,
           max(s.detected_at) AS last_at,
           COALESCE((icp.signal_weights->>s.signal_type)::int, ps.default_weight, 0) AS weight
      FROM company_signals s
      JOIN signal_types st ON st.key = s.signal_type
      LEFT JOIN profession_signals ps ON ps.signal_type = s.signal_type AND ps.profession_key = profession
     WHERE s.company_id = c.id
       AND (s.expires_at IS NULL OR s.expires_at > NOW())
     GROUP BY s.signal_type, st.label, ps.default_weight
     ORDER BY 5 DESC
  LOOP
    newest := GREATEST(newest, sig.last_at);
    IF sig.weight > 0 THEN
      points := sig.weight + LEAST((sig.n - 1) * 5, 10);
      total := total + points;
      items := items || jsonb_build_object(
        'code', 'signal:' || sig.signal_type,
        'label', sig.label || CASE WHEN sig.n > 1 THEN format(' (%s)', sig.n) ELSE '' END,
        'points', points
      );
    END IF;
  END LOOP;

  -- Fraîcheur : un besoin récent a plus de chances d'être encore ouvert
  IF newest > NOW() - INTERVAL '7 days' THEN
    total := total + 10;
    items := items || jsonb_build_object('code', 'freshness:week', 'label', 'Signal de moins de 7 jours', 'points', 10);
  ELSIF newest > NOW() - INTERVAL '30 days' THEN
    total := total + 5;
    items := items || jsonb_build_object('code', 'freshness:month', 'label', 'Signal de moins d''un mois', 'points', 5);
  END IF;

  -- Taille ------------------------------------------------------------------
  IF c.size_category IS NOT NULL THEN
    size_label := CASE c.size_category
      WHEN 'solo' THEN 'indépendant' WHEN 'tpe' THEN 'TPE' WHEN 'pme' THEN 'PME'
      WHEN 'eti' THEN 'ETI' WHEN 'ge' THEN 'grande entreprise' END;
    IF COALESCE(icp.criteria->'size_categories'->'preferred', '[]'::jsonb) ? c.size_category THEN
      total := total + 15;
      items := items || jsonb_build_object('code', 'size:preferred', 'label', format('Taille idéale (%s)', size_label), 'points', 15);
    ELSIF COALESCE(icp.criteria->'size_categories'->'accepted', '[]'::jsonb) ? c.size_category THEN
      total := total + 8;
      items := items || jsonb_build_object('code', 'size:accepted', 'label', format('Taille acceptée (%s)', size_label), 'points', 8);
    ELSE
      items := items || jsonb_build_object('code', 'size:outside', 'label', format('Taille hors cible (%s)', size_label), 'points', 0);
    END IF;
  END IF;

  -- Joignabilité : un prospect qu'on peut contacter vaut plus -----------------
  IF EXISTS (SELECT 1 FROM company_contacts cc WHERE cc.company_id = c.id AND cc.is_decision_maker AND cc.opted_out_at IS NULL) THEN
    total := total + 5;
    items := items || jsonb_build_object('code', 'reach:decision_maker', 'label', 'Décideur identifié', 'points', 5);
  END IF;
  IF EXISTS (SELECT 1 FROM company_contacts cc WHERE cc.company_id = c.id AND cc.email IS NOT NULL AND cc.opted_out_at IS NULL) THEN
    total := total + 5;
    items := items || jsonb_build_object('code', 'reach:email', 'label', 'E-mail de contact', 'points', 5);
  END IF;
  IF c.website IS NOT NULL THEN
    total := total + 5;
    items := items || jsonb_build_object('code', 'reach:website', 'label', 'Site web connu', 'points', 5);
  END IF;

  RETURN QUERY SELECT icp.id, LEAST(total, 100)::smallint, FALSE, NULL::text, items;
END;
$$;

COMMENT ON FUNCTION compute_company_score IS 'Score rules-v1 d''une entreprise (0-100) et ses raisons, sans rien écrire';

-- ---------------------------------------------------------------------
-- 2. Enregistrement (seulement si le résultat change)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION score_company(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result RECORD;
  company_user UUID;
  current_version INTEGER;
  last company_qualifications%ROWTYPE;
BEGIN
  SELECT * INTO result FROM compute_company_score(p_company_id);
  -- Entreprise supprimée, ou utilisateur sans ICP : rien à noter
  IF NOT FOUND OR result.icp_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT user_id INTO company_user FROM companies WHERE id = p_company_id;
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
     AND last.reasons = result.reasons THEN
    RETURN;
  END IF;

  INSERT INTO company_qualifications
    (user_id, company_id, icp_profile_id, score, is_eliminated, elimination_reason, reasons, model)
  VALUES
    (company_user, p_company_id, result.icp_profile_id, result.score, result.is_eliminated,
     result.elimination_reason, result.reasons, 'rules-v1');
END;
$$;

COMMENT ON FUNCTION score_company IS 'Recalcule le score rules-v1 et l''enregistre s''il a changé';

REVOKE EXECUTE ON FUNCTION compute_company_score(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION score_company(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION compute_company_score(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION score_company(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Recalcul automatique
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rescore_company_from_child()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM score_company(COALESCE(NEW.company_id, OLD.company_id));
  RETURN NULL;
END;
$$;

CREATE TRIGGER rescore_on_signal_change
  AFTER INSERT OR UPDATE OR DELETE ON company_signals
  FOR EACH ROW EXECUTE FUNCTION rescore_company_from_child();

CREATE TRIGGER rescore_on_contact_change
  AFTER INSERT OR DELETE OR UPDATE OF is_decision_maker, email, opted_out_at ON company_contacts
  FOR EACH ROW EXECUTE FUNCTION rescore_company_from_child();

CREATE OR REPLACE FUNCTION rescore_company_self()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM score_company(NEW.id);
  RETURN NULL;
END;
$$;

-- Colonnes utilisées par le calcul uniquement : la recopie du score sur
-- l'entreprise (score, scored_at, icp_profile_id) ne relance pas le calcul.
CREATE TRIGGER rescore_on_company_change
  AFTER INSERT OR UPDATE OF name, sector, notes, country, website, size_category ON companies
  FOR EACH ROW EXECUTE FUNCTION rescore_company_self();

-- Un ICP modifié (nouvelle version) : toutes les entreprises de l'utilisateur
CREATE OR REPLACE FUNCTION rescore_companies_on_icp_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF NEW.version IS DISTINCT FROM OLD.version OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    FOR v_company_id IN SELECT c.id FROM companies c WHERE c.user_id = NEW.user_id LOOP
      PERFORM score_company(v_company_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER rescore_on_icp_change
  AFTER UPDATE ON icp_profiles
  FOR EACH ROW EXECUTE FUNCTION rescore_companies_on_icp_change();

-- Un signal qui expire ne déclenche rien : un job quotidien recalcule les
-- entreprises dont un signal a expiré depuis leur dernier calcul.
CREATE OR REPLACE FUNCTION rescore_companies_with_expired_signals()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  total INTEGER := 0;
BEGIN
  FOR v_company_id IN
    SELECT DISTINCT s.company_id
      FROM company_signals s
      JOIN companies c ON c.id = s.company_id
     WHERE s.expires_at <= NOW()
       AND (c.scored_at IS NULL OR s.expires_at > c.scored_at)
  LOOP
    PERFORM score_company(v_company_id);
    total := total + 1;
  END LOOP;
  RETURN total;
END;
$$;

REVOKE EXECUTE ON FUNCTION rescore_companies_with_expired_signals() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'rescore-expired-signals',
  '30 3 * * *',
  $$ SELECT rescore_companies_with_expired_signals(); $$
);

-- ---------------------------------------------------------------------
-- 4. Premier calcul pour les entreprises existantes
-- ---------------------------------------------------------------------
SELECT score_company(id) FROM companies;
