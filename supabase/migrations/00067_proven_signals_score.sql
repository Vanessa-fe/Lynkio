-- Signaux d'opportunité, étape 4 : un score qui ne compte que des faits prouvés (16/11/2026).
--
-- Mêmes groupes et mêmes plafonds que la v2 (adéquation 50, signaux 35, fraîcheur 10, joignabilité 5),
-- validés le 12/11/2026 : peu de fiches ont encore un signal, passer à 40/60 écraserait les scores sans
-- raison. Ce qui change dans le groupe « signaux » :
--   1. Aucun point sans preuve : source officielle (BODACC, registre) ou adresse de la page qui le montre.
--      Un signal sans preuve reste affiché (« sans preuve vérifiable : aucun point »).
--   2. Une hypothèse (signal_types.nature) ne rapporte que la moitié de ses points.
--   3. Un signal dans la seconde moitié de sa durée de validité ne rapporte que la moitié de ses points.
--   4. Un signal écarté par l'utilisateur (« Ce signal est faux ») ne compte plus ; le score est
--      recalculé aussitôt (trigger rescore_on_signal_change, déjà en place).
--   5. Chaque signal actif non trouvé est expliqué : « non » quand il a été vérifié (date de création,
--      site analysé), « non évalué » sinon.
-- Les doublons restent impossibles (dedupe_key unique) et plusieurs signaux du même type ajoutent
-- toujours +5 chacun, 10 au plus. Le nom du modèle reste « rules-v2 » (mêmes groupes).

-- ---------------------------------------------------------------------
-- 1. Signal écarté par l'utilisateur
-- ---------------------------------------------------------------------
ALTER TABLE company_signals ADD COLUMN invalidated_at TIMESTAMPTZ;

COMMENT ON COLUMN company_signals.invalidated_at IS
  'Écarté par l''utilisateur (« Ce signal est faux ») : ne compte plus dans le score ; NULL pour le rétablir';

