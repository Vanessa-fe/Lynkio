-- =====================================================================
-- FICHE BREVO D'UN COMPTE (e-mails du cycle d'essai)
-- Brevo ne connaissait que l'adresse des inscrits. Pour les e-mails de
-- bienvenue, d'aide, de fin d'essai et de remerciement, il lui faut aussi :
--   PRENOM, ENTREPRISE, METIER, DATE_INSCRIPTION, FIN_ESSAI,
--   STATUT (essai | abonne | resilie | essai_termine), OFFRE (essentiel | pro),
--   A_LANCE_RECHERCHE (au moins une recherche réussie), et à l'inscription
--   OPT_IN (accord pour les e-mails marketing, case non cochée par défaut).
-- Calcul unique ici, utilisé par le site (le compte lui-même) et par les
-- fonctions Supabase (paiements, recherches) avec la clé de service.
-- Lecture seulement.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.brevo_contact(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  account RECORD;
BEGIN
  -- Son propre compte, ou le serveur (clé de service)
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id AND coalesce((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT
    u.email,
    u.created_at,
    coalesce((u.raw_user_meta_data->>'marketing_opt_in')::boolean, false) AS opt_in,
    p.first_name,
    p.business_name,
    pr.label AS profession,
    b.trial_ends_at,
    b.status,
    b.plan,
    EXISTS (SELECT 1 FROM public.pipeline_runs r WHERE r.user_id = u.id AND r.status = 'succeeded') AS searched
  INTO account
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  LEFT JOIN public.professions pr ON pr.key = p.profession_key
  LEFT JOIN public.billing b ON b.user_id = u.id
  WHERE u.id = p_user_id;

  IF account.email IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'email', account.email,
    'opt_in', account.opt_in,
    'attributes', jsonb_build_object(
      'PRENOM', coalesce(account.first_name, ''),
      'ENTREPRISE', coalesce(account.business_name, ''),
      'METIER', coalesce(account.profession, ''),
      'DATE_INSCRIPTION', to_char(account.created_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD'),
      'FIN_ESSAI', to_char(account.trial_ends_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD'),
      'STATUT', CASE
        WHEN account.status IN ('active', 'trialing', 'past_due') AND account.plan IS NOT NULL THEN 'abonne'
        WHEN account.status = 'canceled' THEN 'resilie'
        WHEN account.trial_ends_at > now() THEN 'essai'
        ELSE 'essai_termine'
      END,
      'OFFRE', CASE
        WHEN account.status IN ('active', 'trialing', 'past_due') THEN coalesce(account.plan, '')
        ELSE ''
      END,
      'A_LANCE_RECHERCHE', account.searched
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.brevo_contact(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.brevo_contact(UUID) TO authenticated, service_role;
