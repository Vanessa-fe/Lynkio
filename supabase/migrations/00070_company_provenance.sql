-- =====================================================================
-- PROVENANCE DES ENTREPRISES TROUVÉES (lot 1.3 de la refonte)
-- - discovered_by : la source qui a trouvé l'entreprise, pour distinguer
--   les sources officielles (registre, BODACC) de l'analyse par IA
--   (recherche par technologie). Vide pour une saisie ou un import.
-- - pipeline_run_id : le passage de recherche qui l'a ajoutée, pour
--   « Voir les entreprises » à la fin d'une recherche.
-- Ajout seulement : aucune donnée existante n'est modifiée en dehors de
-- ces deux nouvelles colonnes.
-- =====================================================================

ALTER TABLE companies
  ADD COLUMN discovered_by TEXT
    CHECK (discovered_by IN ('registry', 'bodacc', 'tech_ai', 'job_postings')),
  ADD COLUMN pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL;

COMMENT ON COLUMN companies.discovered_by IS
  'Source qui a trouvé l''entreprise : registry (registre officiel, recherches enregistrées), bodacc (créations récentes), tech_ai (recherche par technologie, faite par l''IA de l''utilisateur), job_postings (offres d''emploi, retirées le 13/11/2026). Vide : saisie, import, ou source non enregistrée';
COMMENT ON COLUMN companies.pipeline_run_id IS 'Passage de recherche (pipeline_runs) qui a ajouté l''entreprise';

CREATE INDEX idx_companies_pipeline_run ON companies(user_id, pipeline_run_id) WHERE pipeline_run_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Rattrapage des entreprises déjà trouvées
-- ---------------------------------------------------------------------
-- Recherches enregistrées : registre officiel
UPDATE companies
   SET discovered_by = 'registry'
 WHERE origin = 'detector' AND strategy_id IS NOT NULL;

-- Créations récentes : signal posé par le détecteur BODACC
UPDATE companies c
   SET discovered_by = 'bodacc'
 WHERE c.origin = 'detector' AND c.discovered_by IS NULL
   AND EXISTS (
     SELECT 1 FROM company_signals s
      WHERE s.company_id = c.id AND s.signal_type = 'recently_created' AND s.source = 'bodacc'
   );

-- Recherche par technologie : signal « stack compatible » posé à la création
UPDATE companies c
   SET discovered_by = 'tech_ai'
 WHERE c.origin = 'detector' AND c.discovered_by IS NULL
   AND EXISTS (
     SELECT 1 FROM company_signals s
      WHERE s.company_id = c.id AND s.signal_type = 'tech_stack_match'
   );

-- Passage d'origine, d'après la liste des entreprises créées que garde chaque passage
UPDATE companies c
   SET pipeline_run_id = r.id
  FROM pipeline_runs r,
       jsonb_array_elements(CASE WHEN jsonb_typeof(r.details -> 'created') = 'array' THEN r.details -> 'created' ELSE '[]'::jsonb END) AS created
 WHERE c.pipeline_run_id IS NULL
   AND c.user_id = r.user_id
   AND created ->> 'id' = c.id::text;
