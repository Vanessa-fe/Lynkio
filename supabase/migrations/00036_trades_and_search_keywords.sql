-- Filonea pour tous les freelances : chacun choisit ses mots-clés de recherche, et Sophie cherche
-- les offres d'emploi France Travail dont l'intitulé les contient. Chaque métier propose des
-- suggestions de mots-clés ; « Autre métier » permet d'écrire les siens.
--
-- Les mots-clés de l'utilisateur sont rangés dans icp_profiles.criteria.search_keywords.
-- Le développement web garde en plus sa recherche par codes de métier (ROME).

ALTER TABLE professions
  ADD COLUMN suggested_keywords TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN professions.suggested_keywords IS 'Mots-clés de recherche proposés à l''onboarding et dans Client idéal (intitulés de poste)';

INSERT INTO signal_types (key, label, description, default_ttl_days) VALUES
  ('job_posting_keyword', 'Recrute sur l''un de vos mots-clés', 'Offre d''emploi dont l''intitulé contient l''un de vos mots-clés de recherche', 45)
ON CONFLICT (key) DO NOTHING;

-- Métiers existants
UPDATE professions SET
  description = 'Sites, applications web et e-commerce',
  suggested_keywords = ARRAY['développeur web', 'développeur front-end', 'développeur full stack', 'développeur React',
    'développeur PHP', 'développeur WordPress', 'intégrateur web', 'développeur mobile']
WHERE key = 'web_developer';

UPDATE professions SET
  is_active = true,
  description = 'Identité visuelle, print, web design, UI/UX',
  suggested_keywords = ARRAY['graphiste', 'designer graphique', 'directeur artistique', 'webdesigner', 'UI designer',
    'UX designer', 'illustrateur', 'maquettiste'],
  default_icp = default_icp || jsonb_build_object('search_keywords', jsonb_build_array('graphiste', 'designer graphique', 'webdesigner', 'UI designer'))
WHERE key = 'designer';

UPDATE professions SET
  is_active = true,
  description = 'Contenus, rédaction web, référencement, traduction',
  suggested_keywords = ARRAY['rédacteur web', 'concepteur rédacteur', 'content manager', 'chargé de contenu', 'SEO',
    'référenceur', 'traducteur', 'correcteur'],
  default_icp = default_icp || jsonb_build_object('search_keywords', jsonb_build_array('rédacteur web', 'concepteur rédacteur', 'content manager', 'SEO'))
WHERE key = 'copywriter_seo';

UPDATE professions SET
  is_active = true,
  label = 'Autre métier',
  description = 'Écrivez vos propres mots-clés'
WHERE key = 'other';

-- Nouveaux métiers
INSERT INTO professions (key, label, description, target_roles, default_icp, suggested_keywords, "order", is_active) VALUES
  ('marketing_communication', 'Marketing / communication', 'Réseaux sociaux, communication, marketing digital, publicité',
    ARRAY['directeur marketing', 'directrice marketing', 'responsable marketing', 'responsable communication',
      'directeur communication', 'directrice communication', 'fondateur', 'fondatrice', 'gérant', 'gérante', 'ceo'],
    '{"remote": "preferred", "countries": ["FR"], "size_categories": {"accepted": ["solo"], "preferred": ["tpe", "pme"]}, "search_keywords": ["community manager", "chargé de communication", "marketing digital", "social media manager"]}'::jsonb,
    ARRAY['community manager', 'chargé de communication', 'social media manager', 'marketing digital', 'traffic manager',
      'growth marketer', 'responsable communication', 'chargé de marketing'],
    3, true),
  ('video_photo', 'Vidéo / photo', 'Montage, motion design, tournage, photographie',
    ARRAY['responsable communication', 'directeur marketing', 'directrice marketing', 'responsable marketing',
      'fondateur', 'fondatrice', 'gérant', 'gérante', 'ceo'],
    '{"remote": "preferred", "countries": ["FR"], "size_categories": {"accepted": ["solo"], "preferred": ["tpe", "pme"]}, "search_keywords": ["monteur vidéo", "vidéaste", "motion designer", "photographe"]}'::jsonb,
    ARRAY['monteur vidéo', 'vidéaste', 'motion designer', 'photographe', 'cadreur', 'réalisateur', 'chargé de production audiovisuelle'],
    4, true),
  ('admin_assistant', 'Assistanat / gestion', 'Assistanat administratif ou commercial, gestion, comptabilité',
    ARRAY['gérant', 'gérante', 'fondateur', 'fondatrice', 'directeur général', 'directrice générale', 'office manager',
      'directeur administratif et financier', 'directrice administrative et financière', 'daf', 'ceo'],
    '{"remote": "preferred", "countries": ["FR"], "size_categories": {"accepted": ["solo"], "preferred": ["tpe", "pme"]}, "search_keywords": ["assistant administratif", "assistante de direction", "office manager", "assistant comptable"]}'::jsonb,
    ARRAY['assistant administratif', 'assistante de direction', 'office manager', 'assistant comptable',
      'gestionnaire administratif', 'assistant commercial', 'secrétaire'],
    5, true)
ON CONFLICT (key) DO NOTHING;

-- Signaux de chaque métier. Les mots-clés remplacent la recherche par codes de métier pour le
-- design et la rédaction (ces métiers n'étaient pas encore ouverts : aucun compte ne les utilise).
DELETE FROM profession_signals
 WHERE profession_key IN ('designer', 'copywriter_seo')
   AND signal_type IN ('job_posting_design', 'job_posting_marketing');

INSERT INTO profession_signals (profession_key, signal_type, default_weight)
SELECT trade.key, weights.signal_type, weights.default_weight
  FROM (VALUES ('designer'), ('copywriter_seo'), ('marketing_communication'), ('video_photo'), ('admin_assistant'), ('other')) AS trade(key)
 CROSS JOIN (VALUES
   ('job_posting_keyword', 35),
   ('freelance_mission', 40),
   ('recently_created', 20),
   ('funding_round', 15),
   ('headcount_growth', 10)
 ) AS weights(signal_type, default_weight)
ON CONFLICT (profession_key, signal_type) DO NOTHING;

-- Développement web : les mots-clés s'ajoutent à la recherche par codes de métier
INSERT INTO profession_signals (profession_key, signal_type, default_weight) VALUES
  ('web_developer', 'job_posting_keyword', 30)
ON CONFLICT (profession_key, signal_type) DO NOTHING;
