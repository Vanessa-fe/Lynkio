-- =====================================================================
-- CURSEURS DE SOPHIE REMIS À ZÉRO QUAND LA ZONE OU LES SOURCES CHANGENT
-- Sophie ne relit que les offres publiées depuis son passage précédent.
-- Après l'ajout d'un département ou d'une source, elle doit au contraire
-- regarder les semaines passées pour cette nouvelle zone : on efface le
-- curseur, et le passage suivant repart des 14 derniers jours.
-- (Les offres déjà enregistrées ne sont pas dupliquées : dedupe_key.)
-- =====================================================================

CREATE OR REPLACE FUNCTION prospection_settings_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.bodacc_cursor := NULL;
      NEW.job_postings_cursor := NULL;
    ELSE
      NEW.bodacc_cursor := OLD.bodacc_cursor;
      NEW.job_postings_cursor := OLD.job_postings_cursor;
      NEW.next_run_at := OLD.next_run_at;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (NEW.departments IS DISTINCT FROM OLD.departments OR NEW.sources IS DISTINCT FROM OLD.sources) THEN
    NEW.bodacc_cursor := NULL;
    NEW.job_postings_cursor := NULL;
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

-- Le signal « Recrute pour le web ou le digital » (00019) est nouveau :
-- chaque utilisateur repart des 14 derniers jours pour en profiter
UPDATE prospection_settings SET job_postings_cursor = NULL;
