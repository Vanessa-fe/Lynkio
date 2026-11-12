-- Un échange supprimé (erreur de saisie) efface aussi son effet sur l'étape (12/11/2026).
-- Chaque avancement automatique garde l'identifiant de l'échange qui l'a provoqué. Quand cet
-- échange est supprimé :
--   - la ligne correspondante disparaît de l'historique des étapes ;
--   - la fiche revient à son étape d'avant, seulement si elle est toujours à l'étape atteinte
--     automatiquement (si l'utilisateur l'a déplacée depuis, on ne touche pas à son choix).

ALTER TABLE company_stage_events ADD COLUMN interaction_id UUID;

COMMENT ON COLUMN company_stage_events.interaction_id IS 'Échange qui a fait avancer la fiche (changed_by = auto) ; sa suppression annule ce changement';

CREATE INDEX idx_company_stage_events_interaction ON company_stage_events(interaction_id) WHERE interaction_id IS NOT NULL;

-- Rattrapage : un avancement automatique est écrit dans la même transaction que l'échange,
-- donc à la même heure exacte (now() est celle de la transaction)
UPDATE company_stage_events e
   SET interaction_id = i.id
  FROM company_interactions i
 WHERE e.changed_by = 'auto'
   AND e.interaction_id IS NULL
   AND i.company_id = e.company_id
   AND i.created_at = e.changed_at;

-- ---------------------------------------------------------------------
-- Journal : enregistre l'échange à l'origine, et n'écrit rien pendant une annulation
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_company_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_stage public.pipeline_stages%ROWTYPE;
  new_stage public.pipeline_stages%ROWTYPE;
  author TEXT;
  origin_interaction UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.stage_id IS NULL THEN
    RETURN NULL;
  END IF;
  -- Retour en arrière après la suppression d'un échange : le changement est effacé, pas ajouté
  IF current_setting('filonea.stage_change_undo', true) = '1' THEN
    RETURN NULL;
  END IF;

  -- Posés par advance_stage_on_exchange le temps de sa transaction
  author := nullif(current_setting('filonea.stage_change_by', true), '');
  origin_interaction := nullif(current_setting('filonea.stage_change_interaction', true), '')::uuid;
  IF author IS NULL THEN
    author := CASE
      WHEN TG_OP = 'INSERT' AND NEW.origin = 'detector' THEN 'sophie'
      WHEN TG_OP = 'INSERT' AND NEW.origin = 'import' THEN 'import'
      ELSE 'user'
    END;
  END IF;
  IF author <> 'auto' THEN
    origin_interaction := NULL;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.stage_id IS NOT NULL THEN
    SELECT * INTO old_stage FROM public.pipeline_stages WHERE id = OLD.stage_id;
  END IF;
  IF NEW.stage_id IS NOT NULL THEN
    SELECT * INTO new_stage FROM public.pipeline_stages WHERE id = NEW.stage_id;
  END IF;

  INSERT INTO public.company_stage_events
    (user_id, company_id, from_stage_id, from_stage_name, from_stage_kind, to_stage_id, to_stage_name, to_stage_kind,
     changed_by, interaction_id)
  VALUES
    (NEW.user_id, NEW.id,
     CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage_id END, old_stage.name, old_stage.kind,
     NEW.stage_id, new_stage.name, new_stage.kind,
     author, origin_interaction);
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------
-- Avancement automatique : même règle que 00052, plus l'identifiant de l'échange
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION advance_stage_on_exchange()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_role TEXT;
  sent_count INTEGER;
  fiche companies%ROWTYPE;
  current_stage pipeline_stages%ROWTYPE;
  target_stage pipeline_stages%ROWTYPE;
BEGIN
  IF NEW.status <> 'done' OR NEW.type IN ('note', 'system_event') THEN
    RETURN NULL;
  END IF;
  -- Modification d'un échange déjà effectué sans changement de sens : rien à faire
  IF TG_OP = 'UPDATE' AND OLD.status = 'done' AND OLD.direction IS NOT DISTINCT FROM NEW.direction THEN
    RETURN NULL;
  END IF;

  IF NEW.type = 'meeting' THEN
    target_role := 'meeting';
  ELSIF NEW.direction = 'incoming' THEN
    target_role := 'in_discussion';
  ELSIF NEW.direction = 'outgoing' THEN
    SELECT count(*) INTO sent_count
      FROM company_interactions
     WHERE company_id = NEW.company_id
       AND status = 'done'
       AND direction = 'outgoing'
       AND type NOT IN ('note', 'system_event');
    target_role := CASE WHEN sent_count >= 2 THEN 'followed_up' ELSE 'contacted' END;
  ELSE
    RETURN NULL;
  END IF;

  SELECT * INTO fiche FROM companies WHERE id = NEW.company_id;
  SELECT * INTO target_stage FROM pipeline_stages WHERE user_id = fiche.user_id AND role = target_role;
  IF NOT FOUND AND target_role = 'meeting' THEN
    SELECT * INTO target_stage FROM pipeline_stages WHERE user_id = fiche.user_id AND role = 'in_discussion';
  END IF;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF fiche.stage_id IS NOT NULL THEN
    SELECT * INTO current_stage FROM pipeline_stages WHERE id = fiche.stage_id;
    -- Seulement vers l'avant, et jamais une fiche gagnée, perdue ou hors cible
    IF current_stage.kind <> 'open' OR current_stage."order" >= target_stage."order" THEN
      RETURN NULL;
    END IF;
  END IF;

  PERFORM set_config('filonea.stage_change_by', 'auto', true);
  PERFORM set_config('filonea.stage_change_interaction', NEW.id::text, true);
  UPDATE companies SET stage_id = target_stage.id WHERE id = NEW.company_id;
  PERFORM set_config('filonea.stage_change_by', '', true);
  PERFORM set_config('filonea.stage_change_interaction', '', true);
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------
-- Suppression d'un échange : on annule l'avancement qu'il avait provoqué
-- ---------------------------------------------------------------------
CREATE FUNCTION public.undo_stage_on_exchange_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event public.company_stage_events%ROWTYPE;
BEGIN
  FOR event IN
    SELECT * FROM public.company_stage_events
     WHERE interaction_id = OLD.id AND user_id = OLD.user_id
     ORDER BY changed_at DESC
  LOOP
    -- La fiche est toujours à l'étape atteinte grâce à cet échange : elle revient à l'étape d'avant
    -- (si l'étape d'avant a été supprimée entre-temps, elle reste où elle est)
    IF event.from_stage_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.pipeline_stages WHERE id = event.from_stage_id AND user_id = OLD.user_id) THEN
      PERFORM set_config('filonea.stage_change_undo', '1', true);
      UPDATE public.companies
         SET stage_id = event.from_stage_id
       WHERE id = event.company_id
         AND user_id = OLD.user_id
         AND stage_id IS NOT DISTINCT FROM event.to_stage_id;
      PERFORM set_config('filonea.stage_change_undo', '', true);
    END IF;
    DELETE FROM public.company_stage_events WHERE id = event.id;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_stage_on_exchange_delete() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER undo_stage_on_exchange_delete_trigger
  AFTER DELETE ON company_interactions
  FOR EACH ROW EXECUTE FUNCTION public.undo_stage_on_exchange_delete();
