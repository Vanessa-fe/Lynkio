-- Suggestions de mots-clés pendant la saisie (demande du 11/11/2026) : celles des métiers, et les
-- mots-clés que les utilisateurs ont eux-mêmes écrits, dès qu'au moins 2 comptes les utilisent (un mot
-- écrit par un seul compte n'est jamais montré aux autres). Comparaison sans accents ni majuscules.

CREATE FUNCTION public.suggest_search_keywords(p_query TEXT)
RETURNS TABLE (keyword TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH query AS (
    SELECT replace(replace(replace(
             lower(translate(btrim(left(p_query, 60)), 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucaaaeeeeiioouuuc')),
             '\', '\\'), '%', '\%'), '_', '\_') AS value
  ),
  candidates AS (
    SELECT DISTINCT unnest(suggested_keywords) AS keyword, 1000 AS score
      FROM public.professions
     WHERE is_active
    UNION ALL
    SELECT min(used.keyword), count(DISTINCT used.user_id)
      FROM (
        SELECT profile.user_id, btrim(keyword) AS keyword
          FROM public.icp_profiles profile,
               jsonb_array_elements_text(COALESCE(profile.criteria -> 'search_keywords', '[]'::jsonb)) AS keyword
      ) used
     GROUP BY lower(used.keyword)
    HAVING count(DISTINCT used.user_id) >= 2
  ),
  matches AS (
    SELECT DISTINCT ON (lower(candidates.keyword))
           candidates.keyword,
           candidates.score,
           lower(translate(candidates.keyword, 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucaaaeeeeiioouuuc')) AS normalized
      FROM candidates, query
     WHERE char_length(query.value) >= 2
       AND lower(translate(candidates.keyword, 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucaaaeeeeiioouuuc'))
           LIKE '%' || query.value || '%'
     ORDER BY lower(candidates.keyword), candidates.score DESC
  )
  SELECT matches.keyword
    FROM matches, query
   ORDER BY (matches.normalized LIKE query.value || '%') DESC, matches.score DESC, matches.keyword
   LIMIT 8;
$$;

REVOKE ALL ON FUNCTION public.suggest_search_keywords(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_search_keywords(TEXT) TO authenticated;
