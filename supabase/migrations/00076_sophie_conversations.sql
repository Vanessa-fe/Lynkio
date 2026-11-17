-- =====================================================================
-- CONVERSATIONS AVEC SOPHIE (phase 2 de la refonte, lot 2.1)
-- Décisions du 17/11/2026 : historique gardé côté serveur, par compte ;
-- conservation 12 mois par défaut, réglable ; plafond de 100 messages par
-- jour par défaut, réglable ; ouverture automatique sur l'accueil,
-- désactivable.
--
-- Ce qui n'est PAS stocké : les consignes complètes envoyées à l'IA, les
-- clés, les copies de fiches. Un message garde seulement le contexte de
-- page (page, type et identifiant de l'entité), jamais les données lues.
--
-- Écriture : uniquement par la fonction sophie-chat (service_role), après
-- vérification du compte. L'utilisateur lit, renomme et supprime ses
-- conversations ; les messages suivent la conversation (cascade).
-- =====================================================================

CREATE TABLE public.sophie_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nouvelle conversation' CHECK (char_length(title) BETWEEN 1 AND 120),
  -- auto : tiré du premier message ; user : choisi par l'utilisateur (n'est plus remplacé)
  title_set_by TEXT NOT NULL DEFAULT 'auto' CHECK (title_set_by IN ('auto', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

COMMENT ON TABLE public.sophie_conversations IS 'Conversations avec Sophie, par compte. Écrites par la fonction sophie-chat ; conservées selon data_retention_settings.sophie_chat_months (12 mois par défaut)';

CREATE INDEX idx_sophie_conversations_user ON public.sophie_conversations(user_id, updated_at DESC);

CREATE TABLE public.sophie_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '' CHECK (char_length(content) <= 20000),
  -- Page d'où le message a été écrit : { page, entity_type, entity_id }, jamais les données lues
  context JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context) = 'object'),
  -- error : la réponse n'a pas abouti (le message d'erreur est montré tel quel, jamais une fausse réponse)
  status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'error')),
  error TEXT CHECK (char_length(error) <= 1000),
  provider TEXT,
  model TEXT,
  input_tokens INTEGER CHECK (input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens >= 0),
  latency_ms INTEGER CHECK (latency_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id, user_id) REFERENCES public.sophie_conversations(id, user_id) ON DELETE CASCADE,
  CHECK (status <> 'error' OR error IS NOT NULL)
);

COMMENT ON TABLE public.sophie_messages IS 'Messages d''une conversation avec Sophie. Le contexte ne contient que la page et l''identifiant de l''entité ; provider, model, jetons et durée servent à mesurer coûts et erreurs';

CREATE INDEX idx_sophie_messages_conversation ON public.sophie_messages(conversation_id, created_at);
-- Plafond quotidien : messages envoyés par l'utilisateur depuis minuit
CREATE INDEX idx_sophie_messages_user_day ON public.sophie_messages(user_id, created_at) WHERE role = 'user';

-- ---------------------------------------------------------------------
-- Droits : lecture, renommage et suppression par l'utilisateur ; écriture
-- des messages par la fonction serveur seulement
-- ---------------------------------------------------------------------
ALTER TABLE public.sophie_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sophie_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own conversations"
  ON public.sophie_conversations FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Users rename their own conversations"
  ON public.sophie_conversations FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users delete their own conversations"
  ON public.sophie_conversations FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Seuls le titre et son origine se modifient depuis l'application
REVOKE INSERT, UPDATE ON public.sophie_conversations FROM anon, authenticated;
GRANT UPDATE (title, title_set_by) ON public.sophie_conversations TO authenticated;

CREATE POLICY "Users read their own Sophie messages"
  ON public.sophie_messages FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.sophie_messages FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- Préférences : ouverture automatique sur l'accueil, plafond quotidien
-- ---------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN sophie_auto_open BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN sophie_daily_messages INTEGER NOT NULL DEFAULT 100 CHECK (sophie_daily_messages BETWEEN 10 AND 1000);

COMMENT ON COLUMN public.user_profiles.sophie_auto_open IS 'Sophie s''ouvre à l''arrivée sur le tableau de bord (une fois par session)';
COMMENT ON COLUMN public.user_profiles.sophie_daily_messages IS 'Messages à Sophie au plus par jour (heure de Paris) : plafond de consommation de la clé IA de l''utilisateur';

-- ---------------------------------------------------------------------
-- Conservation : 12 mois par défaut, réglable ; nettoyage chaque nuit
-- ---------------------------------------------------------------------
ALTER TABLE public.data_retention_settings
  ADD COLUMN sophie_chat_months INTEGER NOT NULL DEFAULT 12 CHECK (sophie_chat_months IN (3, 6, 12, 24));

COMMENT ON COLUMN public.data_retention_settings.sophie_chat_months IS 'Conversations avec Sophie supprimées après ce nombre de mois sans nouveau message';
GRANT UPDATE (sophie_chat_months) ON public.data_retention_settings TO authenticated;

CREATE FUNCTION public.purge_old_sophie_conversations()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH removed AS (
    DELETE FROM public.sophie_conversations c
     WHERE c.updated_at < now() - make_interval(months => coalesce(
             (SELECT r.sophie_chat_months FROM public.data_retention_settings r WHERE r.user_id = c.user_id),
             12
           ))
    RETURNING 1
  )
  SELECT count(*)::integer FROM removed;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_sophie_conversations() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('sophie-conversations-retention', '55 3 * * *', $$ SELECT public.purge_old_sophie_conversations(); $$);
