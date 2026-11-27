-- =====================================================================
-- STYLE DES MESSAGES : SOPHIE APPREND DE CE QUE LA FREELANCE RÉÉCRIT (27/11/2026)
-- - user_profiles.message_style : ses consignes permanentes (longueur, ton, ce qu'elle ne veut
--   jamais lire), données à chaque rédaction ;
-- - sophie_drafts : les brouillons rédigés par Sophie, gardés 30 jours, pour distinguer un message
--   accepté tel quel d'un message réécrit ; seule la fonction draft-message écrit ;
-- - message_style_examples : les messages que la freelance a écrits ou réécrits elle-même, 5 au plus
--   par canal ; Sophie s'inspire des 3 derniers du même canal (ton, longueur, tournures, jamais les
--   faits). Visibles et effaçables dans Réglages > Messages.
-- Tout est effacé avec le compte.
-- =====================================================================

-- 1. Consignes permanentes
ALTER TABLE public.user_profiles
  ADD COLUMN message_style TEXT CHECK (char_length(message_style) <= 1000);

COMMENT ON COLUMN public.user_profiles.message_style IS
  'Consignes de style de la freelance pour tous ses messages (longueur, ton, ce qu''elle ne veut jamais lire), données à Sophie à chaque rédaction';

-- 2. Brouillons de Sophie (30 jours)
CREATE TABLE public.sophie_drafts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin_message', 'whatsapp')),
  body TEXT NOT NULL CHECK (char_length(body) <= 6000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sophie_drafts IS
  'Messages rédigés par Sophie (30 jours) : un message envoyé presque identique n''est pas retenu comme exemple du style de la freelance';

CREATE INDEX sophie_drafts_user_channel_created_idx ON public.sophie_drafts (user_id, channel, created_at DESC);

ALTER TABLE public.sophie_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sophie_drafts_select_own" ON public.sophie_drafts
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
-- Pas de règle d'écriture : seule la fonction draft-message (service_role) ajoute des lignes

REVOKE ALL ON public.sophie_drafts FROM anon;
GRANT SELECT ON public.sophie_drafts TO authenticated;

SELECT cron.schedule(
  'sophie-drafts-cleanup',
  '23 4 * * *',
  $$DELETE FROM public.sophie_drafts WHERE created_at < now() - INTERVAL '30 days'$$
);

-- 3. Messages écrits ou réécrits par la freelance (5 au plus par canal, le code fait le ménage)
CREATE TABLE public.message_style_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin_message', 'whatsapp')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 3000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.message_style_examples IS
  'Messages que la freelance a écrits ou réécrits elle-même avant de les envoyer : Sophie imite leur ton et leur longueur, sans en reprendre les faits';

CREATE INDEX message_style_examples_user_channel_created_idx
  ON public.message_style_examples (user_id, channel, created_at DESC);

ALTER TABLE public.message_style_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_style_examples_select_own" ON public.message_style_examples
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "message_style_examples_insert_own" ON public.message_style_examples
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "message_style_examples_delete_own" ON public.message_style_examples
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.message_style_examples FROM anon;
GRANT SELECT, INSERT, DELETE ON public.message_style_examples TO authenticated;
