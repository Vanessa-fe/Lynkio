-- Statuts CRM plus fins (carte Trello « Définir statuts CRM et journal d'activités », 12/11/2026).
-- Trois étapes ajoutées au pipeline par défaut :
--   « Rendez-vous »         (en cours) : un rendez-vous a été noté ; la fiche y avance toute seule
--   « Proposition envoyée » (en cours) : devis ou proposition remis, en attente de décision
--   « Sans suite »          (perdue)   : pas de réponse malgré les relances (≠ « Perdu » : un refus)
-- Comptes existants : ajoutées seulement si le nom n'existe pas déjà, à la bonne place, sans
-- toucher aux étapes renommées ou créées par l'utilisateur. Rien n'est supprimé.
-- Aucune réponse n'est devinée : une fiche n'avance vers « En discussion » que si l'utilisateur
-- note lui-même un message reçu (règle inchangée depuis 00025).

-- ---------------------------------------------------------------------
-- 1. Nouveau rôle « meeting » (avancement automatique sur un rendez-vous noté)
-- ---------------------------------------------------------------------
ALTER TABLE pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_role_check;
ALTER TABLE pipeline_stages
  ADD CONSTRAINT pipeline_stages_role_check
  CHECK (role IN ('to_contact', 'contacted', 'followed_up', 'in_discussion', 'meeting'));

COMMENT ON COLUMN pipeline_stages.role IS 'Étape vers laquelle une fiche avance toute seule : contacted (premier envoi), followed_up (deuxième), in_discussion (réponse notée), meeting (rendez-vous noté)';

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
    WHEN lower(trim(p_name)) IN ('rendez-vous', 'rendez vous', 'rdv') THEN 'meeting'
  END;
$$;

-- ---------------------------------------------------------------------
-- 2. Comptes existants : insertion des trois étapes à leur place
-- ---------------------------------------------------------------------
DO $$
DECLARE
  account RECORD;
  anchor INTEGER;
BEGIN
  FOR account IN SELECT DISTINCT user_id FROM pipeline_stages LOOP
    -- « Rendez-vous » puis « Proposition envoyée » juste après « En discussion »
    -- (à défaut, après la dernière étape en cours)
    SELECT coalesce(
      (SELECT "order" FROM pipeline_stages WHERE user_id = account.user_id AND role = 'in_discussion'),
      (SELECT max("order") FROM pipeline_stages WHERE user_id = account.user_id AND kind = 'open'),
      -1
    ) INTO anchor;

    IF NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE user_id = account.user_id AND lower(trim(name)) = 'rendez-vous') THEN
      UPDATE pipeline_stages SET "order" = "order" + 1 WHERE user_id = account.user_id AND "order" > anchor;
      INSERT INTO pipeline_stages (user_id, name, color, kind, "order")
      VALUES (account.user_id, 'Rendez-vous', '#0ea5e9', 'open', anchor + 1);
      anchor := anchor + 1;
    ELSE
      SELECT "order" INTO anchor FROM pipeline_stages
       WHERE user_id = account.user_id AND lower(trim(name)) = 'rendez-vous';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE user_id = account.user_id AND lower(trim(name)) = 'proposition envoyée') THEN
      UPDATE pipeline_stages SET "order" = "order" + 1 WHERE user_id = account.user_id AND "order" > anchor;
      INSERT INTO pipeline_stages (user_id, name, color, kind, "order")
      VALUES (account.user_id, 'Proposition envoyée', '#6366f1', 'open', anchor + 1);
    END IF;

    -- « Sans suite » juste après « Perdu » (à défaut, à la fin)
    IF NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE user_id = account.user_id AND lower(trim(name)) = 'sans suite') THEN
      SELECT coalesce(
        (SELECT min("order") FROM pipeline_stages WHERE user_id = account.user_id AND kind = 'lost'),
        (SELECT max("order") FROM pipeline_stages WHERE user_id = account.user_id)
      ) INTO anchor;
      UPDATE pipeline_stages SET "order" = "order" + 1 WHERE user_id = account.user_id AND "order" > anchor;
      INSERT INTO pipeline_stages (user_id, name, color, kind, "order")
      VALUES (account.user_id, 'Sans suite', '#a8a29e', 'lost', anchor + 1);
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Nouveaux comptes : pipeline par défaut complet
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION initialize_prospection_defaults()
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE user_id = uid) THEN
    INSERT INTO pipeline_stages (user_id, name, color, kind, "order", is_default) VALUES
      (uid, 'À qualifier',         '#64748b', 'open',      0, true),
      (uid, 'À contacter',         '#3b82f6', 'open',      1, false),
      (uid, 'Contacté',            '#f59e0b', 'open',      2, false),
      (uid, 'Relancé',             '#8b5cf6', 'open',      3, false),
      (uid, 'En discussion',       '#06b6d4', 'open',      4, false),
      (uid, 'Rendez-vous',         '#0ea5e9', 'open',      5, false),
      (uid, 'Proposition envoyée', '#6366f1', 'open',      6, false),
      (uid, 'Gagné',               '#22c55e', 'won',       7, false),
      (uid, 'Perdu',               '#ef4444', 'lost',      8, false),
      (uid, 'Sans suite',          '#a8a29e', 'lost',      9, false),
      (uid, 'Hors cible',          '#6b7280', 'excluded', 10, false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM lead_sources WHERE user_id = uid) THEN
    INSERT INTO lead_sources (user_id, name, icon, "order") VALUES
      (uid, 'Détection automatique', 'radar',      0),
      (uid, 'LinkedIn',              'linkedin',   1),
      (uid, 'Recommandation',        'users',      2),
      (uid, 'Réseau',                'network',    3),
      (uid, 'Événement',             'calendar',   4),
      (uid, 'Autre',                 'help-circle', 5);
  END IF;

  -- Premier ICP, pré-rempli avec les critères par défaut du métier choisi
  IF NOT EXISTS (SELECT 1 FROM icp_profiles WHERE user_id = uid) THEN
    INSERT INTO icp_profiles (user_id, profession_key, name, criteria)
    SELECT uid, p.key, 'Mon client idéal', p.default_icp
      FROM user_profiles up
      JOIN professions p ON p.key = up.profession_key
     WHERE up.id = uid;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Un rendez-vous noté fait avancer la fiche jusqu'à « Rendez-vous »
--    (à défaut d'une telle étape : « En discussion », comme avant)
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
  UPDATE companies SET stage_id = target_stage.id WHERE id = NEW.company_id;
  PERFORM set_config('filonea.stage_change_by', '', true);
  RETURN NULL;
END;
$$;
