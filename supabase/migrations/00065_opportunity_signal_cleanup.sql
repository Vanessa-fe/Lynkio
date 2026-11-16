-- Signaux d'opportunité, étape 1 : nettoyage du catalogue (16/11/2026).
-- Le catalogue ne doit plus proposer que ce que Sophie sait réellement détecter.
--
-- signal_types.availability :
--   available    un détecteur du code (ou un trigger de la base) crée ce signal aujourd'hui
--   unavailable  aucune source fiable ne le produit encore ; affiché comme « indisponible », sans curseur
--   retired      sa source n'est plus utilisée (offres d'emploi France Travail, arrêtées le 13/11/2026) ;
--                masqué des réglages et ignoré par le score
--
-- Rien n'est supprimé : les types, les poids par défaut des métiers (profession_signals), les réglages
-- des utilisateurs (icp_profiles.signal_weights) et l'historique des signaux sont conservés.

ALTER TABLE signal_types
  ADD COLUMN availability TEXT NOT NULL DEFAULT 'unavailable'
    CHECK (availability IN ('available', 'unavailable', 'retired'));

COMMENT ON COLUMN signal_types.availability IS
  'available = détecté aujourd''hui ; unavailable = pas encore de source fiable (indisponible) ; retired = source arrêtée, ignoré par le score';

-- Détectés aujourd'hui
UPDATE signal_types SET availability = 'available'
 WHERE key IN (
   'recently_created',       -- BODACC (créations), source officielle
   'tech_stack_match',       -- technologies du site (trigger sync_tech_stack_signal)
   'website_http_observed'   -- diagnostic du site depuis la fiche (trigger sync_website_protocol_signal, 00059)
 );

-- Source arrêtée : offres d'emploi France Travail (réutilisation commerciale non permise)
UPDATE signal_types SET availability = 'retired', is_active = FALSE
 WHERE key IN (
   'job_posting_dev', 'job_posting_design', 'job_posting_digital', 'job_posting_marketing', 'job_posting_keyword',
   'consulting_hiring', 'dev_hiring_reinforcement', 'freelance_mission'
 );

-- Restent « indisponibles » (valeur par défaut) : linkedin_post_request (aucun code ne le crée),
-- no_website, outdated_website, slow_website, inactive_blog, funding_round, headcount_growth
-- (jamais implémentés). Ils redeviendront « available » avec un vrai détecteur.

