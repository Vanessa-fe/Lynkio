-- Libellé corrigé (16/11/2026) : une entreprise de moins d'un an sans signal « création récente »
-- valide (annonce absente, ou écartée par l'utilisateur) était décrite comme ayant une « date de
-- création inconnue », même quand la date est connue. Seul le texte change, pas les points.

DO $migration$
DECLARE
  definition TEXT := pg_get_functiondef('public.compute_company_score_v2(uuid)'::regprocedure);
  old_branch CONSTANT TEXT := $old$      ELSE
        items := items || jsonb_build_object('group', 'signals', 'code', 'unchecked:' || sig.key,
          'label', format('%s : non vérifié (date de création inconnue)', sig.label),
          'points', 0, 'max', 0, 'kind', 'unavailable');$old$;
  new_branch CONSTANT TEXT := $new$      ELSIF c.founded_on IS NULL THEN
        items := items || jsonb_build_object('group', 'signals', 'code', 'unchecked:' || sig.key,
          'label', format('%s : non vérifié (date de création inconnue)', sig.label),
          'points', 0, 'max', 0, 'kind', 'unavailable');
      ELSE
        items := items || jsonb_build_object('group', 'signals', 'code', 'unchecked:' || sig.key,
          'label', format('%s : pas d’annonce de création valide (absente ou écartée)', sig.label),
          'points', 0, 'max', 0, 'kind', 'unavailable');$new$;
BEGIN
  IF position(old_branch IN definition) = 0 THEN
    RAISE EXCEPTION 'compute_company_score_v2 : libellé de création récente introuvable, migration à revoir';
  END IF;
  EXECUTE replace(definition, old_branch, new_branch);
END;
$migration$;

-- Seules les fiches concernées changent de détail (score_company n'écrit rien si rien ne change)
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  FOR v_company_id IN
    SELECT c.id FROM companies c
     WHERE c.founded_on >= (now() - INTERVAL '1 year')::date
  LOOP
    PERFORM score_company(v_company_id);
  END LOOP;
END;
$$;
