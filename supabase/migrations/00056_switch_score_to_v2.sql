-- Bascule du score vers la v2 (validée par Vanessa le 12/11/2026, après comparaison sur les 130 fiches :
-- v1 moyenne 16,7 / max 35, v2 moyenne 42,1 / max 55).
-- - score_company calcule avec compute_company_score_v2 et écrit des qualifications « rules-v2 ».
--   L'historique rules-v1 est gardé tel quel (table immuable) ; compute_company_score (v1) reste
--   disponible pour comparer.
-- - Le score se recalcule aussi quand changent les données que la v2 utilise (secteur NAF, code postal,
--   date de création, recherche d'origine) et quand les filtres d'une recherche changent.
-- - Toutes les fiches sont recalculées une fois à la fin.

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
  SELECT * INTO result FROM compute_company_score_v2(p_company_id);
  -- Entreprise supprimée, ou utilisateur sans ICP : rien à noter
  IF NOT FOUND OR result.icp_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT user_id, score INTO company_user, company_score FROM companies WHERE id = p_company_id;
  SELECT version INTO current_version FROM icp_profiles WHERE id = result.icp_profile_id;

  SELECT * INTO last
    FROM company_qualifications
   WHERE company_id = p_company_id AND model = 'rules-v2'
   ORDER BY created_at DESC
   LIMIT 1;

  -- Rien n'a changé depuis le dernier calcul : pas de nouvelle ligne
  IF FOUND
     AND last.icp_profile_id = result.icp_profile_id
     AND last.icp_version = current_version
     AND last.score = result.score
     AND last.is_eliminated = result.is_eliminated
     AND last.reasons = result.factors
     AND company_score IS NOT DISTINCT FROM (CASE WHEN result.is_eliminated THEN 0 ELSE result.score END) THEN
    RETURN;
  END IF;

  INSERT INTO company_qualifications
    (user_id, company_id, icp_profile_id, score, is_eliminated, elimination_reason, reasons, model)
  VALUES
    (company_user, p_company_id, result.icp_profile_id, result.score, result.is_eliminated,
     result.elimination_reason, result.factors, result.version);
END;
$$;

-- Données utilisées par la v2 : recalcul quand elles changent
DROP TRIGGER IF EXISTS rescore_on_company_change ON companies;
CREATE TRIGGER rescore_on_company_change
  AFTER INSERT OR UPDATE OF name, sector, notes, country, website, size_category, naf_code, postal_code, founded_on, strategy_id
  ON companies
  FOR EACH ROW EXECUTE FUNCTION rescore_company_self();

-- Filtres d'une recherche modifiés (nouvelle version) : ses fiches sont recalculées
CREATE OR REPLACE FUNCTION rescore_companies_on_strategy_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF NEW.version IS DISTINCT FROM OLD.version THEN
    FOR v_company_id IN SELECT c.id FROM companies c WHERE c.strategy_id = NEW.id AND c.user_id = NEW.user_id LOOP
      PERFORM score_company(v_company_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER rescore_on_strategy_change
  AFTER UPDATE ON prospect_strategies
  FOR EACH ROW EXECUTE FUNCTION rescore_companies_on_strategy_change();

-- Recalcul de toutes les fiches avec la v2
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  FOR v_company_id IN SELECT id FROM companies LOOP
    PERFORM score_company(v_company_id);
  END LOOP;
END;
$$;
