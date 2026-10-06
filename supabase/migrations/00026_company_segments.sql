-- =====================================================================
-- SEGMENTS
-- Trois cibles qui n'achètent pas la même chose :
-- - agency : agences web, digitales, de communication, studios : du renfort
--   sur leurs projets clients (elles achètent déjà du freelance) ;
-- - startup : startups et éditeurs de logiciels : du renfort sur leur produit ;
-- - smb : TPE/PME dont le métier n'est pas le numérique : un site, une
--   refonte, un outil interne.
-- Le segment est deviné (code d'activité, nom, présentation, taille) tant
-- que l'utilisateur ne l'a pas choisi lui-même.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Segment de chaque fiche
-- ---------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN segment TEXT CHECK (segment IN ('agency', 'startup', 'smb')),
  ADD COLUMN segment_set_by TEXT NOT NULL DEFAULT 'auto' CHECK (segment_set_by IN ('auto', 'manual'));

COMMENT ON COLUMN companies.segment IS 'agency (agence, studio), startup (startup, éditeur de logiciel), smb (TPE/PME hors numérique), NULL si inconnu';
COMMENT ON COLUMN companies.segment_set_by IS 'auto : deviné par infer_company_segment ; manual : choisi par l''utilisateur, jamais recalculé';

-- Les codes 62.02 (conseil en informatique) et 62.03 (gestion d'installations)
-- sont surtout des ESN : seuls le nom ou la présentation peuvent en faire une agence.
CREATE OR REPLACE FUNCTION infer_company_segment(
  p_kind TEXT,
  p_name TEXT,
  p_naf TEXT,
  p_notes TEXT,
  p_size TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  naf TEXT := NULLIF(NULLIF(trim(p_naf), ''), '00.00Z');
  words TEXT := lower(concat_ws(' ', p_name, p_notes));
BEGIN
  -- Une personne seule, ou un grand groupe : pas de segment deviné
  IF p_kind = 'individual' OR p_size IN ('eti', 'ge') THEN
    RETURN NULL;
  END IF;

  -- « agence » seul ne suffit pas : agence immobilière, de voyage, bancaire…
  IF words ~ '\magences? (web|digitales?|numériques?|de communication|de com|marketing|créatives?|de design|de création|de publicité|e-?commerce|seo)\M'
     OR words ~ '\magency\M'
     OR words ~ '\mstudio (web|digital|numérique|de (développement|design|création))\M'
     OR naf LIKE '73.1%'    -- publicité
     OR naf LIKE '74.1%'    -- design
     OR naf = '70.21Z'      -- communication et relations publiques
     OR naf = '62.01Z'      -- programmation informatique : agences web et studios de développement
     OR (naf IS NULL AND words ~ '\mstudio\M') THEN
    RETURN 'agency';
  END IF;

  IF words ~ '\m(saas|start-?up|scale-?up|éditeur de logiciels?|software)\M'
     OR naf LIKE '58.2%'    -- édition de logiciels
     OR naf LIKE '63.1%' THEN -- plateformes, hébergement, traitement de données
    RETURN 'startup';
  END IF;

  -- Conseil et services informatiques sans autre indice : souvent des ESN
  IF naf LIKE '62.%' THEN
    RETURN NULL;
  END IF;

  IF naf IS NOT NULL OR p_size IN ('solo', 'tpe', 'pme') THEN
    RETURN 'smb';
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION infer_company_segment IS 'Segment deviné d''une fiche : agency, startup, smb ou NULL';

CREATE OR REPLACE FUNCTION set_company_segment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.segment_set_by = 'auto' THEN
    NEW.segment := infer_company_segment(NEW.kind, NEW.name, NEW.naf_code, NEW.notes, NEW.size_category);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_company_segment_trigger
  BEFORE INSERT OR UPDATE OF kind, name, naf_code, notes, size_category, segment_set_by ON companies
  FOR EACH ROW EXECUTE FUNCTION set_company_segment();

UPDATE companies
   SET segment = infer_company_segment(kind, name, naf_code, notes, size_category)
 WHERE segment_set_by = 'auto';

CREATE INDEX idx_companies_segment ON companies(user_id, segment);

-- ---------------------------------------------------------------------
-- 2. Agence ou startup qui recrute un développeur
-- Pour une entreprise ordinaire, une offre de développeur veut dire « on monte
-- une équipe » (job_posting_dev). Pour une agence ou une startup, elle veut dire
-- « on a plus de travail que d'équipe » : un renfort freelance peut l'intéresser.
-- Sophie choisit l'un ou l'autre d'après le secteur de l'employeur.
-- ---------------------------------------------------------------------
INSERT INTO signal_types (key, label, description, default_ttl_days) VALUES
  ('dev_hiring_reinforcement', 'Agence ou startup qui recrute un développeur',
   'Elle a plus de travail que d''équipe : un renfort freelance peut l''intéresser', 45)
ON CONFLICT (key) DO NOTHING;

INSERT INTO profession_signals (profession_key, signal_type, default_weight) VALUES
  ('web_developer', 'dev_hiring_reinforcement', 30)
ON CONFLICT DO NOTHING;
