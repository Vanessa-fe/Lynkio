-- =====================================================================
-- DÉCOUVERTES ET ENTREPRISES EN DÉMARCHE (lot 1.8b de la refonte)
-- Décision du 17/11/2026 : les entreprises trouvées restent dans la liste
-- Entreprises sans encombrer le pipeline actif ; l'utilisateur décide de
-- commencer à prospecter. Aucune information perdue.
--
-- companies.engaged_at : « en démarche depuis » ; vide = découverte.
-- L'étape (stage_id) n'est PAS modifiée : ajout seulement.
--
-- Une entreprise entre dans le suivi (la base s'en charge, quel que soit
-- l'écran ou l'import) :
--   - quand elle passe dans une étape autre que l'étape d'arrivée, sauf
--     « Hors cible » (une découverte écartée reste une découverte) ;
--   - quand un vrai échange est noté (pas une note) ;
--   - quand une de ses personnes part dans l'envoi LinkedIn ;
--   - avec le bouton « Commencer à prospecter » ou un ajout à la main
--     (écrit par l'application).
-- « Retirer du suivi » vide engaged_at sans toucher aux échanges.
-- Liste du rattrapage validée par Vanessa le 17/11/2026 (26 fiches).
-- =====================================================================

ALTER TABLE companies ADD COLUMN engaged_at TIMESTAMPTZ;

COMMENT ON COLUMN companies.engaged_at IS
  'En démarche commerciale depuis (vide : entreprise découverte, hors du pipeline actif). Rempli par l''utilisateur (Commencer à prospecter, ajout à la main) ou par la base (étape hors arrivée et hors « Hors cible », échange réel, envoi LinkedIn)';

CREATE INDEX idx_companies_engaged ON companies(user_id, engaged_at) WHERE engaged_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- 1. Rattrapage (avant les déclencheurs) : même règle que la liste validée
--    Date : premier échange réel, sinon première séquence LinkedIn, sinon
--    premier changement d'étape, sinon date d'ajout.
-- ---------------------------------------------------------------------
WITH flags AS (
  SELECT c.id, c.origin, c.created_at, s.kind, s.is_default,
    (SELECT min(i.occurred_at) FROM company_interactions i
      WHERE i.company_id = c.id AND i.status = 'done' AND i.type NOT IN ('note', 'system_event')) AS first_exchange,
    (SELECT min(q.created_at) FROM linkedin_sequences q
       JOIN company_contacts cc ON cc.id = q.contact_id
      WHERE cc.company_id = c.id) AS first_sequence,
    (SELECT min(e.changed_at) FROM company_stage_events e
      WHERE e.company_id = c.id AND e.from_stage_id IS NOT NULL) AS first_move
    FROM companies c
    LEFT JOIN pipeline_stages s ON s.id = c.stage_id
)
UPDATE companies c
   SET engaged_at = coalesce(f.first_exchange, f.first_sequence, f.first_move, f.created_at)
  FROM flags f
 WHERE c.id = f.id
   AND (
     f.first_exchange IS NOT NULL
     OR f.first_sequence IS NOT NULL
     OR (f.kind IS NOT NULL AND NOT f.is_default AND f.kind <> 'excluded')
     OR f.origin = 'manual'
   );

-- ---------------------------------------------------------------------
-- 2. Étape hors arrivée et hors « Hors cible » : l'entreprise entre dans
--    le suivi (Kanban, liste d'étapes, import CSV avec une étape, import
--    d'un outil LinkedIn « pas intéressé »…)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION engage_on_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target pipeline_stages%ROWTYPE;
BEGIN
  IF NEW.engaged_at IS NOT NULL OR NEW.stage_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;
  SELECT * INTO target FROM pipeline_stages WHERE id = NEW.stage_id;
  IF FOUND AND NOT target.is_default AND target.kind <> 'excluded' THEN
    NEW.engaged_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER engage_on_stage_trigger
  BEFORE INSERT OR UPDATE OF stage_id ON companies
  FOR EACH ROW EXECUTE FUNCTION engage_on_stage();

-- ---------------------------------------------------------------------
-- 3. Échange réel noté : en démarche depuis la date de l'échange (la plus
--    ancienne, pour un échange passé importé après coup)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION engage_on_exchange()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'done' OR NEW.type IN ('note', 'system_event') THEN
    RETURN NULL;
  END IF;
  UPDATE companies
     SET engaged_at = least(NEW.occurred_at, now())
   WHERE id = NEW.company_id
     AND (engaged_at IS NULL OR engaged_at > NEW.occurred_at);
  RETURN NULL;
END;
$$;

CREATE TRIGGER engage_on_exchange_trigger
  AFTER INSERT OR UPDATE OF status ON company_interactions
  FOR EACH ROW EXECUTE FUNCTION engage_on_exchange();

-- ---------------------------------------------------------------------
-- 4. Personne envoyée sur LinkedIn : son entreprise entre dans le suivi
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION engage_on_linkedin_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE companies
     SET engaged_at = now()
   WHERE engaged_at IS NULL
     AND id = (SELECT company_id FROM company_contacts WHERE id = NEW.contact_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER engage_on_linkedin_sequence_trigger
  AFTER INSERT ON linkedin_sequences
  FOR EACH ROW EXECUTE FUNCTION engage_on_linkedin_sequence();
