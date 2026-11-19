-- =====================================================================
-- IA INCLUSE DANS L'OFFRE PRO (décision du 19/11/2026)
-- Un compte Pro, ou en essai, sans clé personnelle utilise la clé de Filonea, dans la limite
-- de quotas par mois (supabase/functions/_shared/ai-quota.ts). Chaque appel réussi fait avec
-- la clé de Filonea est compté ici. Rien n'est compté avec la clé de l'utilisateur.
-- Lisible par son propriétaire (quotas restants dans Paramètres > Vos clés) ; seules les
-- fonctions du serveur écrivent. Effacé avec le compte ; lignes de plus de 13 mois supprimées.
-- =====================================================================

CREATE TABLE public.ai_usage (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('draft', 'chat', 'deep_dive', 'assistant', 'linkedin_sort')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_usage IS 'Appels d''IA faits avec la clé de Filonea (IA incluse dans Pro), pour les quotas par mois';

CREATE INDEX ai_usage_user_action_created_idx ON public.ai_usage (user_id, action, created_at);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_select_own" ON public.ai_usage
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
-- Pas de règle d'écriture : seul le serveur (service_role) ajoute des lignes

REVOKE ALL ON public.ai_usage FROM anon;
GRANT SELECT ON public.ai_usage TO authenticated;

-- Ménage : les compteurs de plus de 13 mois ne servent plus
SELECT cron.schedule(
  'ai-usage-cleanup',
  '17 4 1 * *',
  $$DELETE FROM public.ai_usage WHERE created_at < now() - INTERVAL '13 months'$$
);
