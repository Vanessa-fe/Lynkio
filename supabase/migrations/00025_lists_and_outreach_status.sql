-- =====================================================================
-- LISTES DE PROSPECTS ET STATUTS DE PROSPECTION
-- - Listes : des groupes de personnes nommés par l'utilisateur (« Agences
--   Lyon », « Session du lundi »), une personne pouvant être dans plusieurs.
-- - Statut de chaque personne (à contacter, contacté, relancé, a répondu) :
--   déduit des échanges enregistrés, jamais saisi à la main.
-- - Étape de la fiche : avance toute seule quand on note un envoi ou une
--   réponse, seulement vers l'avant et jamais sur une fiche close.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rôle des étapes
-- Le rôle survit au renommage d'une étape : c'est lui, pas le nom, qui
-- dit vers quelle étape avancer.
-- ---------------------------------------------------------------------
ALTER TABLE pipeline_stages
  ADD COLUMN role TEXT CHECK (role IN ('to_contact', 'contacted', 'followed_up', 'in_discussion'));

CREATE UNIQUE INDEX uq_pipeline_stages_role ON pipeline_stages(user_id, role) WHERE role IS NOT NULL;

COMMENT ON COLUMN pipeline_stages.role IS 'Étape vers laquelle une fiche avance toute seule : contacted (premier envoi), followed_up (deuxième), in_discussion (réponse)';

-- Étapes par défaut, existantes et futures : rôle donné d'après le nom d'origine
CREATE OR REPLACE FUNCTION default_stage_role(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(trim(p_name)) IN ('à contacter', 'a contacter') THEN 'to_contact'
    WHEN lower(trim(p_name)) IN ('contacté', 'contacte') THEN 'contacted'
    WHEN lower(trim(p_name)) IN ('relancé', 'relance') THEN 'followed_up'
    WHEN lower(trim(p_name)) = 'en discussion' THEN 'in_discussion'
  END;
$$;

UPDATE pipeline_stages SET role = default_stage_role(name) WHERE kind = 'open';

CREATE OR REPLACE FUNCTION set_default_stage_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS NULL AND NEW.kind = 'open' THEN
    NEW.role := default_stage_role(NEW.name);
    -- Un seul rôle de chaque sorte par utilisateur
    IF NEW.role IS NOT NULL AND EXISTS (
      SELECT 1 FROM pipeline_stages WHERE user_id = NEW.user_id AND role = NEW.role
    ) THEN
      NEW.role := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_default_stage_role_trigger
  BEFORE INSERT ON pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION set_default_stage_role();

-- ---------------------------------------------------------------------
-- 2. L'étape avance quand on note un envoi ou une réponse
-- Premier envoi : contacted ; deuxième et suivants : followed_up ;
-- réponse reçue ou rendez-vous : in_discussion.
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

  UPDATE companies SET stage_id = target_stage.id WHERE id = NEW.company_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER advance_stage_on_exchange_trigger
  AFTER INSERT OR UPDATE OF status, direction ON company_interactions
  FOR EACH ROW EXECUTE FUNCTION advance_stage_on_exchange();

-- ---------------------------------------------------------------------
-- 3. Statut de chaque personne, déduit de ses échanges
-- Un échange compte pour une personne s'il lui est rattaché, ou s'il n'est
-- rattaché à personne sur une fiche qui n'a qu'un contact (personne seule,
-- ou entreprise à un seul contact).
-- security_invoker : la RLS des tables s'applique à qui lit la vue.
-- ---------------------------------------------------------------------
CREATE VIEW contact_outreach WITH (security_invoker = true) AS
WITH single_contact_fiches AS (
  SELECT company_id FROM company_contacts GROUP BY company_id HAVING count(*) = 1
),
exchanges AS (
  SELECT cc.id AS contact_id, i.type, i.direction, i.occurred_at
    FROM company_contacts cc
    JOIN company_interactions i ON i.company_id = cc.company_id
   WHERE i.status = 'done'
     AND i.type NOT IN ('note', 'system_event')
     AND (
       i.contact_id = cc.id
       OR (i.contact_id IS NULL AND cc.company_id IN (SELECT company_id FROM single_contact_fiches))
     )
)
SELECT
  cc.id AS contact_id,
  cc.user_id,
  cc.company_id,
  count(e.contact_id) FILTER (WHERE e.direction = 'outgoing') AS sent_count,
  max(e.occurred_at) FILTER (WHERE e.direction = 'outgoing') AS last_sent_at,
  max(e.occurred_at) FILTER (WHERE e.direction = 'incoming' OR e.type = 'meeting') AS last_reply_at,
  CASE
    WHEN cc.opted_out_at IS NOT NULL THEN 'do_not_contact'
    WHEN count(e.contact_id) FILTER (WHERE e.direction = 'incoming' OR e.type = 'meeting') > 0 THEN 'replied'
    WHEN count(e.contact_id) FILTER (WHERE e.direction = 'outgoing') >= 2 THEN 'followed_up'
    WHEN count(e.contact_id) FILTER (WHERE e.direction = 'outgoing') = 1 THEN 'contacted'
    ELSE 'to_contact'
  END AS status
FROM company_contacts cc
LEFT JOIN exchanges e ON e.contact_id = cc.id
GROUP BY cc.id;

COMMENT ON VIEW contact_outreach IS 'Statut de prospection de chaque personne, déduit de ses échanges : to_contact, contacted, followed_up, replied, do_not_contact';

REVOKE ALL ON contact_outreach FROM anon;
GRANT SELECT ON contact_outreach TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Listes de prospects
-- ---------------------------------------------------------------------
ALTER TABLE company_contacts ADD CONSTRAINT company_contacts_id_user_id_key UNIQUE (id, user_id);

CREATE TABLE prospect_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX uq_prospect_lists_name ON prospect_lists(user_id, lower(trim(name)));

COMMENT ON TABLE prospect_lists IS 'Groupes de personnes nommés par l''utilisateur, pour travailler par lots et exporter vers Waalaxy';

CREATE TRIGGER update_prospect_lists_updated_at
  BEFORE UPDATE ON prospect_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE prospect_list_members (
  list_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, contact_id),
  FOREIGN KEY (list_id, user_id) REFERENCES prospect_lists(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id, user_id) REFERENCES company_contacts(id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_prospect_list_members_contact ON prospect_list_members(contact_id);

COMMENT ON TABLE prospect_list_members IS 'Personnes de chaque liste (une personne peut être dans plusieurs listes)';

ALTER TABLE prospect_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_list_members ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['prospect_lists', 'prospect_list_members'] LOOP
    EXECUTE format(
      'CREATE POLICY "Users can view their own rows" ON %I FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "Users can insert their own rows" ON %I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "Users can update their own rows" ON %I FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "Users can delete their own rows" ON %I FOR DELETE TO authenticated USING ((select auth.uid()) = user_id)', t);
  END LOOP;
END;
$$;
