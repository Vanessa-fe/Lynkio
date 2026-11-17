-- =====================================================================
-- ÉTAPES PAR DÉFAUT DES NOUVEAUX COMPTES (lot 1.8d de la refonte)
-- Décisions du 17/11/2026 :
--   - six étapes en cours par défaut : À contacter, Contacté, En
--     discussion, Rendez-vous, Proposition envoyée, Négociation ;
--   - plus de « À qualifier » : une entreprise trouvée est une
--     découverte (companies.engaged_at vide, 00072), pas une étape ;
--   - plus de « Relancé » : une relance est une activité (00073) ;
--   - résultats : Signé, Non concrétisé, Sans suite, Hors cible
--     (plus de « Gagné » ni de « Perdu »).
-- « À contacter » devient l'étape d'arrivée : une découverte y attend,
-- hors du pipeline actif, que l'utilisateur commence à la prospecter.
--
-- NOUVEAUX COMPTES SEULEMENT : la fonction ne crée les étapes que pour un
-- compte qui n'en a aucune. Les pipelines existants ne sont pas touchés.
-- Chaque étape reçoit son rôle (00071) : Sophie et les statistiques la
-- comprennent même si l'utilisateur la renomme.
-- =====================================================================

CREATE OR REPLACE FUNCTION initialize_prospection_defaults()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE user_id = uid) THEN
    INSERT INTO pipeline_stages (user_id, name, color, kind, role, "order", is_default) VALUES
      (uid, 'À contacter',         '#3b82f6', 'open',     'to_contact',    0, true),
      (uid, 'Contacté',            '#f59e0b', 'open',     'contacted',     1, false),
      (uid, 'En discussion',       '#06b6d4', 'open',     'in_discussion', 2, false),
      (uid, 'Rendez-vous',         '#0ea5e9', 'open',     'meeting',       3, false),
      (uid, 'Proposition envoyée', '#6366f1', 'open',     'proposal',      4, false),
      (uid, 'Négociation',         '#8b5cf6', 'open',     'negotiation',   5, false),
      (uid, 'Signé',               '#22c55e', 'won',      NULL,            6, false),
      (uid, 'Non concrétisé',      '#ef4444', 'lost',     'not_concluded', 7, false),
      (uid, 'Sans suite',          '#a8a29e', 'lost',     'no_follow_up',  8, false),
      (uid, 'Hors cible',          '#6b7280', 'excluded', NULL,            9, false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM lead_sources WHERE user_id = uid) THEN
    INSERT INTO lead_sources (user_id, name, icon, "order") VALUES
      (uid, 'Détection automatique', 'radar',      0),
      (uid, 'LinkedIn',              'linkedin',   1),
      (uid, 'Recommandation',        'users',      2),
      (uid, 'Réseau',                'network',    3),
      (uid, 'Événement',             'calendar',   4),
      (uid, 'Autre',                 'help-circle', 5);
  END IF;

  -- Premier ICP, pré-rempli avec les critères par défaut du métier choisi
  IF NOT EXISTS (SELECT 1 FROM icp_profiles WHERE user_id = uid) THEN
    INSERT INTO icp_profiles (user_id, profession_key, name, criteria)
    SELECT uid, p.key, 'Mon client idéal', p.default_icp
      FROM user_profiles up
      JOIN professions p ON p.key = up.profession_key
     WHERE up.id = uid;
  END IF;
END;
$$;
