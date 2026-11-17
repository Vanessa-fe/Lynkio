-- =====================================================================
-- NOM DES COMPTES DANS LA LISTE DES UTILISATEURS SUPABASE
-- La liste Authentication > Users du tableau de bord Supabase n'affichait
-- que l'e-mail : le prénom et l'entreprise sont dans user_profiles. Ils sont
-- désormais recopiés dans la colonne « Display name » (user_metadata
-- display_name), à chaque création ou modification du profil, et pour les
-- comptes existants. Affichage seulement : rien d'autre ne lit cette valeur.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.sync_auth_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  label TEXT := nullif(concat_ws(' · ', nullif(trim(NEW.first_name), ''), nullif(trim(NEW.business_name), '')), '');
BEGIN
  IF label IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', left(label, 120))
    WHERE id = NEW.id
      AND raw_user_meta_data->>'display_name' IS DISTINCT FROM left(label, 120);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_auth_display_name() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_auth_display_name_trigger
  AFTER INSERT OR UPDATE OF first_name, business_name ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_display_name();

-- Comptes existants
UPDATE auth.users u
SET raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('display_name', left(concat_ws(' · ', nullif(trim(p.first_name), ''), nullif(trim(p.business_name), '')), 120))
FROM public.user_profiles p
WHERE p.id = u.id
  AND nullif(concat_ws(' · ', nullif(trim(p.first_name), ''), nullif(trim(p.business_name), '')), '') IS NOT NULL;
