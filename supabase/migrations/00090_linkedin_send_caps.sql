-- =====================================================================
-- PLAFONDS DE L'ENVOI LINKEDIN, COMPTÉS COMME LINKEDIN LES COMPTE (27/11/2026)
-- Avant : 12 actions par jour (invitations et messages mélangés) et 200 invitations par mois.
-- Désormais, des compteurs séparés (envois faits en un clic depuis Filonea compris) :
--   invitations : 15 par jour par défaut (25 au plus), et 100 sur 7 jours glissants, limite dure
--                 (LinkedIn bloque autour de 100 invitations par semaine) ;
--   messages    : premier message et relances, 20 par jour par défaut (40 au plus).
-- Le jour se compte à l'heure de Paris.
--
-- Pendant l'envoi automatique, deux protections divisent un plafond du jour par 2 :
--   démarrage : 14 jours après une première activation, ou après plus de 30 jours sans envoi
--               automatique (un compte calme qui passe d'un coup à 15 invitations par jour est
--               suspect pour LinkedIn) : invitations et messages ;
--   taux d'acceptation bas : sous 20 % sur les 50 dernières invitations envoyées depuis plus de
--               7 jours (au moins 20 invitations pour juger) : invitations, jusqu'à ce que le taux
--               repasse au-dessus de 25 %.
-- Quand LinkedIn répond « limite hebdomadaire atteinte » (ce n'est pas une sanction), l'extension
-- suspend seulement les invitations jusqu'à ce que la fenêtre de 7 jours le permette : les messages
-- continuent.
--
-- linkedin_send_caps() fait le calcul pour Filonea et pour l'extension : une seule règle, qui peut
-- évoluer sans mettre l'extension à jour.
-- =====================================================================

ALTER TABLE public.linkedin_automation
  ADD COLUMN daily_invitations_limit INTEGER NOT NULL DEFAULT 15
    CHECK (daily_invitations_limit BETWEEN 1 AND 25),
  ADD COLUMN daily_messages_limit INTEGER NOT NULL DEFAULT 20
    CHECK (daily_messages_limit BETWEEN 1 AND 40),
  ADD COLUMN ramp_up_until TIMESTAMPTZ,
  ADD COLUMN low_acceptance_since TIMESTAMPTZ,
  ADD COLUMN invitations_held_until TIMESTAMPTZ;

COMMENT ON COLUMN public.linkedin_automation.daily_invitations_limit IS
  'Invitations LinkedIn par jour au plus (heure de Paris), choisies par l''utilisatrice : 15 par défaut, 25 au plus';
COMMENT ON COLUMN public.linkedin_automation.daily_messages_limit IS
  'Messages LinkedIn (premier message et relances) par jour au plus, choisis par l''utilisatrice : 20 par défaut, 40 au plus';
COMMENT ON COLUMN public.linkedin_automation.ramp_up_until IS
  'Fin du démarrage en douceur (plafonds du jour divisés par 2) : 14 jours après une première activation ou une reprise après plus de 30 jours sans envoi automatique';
COMMENT ON COLUMN public.linkedin_automation.low_acceptance_since IS
  'Depuis quand le taux d''acceptation des invitations est bas (sous 20 %) : plafond d''invitations divisé par 2 jusqu''à ce qu''il repasse au-dessus de 25 %';
COMMENT ON COLUMN public.linkedin_automation.invitations_held_until IS
  'LinkedIn a répondu « limite hebdomadaire d''invitations atteinte » : plus d''invitation avant cette date (les messages continuent)';

-- Démarrage en douceur : le premier envoi automatique après plus de 30 jours sans envoi (ou le tout
-- premier) ouvre 14 jours à plafonds réduits. L'activation en ouvre aussi (actions/linkedin-sequences.ts),
-- pour que Filonea l'annonce avant le premier envoi.
CREATE OR REPLACE FUNCTION public.start_linkedin_ramp_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.last_action_at IS NOT NULL
     AND (OLD.last_action_at IS NULL OR NEW.last_action_at - OLD.last_action_at > interval '30 days') THEN
    NEW.ramp_up_until := NEW.last_action_at + interval '14 days';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER linkedin_automation_ramp_up
  BEFORE UPDATE OF last_action_at ON public.linkedin_automation
  FOR EACH ROW EXECUTE FUNCTION public.start_linkedin_ramp_up();

-- Ce que l'utilisatrice connectée peut encore envoyer sur LinkedIn maintenant, et pourquoi
CREATE OR REPLACE FUNCTION public.linkedin_send_caps()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  uid UUID := auth.uid();
  settings public.linkedin_automation%ROWTYPE;
  day_start TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris';
  week_start TIMESTAMPTZ := now() - interval '7 days';
  week_cap CONSTANT INTEGER := 100;
  invitations_today INTEGER;
  invitations_week INTEGER;
  messages_today INTEGER;
  week_frees_at TIMESTAMPTZ;
  judged INTEGER;
  accepted INTEGER;
  rate INTEGER;
  automatic BOOLEAN;
  ramp_up BOOLEAN;
  low BOOLEAN;
  held BOOLEAN;
  invitation_cap INTEGER;
  message_cap INTEGER;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté';
  END IF;

  SELECT * INTO settings FROM public.linkedin_automation WHERE user_id = uid;

  SELECT count(*) FILTER (WHERE invited_at >= day_start),
         count(*) FILTER (WHERE invited_at > week_start),
         count(*) FILTER (WHERE messaged_at >= day_start)
           + count(*) FILTER (WHERE follow_up_1_at >= day_start)
           + count(*) FILTER (WHERE follow_up_2_at >= day_start)
    INTO invitations_today, invitations_week, messages_today
    FROM public.linkedin_sequences
   WHERE user_id = uid;

  -- Quand une place se libère dans la fenêtre de 7 jours : la plus ancienne invitation qu'il faut
  -- voir sortir pour repasser sous la limite (la plus ancienne tout court tant qu'on est en dessous)
  SELECT invited_at + interval '7 days' INTO week_frees_at
    FROM public.linkedin_sequences
   WHERE user_id = uid AND invited_at > week_start
   ORDER BY invited_at
   OFFSET greatest(invitations_week - week_cap, 0)
   LIMIT 1;

  -- Taux d'acceptation : les 50 dernières invitations qui ont eu 7 jours pour être acceptées
  SELECT count(*), count(connected_at) INTO judged, accepted
    FROM (
      SELECT connected_at
        FROM public.linkedin_sequences
       WHERE user_id = uid AND invited_at <= now() - interval '7 days'
       ORDER BY invited_at DESC
       LIMIT 50
    ) last_invitations;
  rate := CASE WHEN judged >= 20 THEN round(100.0 * accepted / judged)::INTEGER END;

  -- Taux bas sous 20 %, de nouveau correct au-dessus de 25 % (entre les deux, on garde l'état)
  low := settings.low_acceptance_since IS NOT NULL;
  IF rate IS NULL OR rate > 25 THEN
    low := false;
  ELSIF rate < 20 THEN
    low := true;
  END IF;
  IF settings.user_id IS NOT NULL AND low <> (settings.low_acceptance_since IS NOT NULL) THEN
    UPDATE public.linkedin_automation
       SET low_acceptance_since = CASE WHEN low THEN now() END
     WHERE user_id = uid;
  END IF;

  -- Les protections ne jouent que pendant l'envoi automatique
  automatic := coalesce(settings.enabled, false);
  ramp_up := automatic AND coalesce(settings.ramp_up_until > now(), false);
  held := coalesce(settings.invitations_held_until > now(), false);
  invitation_cap := coalesce(settings.daily_invitations_limit, 15);
  message_cap := coalesce(settings.daily_messages_limit, 20);
  IF ramp_up THEN
    invitation_cap := greatest(1, invitation_cap / 2);
    message_cap := greatest(1, message_cap / 2);
  END IF;
  IF automatic AND low THEN
    invitation_cap := greatest(1, invitation_cap / 2);
  END IF;

  RETURN jsonb_build_object(
    'invitations_today', invitations_today,
    'invitations_week', invitations_week,
    'messages_today', messages_today,
    'invitations_today_cap', invitation_cap,
    'invitations_week_cap', week_cap,
    'messages_today_cap', message_cap,
    'daily_invitations_limit', coalesce(settings.daily_invitations_limit, 15),
    'daily_messages_limit', coalesce(settings.daily_messages_limit, 20),
    'week_frees_at', week_frees_at,
    'ramp_up_until', CASE WHEN ramp_up THEN settings.ramp_up_until END,
    'acceptance_rate', rate,
    'acceptance_judged', judged,
    'low_acceptance', automatic AND low,
    'invitations_held_until', CASE WHEN held THEN settings.invitations_held_until END,
    'can_invite', NOT held
      AND invitations_today < invitation_cap AND invitations_week < week_cap,
    'can_message', messages_today < message_cap
  );
END;
$$;

COMMENT ON FUNCTION public.linkedin_send_caps() IS
  'Plafonds LinkedIn de l''utilisatrice connectée (invitations du jour et sur 7 jours glissants, messages du jour, démarrage, taux d''acceptation) : lus par Filonea et par l''extension avant chaque envoi';