-- ---------------------------------------------------------------------
-- 2. Preuve du signal « stack compatible » : l'adresse du site analysé
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_tech_stack_signal(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c companies%ROWTYPE;
  wanted TEXT[];
  matched TEXT[];
  ttl INTEGER;
  detected TIMESTAMPTZ;
  page TEXT;
BEGIN
  SELECT * INTO c FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Même ICP que pour le score : celui de l'entreprise, sinon le premier actif
  SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(i.criteria->'tech_stack', '[]'::jsonb)))
    INTO wanted
    FROM icp_profiles i
   WHERE i.user_id = c.user_id
     AND (i.id = c.icp_profile_id OR (c.icp_profile_id IS NULL AND i.is_active))
   ORDER BY (i.id = c.icp_profile_id) DESC NULLS LAST, i.created_at
   LIMIT 1;

  matched := ARRAY(
    SELECT unnest(c.detected_stack)
    INTERSECT
    SELECT unnest(COALESCE(wanted, '{}'::text[]))
  );

  IF cardinality(matched) = 0 THEN
    DELETE FROM company_signals WHERE company_id = c.id AND signal_type = 'tech_stack_match';
    RETURN;
  END IF;

  SELECT default_ttl_days INTO ttl FROM signal_types WHERE key = 'tech_stack_match';
  detected := COALESCE(c.stack_detected_at, NOW());
  -- La page analysée est la page d'accueil du site enregistré sur la fiche
  page := CASE
    WHEN c.website IS NULL THEN NULL
    WHEN c.website ~* '^https?://' THEN c.website
    ELSE 'https://' || c.website END;

  INSERT INTO company_signals (user_id, company_id, signal_type, dedupe_key, source_url, evidence, detected_at, expires_at)
  VALUES (
    c.user_id,
    c.id,
    'tech_stack_match',
    'site',
    page,
    jsonb_build_object('source', 'site', 'technologies', to_jsonb(matched), 'stack_detectee', to_jsonb(c.detected_stack)),
    detected,
    CASE WHEN ttl IS NOT NULL THEN detected + make_interval(days => ttl) END
  )
  ON CONFLICT (company_id, signal_type, dedupe_key) DO UPDATE
    SET source_url = EXCLUDED.source_url,
        evidence = EXCLUDED.evidence,
        detected_at = EXCLUDED.detected_at,
        expires_at = EXCLUDED.expires_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_tech_stack_signal(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sync_tech_stack_signal(UUID) TO authenticated, service_role;

-- Rattrapage : les signaux déjà créés reçoivent l'adresse du site analysé
UPDATE company_signals s
   SET source_url = CASE WHEN c.website ~* '^https?://' THEN c.website ELSE 'https://' || c.website END
  FROM companies c
 WHERE c.id = s.company_id
   AND s.signal_type = 'tech_stack_match'
   AND s.source_url IS NULL
   AND c.website IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. Score
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
  found_types TEXT[] := '{}';
  unproven INTEGER := 0;
  is_hypothesis BOOLEAN;
  is_aging BOOLEAN;
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

  -- 2. Signaux d'opportunité ---------------------------------------------------
  -- Points d'un signal : réglage manuel, sinon recommandation de Sophie, sinon défaut du métier.
  -- Ne comptent que les signaux valides (non expirés, non écartés par l'utilisateur, type non retiré)
  -- ET prouvés : source officielle (BODACC, registre) ou adresse de la page qui le montre.
  -- Points = poids × fiabilité (officielle 1, publique 0,8, déduite 0,5)
  --          × nature (hypothèse : 0,5) × ancienneté (seconde moitié de sa durée de validité : 0,5)
  --          + 5 par signal du même type en plus (10 au plus). Total des signaux plafonné à 35.
  FOR sig IN
    SELECT s.signal_type,
           st.label,
           count(*) AS n,
           max(COALESCE((to_jsonb(s)->>'event_at')::timestamptz, s.detected_at)) AS last_at,
           COALESCE(to_jsonb(st)->>'reliability', 'medium') AS reliability,
           COALESCE(to_jsonb(st)->>'nature', 'observed') AS nature,
           st.default_ttl_days AS ttl,
           COALESCE((icp.signal_weights->>s.signal_type)::int,
                    (to_jsonb(icp)->'signal_recommendations'->'weights'->>s.signal_type)::int,
                    ps.default_weight, 0) AS weight
      FROM company_signals s
      JOIN signal_types st ON st.key = s.signal_type
      LEFT JOIN profession_signals ps ON ps.signal_type = s.signal_type AND ps.profession_key = profession
     WHERE s.company_id = c.id
       AND (s.expires_at IS NULL OR s.expires_at > now())
       AND s.invalidated_at IS NULL
       AND COALESCE(to_jsonb(st)->>'availability', 'available') <> 'retired'
       AND (s.source IN ('bodacc', 'registry') OR s.source_url IS NOT NULL)
     GROUP BY s.signal_type, st.key, ps.default_weight
     ORDER BY 8 DESC
  LOOP
    newest := GREATEST(newest, sig.last_at);
    found_types := found_types || sig.signal_type;
    IF sig.weight > 0 THEN
      factor := CASE sig.reliability WHEN 'high' THEN 1 WHEN 'low' THEN 0.5 ELSE 0.8 END;
      is_hypothesis := sig.nature = 'hypothesis';
      is_aging := sig.ttl IS NOT NULL AND sig.last_at < now() - make_interval(days => sig.ttl / 2);
      IF is_hypothesis THEN factor := factor * 0.5; END IF;
      IF is_aging THEN factor := factor * 0.5; END IF;
      points := round(sig.weight * factor + LEAST((sig.n - 1) * 5, 10));
      signal_points := signal_points + points;
      items := items || jsonb_build_object('group', 'signals', 'code', 'signal:' || sig.signal_type,
        'label', sig.label || CASE WHEN sig.n > 1 THEN format(' (%s)', sig.n) ELSE '' END
          || CASE sig.reliability WHEN 'high' THEN ' · source officielle' WHEN 'low' THEN ' · déduit' ELSE '' END
          || CASE WHEN is_hypothesis THEN ' · hypothèse, moitié des points' ELSE '' END
          || CASE WHEN is_aging THEN ' · ancien, moitié des points' ELSE '' END,
        'points', points, 'max', 35, 'kind', 'positive');
    END IF;
  END LOOP;

  -- Signaux valides mais sans preuve vérifiable : montrés, sans points
  SELECT count(*) INTO unproven
    FROM company_signals s
    JOIN signal_types st ON st.key = s.signal_type
   WHERE s.company_id = c.id
     AND (s.expires_at IS NULL OR s.expires_at > now())
     AND s.invalidated_at IS NULL
     AND COALESCE(to_jsonb(st)->>'availability', 'available') <> 'retired'
     AND NOT (s.source IN ('bodacc', 'registry') OR s.source_url IS NOT NULL);
  IF unproven > 0 THEN
    items := items || jsonb_build_object('group', 'signals', 'code', 'signals:unproven',
      'label', format('%s signal%s sans preuve vérifiable : aucun point', unproven, CASE WHEN unproven > 1 THEN 's' ELSE '' END),
      'points', 0, 'max', 0, 'kind', 'unavailable');
  END IF;

  -- Signaux actifs (points > 0) non trouvés : évalués et absents, ou pas encore évalués
  FOR sig IN
    SELECT st.key, st.label,
           COALESCE((icp.signal_weights->>st.key)::int,
                    (to_jsonb(icp)->'signal_recommendations'->'weights'->>st.key)::int,
                    ps.default_weight, 0) AS weight
      FROM signal_types st
      LEFT JOIN profession_signals ps ON ps.signal_type = st.key AND ps.profession_key = profession
     WHERE st.is_active
       AND COALESCE(to_jsonb(st)->>'availability', 'available') = 'available'
     ORDER BY st.label
  LOOP
    CONTINUE WHEN sig.weight <= 0 OR sig.key = ANY (found_types);
    IF sig.key = 'recently_created' THEN
      IF c.founded_on IS NOT NULL AND c.founded_on < (now() - INTERVAL '1 year')::date THEN
        items := items || jsonb_build_object('group', 'signals', 'code', 'checked:' || sig.key,
          'label', format('%s : non, créée en %s', sig.label, extract(year FROM c.founded_on)),
          'points', 0, 'max', 0, 'kind', 'negative');
      ELSE
        items := items || jsonb_build_object('group', 'signals', 'code', 'unchecked:' || sig.key,
          'label', format('%s : non vérifié (date de création inconnue)', sig.label),
          'points', 0, 'max', 0, 'kind', 'unavailable');
      END IF;
    ELSIF sig.key IN ('tech_stack_match', 'website_http_observed') THEN
      IF c.website IS NULL THEN
        items := items || jsonb_build_object('group', 'signals', 'code', 'unchecked:' || sig.key,
          'label', format('%s : non évalué, pas de site connu', sig.label),
          'points', 0, 'max', 0, 'kind', 'unavailable');
      ELSIF (sig.key = 'tech_stack_match' AND c.stack_detected_at IS NULL)
         OR (sig.key = 'website_http_observed' AND to_jsonb(c)->>'website_audited_at' IS NULL) THEN
        items := items || jsonb_build_object('group', 'signals', 'code', 'unchecked:' || sig.key,
          'label', format('%s : non évalué, site pas encore analysé', sig.label),
          'points', 0, 'max', 0, 'kind', 'unavailable');
      ELSE
        items := items || jsonb_build_object('group', 'signals', 'code', 'checked:' || sig.key,
          'label', format('%s : non, d’après l’analyse du site', sig.label),
          'points', 0, 'max', 0, 'kind', 'negative');
      END IF;
    ELSE
      items := items || jsonb_build_object('group', 'signals', 'code', 'unchecked:' || sig.key,
        'label', format('%s : non évalué', sig.label),
        'points', 0, 'max', 0, 'kind', 'unavailable');
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


COMMENT ON FUNCTION public.compute_company_score_v2 IS 'Score explicable : adéquation 50 (critères souples = points partiels), signaux d''opportunité 35 (prouvés seulement ; poids manuel, sinon Sophie, sinon métier ; hypothèse et signal ancien à moitié ; écartés et retirés ignorés ; absents expliqués), fraîcheur 10, joignabilité 5';

-- Recalcul de toutes les fiches (une ligne d'historique seulement si le détail change)
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  FOR v_company_id IN SELECT id FROM companies LOOP
    PERFORM score_company(v_company_id);
  END LOOP;
END;
$$;
