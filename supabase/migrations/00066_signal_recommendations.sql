-- Signaux d'opportunité, étape 3 : recommandation des signaux par Sophie (16/11/2026).
--
-- icp_profiles.signal_recommendations : dernière recommandation acceptée par l'utilisateur
-- (format : SignalRecommendation, supabase/functions/_shared/signal-capabilities.ts). Écrite par
-- l'application après validation (action saveSignalRecommendation), jamais directement par l'IA.
-- Sa clé « weights » donne les points recommandés de chaque signal détectable (0 = non recommandé).
--
-- Points d'un signal dans le score, dans cet ordre :
--   1. réglage manuel de l'utilisateur (signal_weights) : toujours prioritaire, jamais écrasé ;
--   2. recommandation de Sophie (signal_recommendations.weights) ;
--   3. valeur par défaut du métier (profession_signals).

ALTER TABLE icp_profiles
  ADD COLUMN signal_recommendations JSONB
    CHECK (signal_recommendations IS NULL OR jsonb_typeof(signal_recommendations) = 'object');

COMMENT ON COLUMN icp_profiles.signal_recommendations IS
  'Recommandation de Sophie acceptée par l''utilisateur (événements, raisons, points par signal dans weights) ; les réglages manuels (signal_weights) restent prioritaires';

-- Une nouvelle recommandation change les points : nouvelle version, donc recalcul des fiches
CREATE OR REPLACE FUNCTION bump_icp_profile_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.criteria IS DISTINCT FROM OLD.criteria
     OR NEW.signal_weights IS DISTINCT FROM OLD.signal_weights
     OR NEW.signal_recommendations IS DISTINCT FROM OLD.signal_recommendations THEN
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := OLD.version;
  END IF;
  RETURN NEW;
END;
$$;

-- Score : une seule ligne change dans compute_company_score_v2 (00065), le calcul du poids.
-- On modifie la fonction en place pour ne pas recopier ses 230 lignes ; l'ancre est vérifiée.
DO $migration$
DECLARE
  definition TEXT := pg_get_functiondef('public.compute_company_score_v2(uuid)'::regprocedure);
  old_weight CONSTANT TEXT := 'COALESCE((icp.signal_weights->>s.signal_type)::int, ps.default_weight, 0) AS weight';
  new_weight CONSTANT TEXT := 'COALESCE((icp.signal_weights->>s.signal_type)::int, '
    || '(to_jsonb(icp)->''signal_recommendations''->''weights''->>s.signal_type)::int, ps.default_weight, 0) AS weight';
BEGIN
  IF position(old_weight IN definition) = 0 THEN
    RAISE EXCEPTION 'compute_company_score_v2 : calcul du poids introuvable, migration à revoir';
  END IF;
  EXECUTE replace(definition, old_weight, new_weight);
END;
$migration$;

COMMENT ON FUNCTION public.compute_company_score_v2 IS 'Score explicable v2 : adéquation 50 (critères souples = points partiels), signaux d''opportunité 35 (réglage manuel, sinon recommandation de Sophie, sinon défaut du métier ; types retirés ignorés), fraîcheur 10, joignabilité 5';
