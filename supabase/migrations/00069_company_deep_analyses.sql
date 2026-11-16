-- Signaux d'opportunité, étape 5 : « Approfondir avec Sophie » (16/11/2026).
--
-- Sur une fiche, à la demande, l'IA de l'utilisateur cherche sur Internet les événements publics de
-- l'entreprise liés à ses prestations (fonction company-deep-dive). Chaque résultat retenu devient un
-- signal prouvé : source réellement consultée, date de l'événement, identité de l'entreprise vérifiée.

-- ---------------------------------------------------------------------
-- 1. Types de signaux trouvés par l'analyse approfondie
--    (mêmes clés que OPPORTUNITY_EVENTS, _shared/signal-capabilities.ts ; levée de fonds existait déjà)
-- ---------------------------------------------------------------------
INSERT INTO signal_types (key, label, description, default_ttl_days, category, nature, reliability, retention_days, availability)
VALUES
  ('new_establishment', 'Ouverture d’un établissement', 'Nouveau lieu, boutique, restaurant, agence ou site annoncé publiquement', 180, 'news', 'observed', 'medium', 365, 'available'),
  ('product_launch', 'Lancement d’un produit ou d’une offre', 'Nouveau produit, nouvelle gamme, nouveau service ou nouvelle plateforme annoncés', 180, 'news', 'observed', 'medium', 365, 'available'),
  ('rebranding', 'Nouvelle marque ou nouvelle identité', 'Changement de nom, de logo ou d’identité visuelle annoncé', 180, 'news', 'observed', 'medium', 365, 'available'),
  ('project_announced', 'Nouveau projet annoncé', 'Projet public précis : chantier, programme, partenariat, appel à projets remporté', 180, 'news', 'observed', 'medium', 365, 'available'),
  ('expansion', 'Développement annoncé', 'Nouveaux marchés, export ou croissance d’équipe annoncés publiquement', 180, 'news', 'observed', 'medium', 365, 'available'),
  ('digital_transformation', 'Transformation numérique annoncée', 'Modernisation d’outils, de processus ou d’applications annoncée', 180, 'news', 'observed', 'medium', 365, 'available'),
  ('software_change', 'Changement de logiciel annoncé', 'Déploiement ou remplacement d’un logiciel métier, d’un ERP ou d’un CRM annoncé', 180, 'news', 'observed', 'medium', 365, 'available'),
  ('event_or_campaign', 'Événement ou campagne annoncés', 'Salon, événement ou campagne de communication annoncés', 120, 'news', 'observed', 'medium', 365, 'available'),
  ('reorganisation', 'Réorganisation ou déménagement annoncés', 'Fusion, rachat, réorganisation, déménagement ou nouveaux locaux annoncés', 180, 'news', 'observed', 'medium', 365, 'available')
ON CONFLICT (key) DO NOTHING;

UPDATE signal_types
   SET availability = 'available', category = 'news', nature = 'observed', reliability = 'medium',
       default_ttl_days = 180, retention_days = 365,
       description = 'Financement annoncé publiquement'
 WHERE key = 'funding_round';

