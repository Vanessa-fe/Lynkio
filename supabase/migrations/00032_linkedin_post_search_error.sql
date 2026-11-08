-- =====================================================================
-- RECHERCHE DE POSTS : CE QUI L'EMPÊCHE DE LIRE LINKEDIN
-- L'extension lit la page de recherche affichée par LinkedIn. Si LinkedIn
-- change sa mise en page, elle le note ici pour que Filonea l'affiche ;
-- l'envoi automatique, lui, continue. La fonction linkedin-posts efface la
-- raison à la recherche suivante réussie.
-- =====================================================================

ALTER TABLE linkedin_automation
  ADD COLUMN post_search_error TEXT CHECK (post_search_error IS NULL OR length(post_search_error) <= 300);
