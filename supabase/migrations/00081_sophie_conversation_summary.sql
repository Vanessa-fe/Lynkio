-- =====================================================================
-- RÉSUMÉ DES LONGUES CONVERSATIONS AVEC SOPHIE (fin de la phase 2)
-- Sophie relit les messages écrits depuis le dernier résumé (30 au plus).
-- Au-delà de 24, les plus anciens sont condensés en arrière-plan, après la
-- réponse, dans un résumé court qui reprend le précédent : elle garde le fil
-- (entreprises citées, décisions, actions, questions en suspens) sans relire
-- toute la conversation à chaque message.
-- summary_until : date du dernier message pris en compte dans le résumé.
-- Ajout seulement.
-- =====================================================================

ALTER TABLE public.sophie_conversations
  ADD COLUMN summary TEXT CHECK (char_length(summary) <= 4000),
  ADD COLUMN summary_until TIMESTAMPTZ;

COMMENT ON COLUMN public.sophie_conversations.summary IS 'Résumé automatique des messages anciens (rédigé par l''IA de l''utilisateur, modèle léger), relu par Sophie à la place de ces messages';
COMMENT ON COLUMN public.sophie_conversations.summary_until IS 'Date du dernier message pris en compte dans le résumé';