-- ---------------------------------------------------------------------
-- Score : mêmes règles que 00058, sauf
--   - les signaux d'un type retiré ne comptent plus ;
--   - « signal d'achat » devient « signal d'opportunité » dans le détail.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_company_score_v2(p_company_id UUID)
RETURNS TABLE(icp_profile_id UUID, score SMALLINT, is_eliminated BOOLEAN, elimination_reason TEXT, factors JSONB, version TEXT)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  c companies%ROWTYPE;
  icp icp_profiles%ROWTYPE;
  strat prospect_strategies%ROWTYPE;
  has_strategy BOOLEAN := FALSE;
  profession TEXT;
  items JSONB := '[]'::jsonb;
  keyword TEXT;
  haystack TEXT;
  fit_earned NUMERIC := 0;
  fit_available NUMERIC := 0;
  fit_points INTEGER;
  signal_points NUMERIC := 0;
  fresh_points INTEGER := 0;
  reach_points INTEGER := 0;
  sig RECORD;
  points NUMERIC;
  factor NUMERIC;
  newest TIMESTAMPTZ;
  dept TEXT;
  age_years NUMERIC;
  age_range TEXT;
  size_label TEXT;
  in_list BOOLEAN;
  soft JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO c FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO icp
    FROM icp_profiles i
   WHERE i.user_id = c.user_id
     AND (i.id = c.icp_profile_id OR (c.icp_profile_id IS NULL AND i.is_active))
   ORDER BY (i.id = c.icp_profile_id) DESC NULLS LAST, i.created_at
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  profession := COALESCE(icp.profession_key, (SELECT up.profession_key FROM user_profiles up WHERE up.id = c.user_id));

  IF c.strategy_id IS NOT NULL THEN
    SELECT * INTO strat FROM prospect_strategies s WHERE s.id = c.strategy_id AND s.user_id = c.user_id;
    has_strategy := FOUND;
    IF has_strategy AND jsonb_typeof(strat.filters->'soft') = 'array' THEN
      soft := strat.filters->'soft';
    END IF;
  END IF;

  -- Exclusions ----------------------------------------------------------------
  IF jsonb_typeof(icp.criteria->'countries') = 'array'
     AND jsonb_array_length(icp.criteria->'countries') > 0
     AND NOT (icp.criteria->'countries' ? c.country) THEN
    RETURN QUERY SELECT icp.id, 0::smallint, TRUE, format('Pays hors cible (%s)', c.country),
      jsonb_build_array(jsonb_build_object('group', 'exclusion', 'code', 'eliminated:country',
        'label', format('Pays hors cible (%s)', c.country), 'points', 0, 'max', 0, 'kind', 'negative')),
      'rules-v2'::text;
    RETURN;
  END IF;
  haystack := lower(concat_ws(' ', c.name, c.sector, c.notes));
  FOR keyword IN
    SELECT lower(trim(value)) FROM jsonb_array_elements_text(COALESCE(icp.criteria->'exclude_keywords', '[]'::jsonb))
  LOOP
    IF keyword <> '' AND position(keyword IN haystack) > 0 THEN
      RETURN QUERY SELECT icp.id, 0::smallint, TRUE, format('Mot-clé exclu : %s', keyword),
        jsonb_build_array(jsonb_build_object('group', 'exclusion', 'code', 'eliminated:keyword',
          'label', format('Mot-clé exclu : %s', keyword), 'points', 0, 'max', 0, 'kind', 'negative')),
        'rules-v2'::text;
      RETURN;
    END IF;
  END LOOP;

  -- 1. Adéquation (fit) -------------------------------------------------------
  -- Secteur : codes NAF de la recherche qui a trouvé la fiche
  IF has_strategy AND c.naf_code IS NOT NULL AND jsonb_typeof(strat.filters->'naf_codes') = 'array' THEN
    fit_available := fit_available + 15;
    IF strat.filters->'naf_codes' ? c.naf_code THEN
      fit_earned := fit_earned + 15;
      items := items || jsonb_build_object('group', 'fit', 'code', 'fit:sector', 'label', 'Secteur recherché', 'points', 15, 'max', 15, 'kind', 'positive');
    ELSE
      items := items || jsonb_build_object('group', 'fit', 'code', 'fit:sector', 'label', 'Secteur hors de votre recherche', 'points', 0, 'max', 15, 'kind', 'negative');
    END IF;
  ELSE
    items := items || jsonb_build_object('group', 'fit', 'code', 'fit:sector', 'label', 'Secteur : non comparé (pas de recherche ou code d’activité inconnu)', 'points', 0, 'max', 15, 'kind', 'unavailable');
  END IF;

  -- Taille : client idéal (idéale / acceptée), à défaut tailles de la recherche
  IF c.size_category IS NOT NULL THEN
    size_label := CASE c.size_category
      WHEN 'solo' THEN 'indépendant' WHEN 'tpe' THEN 'TPE' WHEN 'pme' THEN 'PME'
      WHEN 'eti' THEN 'ETI' WHEN 'ge' THEN 'grande entreprise' ELSE c.size_category END;
    fit_available := fit_available + 15;
    IF COALESCE(icp.criteria->'size_categories'->'preferred', '[]'::jsonb) ? c.size_category THEN
      fit_earned := fit_earned + 15;
      items := items || jsonb_build_object('group', 'fit', 'code', 'fit:size', 'label', format('Taille idéale (%s)', size_label), 'points', 15, 'max', 15, 'kind', 'positive');
    ELSIF COALESCE(icp.criteria->'size_categories'->'accepted', '[]'::jsonb) ? c.size_category
       OR (has_strategy AND COALESCE(strat.filters->'sizes', '[]'::jsonb) ? c.size_category) THEN
      fit_earned := fit_earned + 8;
      items := items || jsonb_build_object('group', 'fit', 'code', 'fit:size', 'label', format('Taille acceptée (%s)', size_label), 'points', 8, 'max', 15, 'kind', 'positive');
    ELSIF soft ? 'sizes' THEN
      -- Taille souple : une autre taille garde quelques points
      fit_earned := fit_earned + 4;
      items := items || jsonb_build_object('group', 'fit', 'code', 'fit:size', 'label', format('Taille proche (%s, critère souple)', size_label), 'points', 4, 'max', 15, 'kind', 'positive');
    ELSE
      items := items || jsonb_build_object('group', 'fit', 'code', 'fit:size', 'label', format('Taille hors cible (%s)', size_label), 'points', 0, 'max', 15, 'kind', 'negative');
    END IF;
  ELSE
    items := items || jsonb_build_object('group', 'fit', 'code', 'fit:size', 'label', 'Taille inconnue', 'points', 0, 'max', 15, 'kind', 'unavailable');
  END IF;

  -- Zone : département du siège parmi ceux de la recherche
  dept := CASE
    WHEN c.postal_code IS NULL OR c.postal_code !~ '^\d{5}$' THEN NULL
    WHEN left(c.postal_code, 2) IN ('97', '98') THEN left(c.postal_code, 3)
    WHEN left(c.postal_code, 2) = '20' THEN CASE WHEN c.postal_code::int < 20200 THEN '2A' ELSE '2B' END
    ELSE left(c.postal_code, 2) END;
  IF has_strategy AND dept IS NOT NULL AND jsonb_typeof(strat.filters->'departments') = 'array'
     AND jsonb_array_length(strat.filters->'departments') > 0 THEN
    fit_available := fit_available + 10;
    IF strat.filters->'departments' ? dept THEN
      fit_earned := fit_earned + 10;
      items := items || jsonb_build_object('group', 'fit', 'code', 'fit:zone', 'label', format('Dans votre zone (%s)', dept), 'points', 10, 'max', 10, 'kind', 'positive');
    ELSIF soft ? 'departments' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(strat.filters->'departments') d(code)
       WHERE public.department_region(d.code) = public.department_region(dept)
    ) THEN
      -- Zone souple : même région qu'un département choisi
      fit_earned := fit_earned + 5;
      items := items || jsonb_build_object('group', 'fit', 'code', 'fit:zone', 'label', format('Dans votre région (%s, zone souple)', dept), 'points', 5, 'max', 10, 'kind', 'positive');
    ELSE
      items := items || jsonb_build_object('group', 'fit', 'code', 'fit:zone', 'label', format('Hors de votre zone (%s)', dept), 'points', 0, 'max', 10, 'kind', 'negative');
    END IF;
  ELSE
    items := items || jsonb_build_object('group', 'fit', 'code', 'fit:zone', 'label', 'Zone : non comparée', 'points', 0, 'max', 10, 'kind', 'unavailable');
  END IF;

  -- Ancienneté : seulement si la recherche en a choisi une
  IF has_strategy AND jsonb_typeof(strat.filters->'ages') = 'array' AND jsonb_array_length(strat.filters->'ages') > 0 THEN
    IF c.founded_on IS NOT NULL THEN
      age_years := EXTRACT(EPOCH FROM (now() - c.founded_on::timestamptz)) / (365.25 * 86400);
      age_range := CASE WHEN age_years < 2 THEN 'new' WHEN age_years < 10 THEN 'established' ELSE 'old' END;
      fit_available := fit_available + 10;
      IF strat.filters->'ages' ? age_range THEN
        fit_earned := fit_earned + 10;
        items := items || jsonb_build_object('group', 'fit', 'code', 'fit:age', 'label', 'Ancienneté recherchée', 'points', 10, 'max', 10, 'kind', 'positive');
      ELSE
        items := items || jsonb_build_object('group', 'fit', 'code', 'fit:age',
          'label', CASE WHEN soft ? 'ages' THEN 'Autre ancienneté (critère souple)' ELSE 'Ancienneté hors de votre choix' END,
          'points', 0, 'max', 10, 'kind', 'negative');
      END IF;
    ELSE
      items := items || jsonb_build_object('group', 'fit', 'code', 'fit:age', 'label', 'Date de création inconnue', 'points', 0, 'max', 10, 'kind', 'unavailable');
    END IF;
  END IF;

  fit_points := CASE WHEN fit_available > 0 THEN round(50 * fit_earned / fit_available) ELSE 25 END;

  -- 2. Signaux ----------------------------------------------------------------
  FOR sig IN
    SELECT s.signal_type,
           st.label,
           count(*) AS n,
           max(COALESCE((to_jsonb(s)->>'event_at')::timestamptz, s.detected_at)) AS last_at,
           COALESCE(to_jsonb(st)->>'reliability', 'medium') AS reliability,
           COALESCE((icp.signal_weights->>s.signal_type)::int, ps.default_weight, 0) AS weight
      FROM company_signals s
      JOIN signal_types st ON st.key = s.signal_type
      LEFT JOIN profession_signals ps ON ps.signal_type = s.signal_type AND ps.profession_key = profession
     WHERE s.company_id = c.id
       AND (s.expires_at IS NULL OR s.expires_at > now())
       -- Source arrêtée (00065) : ces signaux ne comptent plus
       AND COALESCE(to_jsonb(st)->>'availability', 'available') <> 'retired'
     GROUP BY s.signal_type, st.key, ps.default_weight
     ORDER BY 6 DESC
  LOOP
    newest := GREATEST(newest, sig.last_at);
    IF sig.weight > 0 THEN
      factor := CASE sig.reliability WHEN 'high' THEN 1 WHEN 'low' THEN 0.5 ELSE 0.8 END;
      points := round(sig.weight * factor + LEAST((sig.n - 1) * 5, 10));
      signal_points := signal_points + points;
      items := items || jsonb_build_object('group', 'signals', 'code', 'signal:' || sig.signal_type,
        'label', sig.label || CASE WHEN sig.n > 1 THEN format(' (%s)', sig.n) ELSE '' END
          || CASE sig.reliability WHEN 'high' THEN ' · source officielle' WHEN 'low' THEN ' · déduit' ELSE '' END,
        'points', points, 'max', 35, 'kind', 'positive');
    END IF;
  END LOOP;
  IF signal_points = 0 THEN
    items := items || jsonb_build_object('group', 'signals', 'code', 'signals:none', 'label', 'Aucun signal d’opportunité observé', 'points', 0, 'max', 35, 'kind', 'unavailable');
  END IF;
  signal_points := LEAST(signal_points, 35);

  -- 3. Fraîcheur --------------------------------------------------------------
  IF newest IS NOT NULL THEN
    fresh_points := CASE
      WHEN newest > now() - INTERVAL '7 days' THEN 10
      WHEN newest > now() - INTERVAL '30 days' THEN 5
      WHEN newest > now() - INTERVAL '90 days' THEN 2
      ELSE 0 END;
    items := items || jsonb_build_object('group', 'freshness', 'code', 'freshness',
      'label', CASE fresh_points WHEN 10 THEN 'Signal de moins de 7 jours' WHEN 5 THEN 'Signal de moins d’un mois'
        WHEN 2 THEN 'Signal de moins de 3 mois' ELSE 'Signaux anciens (plus de 3 mois)' END,
      'points', fresh_points, 'max', 10, 'kind', CASE WHEN fresh_points > 0 THEN 'positive' ELSE 'negative' END);
  END IF;

  -- 4. Joignabilité -----------------------------------------------------------
  IF EXISTS (SELECT 1 FROM company_contacts cc WHERE cc.company_id = c.id AND cc.is_decision_maker AND cc.opted_out_at IS NULL) THEN
    reach_points := reach_points + 2;
    items := items || jsonb_build_object('group', 'reach', 'code', 'reach:decision_maker', 'label', 'Décideur identifié', 'points', 2, 'max', 2, 'kind', 'positive');
  END IF;
  IF EXISTS (SELECT 1 FROM company_contacts cc WHERE cc.company_id = c.id AND cc.email IS NOT NULL AND cc.opted_out_at IS NULL) THEN
    reach_points := reach_points + 2;
    items := items || jsonb_build_object('group', 'reach', 'code', 'reach:email', 'label', 'E-mail de contact', 'points', 2, 'max', 2, 'kind', 'positive');
  END IF;
  IF c.website IS NOT NULL THEN
    reach_points := reach_points + 1;
    items := items || jsonb_build_object('group', 'reach', 'code', 'reach:website', 'label', 'Site web connu', 'points', 1, 'max', 1, 'kind', 'positive');
  END IF;

  items := items || jsonb_build_object('group', 'fit', 'code', 'fit:total',
    'label', format('Adéquation : %s sur 50 (sur les critères connus)', fit_points), 'points', fit_points, 'max', 50, 'kind', 'summary');

  RETURN QUERY SELECT icp.id,
    GREATEST(0, LEAST(100, fit_points + signal_points::int + fresh_points + reach_points))::smallint,
    FALSE, NULL::text, items, 'rules-v2'::text;
END;
$$;


COMMENT ON FUNCTION public.compute_company_score_v2 IS 'Score explicable v2 : adéquation 50 (critères souples = points partiels), signaux d''opportunité 35 (types retirés ignorés), fraîcheur 10, joignabilité 5';

-- Recalcul : seules les fiches dont le détail change reçoivent une nouvelle ligne (score_company)
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  FOR v_company_id IN SELECT id FROM companies LOOP
    PERFORM score_company(v_company_id);
  END LOOP;
END;
$$;
