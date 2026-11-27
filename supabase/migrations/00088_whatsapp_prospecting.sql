-- =====================================================================
-- PROSPECTION PAR WHATSAPP + AVERTISSEMENT AVANT L'ENVOI LINKEDIN AUTOMATIQUE (27/11/2026)
-- WhatsApp (offre Pro) : Sophie rédige le message, l'utilisatrice l'ouvre dans WhatsApp (lien wa.me)
-- et l'envoie elle-même, puis clique « C'est envoyé » : le brouillon passe en « done » et le trigger
-- existant advance_stage_on_exchange fait avancer la fiche (rien à changer dans le trigger).
-- Le plafond du jour se compte sur les échanges WhatsApp envoyés depuis minuit, heure de Paris.
-- LinkedIn : la date à laquelle l'utilisatrice a accepté le risque de restriction de son compte
-- avant d'activer l'envoi automatique (preuve que l'information a été donnée).
-- La contrainte de format E.164 des numéros vient après, dans 00089, une fois le code en ligne.
-- =====================================================================

-- 1. Type d'échange « whatsapp »
ALTER TABLE public.company_interactions DROP CONSTRAINT company_interactions_type_check;
ALTER TABLE public.company_interactions
  ADD CONSTRAINT company_interactions_type_check
  CHECK (type = ANY (ARRAY['email', 'linkedin_message', 'whatsapp', 'call', 'meeting', 'note', 'system_event']));

-- 2. Un contact peut n'avoir qu'un téléphone (artisan trouvé par sa fiche Google)
ALTER TABLE public.company_contacts DROP CONSTRAINT company_contacts_check;
ALTER TABLE public.company_contacts
  ADD CONSTRAINT company_contacts_check
  CHECK (COALESCE(first_name, last_name, email, linkedin_url, phone) IS NOT NULL);

-- 3. Plafond de messages WhatsApp par jour (heure de Paris)
ALTER TABLE public.user_profiles
  ADD COLUMN whatsapp_daily_limit INTEGER NOT NULL DEFAULT 15
  CHECK (whatsapp_daily_limit BETWEEN 1 AND 50);

COMMENT ON COLUMN public.user_profiles.whatsapp_daily_limit IS
  'Messages WhatsApp marqués envoyés au plus par jour (heure de Paris) : limite le risque de blocage du numéro';

-- Compteur du jour (échanges WhatsApp envoyés depuis minuit, Paris) : l'index existant
-- idx_company_interactions_user (user_id, occurred_at DESC) suffit

-- 4. Acceptation du risque avant l'envoi LinkedIn automatique
ALTER TABLE public.linkedin_automation ADD COLUMN risk_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.linkedin_automation.risk_accepted_at IS
  'Dernière fois que l''utilisatrice a coché « J''ai compris que l''envoi automatique peut entraîner une restriction de mon compte LinkedIn » avant d''activer l''envoi automatique';

-- 5. Bilan hebdomadaire de Sophie : les messages WhatsApp comptent comme les e-mails et messages LinkedIn
CREATE OR REPLACE FUNCTION public.deliver_sophie_notifications()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
        jsonb_build_object('outgoing',count(*) FILTER (WHERE direction='outgoing' AND type IN ('email','call','linkedin_message','whatsapp')),
          'incoming',count(*) FILTER (WHERE direction='incoming' AND type IN ('email','call','linkedin_message','whatsapp')),
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
$function$;
