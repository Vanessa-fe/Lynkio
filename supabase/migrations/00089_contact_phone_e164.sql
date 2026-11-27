-- =====================================================================
-- TÉLÉPHONE DES CONTACTS AU FORMAT INTERNATIONAL E.164 (+33…, +32…)
-- À appliquer seulement une fois en ligne le code qui normalise tous les numéros (src/lib/phone.ts :
-- formulaires de contact et de personne, import CSV) : l'ancien code enregistrait tel quel un numéro
-- qu'il ne savait pas lire, et ces écritures échoueraient.
-- Le 27/11/2026, aucun contact n'avait de téléphone : rien à reprendre.
-- =====================================================================

ALTER TABLE public.company_contacts
  ADD CONSTRAINT company_contacts_phone_e164_check
  CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$');

COMMENT ON COLUMN public.company_contacts.phone IS
  'Téléphone au format international E.164 (+33…, +32…), normalisé par le code avant écriture (src/lib/phone.ts)';
