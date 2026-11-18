-- =====================================================================
-- FORMULAIRE D'AIDE (support@filonea.fr)
-- Distinct de la boîte à idées : une question, un problème, la facturation,
-- ouvert à tous, connecté ou non (un visiteur, quelqu'un qui ne peut plus se
-- connecter). Le message part par e-mail vers support@filonea.fr ; il est aussi
-- gardé ici, au cas où l'e-mail se perdrait. Personne ne peut lire la table
-- depuis le site : seulement l'équipe, depuis Supabase. Effacé après 12 mois.
-- =====================================================================

CREATE TABLE public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  topic TEXT NOT NULL CHECK (topic IN ('question', 'problem', 'billing', 'account', 'other')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.support_requests IS 'Messages du formulaire d''aide (envoyés aussi à support@filonea.fr), effacés après 12 mois';

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
-- Aucune règle : ni lecture ni écriture directe depuis le site, seulement la fonction ci-dessous

CREATE INDEX support_requests_created_at_idx ON public.support_requests (created_at);

/**
 * Enregistre un message d'aide, avec des limites contre les robots :
 * 3 par heure pour une même adresse (et une même adresse IP quand le site la donne),
 * 5 par heure pour un compte connecté, 40 par heure en tout.
 * Renvoie true si le message est enregistré, false si une limite est atteinte.
 */
CREATE FUNCTION public.submit_support_request(
  p_name TEXT,
  p_email TEXT,
  p_topic TEXT,
  p_message TEXT,
  p_ip TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
  clean_email TEXT := lower(trim(p_email));
BEGIN
  IF clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Adresse e-mail invalide' USING ERRCODE = '22023';
  END IF;

  IF NOT public.hit_rate_limit('support:all', 40, 3600)
    OR NOT public.hit_rate_limit('support:email:' || clean_email, 3, 3600)
    OR (p_ip IS NOT NULL AND NOT public.hit_rate_limit('support:ip:' || left(p_ip, 64), 3, 3600))
    OR (uid IS NOT NULL AND NOT public.hit_rate_limit('support:user:' || uid, 5, 3600))
  THEN
    RETURN false;
  END IF;

  INSERT INTO public.support_requests (user_id, name, email, topic, message)
  VALUES (uid, trim(p_name), clean_email, p_topic, trim(p_message));

  -- Ménage : les messages de plus de 12 mois
  IF random() < 0.05 THEN
    DELETE FROM public.support_requests WHERE created_at < now() - INTERVAL '12 months';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_support_request(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_support_request(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
