-- =====================================================================
-- SUIVI COMMERCIAL DES ENTREPRISES
-- Ce que la base Notion « Prospection » suivait en plus du pipeline :
-- le montant que la mission pourrait rapporter et la prochaine chose à
-- faire. La date de la prochaine relance reste dans `reminders`.
-- =====================================================================

ALTER TABLE companies
  ADD COLUMN estimated_amount INTEGER CHECK (estimated_amount BETWEEN 0 AND 10000000),
  ADD COLUMN next_action TEXT CHECK (length(next_action) <= 300);

COMMENT ON COLUMN companies.estimated_amount IS 'Montant estimé de la mission, en euros hors taxes';
COMMENT ON COLUMN companies.next_action IS 'Prochaine action prévue avec l''entreprise (« Envoyer le devis »…)';
