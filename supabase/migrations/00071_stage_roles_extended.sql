-- =====================================================================
-- RÔLES D'ÉTAPES ÉTENDUS (lot 1.8a de la refonte)
-- Les étapes restent personnalisables (décision du 17/11/2026). Pour que
-- Sophie, l'entonnoir et les statistiques comprennent une étape sans se
-- fier à son nom, chaque étape peut porter un rôle : ce qu'elle représente.
-- Nouveaux rôles :
--   proposal      (en cours) : proposition ou devis envoyé
--   negotiation   (en cours) : négociation
--   not_concluded (perdue)   : l'entreprise a dit non
--   no_follow_up  (perdue)   : pas de réponse, sans suite
-- Un rôle reste facultatif et unique par compte. Rien n'est renommé,
-- déplacé ni supprimé ; l'avancement automatique ne change pas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Valeurs permises, et rôle cohérent avec la nature de l'étape
-- ---------------------------------------------------------------------
ALTER TABLE pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_role_check;
ALTER TABLE pipeline_stages
  ADD CONSTRAINT pipeline_stages_role_check
  CHECK (role IN (
    'to_contact', 'contacted', 'followed_up', 'in_discussion', 'meeting', 'proposal', 'negotiation',
    'not_concluded', 'no_follow_up'
  ));

CREATE OR REPLACE FUNCTION stage_role_fits(p_kind TEXT, p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_role IS NULL
      OR (p_kind = 'open' AND p_role IN ('to_contact', 'contacted', 'followed_up', 'in_discussion', 'meeting', 'proposal', 'negotiation'))
      OR (p_kind = 'lost' AND p_role IN ('not_concluded', 'no_follow_up'));
$$;

ALTER TABLE pipeline_stages
  ADD CONSTRAINT pipeline_stages_role_fits_kind CHECK (stage_role_fits(kind, role));

COMMENT ON COLUMN pipeline_stages.role IS
  'Ce que représente l''étape, quel que soit son nom (facultatif, unique par compte). En cours : to_contact, contacted (premier envoi), followed_up (deuxième envoi), in_discussion (réponse notée), meeting (rendez-vous noté), proposal, negotiation. Perdue : not_concluded (refus), no_follow_up (sans suite). L''avancement automatique vise contacted, followed_up, in_discussion et meeting';

-- ---------------------------------------------------------------------
-- 2. Rôle deviné d'après le nom d'origine (étapes par défaut)
-- ---------------------------------------------------------------------
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
    WHEN lower(trim(p_name)) IN ('proposition envoyée', 'proposition envoyee') THEN 'proposal'
    WHEN lower(trim(p_name)) IN ('négociation', 'negociation') THEN 'negotiation'
    WHEN lower(trim(p_name)) IN ('perdu', 'non concrétisé', 'non concretise') THEN 'not_concluded'
    WHEN lower(trim(p_name)) = 'sans suite' THEN 'no_follow_up'
  END;
$$;

-- Nouvelle étape : rôle d'après son nom, s'il convient à sa nature et n'est pas déjà pris
CREATE OR REPLACE FUNCTION set_default_stage_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS NULL AND NEW.kind IN ('open', 'lost') THEN
    NEW.role := default_stage_role(NEW.name);
    IF NEW.role IS NOT NULL AND (
      NOT stage_role_fits(NEW.kind, NEW.role)
      OR EXISTS (SELECT 1 FROM pipeline_stages WHERE user_id = NEW.user_id AND role = NEW.role)
    ) THEN
      NEW.role := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Nature changée : un rôle qui ne lui convient plus est retiré (plutôt qu'un refus d'enregistrer)
CREATE OR REPLACE FUNCTION clear_unfit_stage_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind AND NOT stage_role_fits(NEW.kind, NEW.role) THEN
    NEW.role := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clear_unfit_stage_role_trigger
  BEFORE UPDATE OF kind ON pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION clear_unfit_stage_role();

-- ---------------------------------------------------------------------
-- 3. Rattrapage des comptes existants : seulement les noms d'origine,
--    seulement si le rôle est libre et convient à la nature de l'étape
-- ---------------------------------------------------------------------
WITH candidates AS (
  SELECT DISTINCT ON (s.user_id, default_stage_role(s.name))
         s.id, default_stage_role(s.name) AS role
    FROM pipeline_stages s
   WHERE s.role IS NULL
     AND default_stage_role(s.name) IS NOT NULL
     AND stage_role_fits(s.kind, default_stage_role(s.name))
     AND NOT EXISTS (
       SELECT 1 FROM pipeline_stages taken
        WHERE taken.user_id = s.user_id AND taken.role = default_stage_role(s.name)
     )
   ORDER BY s.user_id, default_stage_role(s.name), s."order"
)
UPDATE pipeline_stages s
   SET role = candidates.role
  FROM candidates
 WHERE s.id = candidates.id;
