-- =====================================================================
-- PERSONNES SEULES
-- Une fiche (`companies`) peut maintenant représenter une personne sans
-- entreprise : un indépendant, ou quelqu'un dont on ne connaît pas encore
-- l'entreprise (Waalaxy recense des personnes, pas des entreprises).
-- C'est le principe des « comptes personnels » des CRM : la personne garde
-- tout ce qu'a une entreprise (étape, échanges, relances, messages) avec
-- un seul pipeline. Sa fiche a un seul contact : elle-même.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Type de fiche
-- ---------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'organization' CHECK (kind IN ('organization', 'individual'));

COMMENT ON COLUMN companies.kind IS 'organization : entreprise ; individual : personne seule (indépendant ou entreprise inconnue), dont le contact unique est la personne';

-- ---------------------------------------------------------------------
-- 2. Le nom d'une personne seule suit celui de son contact
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_individual_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  full_name TEXT := NULLIF(trim(concat_ws(' ', NEW.first_name, NEW.last_name)), '');
BEGIN
  IF full_name IS NOT NULL THEN
    UPDATE companies
       SET name = full_name
     WHERE id = NEW.company_id
       AND kind = 'individual'
       AND name IS DISTINCT FROM full_name;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_individual_name_trigger
  AFTER INSERT OR UPDATE OF first_name, last_name ON company_contacts
  FOR EACH ROW EXECUTE FUNCTION sync_individual_name();

-- ---------------------------------------------------------------------
-- 3. Rattacher une personne seule à une entreprise
-- La personne, ses échanges, ses relances et ses signaux rejoignent la
-- fiche de l'entreprise, puis la fiche de la personne est supprimée.
-- SECURITY INVOKER : la RLS s'applique, on ne touche qu'à ses propres fiches.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION attach_individual_to_company(p_individual_id UUID, p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  individual companies%ROWTYPE;
  target companies%ROWTYPE;
  target_is_default BOOLEAN;
  interaction_ids UUID[];
  interaction_contacts UUID[];
BEGIN
  SELECT * INTO individual FROM companies
   WHERE id = p_individual_id AND user_id = (SELECT auth.uid()) AND kind = 'individual'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personne introuvable' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO target FROM companies
   WHERE id = p_company_id AND user_id = (SELECT auth.uid()) AND kind = 'organization'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entreprise introuvable' USING ERRCODE = 'P0002';
  END IF;

  -- Les échanges désignent leur contact par (contact_id, company_id) : on détache
  -- le contact le temps de déplacer la personne, puis on le remet
  SELECT coalesce(array_agg(id), '{}'), coalesce(array_agg(contact_id), '{}')
    INTO interaction_ids, interaction_contacts
    FROM company_interactions
   WHERE company_id = p_individual_id AND contact_id IS NOT NULL;

  UPDATE company_interactions SET contact_id = NULL WHERE id = ANY (interaction_ids);
  UPDATE company_contacts SET company_id = p_company_id WHERE company_id = p_individual_id;
  UPDATE company_interactions SET company_id = p_company_id WHERE company_id = p_individual_id;
  UPDATE company_interactions i
     SET contact_id = moved.contact_id
    FROM unnest(interaction_ids, interaction_contacts) AS moved(id, contact_id)
   WHERE i.id = moved.id;

  UPDATE reminders SET company_id = p_company_id WHERE company_id = p_individual_id;
  UPDATE unidentified_job_offers SET company_id = p_company_id WHERE company_id = p_individual_id;

  -- Un signal déjà présent sur l'entreprise n'est pas dupliqué : il part avec la fiche
  UPDATE company_signals s
     SET company_id = p_company_id
   WHERE s.company_id = p_individual_id
     AND NOT EXISTS (
       SELECT 1 FROM company_signals t
        WHERE t.company_id = p_company_id
          AND t.signal_type = s.signal_type
          AND t.dedupe_key IS NOT DISTINCT FROM s.dedupe_key
     );

  -- Suivi commercial : l'entreprise garde le sien et complète ce qui lui manque.
  -- Si elle n'avait pas encore avancé (étape par défaut), elle prend l'étape de la personne.
  SELECT coalesce(is_default, TRUE) INTO target_is_default
    FROM pipeline_stages WHERE id = target.stage_id;

  UPDATE companies
     SET stage_id = CASE WHEN coalesce(target_is_default, TRUE) THEN coalesce(individual.stage_id, stage_id) ELSE stage_id END,
         source_id = coalesce(source_id, individual.source_id),
         next_action = coalesce(next_action, individual.next_action),
         estimated_amount = coalesce(estimated_amount, individual.estimated_amount),
         notes = CASE
           WHEN individual.notes IS NULL THEN notes
           WHEN notes IS NULL THEN individual.notes
           ELSE notes || E'\n\n' || individual.notes
         END,
         last_interaction_at = GREATEST(last_interaction_at, individual.last_interaction_at)
   WHERE id = p_company_id;

  DELETE FROM companies WHERE id = p_individual_id;

  -- Déplacer un contact ne relance pas le calcul : on le fait ici
  PERFORM score_company(p_company_id);
END;
$$;

COMMENT ON FUNCTION attach_individual_to_company IS 'Déplace une personne seule (contact, échanges, relances, signaux) dans une entreprise, puis supprime sa fiche';

REVOKE EXECUTE ON FUNCTION attach_individual_to_company(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION attach_individual_to_company(UUID, UUID) TO authenticated;