-- ---------------------------------------------------------------------
-- 2. Analyses approfondies : une par lancement, gardées 30 jours comme cache
-- ---------------------------------------------------------------------
CREATE TABLE company_deep_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  provider TEXT CHECK (provider IN ('openai', 'gemini', 'anthropic')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  -- Résultat filtré (DeepDiveResult) : identité, résumé, résultats retenus ou écartés avec leur raison
  result JSONB CHECK (result IS NULL OR jsonb_typeof(result) = 'object'),
  error TEXT CHECK (error IS NULL OR length(error) <= 500),
  signals_added INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (company_id, user_id) REFERENCES companies(id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE company_deep_analyses IS
  '« Approfondir avec Sophie » : recherche web de l''IA de l''utilisateur sur une entreprise (fonction company-deep-dive). Une seule en cours par entreprise ; le résultat sert de cache 30 jours';

CREATE INDEX idx_company_deep_analyses_company ON company_deep_analyses (company_id, started_at DESC);
CREATE INDEX idx_company_deep_analyses_user ON company_deep_analyses (user_id);
-- Jamais deux analyses en même temps sur la même entreprise
CREATE UNIQUE INDEX company_deep_analyses_one_running ON company_deep_analyses (company_id) WHERE status = 'running';

ALTER TABLE company_deep_analyses ENABLE ROW LEVEL SECURITY;

-- L'utilisateur lit les siennes ; la fonction (clé de service) les crée et les termine
CREATE POLICY "Users can view their own rows" ON company_deep_analyses
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

-- Purge : les analyses de plus de 180 jours (les signaux qu'elles ont créés suivent leur propre durée)
SELECT cron.schedule(
  'deep-analyses-retention',
  '25 3 * * *',
  $$DELETE FROM public.company_deep_analyses WHERE started_at < now() - interval '180 days'$$
);

-- ---------------------------------------------------------------------
-- 3. Score : un signal approfondi absent est expliqué
--    « non, d'après l'analyse approfondie du … » si une analyse a abouti depuis moins de 30 jours,
--    « non évalué : lancez « Approfondir avec Sophie » » sinon. Les points ne changent pas.
-- ---------------------------------------------------------------------
DO $migration$
DECLARE
  definition TEXT := pg_get_functiondef('public.compute_company_score_v2(uuid)'::regprocedure);
  old_branch CONSTANT TEXT := $old$    ELSE
      items := items || jsonb_build_object('group', 'signals', 'code', 'unchecked:' || sig.key,
        'label', format('%s : non évalué', sig.label),
        'points', 0, 'max', 0, 'kind', 'unavailable');
    END IF;$old$;
  new_branch CONSTANT TEXT := $new$    ELSIF deep_checked_at IS NOT NULL THEN
      items := items || jsonb_build_object('group', 'signals', 'code', 'checked:' || sig.key,
        'label', format('%s : non, d’après l’analyse approfondie du %s', sig.label, to_char(deep_checked_at, 'DD/MM/YYYY')),
        'points', 0, 'max', 0, 'kind', 'negative');
    ELSE
      items := items || jsonb_build_object('group', 'signals', 'code', 'unchecked:' || sig.key,
        'label', format('%s : non évalué (lancez « Approfondir avec Sophie »)', sig.label),
        'points', 0, 'max', 0, 'kind', 'unavailable');
    END IF;$new$;
  old_declare CONSTANT TEXT := E'  is_aging BOOLEAN;\n';
  new_declare CONSTANT TEXT := E'  is_aging BOOLEAN;\n  deep_checked_at TIMESTAMPTZ;\n';
  old_loop CONSTANT TEXT := '  -- Signaux actifs (points > 0) non trouvés : évalués et absents, ou pas encore évalués';
  new_loop CONSTANT TEXT := '  -- Dernière analyse approfondie aboutie (moins de 30 jours) : ses absences sont des « non »
  SELECT max(a.finished_at) INTO deep_checked_at
    FROM company_deep_analyses a
   WHERE a.company_id = c.id AND a.status = ''done'' AND a.started_at > now() - INTERVAL ''30 days'';

  -- Signaux actifs (points > 0) non trouvés : évalués et absents, ou pas encore évalués';
BEGIN
  IF position(old_branch IN definition) = 0 OR position(old_declare IN definition) = 0 OR position(old_loop IN definition) = 0 THEN
    RAISE EXCEPTION 'compute_company_score_v2 : ancres introuvables, migration à revoir';
  END IF;
  definition := replace(definition, old_branch, new_branch);
  definition := replace(definition, old_declare, new_declare);
  definition := replace(definition, old_loop, new_loop);
  EXECUTE definition;
END;
$migration$;

-- Analyse terminée : le score de la fiche est recalculé (ses explications changent même sans signal)
CREATE OR REPLACE FUNCTION rescore_company_after_deep_analysis()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    PERFORM score_company(NEW.company_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER rescore_after_deep_analysis
  AFTER UPDATE OF status ON company_deep_analyses
  FOR EACH ROW EXECUTE FUNCTION rescore_company_after_deep_analysis();

-- Les fiches qui ont des signaux approfondis actifs à expliquer (aucun point ne change)
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  FOR v_company_id IN SELECT id FROM companies LOOP
    PERFORM score_company(v_company_id);
  END LOOP;
END;
$$;
