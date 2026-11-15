-- Une recherche de Sophie sans résultat ne compte plus dans les limites (décision du 15/11/2026).
-- Comptent : le passage en cours (sinon on pourrait en lancer plusieurs à la fois) et ceux terminés
-- avec au moins une entreprise ajoutée. Une recherche sans résultat, ou échouée, ne compte pas.
-- Même règle dans l'application : runCountsTowardLimits (src/lib/billing.ts et
-- supabase/functions/_shared/plan.ts). Remplace le décompte de 00057 (5 lancements à la main par jour).

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
       AND (status = 'running' OR (status = 'succeeded' AND companies_created > 0))
  ) >= 5 THEN
    RAISE EXCEPTION 'Vous avez déjà lancé Sophie 5 fois aujourd’hui : vous pourrez la relancer demain'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
