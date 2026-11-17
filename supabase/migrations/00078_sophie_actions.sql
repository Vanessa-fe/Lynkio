-- =====================================================================
-- ACTIONS PROPOSÉES PAR SOPHIE (phase 4 de la refonte)
-- Sophie ne modifie jamais rien seule : elle PROPOSE une action (noter un
-- échange, programmer une relance, changer une étape, commencer à
-- prospecter, lancer une recherche), affichée dans un récapitulatif.
-- L'action n'est exécutée que si l'utilisateur clique « Confirmer », par
-- les mêmes fonctions que les écrans (mêmes vérifications).
--
-- Une action ne s'exécute qu'une fois : le passage proposed -> confirmed
-- se fait en une seule requête conditionnelle (idempotence) ; une
-- proposition non confirmée expire au bout de 24 heures.
-- Journal : statut, dates et résultat restent consultables.
-- =====================================================================

CREATE TABLE public.sophie_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID,
  kind TEXT NOT NULL CHECK (kind IN ('log_activity', 'create_reminder', 'change_stage', 'start_prospecting', 'launch_search')),
  company_id UUID,
  -- Arguments vérifiés par la fonction sophie-chat ; revérifiés à l'exécution
  args JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(args) = 'object'),
  summary TEXT NOT NULL CHECK (char_length(summary) <= 500),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'executed', 'failed', 'refused')),
  result JSONB,
  error TEXT CHECK (char_length(error) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  FOREIGN KEY (conversation_id, user_id) REFERENCES public.sophie_conversations(id, user_id) ON DELETE SET NULL (conversation_id),
  FOREIGN KEY (company_id, user_id) REFERENCES public.companies(id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.sophie_actions IS 'Actions proposées par Sophie et leur sort : exécutées seulement après confirmation de l''utilisateur, une seule fois (proposed -> confirmed conditionnel), expirées après 24 h';

CREATE INDEX idx_sophie_actions_user ON public.sophie_actions(user_id, created_at DESC);

ALTER TABLE public.sophie_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own Sophie actions"
  ON public.sophie_actions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
-- L'utilisateur décide (confirmer, refuser) et le serveur du site note le résultat, avec ses droits ;
-- les arguments et le récapitulatif ne se modifient pas
CREATE POLICY "Users decide their own Sophie actions"
  ON public.sophie_actions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.sophie_actions FROM anon, authenticated;
GRANT UPDATE (status, result, error, decided_at, executed_at) ON public.sophie_actions TO authenticated;
