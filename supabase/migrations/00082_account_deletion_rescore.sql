-- =====================================================================
-- CORRECTIF : SUPPRESSION DE COMPTE BLOQUÉE
-- Supprimer un compte (auth.users) efface en cascade ses entreprises, leurs
-- contacts et leurs signaux. Les automatismes de recalcul du score se
-- déclenchaient alors avec le rôle technique de Supabase Auth, qui n'a pas
-- le droit d'exécuter score_company (droit retiré à PUBLIC) : « permission
-- denied for function score_company », et le compte n'était jamais
-- supprimé (« Suppression impossible pour le moment »).
--
-- Désormais, quand le rôle courant ne peut pas recalculer un score, le
-- recalcul est simplement passé : c'est le cas pendant une suppression de
-- compte, où l'entreprise disparaît de toute façon. Pour l'utilisateur, le
-- service et les fonctions du site, rien ne change.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rescore_company_from_child()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_function_privilege('public.score_company(uuid)', 'EXECUTE') THEN
    RETURN NULL;
  END IF;
  PERFORM score_company(COALESCE(NEW.company_id, OLD.company_id));
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rescore_company_self()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_function_privilege('public.score_company(uuid)', 'EXECUTE') THEN
    RETURN NULL;
  END IF;
  PERFORM score_company(NEW.id);
  RETURN NULL;
END;
$function$;
