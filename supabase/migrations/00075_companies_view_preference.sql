-- =====================================================================
-- VUE PRÉFÉRÉE DE LA PAGE ENTREPRISES (lot 1.9 de la refonte)
-- Entreprises et Pipeline commercial sont réunis : une page, deux vues
-- (Tableau, Kanban). Le dernier choix est gardé sur le compte, pas
-- seulement dans le navigateur : on le retrouve sur un autre appareil.
-- Ajout seulement.
-- =====================================================================

ALTER TABLE user_profiles
  ADD COLUMN companies_view TEXT NOT NULL DEFAULT 'table' CHECK (companies_view IN ('table', 'kanban'));

COMMENT ON COLUMN user_profiles.companies_view IS 'Dernière vue choisie sur la page Entreprises : table (tableau) ou kanban';
