-- =====================================================================
-- CARTES DES RÉPONSES DE SOPHIE (phase 3 de la refonte)
-- Une réponse peut s'accompagner de cartes : recherche proposée (à valider),
-- brouillon de message (à relire, jamais envoyé par Sophie), liste
-- d'entreprises (priorités, relances). Elles sont gardées avec le message
-- pour réapparaître dans l'historique. Les outils utilisés sont notés pour
-- mesurer leur utilité, sans leurs résultats complets.
-- Ajout seulement.
-- =====================================================================

ALTER TABLE public.sophie_messages
  ADD COLUMN cards JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(cards) = 'array'),
  ADD COLUMN tools TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.sophie_messages.cards IS 'Cartes affichées avec la réponse : search_proposal, outreach_draft, companies (données de présentation, sans copie des fiches)';
COMMENT ON COLUMN public.sophie_messages.tools IS 'Outils utilisés pour cette réponse (noms seulement), pour mesurer leur utilité';
