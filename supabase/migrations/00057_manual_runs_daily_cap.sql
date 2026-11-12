-- Au plus 5 lancements à la main par jour et par compte (décision de Vanessa, 12/11/2026).
-- L'application prévient avant (src/lib/actions/prospection.ts, PLAN_LIMITS.manualRunsPerDay) ;
-- ce trigger est le garde-fou côté base, quel que soit le chemin. Les passages automatiques
-- (triggered_by = 'schedule') ne comptent pas. Le jour est celui de Paris.

CREATE OR REPLACE FUNCTION public.limit_manual_pipeline_runs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  day_start TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris';
BEGIN
  IF NEW.triggered_by = 'manual' AND (
    SELECT count(*) FROM public.pipeline_runs
     WHERE user_id = NEW.user_id AND triggered_by = 'manual' AND started_at >= day_start
  ) >= 5 THEN
    RAISE EXCEPTION 'Vous avez déjà lancé Sophie 5 fois aujourd’hui : vous pourrez la relancer demain'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER limit_manual_pipeline_runs_trigger
  BEFORE INSERT ON pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION public.limit_manual_pipeline_runs();
