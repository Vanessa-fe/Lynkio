-- =====================================================================
-- FICHE BREVO : STATUT plus précis (demande du 18/11/2026)
-- « abonne » ne voulait pas toujours dire « a payé ». Désormais :
--   abonne          abonnement payé (Stripe : active)
--   abonne_essai    offre choisie pendant l'essai, premier prélèvement à la fin
--                   de l'essai (Stripe : trialing)
--   paiement_echoue prélèvement à régulariser (Stripe : past_due ou unpaid)
--   resilie, essai, essai_termine : inchangés
-- Toujours mis à jour par le webhook Stripe, donc seulement sur confirmation
-- de Stripe. Le reste de la fiche ne change pas.
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
        WHEN account.status = 'active' AND account.plan IS NOT NULL THEN 'abonne'
        WHEN account.status = 'trialing' AND account.plan IS NOT NULL THEN 'abonne_essai'
        WHEN account.status IN ('past_due', 'unpaid') THEN 'paiement_echoue'
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
