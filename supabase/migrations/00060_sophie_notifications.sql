-- Consentement distinct pour les signaux et le bilan. Les dates de début
-- sont fixées par la base pour exclure la période précédant l'inscription.
CREATE TABLE public.sophie_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('off', 'daily', 'weekly')),
  alerts_since timestamptz,
  alerts_through timestamptz,
  digest_from timestamptz
);

CREATE TABLE public.sophie_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('signal', 'digest')),
  delivery_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  company_id uuid,
  signal_id uuid REFERENCES public.company_signals ON DELETE SET NULL,
  title text NOT NULL,
  source text NOT NULL,
  source_url text,
  detected_at timestamptz,
  event_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  counts jsonb,
  UNIQUE(user_id, delivery_key),
  FOREIGN KEY (company_id,user_id) REFERENCES public.companies(id,user_id) ON DELETE CASCADE
);
CREATE INDEX sophie_inbox_order ON public.sophie_notifications(user_id,created_at DESC,id DESC);
CREATE INDEX sophie_new_signals ON public.company_signals(user_id,created_at);
ALTER TABLE public.sophie_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sophie_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sophie_preferences, public.sophie_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sophie_preferences, public.sophie_notifications TO authenticated;
GRANT UPDATE(read_at) ON public.sophie_notifications TO authenticated;
CREATE POLICY read_preferences ON public.sophie_preferences FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY read_notifications ON public.sophie_notifications FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY mark_notifications ON public.sophie_notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.set_sophie_preferences(p_frequency text, p_digest boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR p_frequency IS NULL OR p_frequency NOT IN ('off','daily','weekly') OR p_digest IS NULL THEN
    RAISE EXCEPTION 'Préférences invalides';
  END IF;
  INSERT INTO public.sophie_preferences AS p(user_id,frequency,alerts_since,digest_from)
  VALUES(uid,p_frequency,CASE WHEN p_frequency <> 'off' THEN now() END,CASE WHEN p_digest THEN now() END)
  ON CONFLICT(user_id) DO UPDATE SET frequency = EXCLUDED.frequency,
    alerts_since = CASE WHEN EXCLUDED.frequency <> 'off' THEN coalesce(p.alerts_since,now()) END,
    alerts_through = CASE WHEN EXCLUDED.frequency <> 'off' THEN p.alerts_through END,
    digest_from = CASE WHEN p_digest THEN coalesce(p.digest_from,now()) END;
  UPDATE public.sophie_notifications SET read_at = now() WHERE user_id = uid AND read_at IS NULL
    AND ((kind = 'signal' AND p_frequency = 'off') OR (kind = 'digest' AND NOT p_digest));
END;
$$;
REVOKE ALL ON FUNCTION public.set_sophie_preferences(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_sophie_preferences(text,boolean) TO authenticated;

CREATE FUNCTION public.deliver_sophie_notifications() RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  p public.sophie_preferences%ROWTYPE;
  paris_now timestamp := now() AT TIME ZONE 'Europe/Paris';
  cutoff timestamptz;
  week_end timestamptz;
BEGIN
  FOR p IN SELECT * FROM public.sophie_preferences WHERE frequency <> 'off' OR digest_from IS NOT NULL
    ORDER BY user_id FOR UPDATE SKIP LOCKED
  LOOP
    IF p.frequency <> 'off' THEN
      cutoff := date_trunc(CASE WHEN p.frequency = 'weekly' THEN 'week' ELSE 'day' END, paris_now) AT TIME ZONE 'Europe/Paris';
      IF cutoff > coalesce(p.alerts_through,p.alerts_since) THEN
        INSERT INTO public.sophie_notifications(user_id,kind,delivery_key,company_id,signal_id,title,source,source_url,detected_at,event_at)
        SELECT p.user_id,'signal',jsonb_build_array(s.company_id,s.signal_type,s.dedupe_key)::text,
          c.id,s.id,t.label || ' · ' || c.name,s.source,s.source_url,s.detected_at,s.event_at
        FROM public.company_signals s JOIN public.companies c ON c.id = s.company_id AND c.user_id = p.user_id
        LEFT JOIN public.pipeline_stages stage ON stage.id = c.stage_id
        JOIN public.signal_types t ON t.key = s.signal_type
        WHERE s.user_id = p.user_id AND (c.strategy_id IS NOT NULL OR coalesce(stage.kind, 'open') = 'open')
          AND s.created_at >= greatest(p.alerts_since,now() - interval '365 days') AND s.created_at < cutoff
          AND (s.expires_at IS NULL OR s.expires_at > now())
        ON CONFLICT(user_id,delivery_key) DO NOTHING;
        UPDATE public.sophie_preferences SET alerts_through = cutoff WHERE user_id = p.user_id;
      END IF;
    END IF;
    WHILE p.digest_from IS NOT NULL LOOP
      week_end := (date_trunc('week',p.digest_from AT TIME ZONE 'Europe/Paris') + interval '1 week') AT TIME ZONE 'Europe/Paris';
      EXIT WHEN week_end > now();
      INSERT INTO public.sophie_notifications(user_id,kind,delivery_key,title,source,period_start,period_end,counts)
      SELECT p.user_id,'digest','week/' || (week_end AT TIME ZONE 'Europe/Paris')::date,
        'Bilan hebdomadaire de Sophie','crm',p.digest_from,week_end,
        jsonb_build_object('outgoing',count(*) FILTER (WHERE direction='outgoing' AND type IN ('email','call','linkedin_message')),
          'incoming',count(*) FILTER (WHERE direction='incoming' AND type IN ('email','call','linkedin_message')),
          'meetings',count(*) FILTER (WHERE type='meeting'),
          'notes',count(*) FILTER (WHERE type='note'))
      FROM public.company_interactions WHERE user_id=p.user_id AND status='done'
        AND occurred_at >= p.digest_from AND occurred_at < week_end
      ON CONFLICT(user_id,delivery_key) DO NOTHING;
      p.digest_from := week_end;
      UPDATE public.sophie_preferences SET digest_from = week_end WHERE user_id = p.user_id;
    END LOOP;
  END LOOP;
  DELETE FROM public.sophie_notifications WHERE created_at < now() - interval '365 days';
END;
$$;
REVOKE ALL ON FUNCTION public.deliver_sophie_notifications() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('sophie-notifications','10 * * * *',$$SELECT public.deliver_sophie_notifications();$$);
