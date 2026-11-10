-- rls_auto_enable est la fonction de l'événement ensure_rls (RLS activée sur chaque nouvelle table) :
-- personne n'a à l'appeler par l'API. Alerte du conseiller de sécurité Supabase.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
