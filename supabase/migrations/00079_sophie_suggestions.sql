-- =====================================================================
-- SUGGESTIONS PROACTIVES DE SOPHIE (phase 5 de la refonte)
-- Sophie propose d'elle-même quelques actions tirées de RÈGLES (sans IA) :
-- relance prévue, prospect sans réponse, dirigeant pas encore contacté,
-- nouvelles entreprises. « Ignorer » est mémorisé ici pour ne pas répéter
-- une suggestion ; chaque clé désigne un cas précis (une relance, un envoi,
-- un contact), donc un nouveau cas redonne une nouvelle suggestion.
-- Préférence : afficher ou non ces suggestions.
-- Ajout seulement.
-- =====================================================================

CREATE TABLE public.sophie_suggestion_states (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (char_length(key) <= 120),
  status TEXT NOT NULL DEFAULT 'dismissed' CHECK (status IN ('dismissed', 'done')),
  -- Vide : pour toujours ; sinon la suggestion peut revenir après cette date
  until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

COMMENT ON TABLE public.sophie_suggestion_states IS 'Suggestions de Sophie écartées (« Ignorer ») : ne pas les répéter';

ALTER TABLE public.sophie_suggestion_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own Sophie suggestion states"
  ON public.sophie_suggestion_states FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE public.user_profiles
  ADD COLUMN sophie_suggestions BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_profiles.sophie_suggestions IS 'Afficher les suggestions proactives de Sophie (règles, sans IA)';

-- Correctif : l'enregistrement des durées de conservation (upsert) envoie aussi user_id dans la mise à
-- jour ; sans ce droit, la base refusait (403) dès que la ligne existait. La règle de sécurité impose
-- toujours user_id = l'utilisateur connecté : il ne peut pas désigner quelqu'un d'autre.
GRANT UPDATE (user_id) ON public.data_retention_settings TO authenticated;
