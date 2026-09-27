-- =====================================================================
-- SOURCES DE PROSPECTION
-- Une société qui vient d'être créée a rarement le budget d'un freelance :
-- l'ancienneté devient une information affichée, plus un critère de
-- sélection. La source principale devient les offres d'emploi (France
-- Travail) : une entreprise qui recrute un développeur a un besoin et un
-- budget. Les créations récentes (BODACC) restent disponibles en option.
-- =====================================================================

ALTER TABLE prospection_settings
  ADD COLUMN sources TEXT[] NOT NULL DEFAULT '{job_postings}'
    CHECK (cardinality(sources) > 0 AND sources <@ '{job_postings,recent_creations}'::text[]),
  -- Date de publication des offres jusqu'à laquelle France Travail a été interrogé
  ADD COLUMN job_postings_cursor TIMESTAMPTZ;

COMMENT ON COLUMN prospection_settings.sources IS 'Sources utilisées : job_postings (offres France Travail), recent_creations (créations BODACC)';

-- Les réglages déjà enregistrés passent sur la nouvelle source par défaut
UPDATE prospection_settings SET sources = '{job_postings}';

-- Le nouveau curseur est, comme bodacc_cursor, géré uniquement par Sophie
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
