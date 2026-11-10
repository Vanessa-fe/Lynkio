-- Limites d'usage (nombre d'essais par fenêtre de temps), pour freiner les abus :
-- vérification de clés d'API en rafale, formulaires publics envoyés par des robots…
-- La table n'est lisible par personne : on ne la touche que par les fonctions ci-dessous.

CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

COMMENT ON TABLE rate_limits IS 'Compteurs d''essais par fenêtre de temps (voir hit_rate_limit)';

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

/**
 * Compte un essai dans le seau donné ; true tant que le maximum n'est pas dépassé.
 * Réservée au serveur (service_role) : le seau peut contenir une adresse IP.
 */
CREATE FUNCTION public.hit_rate_limit(p_bucket TEXT, p_max INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_window TIMESTAMPTZ := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  total INTEGER;
BEGIN
  INSERT INTO public.rate_limits (bucket, window_start, hits)
  VALUES (left(p_bucket, 200), current_window, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET hits = public.rate_limits.hits + 1
  RETURNING hits INTO total;

  -- Ménage des vieux compteurs, de temps en temps
  IF random() < 0.05 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - INTERVAL '2 days';
  END IF;

  RETURN total <= p_max;
END;
$$;

/**
 * Même chose pour l'utilisateur connecté : son seau porte son identifiant, il ne peut pas
 * remplir celui d'un autre.
 */
CREATE FUNCTION public.hit_my_rate_limit(p_action TEXT, p_max INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_action !~ '^[a-z_]{1,40}$' OR p_max < 1 OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit' USING ERRCODE = '22023';
  END IF;
  RETURN public.hit_rate_limit('user:' || auth.uid() || ':' || p_action, p_max, p_window_seconds);
END;
$$;

REVOKE ALL ON FUNCTION public.hit_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hit_my_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.hit_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.hit_my_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated;
