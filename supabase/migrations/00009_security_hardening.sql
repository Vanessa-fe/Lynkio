-- =====================================================================
-- DURCISSEMENT SÉCURITÉ
-- Corrige les alertes remontées par le Security Advisor de Supabase.
-- Migration indépendante de la refonte : elle peut être appliquée seule,
-- dès maintenant, sans rien casser dans l'application actuelle.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. initialize_user_defaults : n'importe qui pouvait l'appeler pour
--    n'importe quel utilisateur.
-- ---------------------------------------------------------------------
-- La fonction est SECURITY DEFINER (elle s'exécute avec les droits de son
-- propriétaire, donc sans RLS) et accepte un target_user_id arbitraire.
-- Via l'API REST (/rest/v1/rpc/initialize_user_defaults), un visiteur non
-- connecté pouvait donc insérer des statuts et sources dans le compte de
-- quelqu'un d'autre. On ajoute un garde-fou : on ne peut initialiser que
-- son propre compte. La signature ne change pas, l'onboarding continue de
-- fonctionner tel quel.
CREATE OR REPLACE FUNCTION public.initialize_user_defaults(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_order INTEGER := 0;
  source_order INTEGER := 0;
  agency_status_order INTEGER := 0;
  agency_source_order INTEGER := 0;
BEGIN
  IF target_user_id IS NULL OR target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez initialiser que votre propre compte'
      USING ERRCODE = '42501';
  END IF;

  -- Insérer les statuts par défaut (contacts)
  INSERT INTO contact_statuses (user_id, name, color, "order", is_default) VALUES
    (target_user_id, 'Nouveau', '#3b82f6', status_order, true),
    (target_user_id, 'À répondre', '#f59e0b', status_order + 1, false),
    (target_user_id, 'En discussion', '#8b5cf6', status_order + 2, false),
    (target_user_id, 'Intéressé', '#10b981', status_order + 3, false),
    (target_user_id, 'Rendez-vous prévu', '#06b6d4', status_order + 4, false),
    (target_user_id, 'Client', '#22c55e', status_order + 5, false),
    (target_user_id, 'Client fidèle', '#84cc16', status_order + 6, false),
    (target_user_id, 'À relancer', '#f97316', status_order + 7, false),
    (target_user_id, 'Refusé', '#6b7280', status_order + 8, false),
    (target_user_id, 'Bloqué', '#ef4444', status_order + 9, false);

  -- Insérer les sources par défaut (contacts)
  INSERT INTO contact_sources (user_id, name, icon, "order") VALUES
    (target_user_id, 'Recommandation', 'users', source_order),
    (target_user_id, 'Site internet', 'globe', source_order + 1),
    (target_user_id, 'Réseau social', 'share-2', source_order + 2),
    (target_user_id, 'Plateforme', 'smartphone', source_order + 3),
    (target_user_id, 'Appel direct', 'phone', source_order + 4),
    (target_user_id, 'Autre', 'help-circle', source_order + 5);

  -- Insérer les statuts par défaut (agences)
  INSERT INTO agency_statuses (user_id, name, color, "order", is_default) VALUES
    (target_user_id, 'À contacter', '#3b82f6', agency_status_order, true),
    (target_user_id, 'Contacté', '#f59e0b', agency_status_order + 1, false),
    (target_user_id, 'Relance 1', '#8b5cf6', agency_status_order + 2, false),
    (target_user_id, 'Relance 2', '#6366f1', agency_status_order + 3, false),
    (target_user_id, 'Répondu', '#06b6d4', agency_status_order + 4, false),
    (target_user_id, 'RDV', '#10b981', agency_status_order + 5, false),
    (target_user_id, 'À recontacter dans 3 mois', '#84cc16', agency_status_order + 6, false),
    (target_user_id, 'Pas intéressé', '#6b7280', agency_status_order + 7, false);

  -- Insérer les sources par défaut (agences)
  INSERT INTO agency_sources (user_id, name, icon, "order") VALUES
    (target_user_id, 'LinkedIn', 'linkedin', agency_source_order),
    (target_user_id, 'Offre d''emploi', 'briefcase', agency_source_order + 1),
    (target_user_id, 'Recherche Google', 'search', agency_source_order + 2),
    (target_user_id, 'Recommandation', 'users', agency_source_order + 3),
    (target_user_id, 'Réseau perso', 'network', agency_source_order + 4),
    (target_user_id, 'Autre', 'help-circle', agency_source_order + 5);
END;
$$;

-- Par défaut, Postgres donne EXECUTE à PUBLIC (donc aussi au rôle anon).
REVOKE EXECUTE ON FUNCTION public.initialize_user_defaults(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initialize_user_defaults(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. handle_new_user : fonction de trigger exposée dans l'API
-- ---------------------------------------------------------------------
-- Elle n'est appelée que par le trigger on_auth_user_created, qui n'a pas
-- besoin du droit EXECUTE pour la déclencher. Personne ne doit pouvoir
-- l'appeler en direct.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Politique d'insertion trop permissive sur user_profiles
-- ---------------------------------------------------------------------
-- "WITH CHECK (true)" autorisait tout utilisateur connecté à créer une
-- ligne de profil pour un autre identifiant. Elle est inutile : le profil
-- est créé par handle_new_user(), qui est SECURITY DEFINER et appartient
-- au propriétaire de la table, donc la RLS ne s'applique pas à elle.
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.user_profiles;

-- ---------------------------------------------------------------------
-- 4. search_path figé sur les fonctions existantes
-- ---------------------------------------------------------------------
-- Sans search_path fixé, une fonction résout les noms de tables selon le
-- contexte de l'appelant : un schéma malveillant placé en tête du chemin
-- pourrait lui faire utiliser une autre table que prévu.
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_contact_last_interaction() SET search_path = public;
ALTER FUNCTION public.check_deposit_amount() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_agency_last_interaction() SET search_path = public;
