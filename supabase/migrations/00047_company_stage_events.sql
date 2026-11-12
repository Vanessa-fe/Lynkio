-- Journal des changements d'étape (phase 0 de l'évolution de Sophie, 13/11/2026).
-- Jusqu'ici companies.stage_id était écrasé : impossible de savoir quand une fiche est passée de
-- « Contacté » à « En discussion ». Ce journal, rempli par la base (quelle que soit l'origine du
-- changement : écran, import, avancement automatique), servira à l'entonnoir et aux statistiques.
-- Il ne se rattrape pas après coup : on commence à collecter maintenant.

CREATE TABLE company_stage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  -- Pas de clé étrangère vers pipeline_stages : une étape supprimée ne doit pas effacer l'historique.
  -- Le nom et la nature sont recopiés au moment du changement.
  from_stage_id UUID,
  from_stage_name TEXT,
  from_stage_kind TEXT,
  to_stage_id UUID,
  to_stage_name TEXT,
  to_stage_kind TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- user : écran ; auto : avancement automatique après un échange ; sophie : fiche créée par Sophie ;
  -- import : fiche importée ; backfill : photo de l'étape au moment de la création du journal
  changed_by TEXT NOT NULL CHECK (changed_by IN ('user', 'auto', 'sophie', 'import', 'backfill')),
  FOREIGN KEY (company_id, user_id) REFERENCES companies(id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE company_stage_events IS 'Historique des étapes de chaque fiche, écrit par la base uniquement';

CREATE INDEX idx_company_stage_events_company ON company_stage_events(company_id, changed_at);
CREATE INDEX idx_company_stage_events_user ON company_stage_events(user_id, changed_at);

ALTER TABLE company_stage_events ENABLE ROW LEVEL SECURITY;

-- Lecture seule pour l'utilisateur : seule la base écrit (trigger SECURITY DEFINER)
CREATE POLICY "Users can read their own stage events"
  ON company_stage_events FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE ON company_stage_events FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- Enregistrement
-- ---------------------------------------------------------------------
CREATE FUNCTION public.log_company_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_stage public.pipeline_stages%ROWTYPE;
  new_stage public.pipeline_stages%ROWTYPE;
  author TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.stage_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Posé par advance_stage_on_exchange le temps de sa transaction
  author := nullif(current_setting('filonea.stage_change_by', true), '');
  IF author IS NULL THEN
    author := CASE
      WHEN TG_OP = 'INSERT' AND NEW.origin = 'detector' THEN 'sophie'
      WHEN TG_OP = 'INSERT' AND NEW.origin = 'import' THEN 'import'
      ELSE 'user'
    END;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.stage_id IS NOT NULL THEN
    SELECT * INTO old_stage FROM public.pipeline_stages WHERE id = OLD.stage_id;
  END IF;
  IF NEW.stage_id IS NOT NULL THEN
    SELECT * INTO new_stage FROM public.pipeline_stages WHERE id = NEW.stage_id;
  END IF;

  INSERT INTO public.company_stage_events
    (user_id, company_id, from_stage_id, from_stage_name, from_stage_kind, to_stage_id, to_stage_name, to_stage_kind, changed_by)
  VALUES
    (NEW.user_id, NEW.id,
     CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage_id END, old_stage.name, old_stage.kind,
     NEW.stage_id, new_stage.name, new_stage.kind,
     author);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_company_stage_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER log_company_stage_change_trigger
  AFTER INSERT OR UPDATE OF stage_id ON companies
  FOR EACH ROW EXECUTE FUNCTION public.log_company_stage_change();

-- ---------------------------------------------------------------------
-- L'avancement automatique se signale comme tel (même fonction que 00025, plus le marqueur)
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

  IF NEW.direction = 'incoming' OR NEW.type = 'meeting' THEN
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
  UPDATE companies SET stage_id = target_stage.id WHERE id = NEW.company_id;
  PERFORM set_config('filonea.stage_change_by', '', true);
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------
-- Point de départ : l'étape actuelle de chaque fiche, marquée « backfill »
-- (on ne connaît pas les changements passés, on ne les invente pas)
-- ---------------------------------------------------------------------
INSERT INTO company_stage_events (user_id, company_id, to_stage_id, to_stage_name, to_stage_kind, changed_by)
SELECT c.user_id, c.id, c.stage_id, s.name, s.kind, 'backfill'
  FROM companies c
  JOIN pipeline_stages s ON s.id = c.stage_id;
