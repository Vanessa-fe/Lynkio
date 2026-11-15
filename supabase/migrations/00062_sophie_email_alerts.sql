-- Alertes de Sophie aussi par e-mail. Le canal suit l'abonnement déjà choisi (signaux ou bilan),
-- et se coupe avec la case « Recevoir aussi ces alertes par e-mail ».
ALTER TABLE public.sophie_preferences ADD COLUMN by_email boolean NOT NULL DEFAULT true;
ALTER TABLE public.sophie_notifications ADD COLUMN emailed_at timestamptz;
-- Les alertes déjà lues ne partiront jamais par e-mail
UPDATE public.sophie_notifications SET emailed_at = read_at WHERE read_at IS NOT NULL;

-- Nouvelle version à 3 paramètres. L'ancienne (text, boolean) reste le temps que le site
-- déployé passe à celle-ci ; elle ne touche pas à by_email.
CREATE FUNCTION public.set_sophie_preferences(p_frequency text, p_digest boolean, p_email boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR p_frequency IS NULL OR p_frequency NOT IN ('off','daily','weekly') OR p_digest IS NULL OR p_email IS NULL THEN
    RAISE EXCEPTION 'Préférences invalides';
  END IF;
  INSERT INTO public.sophie_preferences AS p(user_id,frequency,alerts_since,digest_from,by_email)
  VALUES(uid,p_frequency,CASE WHEN p_frequency <> 'off' THEN now() END,CASE WHEN p_digest THEN now() END,p_email)
  ON CONFLICT(user_id) DO UPDATE SET frequency = EXCLUDED.frequency,
    alerts_since = CASE WHEN EXCLUDED.frequency <> 'off' THEN coalesce(p.alerts_since,now()) END,
    alerts_through = CASE WHEN EXCLUDED.frequency <> 'off' THEN p.alerts_through END,
    digest_from = CASE WHEN p_digest THEN coalesce(p.digest_from,now()) END,
    by_email = EXCLUDED.by_email;
  UPDATE public.sophie_notifications SET read_at = now() WHERE user_id = uid AND read_at IS NULL
    AND ((kind = 'signal' AND p_frequency = 'off') OR (kind = 'digest' AND NOT p_digest));
END;
$$;
REVOKE ALL ON FUNCTION public.set_sophie_preferences(text,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_sophie_preferences(text,boolean,boolean) TO authenticated;

-- Réserve les alertes à envoyer, en une seule requête : deux envois simultanés ne peuvent pas
-- prendre la même alerte. Seules les alertes récentes (2 jours) et non lues partent.
CREATE FUNCTION public.claim_sophie_emails()
RETURNS TABLE(id uuid, user_id uuid, kind text, title text, source text, source_url text,
  event_at timestamptz, period_start timestamptz, period_end timestamptz, counts jsonb)
LANGUAGE sql SET search_path = '' AS $$
  UPDATE public.sophie_notifications n SET emailed_at = now()
  FROM public.sophie_preferences p
  WHERE p.user_id = n.user_id AND p.by_email AND n.emailed_at IS NULL AND n.read_at IS NULL
    AND n.created_at > now() - interval '2 days'
    AND ((n.kind = 'signal' AND p.frequency <> 'off') OR (n.kind = 'digest' AND p.digest_from IS NOT NULL))
  RETURNING n.id, n.user_id, n.kind, n.title, n.source, n.source_url, n.event_at, n.period_start, n.period_end, n.counts;
$$;

-- Rend des alertes à la file quand l'e-mail n'a pas pu partir (nouvel essai à l'heure suivante)
CREATE FUNCTION public.release_sophie_emails(p_ids uuid[]) RETURNS void
LANGUAGE sql SET search_path = '' AS $$
  UPDATE public.sophie_notifications SET emailed_at = NULL WHERE id = ANY(p_ids);
$$;

REVOKE ALL ON FUNCTION public.claim_sophie_emails() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_sophie_emails(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sophie_emails() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_sophie_emails(uuid[]) TO service_role;

-- Cinq minutes après la création des alertes (10 * * * *), la fonction sophie-email les envoie
SELECT cron.schedule('sophie-emails', '15 * * * *', $$
  SELECT net.http_post(
    url := 'https://kifzcqxasqpcstujihqt.supabase.co/functions/v1/sophie-email',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
