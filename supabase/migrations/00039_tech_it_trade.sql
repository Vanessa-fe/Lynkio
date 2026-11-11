-- « Développeur·se web » devient « Tech / IT » : développeurs web et logiciel, DevOps, cloud, data, IA,
-- cybersécurité… (décision du 11/11/2026). La clé web_developer ne change pas : les comptes existants
-- gardent leur métier, leurs signaux et leur recherche par codes de métier (ROME).
UPDATE professions SET
  label = 'Tech / IT',
  description = 'Développement web et logiciel, DevOps, cloud, data, IA, cybersécurité',
  suggested_keywords = ARRAY['développeur web', 'développeur logiciel', 'développeur full stack', 'développeur mobile',
    'ingénieur DevOps', 'architecte cloud', 'administrateur système', 'data engineer', 'data scientist',
    'ingénieur IA', 'ingénieur cybersécurité', 'chef de projet technique'],
  target_roles = (
    SELECT array_agg(DISTINCT role) FROM unnest(target_roles || ARRAY['dsi', 'directeur des systèmes d''information',
      'directrice des systèmes d''information', 'responsable informatique', 'responsable infrastructure',
      'head of engineering', 'head of data']) AS role
  )
WHERE key = 'web_developer';
