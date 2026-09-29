-- =====================================================================
-- CHIFFRES CLÉS DES ENTREPRISES
-- Chiffre d'affaires et résultat du dernier exercice publié (API Recherche
-- d'entreprises, gratuite). Ils servent à juger si l'entreprise peut payer
-- une mission au tarif journalier de l'utilisatrice. Beaucoup de petites
-- entreprises rendent leurs comptes confidentiels : les colonnes restent vides.
-- =====================================================================

ALTER TABLE companies
  ADD COLUMN revenue BIGINT,
  ADD COLUMN net_income BIGINT,
  ADD COLUMN finances_year SMALLINT CHECK (finances_year BETWEEN 1900 AND 2100);

COMMENT ON COLUMN companies.revenue IS 'Chiffre d''affaires du dernier exercice publié, en euros';
COMMENT ON COLUMN companies.net_income IS 'Résultat net du dernier exercice publié, en euros';
COMMENT ON COLUMN companies.finances_year IS 'Année de l''exercice de revenue et net_income';
